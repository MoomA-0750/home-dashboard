import asyncio
import io
import logging
import wave
from collections.abc import AsyncIterator

import numpy as np

log = logging.getLogger(__name__)

SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2
CHUNK_SAMPLES = SAMPLE_RATE // 10
CHUNK_BYTES = CHUNK_SAMPLES * SAMPLE_WIDTH


class MicrophoneError(RuntimeError):
    pass


async def microphone(cmd: list[str]) -> AsyncIterator[bytes]:
    """録音コマンドの標準出力（16kHz mono s16le）を100msごとに返す"""
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, stdin=asyncio.subprocess.DEVNULL
    )
    assert proc.stdout is not None and proc.stderr is not None
    try:
        while True:
            try:
                yield await proc.stdout.readexactly(CHUNK_BYTES)
            except asyncio.IncompleteReadError:
                stderr = (await proc.stderr.read()).decode(errors="replace").strip()
                raise MicrophoneError(f"録音コマンドが終了しました: {' '.join(cmd)} {stderr}") from None
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()


class Player:
    """WAVを外部コマンドで再生する。stop() で再生中のものを打ち切れる"""

    def __init__(self, cmd: list[str]) -> None:
        self._cmd = cmd
        self._proc: asyncio.subprocess.Process | None = None

    async def play(self, wav: bytes) -> None:
        proc = await asyncio.create_subprocess_exec(
            *self._cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        self._proc = proc
        try:
            _, stderr = await proc.communicate(wav)
        except (BrokenPipeError, ConnectionResetError):
            # stop() で殺された場合
            return
        finally:
            if proc.returncode is None:
                proc.kill()
                await proc.wait()
            self._proc = None
        if proc.returncode not in (0, -9):
            log.warning("再生コマンドが失敗しました (%s): %s", proc.returncode, stderr.decode(errors="replace").strip())

    def stop(self) -> None:
        if self._proc and self._proc.returncode is None:
            self._proc.kill()


def pcm_to_float(pcm: bytes) -> np.ndarray:
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def _to_wav(samples: np.ndarray, rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(SAMPLE_WIDTH)
        w.setframerate(rate)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes())
    return buf.getvalue()


def _tones(freqs: list[float], tone_s: float, rate: int = 24000) -> bytes:
    parts = []
    for f in freqs:
        t = np.arange(int(rate * tone_s)) / rate
        # 立ち上がり・減衰をつけてクリックノイズを出さない
        envelope = np.minimum(1, t / 0.01) * np.exp(-t * 9)
        parts.append(0.35 * np.sin(2 * np.pi * f * t) * envelope)
    return _to_wav(np.concatenate(parts), rate)


# ウェイクワードを受け付けた合図（上昇2音）と、聞き取れなかった合図（下降2音）
WAKE_CHIME = _tones([880, 1320], 0.12)
MISS_CHIME = _tones([660, 440], 0.12)
CHIME_DURATION_S = 0.24
