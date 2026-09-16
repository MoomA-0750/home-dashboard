import asyncio
import logging
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import httpx

from .audio import Player

log = logging.getLogger(__name__)

_SENTENCE_END = re.compile(r"[。！？!?\n]+")
_CLAUSE_END = re.compile(r"[、，,]")
# これより長くなった文は読点でも区切って先に合成に回す。CPUだけのVOICEVOXは合成が実時間と同程度に
# かかるので、1文丸ごと待つと声が出るまで何秒も空く
MIN_CLAUSE_CHARS = 12
_MARKDOWN = re.compile(r"[*_#`>|]+|^\s*[-・]\s+", re.M)
_URL = re.compile(r"https?://\S+")


class SentenceSplitter:
    """ストリーミングで届く返答を文（長ければ読点）単位に区切り、区切れるたびに読み上げに回せるようにする"""

    def __init__(self) -> None:
        self._pending = ""

    def feed(self, delta: str) -> list[str]:
        self._pending += delta
        sentences = []
        while (end := self._next_break()) is not None:
            sentences.append(self._pending[:end])
            self._pending = self._pending[end:]
        return [s for s in (clean_for_speech(s) for s in sentences) if s]

    def _next_break(self) -> int | None:
        sentence = _SENTENCE_END.search(self._pending)
        limit = sentence.start() if sentence else len(self._pending)
        for clause in _CLAUSE_END.finditer(self._pending, 0, limit):
            if clause.start() >= MIN_CLAUSE_CHARS:
                return clause.end()
        return sentence.end() if sentence else None

    def flush(self) -> list[str]:
        rest, self._pending = clean_for_speech(self._pending), ""
        return [rest] if rest else []


def clean_for_speech(text: str) -> str:
    """指示していても混ざることがある記号やURLを、読み上げ前に落とす"""
    text = _URL.sub("", text)
    text = _MARKDOWN.sub("", text)
    return text.strip()


@dataclass
class Speech:
    wav: bytes
    # 口の形の時系列（[再生開始からの秒, 母音]）。アバターの口パクに使う。母音は a/i/u/e/o、口を閉じるのは N/cl/pau
    mouth_cues: list[tuple[float, str]]
    duration_s: float


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


class VoiceVox:
    def __init__(self, base_url: str, speaker: int, speed: float) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=60)
        self._speaker = speaker
        self._speed = speed

    async def synthesize(self, text: str) -> Speech:
        res = await self._client.post("/audio_query", params={"text": text, "speaker": self._speaker})
        res.raise_for_status()
        query = res.json()
        query["speedScale"] = self._speed
        res = await self._client.post("/synthesis", params={"speaker": self._speaker}, json=query)
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

    def __init__(self, tts: VoiceVox, player: Player, on_play: Callable[[Speech, bool], Awaitable[None]]) -> None:
        """on_play(speech, first) は各文の再生を始める直前に呼ばれる"""
        self._tts = tts
        self._player = player
        self._on_play = on_play
        self._texts: asyncio.Queue = asyncio.Queue()
        self._audio: asyncio.Queue = asyncio.Queue(maxsize=2)
        self._tasks = [asyncio.create_task(self._synthesize_loop()), asyncio.create_task(self._play_loop())]

    def say(self, text: str) -> None:
        self._texts.put_nowait(text)

    async def finish(self) -> None:
        """投入済みの文をすべて読み上げ終えるまで待つ"""
        self._texts.put_nowait(_END)
        await asyncio.gather(*self._tasks)

    def cancel(self) -> None:
        for task in self._tasks:
            task.cancel()
        self._player.stop()

    async def _synthesize_loop(self) -> None:
        while (text := await self._texts.get()) is not _END:
            try:
                await self._audio.put(await self._tts.synthesize(text))
            except httpx.HTTPError as err:
                log.error("VOICEVOXでの音声合成に失敗しました: %s", err)
        await self._audio.put(_END)

    async def _play_loop(self) -> None:
        first = True
        while (speech := await self._audio.get()) is not _END:
            await self._on_play(speech, first)
            first = False
            await self._player.play(speech.wav)
