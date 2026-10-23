import asyncio
import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

import httpx

from .audio import Player, wav_duration_s
from .personas import ENGINE_NAMES, Expression

log = logging.getLogger(__name__)

_SENTENCE_END = re.compile(r"[。！？!?\n]+")
_CLAUSE_END = re.compile(r"[、，,]")
# これより長くなった文は読点でも区切って先に合成に回す。CPUだけのVOICEVOX・AivisSpeechは合成が実時間と同程度に
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
    # 強調の時刻（[再生開始からの秒, 強さ 0〜1]）。アバターがうなずきや手の振りを合わせる
    beats: list[tuple[float, float]] = field(default_factory=list)


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
    # 合成に使うエンジン（personas.ENGINE_NAMES のキー）
    engine: str = "voicevox"


# これより近いビートはまとめる（細かすぎるうなずきは落ち着きがなく見える）
MIN_BEAT_INTERVAL_S = 0.35


def speech_beats(query: dict) -> list[tuple[float, float]]:
    """
    VOICEVOX の audio_query から、各アクセント句のアクセント核（高く発音される最後の拍）の開始時刻と、
    文の中での音の高さの相対値を求める。身振りの「ストローク（強調）」は言葉の強調とほぼ同時に来るので、ここに合わせる
    """
    speed = query.get("speedScale") or 1.0
    t = query["prePhonemeLength"]
    raw: list[tuple[float, float]] = []
    for phrase in query["accent_phrases"]:
        moras = phrase["moras"]
        nucleus = min(max(phrase.get("accent", 1), 1), len(moras)) - 1
        pitch = max((m["pitch"] for m in moras), default=0.0)
        for index, mora in enumerate(moras):
            if index == nucleus:
                raw.append((t / speed, pitch))
            t += (mora.get("consonant_length") or 0) + mora["vowel_length"]
        if pause := phrase.get("pause_mora"):
            t += pause["vowel_length"]

    voiced = [pitch for _, pitch in raw if pitch > 0]
    if not voiced:
        return []
    low, high = min(voiced), max(voiced)
    beats: list[tuple[float, float]] = []
    for time, pitch in raw:
        strength = 0.5 if high - low < 1e-6 else 0.3 + 0.7 * (pitch - low) / (high - low)
        if beats and time - beats[-1][0] < MIN_BEAT_INTERVAL_S:
            if strength > beats[-1][1]:
                beats[-1] = (beats[-1][0], round(strength, 2))
            continue
        beats.append((round(time, 3), round(strength, 2)))
    return beats


# 拍の長さを見積もるときの重み。読点などの間（pau）は普通の拍より長く、促音（cl）は短い
_MORA_WEIGHTS = {"pau": 2.0, "cl": 0.6}
_CONSONANT_SHARE = 0.35


def estimate_lengths(query: dict, duration_s: float) -> dict:
    """
    音素ごとの長さを返さないエンジン（AivisSpeech は audio_query の長さ・高さがすべて 0）のために、合成した音声の
    実際の長さを拍に配って、VOICEVOX と同じ形の audio_query を作る（口パク・身振りの計算をそのまま使えるように）。
    拍ごとの長さは実際とずれるが、文の始まりと終わりは音声と揃う
    """
    speed = query.get("speedScale") or 1.0
    pre, post = query["prePhonemeLength"], query["postPhonemeLength"]
    moras = [m for phrase in query["accent_phrases"] for m in [*phrase["moras"], phrase.get("pause_mora")] if m]
    weights = [_MORA_WEIGHTS.get(m["vowel"], 1.0) for m in moras]
    body = max(duration_s * speed - pre - post, 0.0)
    unit = body / sum(weights) if weights else 0.0
    estimated = {**query, "accent_phrases": []}
    for phrase in query["accent_phrases"]:
        filled = {**phrase, "moras": [_fill(m, unit) for m in phrase["moras"]]}
        if phrase.get("pause_mora"):
            filled["pause_mora"] = _fill(phrase["pause_mora"], unit)
        estimated["accent_phrases"].append(filled)
    return estimated


def _fill(mora: dict, unit: float) -> dict:
    length = unit * _MORA_WEIGHTS.get(mora["vowel"], 1.0)
    consonant = length * _CONSONANT_SHARE if mora.get("consonant") else 0.0
    voiced = mora["vowel"] in ("a", "i", "u", "e", "o")
    # 高さは分からないので、声のある拍を同じ高さにする（身振りの強さはどれも同じになる）
    return {**mora, "consonant_length": consonant, "vowel_length": length - consonant, "pitch": 1.0 if voiced else 0.0}


class VoiceVox:
    """VOICEVOX Engine と、同じ API を持つエンジン（AivisSpeech Engine）"""

    def __init__(self, base_url: str, estimate_timing: bool = False) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=60)
        self.base_url = base_url
        # 音素ごとの長さを返さないエンジンか（AivisSpeech）
        self._estimate_timing = estimate_timing

    async def synthesize(self, text: str, voice: Voice) -> Speech:
        res = await self._client.post("/audio_query", params={"text": text, "speaker": voice.speaker})
        res.raise_for_status()
        query = res.json()
        query["speedScale"] = voice.speed
        res = await self._client.post("/synthesis", params={"speaker": voice.speaker}, json=query)
        res.raise_for_status()
        if self._estimate_timing:
            query = estimate_lengths(query, wav_duration_s(res.content))
        cues, duration = mouth_cues(query)
        return Speech(res.content, cues, duration, beats=speech_beats(query))

    async def speaker_ids(self) -> set[int] | None:
        """使える話者（スタイル）のID。エンジンにつながらなければ None（確かめない）"""
        try:
            res = await self._client.get("/speakers")
            res.raise_for_status()
        except httpx.HTTPError:
            return None
        return {style["id"] for speaker in res.json() for style in speaker["styles"]}

    async def check(self) -> str:
        res = await self._client.get("/version")
        res.raise_for_status()
        return res.json()


class Synthesizer:
    """Voice.engine で合成エンジンを選ぶ"""

    def __init__(self, engines: dict[str, VoiceVox]) -> None:
        self.engines = engines

    async def synthesize(self, text: str, voice: Voice) -> Speech:
        engine = self.engines.get(voice.engine)
        if engine is None:
            raise httpx.HTTPError(f"合成エンジン {voice.engine} がありません")
        return await engine.synthesize(text, voice)

    async def speaker_ids(self) -> dict[str, set[int] | None]:
        return {name: await engine.speaker_ids() for name, engine in self.engines.items()}


_END = object()


class SpeechQueue:
    """
    文を順に合成・再生する。合成と再生を別タスクにして、1文目を再生している間に2文目を合成しておく
    （返答の書き出しから声が出るまでの待ち時間と、文と文の間の途切れを短くするため）。
    """

    def __init__(
        self, tts: Synthesizer, voice: Voice, player: Player, on_play: Callable[[Speech, bool], Awaitable[None]]
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
                engine=expression.engine if expression and expression.engine else self._voice.engine,
            )
            speech = await self._synthesize(piece.text, voice)
            # 表情の声（スタイル）が無いときは、黙るよりキャラクターのふだんの声で読む（エンジンを替えて表情の声を直し忘れたときなど）
            if speech is None and voice != self._voice:
                speech = await self._synthesize(piece.text, self._voice)
            if speech is not None:
                speech.expression = expression
                await self._audio.put(speech)
        await self._audio.put(_END)

    async def _synthesize(self, text: str, voice: Voice) -> Speech | None:
        try:
            return await self._tts.synthesize(text, voice)
        except httpx.HTTPError as err:
            log.error("%sでの音声合成に失敗しました（話者ID %s）: %s", ENGINE_NAMES.get(voice.engine, voice.engine), voice.speaker, err)
            return None

    async def _play_loop(self) -> None:
        first = True
        while (speech := await self._audio.get()) is not _END:
            await self._on_play(speech, first)
            first = False
            await self._player.play(speech.wav)
