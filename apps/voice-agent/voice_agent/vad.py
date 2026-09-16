import numpy as np
from faster_whisper.vad import get_vad_model

from .audio import pcm_to_float

FRAME = 512
# SileroVADModel は呼び出しごとに内部状態を初期化するので、毎回直近の約1秒をまとめて渡して文脈を持たせる
WINDOW = FRAME * 32
THRESHOLD = 0.5


class VoiceActivity:
    """
    人の声が出ているかを判定する（faster-whisper同梱のSilero VAD）。

    発話の終わりをVoskの区切りだけで判断すると、無音や空調の音に対しても `[unk]` を出し続けるせいで
    「まだ話している」と見なしてしまい、話し終えてから数秒待たされる。終わりの判定はこちらで行う。
    """

    def __init__(self) -> None:
        self._model = get_vad_model()
        self._window = np.zeros(WINDOW, dtype=np.float32)

    def push(self, chunk: bytes) -> None:
        samples = pcm_to_float(chunk)
        self._window = np.concatenate([self._window, samples])[-WINDOW:]

    def is_speech(self) -> bool:
        """直近100ms程度に声が含まれるか"""
        probs = self._model(self._window).reshape(-1)
        return bool(probs[-3:].max() >= THRESHOLD)
