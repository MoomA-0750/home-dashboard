"""音声やモデルを使わない、文字列処理の単体テスト"""

import pytest

from voice_agent.personas import DEFAULT_EXPRESSIONS, Expression
from voice_agent.speech import Directions, SentenceSplitter, clean_for_speech, mouth_cues
from voice_agent.stt import clean_transcript, wake_prefix_pattern

REPLY = "今日の東京は雨模様で、雷を伴うところもあるみたいです。最高気温は24度、最低気温は21度で、10月並みの涼しさになります。傘は忘れずに"
REPLY_PIECES = [
    "今日の東京は雨模様で、雷を伴うところもあるみたいです。",
    # 12文字以上たまった文は、読点でも区切って先に合成に回す
    "最高気温は24度、最低気温は21度で、",
    "10月並みの涼しさになります。",
    "傘は忘れずに",
]


def split_all(deltas: list[str], directions: Directions | None = None) -> list[str]:
    return [piece.text for piece in split_pieces(deltas, directions)]


def split_pieces(deltas: list[str], directions: Directions | None = None):
    splitter = SentenceSplitter(directions)
    pieces = [piece for delta in deltas for piece in splitter.feed(delta)]
    return pieces + splitter.flush()


EXPRESSIONS = {e.name: e for e in DEFAULT_EXPRESSIONS} | {
    "ドヤ顔": Expression("ドヤ顔", {"doya_1": 1.0}, keywords=("ドヤ", "得意")),
    "ひそひそ": Expression("ひそひそ", {"relaxed": 0.4}, speaker=71, keywords=("小声",)),
}
CHARACTER = Directions(EXPRESSIONS, hide_descriptions=True)


def test_splits_by_sentence_and_long_clause():
    assert split_all([REPLY]) == REPLY_PIECES


@pytest.mark.parametrize("size", [1, 3, 7, 20])
def test_split_does_not_depend_on_how_deltas_arrive(size):
    """ストリーミングの差分の切れ目がどこでも、同じ区切りになる"""
    deltas = [REPLY[i : i + size] for i in range(0, len(REPLY), size)]
    assert split_all(deltas) == REPLY_PIECES


REPLY_WITH_DIRECTIONS = (
    "（ドヤ顔）プラムにおまかせだよっ！東京タワーは（333メートル）あるんだよ。"
    "（嬉しそうに耳をピコピコ、させる）明日は晴れだから、お出かけ日和だねっ！（ひそひそ）内緒だよ。"
)


@pytest.mark.parametrize("size", [1, 4, 200])
def test_directions_set_expression_and_are_not_spoken(size):
    """（表情名）は表情と声の指定として読み、読み上げない。括弧の途中の句読点では区切らない"""
    deltas = [REPLY_WITH_DIRECTIONS[i : i + size] for i in range(0, len(REPLY_WITH_DIRECTIONS), size)]
    pieces = [(p.text, p.expression.name if p.expression else None) for p in split_pieces(deltas, CHARACTER)]
    assert pieces == [
        ("プラムにおまかせだよっ！", "ドヤ顔"),
        # 数字を含む括弧は本文の補足として残す。表情は次の指定まで続く
        ("東京タワーは（333メートル）あるんだよ。", "ドヤ顔"),
        # 表情名ではない描写も隠し、keywords（嬉）から近い表情を選ぶ
        ("明日は晴れだから、", "にっこり"),
        ("お出かけ日和だねっ！", "にっこり"),
        ("内緒だよ。", "ひそひそ"),
    ]


def test_visible_response_hides_directions_while_streaming():
    assert CHARACTER.visible(REPLY_WITH_DIRECTIONS) == (
        "プラムにおまかせだよっ！東京タワーは（333メートル）あるんだよ。明日は晴れだから、お出かけ日和だねっ！内緒だよ。"
    )
    # 書きかけの指定は、閉じる前から隠す
    assert CHARACTER.visible("プラムだよ！（ドヤ") == "プラムだよ！"


def test_plain_assistant_keeps_parentheses():
    """キャラクターの無い素のアシスタントでは、括弧を指定として扱わない"""
    plain = Directions({}, hide_descriptions=False)
    assert plain.visible("（補足）そのままです") == "（補足）そのままです"
    assert split_all(["（補足）そのままです。"], plain) == ["（補足）そのままです。"]


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
        # 括弧は表情の指定かどうかを Directions が判断するので、ここでは消さない
        ("東京タワーは（333メートル）", "東京タワーは（333メートル）"),
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


@pytest.mark.parametrize(
    ("transcript", "expected"),
    [
        ("ネープラム 明日の天気は", "明日の天気は"),
        ("ねぇ、ぷらむちゃん、電気消して", "電気消して"),
        ("ねえカリン、エアコンを25度にして", "エアコンを25度にして"),
        ("ねぇあまなつ、みんなで何の話してたの?", "みんなで何の話してたの?"),
        ("ねえ甘夏、音楽かけて", "音楽かけて"),
        ("Necrode今何時?", "今何時?"),
        # 名前で始まらない命令は残す
        ("プラモデルの作り方を教えて", "プラモデルの作り方を教えて"),
    ],
)
def test_clean_transcript_with_persona_names(transcript, expected):
    pattern = wake_prefix_pattern(["プラム", "カリン", "花梨", "あまなつ", "甘夏", "クロード"])
    assert clean_transcript(transcript, pattern) == expected


def test_mouth_cues_follow_phoneme_lengths():
    """VOICEVOX の audio_query の音素の長さから、口の形の時系列を作る（話速で縮める）"""
    query = {
        "speedScale": 2.0,
        "prePhonemeLength": 0.1,
        "postPhonemeLength": 0.1,
        "accent_phrases": [
            {
                "moras": [
                    {"consonant_length": None, "vowel": "a", "vowel_length": 0.2},  # あ
                    {"consonant_length": 0.1, "vowel": "i", "vowel_length": 0.2},  # き
                ],
                "pause_mora": {"vowel": "pau", "vowel_length": 0.4},
            },
            {"moras": [{"consonant_length": 0.05, "vowel": "N", "vowel_length": 0.1}], "pause_mora": None},
        ],
    }
    cues, duration = mouth_cues(query)
    assert cues == [(0.0, "pau"), (0.05, "a"), (0.2, "i"), (0.3, "pau"), (0.525, "N"), (0.575, "pau")]
    assert duration == 0.625


def test_expression_changes_voice_style():
    """表情に声のスタイルがあれば、その区切りだけ話者を切り替える（無ければキャラクターの声のまま）"""
    import asyncio

    from voice_agent.speech import Speech, SpeechQueue, Voice

    synthesized: list[tuple[str, int, float]] = []

    class FakeTTS:
        async def synthesize(self, text: str, voice: Voice) -> Speech:
            synthesized.append((text, voice.speaker, voice.speed))
            return Speech(b"", [], 0.0)

    class FakePlayer:
        async def play(self, wav: bytes) -> None:
            pass

        def stop(self) -> None:
            pass

    played_expressions: list[str | None] = []

    async def on_play(speech: Speech, first: bool) -> None:
        played_expressions.append(speech.expression.name if speech.expression else None)

    async def scenario() -> None:
        queue = SpeechQueue(FakeTTS(), Voice(speaker=70, speed=1.1), FakePlayer(), on_play)
        for piece in split_pieces(["ふつうに話すよ。（ひそひそ）内緒だよ。（にっこり）おしまい！"], CHARACTER):
            queue.say(piece)
        await queue.finish()

    asyncio.run(scenario())
    assert synthesized == [("ふつうに話すよ。", 70, 1.1), ("内緒だよ。", 71, 1.1), ("おしまい！", 70, 1.1)]
    assert played_expressions == [None, "ひそひそ", "にっこり"]
