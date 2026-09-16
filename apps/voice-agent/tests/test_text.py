"""音声やモデルを使わない、文字列処理の単体テスト"""

import pytest

from voice_agent.speech import SentenceSplitter, clean_for_speech
from voice_agent.stt import clean_transcript

REPLY = "今日の東京は雨模様で、雷を伴うところもあるみたいです。最高気温は24度、最低気温は21度で、10月並みの涼しさになります。傘は忘れずに"
REPLY_PIECES = [
    "今日の東京は雨模様で、雷を伴うところもあるみたいです。",
    # 12文字以上たまった文は、読点でも区切って先に合成に回す
    "最高気温は24度、最低気温は21度で、",
    "10月並みの涼しさになります。",
    "傘は忘れずに",
]


def split_all(deltas: list[str]) -> list[str]:
    splitter = SentenceSplitter()
    pieces = [piece for delta in deltas for piece in splitter.feed(delta)]
    return pieces + splitter.flush()


def test_splits_by_sentence_and_long_clause():
    assert split_all([REPLY]) == REPLY_PIECES


@pytest.mark.parametrize("size", [1, 3, 7, 20])
def test_split_does_not_depend_on_how_deltas_arrive(size):
    """ストリーミングの差分の切れ目がどこでも、同じ区切りになる"""
    deltas = [REPLY[i : i + size] for i in range(0, len(REPLY), size)]
    assert split_all(deltas) == REPLY_PIECES


def test_short_clause_is_not_split():
    assert split_all(["はい、そうです。"]) == ["はい、そうです。"]


def test_newlines_between_messages_end_a_sentence():
    # ツール呼び出しを挟んで複数メッセージに分かれると "\n" が入る
    assert split_all(["調べました\n", "明日は晴れです"]) == ["調べました", "明日は晴れです"]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("**傘**を持っていってね", "傘を持っていってね"),
        ("詳しくは https://example.com を見てね", "詳しくは  を見てね"),
        ("- 一つ目", "一つ目"),
        ("```", ""),
    ],
)
def test_clean_for_speech(text, expected):
    assert clean_for_speech(text) == expected


@pytest.mark.parametrize(
    ("transcript", "expected"),
    [
        # whisper が「ねえクロード」を書き起こすときの実際の揺れ
        ("ねぇ、クロード!今何時？", "今何時？"),
        ("レークロード 電気を消して", "電気を消して"),
        ("レークロード、リビングの電気を消して", "リビングの電気を消して"),
        ("ネイクロード、電気を消して", "電気を消して"),
        ("ネークロード エアコンを25度にして", "エアコンを25度にして"),
        ("ネクロード!今なんじ?", "今なんじ?"),
        ("Necrodeリリングの電気を消して", "リリングの電気を消して"),
        # ウェイクワードで始まらない発話はそのまま
        ("ネットで調べて", "ネットで調べて"),
        ("レシピを教えて", "レシピを教えて"),
        ("今日の東京の天気を教えて", "今日の東京の天気を教えて"),
        # 無音や雑音に対する whisper の定型のハルシネーション
        ("ご視聴ありがとうございました", ""),
        ("", ""),
    ],
)
def test_clean_transcript(transcript, expected):
    assert clean_transcript(transcript) == expected
