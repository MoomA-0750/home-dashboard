import re

from faster_whisper import WhisperModel

from .audio import pcm_to_float
from .config import CACHE_DIR

# whisperが「ねえクロード」を書き起こすときの揺れ
# （実測: ねぇ、クロード / レークロード / ネイクロード / ネクロード! / Necrode）。
# 命令の頭に付いたウェイクワードを落とすために使う
_WAKE_PREFIX = re.compile(
    r"^\s*(?:(?:ね|ネ|れ|レ)[えぇーイい]?|ne|hey|へい)?[、,.。!！\s]*(?:クロード|claude|crode|clode)[、,.。!！?？\s]*",
    re.I,
)

# 無音や雑音に対してwhisperが出しがちな定型文。これだけが返ってきたら聞き取れなかった扱いにする
_HALLUCINATIONS = ("ご視聴ありがとうございました", "チャンネル登録", "おやすみなさい", "字幕")


class Transcriber:
    def __init__(self, model: str, compute_type: str) -> None:
        self._model = WhisperModel(
            model, device="cpu", compute_type=compute_type, download_root=str(CACHE_DIR / "whisper")
        )

    def transcribe(self, pcm: bytes) -> str:
        segments, _ = self._model.transcribe(
            pcm_to_float(pcm),
            language="ja",
            beam_size=1,
            # 前後の無音・雑音を落としてから認識する（雑音だけの区間でのハルシネーション対策）
            vad_filter=True,
            condition_on_previous_text=False,
            without_timestamps=True,
        )
        text = "".join(s.text for s in segments).strip()
        return clean_transcript(text)


def clean_transcript(text: str) -> str:
    text = _WAKE_PREFIX.sub("", text).strip()
    if any(h in text for h in _HALLUCINATIONS) and len(text) < 20:
        return ""
    return text
