import json
from dataclasses import dataclass, field

from vosk import KaldiRecognizer, Model, SetLogLevel

from .audio import SAMPLE_RATE, SAMPLE_WIDTH
from .personas import Personas

SetLogLevel(-1)

BYTES_PER_SECOND = SAMPLE_RATE * SAMPLE_WIDTH
# 発話の前後を少し広めに切り出す（Voskの単語境界はwhisperに渡すには少し詰まりすぎている）
PAD_S = 0.3
# 「ねえ」と名前の間がこれより短ければ、別々の発話に区切られていても1つの呼びかけとみなす
JOIN_GAP_S = 1.6
MAX_PHRASE_WORDS = 4


@dataclass
class Word:
    word: str
    start: float
    end: float


@dataclass
class Utterance:
    """Voskが発話の終わりと判断した1区間。時刻は認識器を作ってからの経過秒"""

    words: list[Word]
    # 直前の発話の単語（「ねえ」と名前の間に間があって、発話が2つに分かれた場合に使う）
    previous: list[Word] = field(default_factory=list)


@dataclass
class WakeHit:
    persona_id: str
    # ウェイクワードを言い始めた/言い終えた時刻
    start: float
    end: float
    # ウェイクワードに続けて話された単語（「ねえプラム、電気消して」の「電気消して」側）
    rest: list[Word]


class SpeechRecognizer:
    """
    Voskを「ウェイクワード＋おとり単語」だけの文法で常時回し、発話の区切りを検出する。

    自由文の認識はしない（それはwhisperの担当）。ここでの役割は
    - 発話の区切り（Voskのendpointer）ごとに、どのキャラクターのウェイクワードが含まれるかを判定すること
    - 直近の音声を保持しておき、あとから任意の時間範囲をwhisper用に切り出せるようにすること
    の2つ。文法にはウェイクワードと音の似た語（おとり）を入れておき、似た音をそちらに吸わせて誤検出を減らす。
    """

    def __init__(self, model: Model, personas: Personas, buffer_s: float = 30) -> None:
        self._model = model
        self._phrases = [(p.id, phrase) for p in personas.personas for phrase in p.wake_phrases]
        entries = [" ".join(phrase) for _, phrase in self._phrases] + personas.decoys + ["[unk]"]
        self._grammar = json.dumps(list(dict.fromkeys(entries)), ensure_ascii=False)
        self._buffer_limit = int(buffer_s * BYTES_PER_SECOND)
        self.reset()

    def reset(self) -> None:
        """認識途中の状態と音声バッファを捨てる（読み上げ中に拾った音などを次の判定に持ち込まない）"""
        self._rec = KaldiRecognizer(self._model, SAMPLE_RATE, self._grammar)
        self._rec.SetWords(True)
        self._buffer = bytearray()
        self._buffer_start = 0  # バッファ先頭の、認識器作成時からのバイト位置
        self._fed = 0
        self._last_words: list[Word] = []

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
        if not words:
            return None
        utterance = Utterance(words, previous=self._last_words)
        self._last_words = words
        return utterance

    def find_wake(self, utterance: Utterance) -> WakeHit | None:
        # 「ねえ、……プラム」と間を空けて呼ぶと、Voskが「ねえ」と「プラム」を別々の発話に区切ることがある。
        # 間が短ければ、直前の発話の末尾とつなげて判定する
        carried: list[Word] = []
        if utterance.previous and utterance.words[0].start - utterance.previous[-1].end < JOIN_GAP_S:
            carried = utterance.previous[-(MAX_PHRASE_WORDS - 1) :]
        words = carried + utterance.words
        texts = [w.word for w in words]

        for i in range(len(texts)):
            for persona_id, phrase in self._phrases:
                n = len(phrase)
                # つなげた分だけで完結するものは、直前の発話ですでに判定済み
                if texts[i : i + n] != phrase or i + n <= len(carried):
                    continue
                # 直前がおとり単語（「あのね」「ですね」など）なら、その語尾の「ね」を「ねえ」と取り直しただけとみなす。
                # 「あのね、クロードモネの〜」が、前に流す無音の長さ次第で「あのね ねえ クロード モネ」になった
                # 別の発話として区切られた後（i == len(carried)）なら、前の発話の語尾は関係ない
                if i > 0 and i != len(carried) and texts[i - 1] != "[unk]":
                    continue
                return WakeHit(persona_id, words[i].start, words[i + n - 1].end, words[i + n :])
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
