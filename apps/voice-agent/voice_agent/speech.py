import asyncio
import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx

from .audio import Player
from .personas import Expression

log = logging.getLogger(__name__)

_SENTENCE_END = re.compile(r"[。！？!?\n]+")
_CLAUSE_END = re.compile(r"[、，,]")
# これより長くなった文は読点でも区切って先に合成に回す。CPUだけのVOICEVOXは合成が実時間と同程度に
# かかるので、1文丸ごと待つと声が出るまで何秒も空く
MIN_CLAUSE_CHARS = 12
_MARKDOWN = re.compile(r"[*_#`>|]+|^\s*[-・]\s+", re.M)
_OPEN_PARENS = "（("
_CLOSE_PARENS = "）)"
_PARENTHESIZED = re.compile(r"[（(]([^（）()]*)[）)]")
_UNCLOSED = re.compile(r"[（(][^（）()]*$")
_URL = re.compile(r"https?://\S+")
# 描写か本文の補足かを見分ける目安。「（333メートル）」のように数字を含むものや、長いものは本文の補足として残す
_DIRECTION_MAX_CHARS = 30
_DIGITS = re.compile(r"[0-9０-９]")


class Directions:
    """
    返答の中の（ ）を、表情と声のトーンの指定として読む。（ ）自体は画面にも読み上げにも出さない。

    Claude には（表情名）だけを書くよう指示しているが、「（嬉しそうに耳を動かす）」のような描写を書いてしまうこともある。
    キャラクターを演じているとき（hide_descriptions）は、そうした描写も隠し、keywords から近い表情を選ぶ。
    """

    def __init__(self, expressions: dict[str, Expression], hide_descriptions: bool) -> None:
        self._expressions = expressions
        self._hide_descriptions = hide_descriptions

    def is_direction(self, content: str) -> bool:
        content = content.strip()
        if content in self._expressions:
            return True
        return self._hide_descriptions and len(content) <= _DIRECTION_MAX_CHARS and not _DIGITS.search(content)

    def resolve(self, content: str) -> Expression | None:
        content = content.strip()
        if content in self._expressions:
            return self._expressions[content]
        for expression in self._expressions.values():
            if any(keyword in content for keyword in expression.keywords):
                return expression
        return None

    def strip(self, text: str) -> tuple[str, Expression | None]:
        """（ ）の指定を取り除き、最後に指定された表情を返す"""
        found: list[Expression] = []

        def replace(match: re.Match[str]) -> str:
            if not self.is_direction(match.group(1)):
                return match.group(0)
            if expression := self.resolve(match.group(1)):
                found.append(expression)
            return ""

        return _PARENTHESIZED.sub(replace, text), (found[-1] if found else None)

    def visible(self, text: str) -> str:
        """画面に出す返答。ストリーミングの途中で閉じていない（ ）も、指定の書きかけとみなして隠す"""
        stripped, _ = self.strip(text)
        if (unclosed := _UNCLOSED.search(stripped)) and self._hide_descriptions:
            stripped = stripped[: unclosed.start()]
        return re.sub(r"[ 　]{2,}", " ", stripped)


@dataclass(frozen=True)
class Piece:
    """読み上げる1区切りと、そのときの表情（返答の中で最後に指定されたものが続く）"""

    text: str
    expression: Expression | None = None


class SentenceSplitter:
    """ストリーミングで届く返答を文（長ければ読点）単位に区切り、区切れるたびに読み上げに回せるようにする"""

    def __init__(self, directions: Directions | None = None) -> None:
        self._pending = ""
        self._directions = directions
        self._expression: Expression | None = None

    def feed(self, delta: str) -> list[Piece]:
        self._pending += delta
        pieces = []
        while (end := self._next_break()) is not None:
            pieces += self._piece(self._pending[:end])
            self._pending = self._pending[end:]
        return pieces

    def flush(self) -> list[Piece]:
        rest, self._pending = self._pending, ""
        return self._piece(rest)

    def _piece(self, raw: str) -> list[Piece]:
        if self._directions:
            raw, expression = self._directions.strip(raw)
            if expression:
                # 表情だけの区切り（「（ドヤ顔）」）は、次に読み上げる文に効かせる
                self._expression = expression
        text = clean_for_speech(raw)
        return [Piece(text, self._expression)] if text else []

    def _next_break(self) -> int | None:
        # （ ）の途中では区切らない（区切ると閉じ括弧の無い断片になり、指定として取り除けなくなる）
        depth_at = self._paren_depths()
        sentence = next((m for m in _SENTENCE_END.finditer(self._pending) if depth_at[m.start()] == 0), None)
        limit = sentence.start() if sentence else len(self._pending)
        for clause in _CLAUSE_END.finditer(self._pending, 0, limit):
            if clause.start() >= MIN_CLAUSE_CHARS and depth_at[clause.start()] == 0:
                return clause.end()
        return sentence.end() if sentence else None

    def _paren_depths(self) -> list[int]:
        depths, depth = [], 0
        for ch in self._pending:
            if ch in _OPEN_PARENS:
                depth += 1
            elif ch in _CLOSE_PARENS:
                depth = max(0, depth - 1)
            depths.append(depth)
        return depths


def clean_for_speech(text: str) -> str:
    """指示していても混ざることがある記号やURLを、読み上げ前に落とす"""
    text = _URL.sub("", text)
    text = _MARKDOWN.sub("", text)
    # 指定を取り除いた後の句読点だけの断片は読まない
    return "" if not re.search(r"[^\s、。！？!?,.，]", text) else text.strip()


@dataclass
class Speech:
    wav: bytes
    # 口の形の時系列（[再生開始からの秒, 母音]）。アバターの口パクに使う。母音は a/i/u/e/o、口を閉じるのは N/cl/pau
    mouth_cues: list[tuple[float, str]]
    duration_s: float
    expression: Expression | None = None


def mouth_cues(query: dict) -> tuple[list[tuple[float, str]], float]:
    """
    VOICEVOX の audio_query（音素ごとの長さ）から、口の形の時系列と全体の長さを求める。
    合成した音声の長さとの差は実測で20ms程度で、口パクには十分な精度。
    """
    speed = query.get("speedScale") or 1.0
    t = query["prePhonemeLength"]
    cues: list[tuple[float, str]] = [(0.0, "pau")]
    for phrase in query["accent_phrases"]:
        for mora in phrase["moras"]:
            t += mora.get("consonant_length") or 0
            cues.append((round(t / speed, 3), mora["vowel"]))
            t += mora["vowel_length"]
        if pause := phrase.get("pause_mora"):
            cues.append((round(t / speed, 3), "pau"))
            t += pause["vowel_length"]
    cues.append((round(t / speed, 3), "pau"))
    t += query["postPhonemeLength"]
    return cues, round(t / speed, 3)


@dataclass(frozen=True)
class Voice:
    speaker: int
    speed: float


class VoiceVox:
    def __init__(self, base_url: str) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=60)

    async def synthesize(self, text: str, voice: Voice) -> Speech:
        res = await self._client.post("/audio_query", params={"text": text, "speaker": voice.speaker})
        res.raise_for_status()
        query = res.json()
        query["speedScale"] = voice.speed
        res = await self._client.post("/synthesis", params={"speaker": voice.speaker}, json=query)
        res.raise_for_status()
        cues, duration = mouth_cues(query)
        return Speech(res.content, cues, duration)

    async def check(self) -> str:
        res = await self._client.get("/version")
        res.raise_for_status()
        return res.json()


_END = object()


class SpeechQueue:
    """
    文を順に合成・再生する。合成と再生を別タスクにして、1文目を再生している間に2文目を合成しておく
    （返答の書き出しから声が出るまでの待ち時間と、文と文の間の途切れを短くするため）。
    """

    def __init__(
        self, tts: VoiceVox, voice: Voice, player: Player, on_play: Callable[[Speech, bool], Awaitable[None]]
    ) -> None:
        """on_play(speech, first) は各文の再生を始める直前に呼ばれる"""
        self._tts = tts
        self._voice = voice
        self._player = player
        self._on_play = on_play
        self._texts: asyncio.Queue = asyncio.Queue()
        self._audio: asyncio.Queue = asyncio.Queue(maxsize=2)
        self._tasks = [asyncio.create_task(self._synthesize_loop()), asyncio.create_task(self._play_loop())]

    def say(self, piece: Piece) -> None:
        self._texts.put_nowait(piece)

    async def finish(self) -> None:
        """投入済みの文をすべて読み上げ終えるまで待つ"""
        self._texts.put_nowait(_END)
        await asyncio.gather(*self._tasks)

    def cancel(self) -> None:
        for task in self._tasks:
            task.cancel()
        self._player.stop()

    async def _synthesize_loop(self) -> None:
        while (piece := await self._texts.get()) is not _END:
            expression = piece.expression
            # 表情によっては声のスタイル（ささやき・ツンツンなど）も変える
            voice = Voice(
                speaker=expression.speaker if expression and expression.speaker is not None else self._voice.speaker,
                speed=expression.speed if expression and expression.speed is not None else self._voice.speed,
            )
            try:
                speech = await self._tts.synthesize(piece.text, voice)
                speech.expression = expression
                await self._audio.put(speech)
            except httpx.HTTPError as err:
                log.error("VOICEVOXでの音声合成に失敗しました: %s", err)
        await self._audio.put(_END)

    async def _play_loop(self) -> None:
        first = True
        while (speech := await self._audio.get()) is not _END:
            await self._on_play(speech, first)
            first = False
            await self._player.play(speech.wav)
