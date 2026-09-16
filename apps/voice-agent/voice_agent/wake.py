import json
from dataclasses import dataclass

from vosk import KaldiRecognizer, Model, SetLogLevel

from .audio import SAMPLE_RATE, SAMPLE_WIDTH

SetLogLevel(-1)

BYTES_PER_SECOND = SAMPLE_RATE * SAMPLE_WIDTH
# 発話の前後を少し広めに切り出す（Voskの単語境界はwhisperに渡すには少し詰まりすぎている）
PAD_S = 0.3


@dataclass
class Word:
    word: str
    start: float
    end: float


@dataclass
class Utterance:
    """Voskが発話の終わりと判断した1区間。時刻は認識器を作ってからの経過秒"""

    words: list[Word]


class SpeechRecognizer:
    """
    Voskを「ウェイクワード＋おとり単語」だけの文法で常時回し、発話の区切りを検出する。

    自由文の認識はしない（それはwhisperの担当）。ここでの役割は
    - 発話の区切り（Voskのendpointer）ごとに、ウェイクワードが含まれるかを判定すること
    - 直近の音声を保持しておき、あとから任意の時間範囲をwhisper用に切り出せるようにすること
    の2つ。文法にはウェイクワードと音の似た語（おとり）を入れておき、似た音をそちらに吸わせて誤検出を減らす。
    """

    def __init__(self, model: Model, wake_phrase: list[str], decoys: list[str], buffer_s: float = 30) -> None:
        self._model = model
        self._wake_phrase = wake_phrase
        self._grammar = json.dumps([" ".join(wake_phrase), *decoys, "[unk]"], ensure_ascii=False)
        self._buffer_limit = int(buffer_s * BYTES_PER_SECOND)
        self.reset()

    def reset(self) -> None:
        """認識途中の状態と音声バッファを捨てる（読み上げ中に拾った音などを次の判定に持ち込まない）"""
        self._rec = KaldiRecognizer(self._model, SAMPLE_RATE, self._grammar)
        self._rec.SetWords(True)
        self._buffer = bytearray()
        self._buffer_start = 0  # バッファ先頭の、認識器作成時からのバイト位置
        self._fed = 0

    @property
    def now(self) -> float:
        return self._fed / BYTES_PER_SECOND

    def feed(self, chunk: bytes) -> Utterance | None:
        self._buffer += chunk
        self._fed += len(chunk)
        overflow = len(self._buffer) - self._buffer_limit
        if overflow > 0:
            del self._buffer[:overflow]
            self._buffer_start += overflow

        if not self._rec.AcceptWaveform(chunk):
            return None
        words = [Word(w["word"], w["start"], w["end"]) for w in json.loads(self._rec.Result()).get("result", [])]
        return Utterance(words) if words else None

    def find_wake(self, utterance: Utterance) -> int | None:
        """ウェイクワードの最後の単語のindexを返す"""
        n = len(self._wake_phrase)
        texts = [w.word for w in utterance.words]
        for i in range(len(texts) - n + 1):
            if texts[i : i + n] == self._wake_phrase:
                return i + n - 1
        return None

    def audio(self, start_s: float, end_s: float) -> bytes:
        start = max(self._buffer_start, _align(start_s - PAD_S))
        end = min(self._buffer_start + len(self._buffer), _align(end_s + PAD_S))
        if end <= start:
            return b""
        return bytes(self._buffer[start - self._buffer_start : end - self._buffer_start])


def _align(seconds: float) -> int:
    offset = int(max(0.0, seconds) * BYTES_PER_SECOND)
    return offset - offset % SAMPLE_WIDTH
