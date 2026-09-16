import asyncio
import logging
import re
from collections.abc import Awaitable, Callable

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


class VoiceVox:
    def __init__(self, base_url: str, speaker: int, speed: float) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=60)
        self._speaker = speaker
        self._speed = speed

    async def synthesize(self, text: str) -> bytes:
        res = await self._client.post("/audio_query", params={"text": text, "speaker": self._speaker})
        res.raise_for_status()
        query = res.json()
        query["speedScale"] = self._speed
        res = await self._client.post("/synthesis", params={"speaker": self._speaker}, json=query)
        res.raise_for_status()
        return res.content

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

    def __init__(self, tts: VoiceVox, player: Player, on_first_audio: Callable[[], Awaitable[None]]) -> None:
        self._tts = tts
        self._player = player
        self._on_first_audio = on_first_audio
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
        while (wav := await self._audio.get()) is not _END:
            if first:
                first = False
                await self._on_first_audio()
            await self._player.play(wav)
