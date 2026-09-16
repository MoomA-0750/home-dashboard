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
from voice_agent.wake import SpeechRecognizer

pytestmark = pytest.mark.audio


def silence(seconds: float) -> bytes:
    return bytes(int(seconds * SAMPLE_RATE) * SAMPLE_WIDTH)


# おとり単語を入れる前は、負例のうち「クローゼット」「クロードモネ」「クローバー」「クロール」を誤検出していた
WAKE_POSITIVES = [
    ("ねえクロード", 11),
    ("ねえ、クロード", 2),
    ("ねぇクロード", 8),
    ("ねえクロード、電気を消して", 8),
    ("ねえクロード、明日の予定は？", 2),
]
WAKE_NEGATIVES = [
    ("今日はいい天気ですね、クローゼットを片付けよう", 2),
    ("あのね、クロードモネの絵が好き", 8),
    ("ねえ、クローバー見つけた", 8),
    ("クロールで泳ぐのが得意", 3),
    ("ねえ、黒土って知ってる？", 2),
    ("寝るど", 3),
    ("今日は寝るぞ、おやすみ", 11),
]


# 発話の前後の無音（秒）。前の無音の長さだけで認識結果が変わることがあった（「あのね ねえ クロード」）ので、いくつか変えて確かめる。
# 後ろは2秒以上にする: Voskは間の入った発話だと無音が最長2秒続くまで結果を確定しない（実機ではマイクの無音が続くので問題にならない）
PADDINGS = [(0, 2.5), (0.5, 3), (1, 2.5), (3, 3)]


def detects_wake(vosk_model, pcm: bytes, lead_s: float, trail_s: float) -> bool:
    config = load_config()
    recognizer = SpeechRecognizer(vosk_model, config.wake_phrase, config.wake_decoys)
    stream = silence(lead_s) + pcm + silence(trail_s)
    for i in range(0, len(stream), CHUNK_BYTES):
        utterance = recognizer.feed(stream[i : i + CHUNK_BYTES])
        if utterance and recognizer.find_wake(utterance) is not None:
            return True
    return False


@pytest.mark.parametrize(("text", "speaker"), WAKE_POSITIVES)
def test_detects_wake_phrase(vosk_model, speech_pcm, text, speaker):
    pcm = speech_pcm(text, speaker)
    for lead_s, trail_s in PADDINGS:
        assert detects_wake(vosk_model, pcm, lead_s, trail_s), (lead_s, trail_s)


@pytest.mark.parametrize(("text", "speaker"), WAKE_NEGATIVES)
def test_ignores_similar_sounding_speech(vosk_model, speech_pcm, text, speaker):
    pcm = speech_pcm(text, speaker)
    for lead_s, trail_s in PADDINGS:
        assert not detects_wake(vosk_model, pcm, lead_s, trail_s), (lead_s, trail_s)


class _MicrophoneExhausted(Exception):
    pass


@dataclasses.dataclass
class Session:
    turns: list[bytes]
    states: list[str]


def run_assistant(monkeypatch, tmp_path, vosk_model, pcm: bytes, listen_request: dict | None = None) -> Session:
    """
    音声を流し込んで Assistant のマイクのループを回し、書き起こしに回された音声（ターン）と状態の移り変わりを返す。
    書き起こし以降（whisper・Claude・読み上げ）は呼ばない。
    """
    config = dataclasses.replace(load_config(), chime=False, listen_timeout_s=3, claude_cwd=tmp_path)
    assistant = agent.Assistant(config)
    assistant.recognizer = SpeechRecognizer(vosk_model, config.wake_phrase, config.wake_decoys)
    assistant._listen_request = listen_request
    session = Session(turns=[], states=[])

    async def publish() -> None:
        if not session.states or session.states[-1] != assistant.state:
            session.states.append(assistant.state)

    def start_turn(*, audio: bytes | None = None, text: str | None = None) -> None:
        assert audio is not None
        session.turns.append(audio)
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
    text = transcriber.transcribe(session.turns[0])
    assert "電気" in text and "消" in text
    assert not text.startswith(("ね", "ネ", "レ"))  # ウェイクワードは落としてある


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
    session = run_assistant(monkeypatch, tmp_path, vosk_model, pcm, listen_request={})
    assert len(session.turns) == 1
    assert len(session.turns[0]) >= len(pcm)
