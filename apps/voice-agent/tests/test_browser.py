"""
画面（ブラウザ）から話しかけたときに、返答の声を指定どおりの場所で鳴らすかを確かめる。
書き起こし・Claude・VOICEVOX は偽物に差し替えるので、どの環境でも動く。
"""

import asyncio
import base64
import dataclasses
import io
import wave

import voice_agent.__main__ as agent
from voice_agent.audio import SAMPLE_RATE, SAMPLE_WIDTH
from voice_agent.config import load_config
from voice_agent.speech import Speech


def tiny_wav(seconds: float = 0.05) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(bytes(int(24000 * seconds) * 2))
    return buf.getvalue()


class FakePlayer:
    def __init__(self) -> None:
        self.played: list[bytes] = []

    async def play(self, wav: bytes) -> None:
        self.played.append(wav)

    def stop(self) -> None:
        pass


def make_assistant(monkeypatch, tmp_path, transcript: str = "今日の天気は？"):
    config = dataclasses.replace(load_config(), claude_cwd=tmp_path, personas_dir=tmp_path / "no-personas", chime=True)
    assistant = agent.Assistant(config)
    sent: list[dict] = []
    host = FakePlayer()
    assistant.player = host

    async def send(message: dict) -> None:
        sent.append(message)

    async def publish() -> None:
        pass

    async def ask(_text, _persona, _conversation_id=None, _attachments=(), _guard=None, owner=None):
        for delta in ["晴れです。", "傘は要りません。"]:
            yield delta

    async def synthesize(_text, _voice) -> Speech:
        return Speech(tiny_wav(), [(0.0, "pau")], 0.05)

    class FakeTranscriber:
        def transcribe(self, pcm: bytes) -> str:
            assert pcm
            return transcript

    monkeypatch.setattr(assistant.relay, "send", send)
    monkeypatch.setattr(assistant.relay, "publish", publish)
    monkeypatch.setattr(assistant.claude, "ask", ask)
    monkeypatch.setattr(assistant.tts, "synthesize", synthesize)
    assistant.transcriber = FakeTranscriber()
    return assistant, sent, host


async def run_command(assistant, message: dict) -> None:
    await assistant.handle_command(message)
    assert assistant.turn_task is not None
    await assistant.turn_task


def browser_audio(seconds: float = 1.0) -> str:
    return base64.b64encode(bytes(int(seconds * SAMPLE_RATE) * SAMPLE_WIDTH)).decode()


def test_reply_spoken_in_the_browser(monkeypatch, tmp_path):
    assistant, sent, host = make_assistant(monkeypatch, tmp_path)
    message = {"type": "ask-audio", "audio": browser_audio(), "reply": {"speech": "browser", "clientId": "tab-1"}}
    asyncio.run(run_command(assistant, message))

    audio = [m for m in sent if m["type"] == "audio"]
    assert len(audio) == 2
    assert all(m["clientId"] == "tab-1" for m in audio)
    assert base64.b64decode(audio[0]["wav"]) == tiny_wav()
    # ホストのスピーカーでは鳴らさない。画面のアバターの口パクは今までどおり全画面に流す
    assert host.played == []
    assert len([m for m in sent if m["type"] == "lipsync"]) == 2
    # 読み終えた後の後始末で、ブラウザの再生を止めさせない
    assert not [m for m in sent if m["type"] == "audio-stop"]

    record = next(m for m in sent if m["type"] == "turn")["record"]
    assert record["input"] == {"source": "browser-mic", "text": "今日の天気は？"}
    assert record["status"] == "answered"
    # ブラウザで話した人はホストのマイクの前にいるとは限らないので、続けて聞き始めない
    assert assistant._listen_request is None
    assert assistant.state == "idle"


def test_text_only_reply_is_not_spoken(monkeypatch, tmp_path):
    assistant, sent, host = make_assistant(monkeypatch, tmp_path)
    asyncio.run(run_command(assistant, {"type": "ask", "text": "こんにちは", "reply": {"speech": "none"}}))
    assert host.played == []
    assert not [m for m in sent if m["type"] in ("audio", "lipsync")]
    assert assistant.response == "晴れです。傘は要りません。"
    assert assistant.state == "idle"


def test_text_ask_without_reply_uses_host_speaker(monkeypatch, tmp_path):
    """これまでどおりの文字入力（返答の出し先の指定なし）はホストのスピーカーで読み上げる"""
    assistant, sent, host = make_assistant(monkeypatch, tmp_path)
    asyncio.run(run_command(assistant, {"type": "ask", "text": "こんにちは"}))
    assert len(host.played) == 2
    assert not [m for m in sent if m["type"] == "audio"]


def test_browser_audio_not_understood_does_not_chime_on_host(monkeypatch, tmp_path):
    assistant, sent, host = make_assistant(monkeypatch, tmp_path, transcript="")
    message = {"type": "ask-audio", "audio": browser_audio(), "reply": {"speech": "browser", "clientId": "tab-1"}}
    asyncio.run(run_command(assistant, message))
    assert assistant.state == "error"
    assert host.played == []


def test_too_long_browser_audio_is_rejected(monkeypatch, tmp_path):
    assistant, _sent, _host = make_assistant(monkeypatch, tmp_path)
    message = {"type": "ask-audio", "audio": browser_audio(agent.BROWSER_AUDIO_MAX_S + 1)}
    asyncio.run(assistant.handle_command(message))
    assert assistant.turn_task is None


def test_reply_falls_back_to_host_without_client_id():
    assert agent.Reply.from_message({"reply": {"speech": "browser"}}) == agent.Reply("host")
    assert agent.Reply.from_message({"reply": "browser"}) == agent.Reply("host")
    assert agent.Reply.from_message({"reply": {"speech": "none"}}) == agent.Reply("none")


def test_chat_turn_uses_selected_conversation_and_mentioned_character(monkeypatch, tmp_path):
    """チャットから話しかけると、選んだ会話で答え、「@名前」があればそのキャラクターが答える"""
    personas_dir = tmp_path / "personas"
    for persona_id, name in [("plum", "プラム"), ("karin", "カリン")]:
        (personas_dir / persona_id).mkdir(parents=True)
        (personas_dir / persona_id / "persona.json").write_text(
            f'{{"id": "{persona_id}", "name": "{name}", "wakeWords": ["{name}"]}}', encoding="utf-8"
        )
    monkeypatch.setenv("VOICE_PERSONAS_DIR", str(personas_dir))
    assistant, sent, _ = make_assistant(monkeypatch, tmp_path)
    assistant.personas = agent.load_personas(dataclasses.replace(assistant.config, personas_dir=personas_dir))
    calls = []
    owners = []

    async def ask(text, persona, conversation_id=None, attachments=(), guard=None, owner=None):
        calls.append((text, persona.id, conversation_id))
        owners.append(owner)
        # 本物と同じく、会話を選んで答えたら今の会話がそれになる
        assistant.claude._session_id = conversation_id or assistant.claude._session_id
        assistant.claude._owner = owner
        yield "はい。"

    monkeypatch.setattr(assistant.claude, "ask", ask)
    chat = "33333333-3333-4333-8333-333333333333"
    message = {"type": "ask", "text": "＠カリン おすすめは？", "personaId": "plum", "conversationId": chat, "reply": {"speech": "none"}}
    asyncio.run(run_command(assistant, message))
    assert calls == [("＠カリン おすすめは？", "karin", chat)]
    assert assistant.snapshot()["conversationId"] == chat
    assert owners == [None]

    # 自分の画面から話しかけた会話は、その人のものとして画面と記録に伝える（サーバーが本人にだけ見せる）
    mom = "55555555-5555-4555-8555-555555555555"
    asyncio.run(run_command(assistant, {**message, "owner": mom, "accountId": mom}))
    assert owners[-1] == mom
    assert assistant.snapshot()["owner"] == mom
    assert [m["record"]["owner"] for m in sent if m["type"] == "turn"][-1] == mom

    # 形の違う会話のIDは無視して、今の会話で答える
    asyncio.run(run_command(assistant, {**message, "text": "ありがとう", "conversationId": "../x"}))
    assert calls[-1] == ("ありがとう", "plum", None)


def test_chat_attachments_are_fetched_and_recorded(monkeypatch, tmp_path):
    assistant, sent, _ = make_assistant(monkeypatch, tmp_path)
    given = []

    async def ask(text, persona, conversation_id=None, attachments=(), guard=None, owner=None):
        given.append((text, list(attachments)))
        yield "赤いです。"

    class FakeResponse:
        content = b"\x89PNG"

        def raise_for_status(self) -> None:
            pass

    fetched = []

    async def get(url, **_kwargs):
        fetched.append(url)
        return FakeResponse()

    monkeypatch.setattr(assistant.claude, "ask", ask)
    monkeypatch.setattr(assistant.http, "get", get)
    photo = {"id": "11111111-1111-4111-8111-111111111111", "name": "photo.png", "type": "image/png", "kind": "image"}
    message = {"type": "ask", "text": "", "attachments": [photo, "bad"], "reply": {"speech": "none"}}
    asyncio.run(run_command(assistant, message))

    assert fetched == [f"/api/voice/attachments/{photo['id']}"]
    ((text, blocks),) = given
    assert text == ""
    assert blocks == [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "iVBORw=="}}]
    (turn,) = [m["record"] for m in sent if m["type"] == "turn"]
    assert turn["input"]["attachments"] == [photo]
