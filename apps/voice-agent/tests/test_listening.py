"""
ウェイクワード検出から命令の切り出し・書き起こしまでを、VOICEVOX で作った発話で確かめる結合テスト。

マイクの代わりに音声を実時間を待たずに流し込む。判定はすべて「認識器が受け取った音声の時刻」で行っているので、
速く流しても実機と同じ判定になる。
"""

import asyncio
import dataclasses

import pytest

import voice_agent.__main__ as agent
from voice_agent.audio import CHUNK_BYTES, SAMPLE_RATE, SAMPLE_WIDTH
from voice_agent.config import load_config
from voice_agent.personas import Persona, Personas
from voice_agent.wake import SpeechRecognizer

pytestmark = pytest.mark.audio


def silence(seconds: float) -> bytes:
    return bytes(int(seconds * SAMPLE_RATE) * SAMPLE_WIDTH)


VOICES = (2, 3, 8, 11, 14, 16, 20, 70)

# テスト用のキャラクター設定（実際の config/voice-personas.json と同じ名前・おとり）。
# おとり無しだと「ねえ、プランはどうする？」「ねえ、カラオケ行こう」などを誤検出し、
# 「パラム」「クローン」のように名前と近すぎるおとりは、逆に正しい呼びかけを吸ってしまった
PERSONAS = Personas(
    personas=[
        Persona("plum", "プラム", [["ねえ", "プラム"]], ["ですね", "あのね", "寝る", "ね", "プラモ", "プール", "プリン", "クラス", "クリーム", "ブラウン"], "", 70, 1.1),
        Persona("karin", "カリン", [["ねえ", "カリン"], ["ねえ", "花梨"]], ["カレン", "かりんとう", "カラオケ", "借り", "から"], "", 2, 1.1),
        Persona("amanatsu", "あまなつ", [["ねえ", "甘夏"]], ["あまり", "夏", "甘栗"], "", 8, 1.1),
        Persona("claude", "クロード", [["ねえ", "クロード"]], ["クローゼット", "クローバー", "クロール", "クロス", "黒", "モネ"], "", 3, 1.1),
    ],
    world="",
)

WAKE_POSITIVES = [
    ("ねえプラム", "plum"),
    ("ねえ、プラム", "plum"),
    ("ねえ、プラムちゃん", "plum"),
    ("ねえプラム、明日の天気は？", "plum"),
    ("ねえカリン", "karin"),
    ("ねえ、カリン", "karin"),
    ("ねえカリン、電気消して", "karin"),
    ("ねえあまなつ", "amanatsu"),
    ("ねえ、あまなつ", "amanatsu"),
    ("ねえあまなつ、音楽かけて", "amanatsu"),
    ("ねえクロード", "claude"),
    ("ねえ、クロード", "claude"),
]
WAKE_NEGATIVES = [
    "ねえ、プランはどうする？",
    "プラモデルを作ろう",
    "ねえ、カレンダー見せて",
    "かりんとう食べたい",
    "あまりにも暑いね",
    "ねえ、夏休みどこ行く？",
    "ラムネ飲みたいな",
    "ねえ、ブラウンのコート",
    "ねえ、借りた本返した？",
    "甘いものが食べたい",
    "今日はいい天気ですね、クローゼットを片付けよう",
    "あのね、クロードモネの絵が好き",
    "ねえ、クローバー見つけた",
    "ねえ、黒土って知ってる？",
    "ねえ、カラオケ行こう",
    "くらむぼん",
    "ねえ、ちょっと来て",
    "ねえ、ご飯まだ？",
    "ねえ、あれ取って",
    "ねえ、カーテン閉めて",
    "ねえ、ぷりん食べていい？",
    "ねえ、クリーム買ってきて",
    "ねえ、甘栗あるよ",
    "ねえ、からあげ食べたい",
    "ねえ、プールに行こう",
    "ねえ、クラスの友達がね",
]


def detect_wake(vosk_model, pcm: bytes, lead_s: float = 0.5, trail_s: float = 3) -> str | None:
    """検出したキャラクターのIDを返す"""
    recognizer = SpeechRecognizer(vosk_model, PERSONAS)
    stream = silence(lead_s) + pcm + silence(trail_s)
    for i in range(0, len(stream), CHUNK_BYTES):
        utterance = recognizer.feed(stream[i : i + CHUNK_BYTES])
        if utterance and (hit := recognizer.find_wake(utterance)):
            return hit.persona_id
    return None


def test_wake_word_accuracy(vosk_model, speech_pcm):
    """
    8人の声（VOICEVOX）で、呼び分けの精度が落ちていないかを見る。実際の人の声ではないので、個々の成否ではなく
    全体の割合で判定する（おとりを入れた時点で、取りこぼし 5/96・誤検出 7/208 だった）。
    キャラクターの取り違え（プラムを呼んだのにカリンが出る）は1件も許さない。
    """
    missed, wrong, false_accepts = [], [], []
    for text, expected in WAKE_POSITIVES:
        for voice in VOICES:
            got = detect_wake(vosk_model, speech_pcm(text, voice))
            if got is None:
                missed.append((text, voice))
            elif got != expected:
                wrong.append((text, voice, got))
    for text in WAKE_NEGATIVES:
        for voice in VOICES:
            if got := detect_wake(vosk_model, speech_pcm(text, voice)):
                false_accepts.append((text, voice, got))

    positives = len(WAKE_POSITIVES) * len(VOICES)
    negatives = len(WAKE_NEGATIVES) * len(VOICES)
    report = f"取りこぼし {len(missed)}/{positives} {missed}\n誤検出 {len(false_accepts)}/{negatives} {false_accepts}\n取り違え {wrong}"
    assert not wrong, report
    assert len(missed) / positives <= 0.07, report
    assert len(false_accepts) / negatives <= 0.05, report


@pytest.mark.parametrize(("lead_s", "trail_s"), [(0, 2.5), (0.5, 3), (1, 2.5), (3, 3)])
def test_detection_does_not_depend_on_surrounding_silence(vosk_model, speech_pcm, lead_s, trail_s):
    # 前後の無音の長さだけで認識結果が変わることがあった（「あのね ねえ クロード」）。
    # 後ろは2秒以上にする: Voskは間の入った発話だと無音が最長2秒続くまで結果を確定しない
    assert detect_wake(vosk_model, speech_pcm("ねえクロード", 11), lead_s, trail_s) == "claude"
    assert detect_wake(vosk_model, speech_pcm("ねえ、カリン", 8), lead_s, trail_s) == "karin"
    assert detect_wake(vosk_model, speech_pcm("あのね、クロードモネの絵が好き", 8), lead_s, trail_s) is None
    assert detect_wake(vosk_model, speech_pcm("今日はいい天気ですね、クローゼットを片付けよう", 2), lead_s, trail_s) is None


def test_wake_phrase_split_by_a_pause(vosk_model, speech_pcm):
    """「ねえ、……プラム」と間を空けて呼んで、Voskが2つの発話に区切っても1つの呼びかけとみなす"""
    pcm = speech_pcm("ねえ", 3) + silence(1.0) + speech_pcm("プラム", 3)
    assert detect_wake(vosk_model, pcm) == "plum"


class _MicrophoneExhausted(Exception):
    pass


@dataclasses.dataclass
class Session:
    turns: list[bytes]
    states: list[str]
    # 書き起こしに回したときに応答することになっていたキャラクター
    personas: list[str]


def run_assistant(monkeypatch, tmp_path, vosk_model, pcm: bytes, listen_request: dict | None = None) -> Session:
    """
    音声を流し込んで Assistant のマイクのループを回し、書き起こしに回された音声（ターン）と状態の移り変わりを返す。
    書き起こし以降（whisper・Claude・読み上げ）は呼ばない。
    """
    config = dataclasses.replace(
        load_config(), chime=False, listen_timeout_s=3, claude_cwd=tmp_path, personas_path=tmp_path / "none.json"
    )
    assistant = agent.Assistant(config)
    assistant.personas = PERSONAS
    assistant.recognizer = SpeechRecognizer(vosk_model, PERSONAS)
    assistant._listen_request = listen_request
    session = Session(turns=[], states=[], personas=[])

    async def publish() -> None:
        if not session.states or session.states[-1] != assistant.state:
            session.states.append(assistant.state)

    def start_turn(*, audio: bytes | None = None, text: str | None = None) -> None:
        assert audio is not None
        session.turns.append(audio)
        session.personas.append(assistant.persona.id)
        assistant.mode = agent.Mode.IDLE
        assistant._reset_requested = True

    async def microphone(_cmd):
        stream = silence(0.5) + pcm + silence(8)
        for i in range(0, len(stream), CHUNK_BYTES):
            chunk = stream[i : i + CHUNK_BYTES]
            yield chunk + bytes(CHUNK_BYTES - len(chunk))
        raise _MicrophoneExhausted

    monkeypatch.setattr(assistant.relay, "publish", publish)
    monkeypatch.setattr(assistant, "_start_turn", start_turn)
    monkeypatch.setattr(agent, "microphone", microphone)
    with pytest.raises(_MicrophoneExhausted):
        asyncio.run(assistant._listen_loop())
    return session


def test_command_in_one_breath(monkeypatch, tmp_path, vosk_model, speech_pcm, transcriber):
    """「ねえクロード、〜」と続けて言っても、ウェイクワードの後ろの命令を取りこぼさない"""
    session = run_assistant(monkeypatch, tmp_path, vosk_model, speech_pcm("ねえクロード、リビングの電気を消して", 8))
    assert len(session.turns) == 1
    assert session.personas == ["claude"]
    text = transcriber.transcribe(session.turns[0])
    assert "電気" in text and "消" in text
    assert not text.startswith(("ね", "ネ", "レ"))  # ウェイクワードは落としてある


def test_calls_the_persona_by_its_wake_word(monkeypatch, tmp_path, vosk_model, speech_pcm, transcriber):
    session = run_assistant(monkeypatch, tmp_path, vosk_model, speech_pcm("ねえカリン、エアコンを25度にして", 3))
    assert session.personas == ["karin"]
    assert "25" in transcriber.transcribe(session.turns[0])


def test_command_after_pause(monkeypatch, tmp_path, vosk_model, speech_pcm, transcriber):
    pcm = speech_pcm("ねえクロード", 11) + silence(1.5) + speech_pcm("今日の東京の天気を教えて", 11)
    session = run_assistant(monkeypatch, tmp_path, vosk_model, pcm)
    assert session.states[:1] == ["listening"]
    assert len(session.turns) == 1
    assert "天気" in transcriber.transcribe(session.turns[0])


def test_short_pause_inside_command_does_not_cut_it(monkeypatch, tmp_path, vosk_model, speech_pcm, transcriber):
    """命令の途中で言いよどんでも（VOICE_END_SILENCE_S 未満の間なら）1つの命令として聞く"""
    pcm = speech_pcm("ねえクロード、明日の", 3) + silence(0.6) + speech_pcm("天気を教えて", 3)
    session = run_assistant(monkeypatch, tmp_path, vosk_model, pcm)
    assert len(session.turns) == 1
    text = transcriber.transcribe(session.turns[0])
    assert "明日" in text and "天気" in text


def test_wake_phrase_only_times_out(monkeypatch, tmp_path, vosk_model, speech_pcm):
    session = run_assistant(monkeypatch, tmp_path, vosk_model, speech_pcm("ねえクロード", 11))
    assert session.turns == []
    assert session.states == ["listening", "idle"]


def test_speech_without_wake_phrase_is_ignored(monkeypatch, tmp_path, vosk_model, speech_pcm):
    session = run_assistant(monkeypatch, tmp_path, vosk_model, speech_pcm("今日はいい天気ですね、クローゼットを片付けよう", 2))
    assert session.turns == []
    assert session.states == []


def test_follow_up_without_wake_phrase(monkeypatch, tmp_path, vosk_model, speech_pcm):
    """返答の直後は、ウェイクワード無しで続けて話せる"""
    pcm = speech_pcm("じゃあスカイツリーの高さは？", 8)
    session = run_assistant(monkeypatch, tmp_path, vosk_model, pcm, listen_request={"follow_up": True})
    assert len(session.turns) == 1
    # 書き起こしの精度ではなく、発話が欠けずに切り出されたかを見る
    assert len(session.turns[0]) >= len(pcm)


def test_follow_up_silence_returns_to_idle(monkeypatch, tmp_path, vosk_model):
    session = run_assistant(monkeypatch, tmp_path, vosk_model, b"", listen_request={"follow_up": True})
    assert session.turns == []
    assert session.states == ["listening", "idle"]


def test_mic_button_listens_without_wake_phrase(monkeypatch, tmp_path, vosk_model, speech_pcm):
    pcm = speech_pcm("今日の天気を教えて", 3)
    session = run_assistant(
        monkeypatch, tmp_path, vosk_model, pcm, listen_request={"persona_id": "amanatsu", "source": "button"}
    )
    # マイクボタンでは、サーバーが決めた既定のキャラクターが応答する
    assert session.personas == ["amanatsu"]
    assert len(session.turns) == 1
    assert len(session.turns[0]) >= len(pcm)
