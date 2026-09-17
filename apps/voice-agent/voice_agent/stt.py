import re

from faster_whisper import WhisperModel

from .audio import pcm_to_float
from .config import CACHE_DIR

# whisperが「ねえクロード」「ねえプラム」を書き起こすときの揺れ
# （実測: ねぇ、クロード / レークロード / ネイクロード / ネクロード! / Necrode / ネープラム）。
# 命令の頭に付いたウェイクワードを落とすために使う。名前は呼び分けるキャラクターから作る
_LATIN_ALIASES = ["claude", "crode", "clode"]


def _swap_kana(text: str) -> str:
    """ひらがなとカタカナを入れ替える（whisper は名前をどちらで書くか揺れる）"""
    return "".join(
        chr(ord(ch) + 0x60) if "ぁ" <= ch <= "ゖ" else chr(ord(ch) - 0x60) if "ァ" <= ch <= "ヶ" else ch for ch in text
    )


def wake_prefix_pattern(names: list[str]) -> re.Pattern[str]:
    variants = {v for name in names for v in (name, _swap_kana(name)) if v} | set(_LATIN_ALIASES)
    alternatives = "|".join(re.escape(v) for v in sorted(variants, key=len, reverse=True))
    return re.compile(
        rf"^\s*(?:(?:ね|ネ|れ|レ)[えぇーイいェ]?|ne|hey|へい)?[、,.。!！\s]*(?:{alternatives})(?:ちゃん)?[、,.。!！?？\s]*",
        re.I,
    )


_DEFAULT_WAKE_PREFIX = wake_prefix_pattern(["クロード"])

# 無音や雑音に対してwhisperが出しがちな定型文。これだけが返ってきたら聞き取れなかった扱いにする
_HALLUCINATIONS = ("ご視聴ありがとうございました", "チャンネル登録", "おやすみなさい", "字幕")


class Transcriber:
    def __init__(self, model: str, compute_type: str, names: list[str] | None = None) -> None:
        self._wake_prefix = wake_prefix_pattern(names) if names else _DEFAULT_WAKE_PREFIX
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
        return clean_transcript(text, self._wake_prefix)


def clean_transcript(text: str, wake_prefix: re.Pattern[str] = _DEFAULT_WAKE_PREFIX) -> str:
    text = wake_prefix.sub("", text).strip()
    if any(h in text for h in _HALLUCINATIONS) and len(text) < 20:
        return ""
    return text
