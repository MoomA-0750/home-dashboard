"""Claude Code の起動引数（権限を絞るフラグ）と、常駐プロセスの使い回し・作り直しのテスト。偽の claude を使う"""

import asyncio
import contextlib
import dataclasses
import json
import os
import signal
import sys
from datetime import datetime
from pathlib import Path

import pytest

from voice_agent.claude import ClaudeConversation, attachment_block, format_history
from voice_agent.config import load_config
from voice_agent.personas import Expression, Persona, Personas

FAKE_CLAUDE = Path(__file__).with_name("fake_claude.py")

PLUM = Persona(
    "plum",
    "プラム",
    [["ねえ", "プラム"]],
    [],
    "一人称はプラム。明るく弾む口調。",
    70,
    1.1,
    {"にっこり": Expression("にっこり", {"happy": 0.6}), "ドヤ顔": Expression("ドヤ顔", {"doya_1": 1.0})},
)
KARIN = Persona("karin", "カリン", [["ねえ", "カリン"]], [], "一人称はわたし。お姉さんぶる。", 2, 1.1)
CHARACTERS = Personas([PLUM, KARIN], world="姉妹たちは一緒に暮らしている。")
PLAIN = Personas([Persona("claude", "Claude", [["ねえ", "クロード"]], [], "", 3, 1.1)], world="")


@pytest.fixture
def make_conversation(tmp_path, monkeypatch):
    log = tmp_path / "claude.log"
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(log))
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path / "claude-config"))
    wrapper = tmp_path / "claude"
    wrapper.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{FAKE_CLAUDE}" "$@"\n')
    wrapper.chmod(0o755)

    def make(personas: Personas = PLAIN, history=None, **overrides) -> ClaudeConversation:
        defaults = {
            "claude_bin": str(wrapper),
            "claude_cwd": tmp_path / "workspace",
            "server_url": "http://127.0.0.1:8787",
            "agent_token": "",
            "dashboard_mcp": True,
            "claude_timeout_s": 10,
        }
        config = dataclasses.replace(load_config(), **{**defaults, **overrides})
        return ClaudeConversation(config, personas, history)

    def events() -> list[dict]:
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    make.events = events
    yield make

    # プロセスはテストごとの asyncio.run の中で起動しているので、終わった後はPIDで直接止める
    for event in events():
        with contextlib.suppress(ProcessLookupError):
            os.kill(event["pid"], signal.SIGKILL)


async def collect(
    conversation: ClaudeConversation,
    text: str,
    persona: Persona = PLAIN.personas[0],
    conversation_id: str | None = None,
    owner: str | None = None,
) -> str:
    async with contextlib.aclosing(conversation.ask(text, persona, conversation_id, owner=owner)) as stream:
        return "".join([delta async for delta in stream])


def option(args: list[str], name: str) -> str:
    return args[args.index(name) + 1]


def test_starts_claude_with_restricted_permissions(make_conversation):
    """部屋にいる誰の声でも動くので、権限を絞るフラグが外れていないことを確かめる"""
    conversation = make_conversation(agent_token="secret", claude_tools="WebSearch,WebFetch")
    assert asyncio.run(collect(conversation, "こんにちは")) == "受け取りました。\n"

    (start,) = [e for e in make_conversation.events() if e["event"] == "start"]
    args = start["args"]
    assert "--restricted" in args
    assert "--strict-mcp-config" in args
    assert option(args, "--tools") == "WebSearch,WebFetch"
    # どの道具も事前には許さず、使うたびに尋ねてもらう（サーバーの確かめに回す）
    assert "--allowedTools" not in args
    assert option(args, "--permission-prompt-tool") == "stdio"
    assert not any("bypass" in a.lower() or "skip-permissions" in a for a in args)

    mcp = json.loads(option(args, "--mcp-config"))
    assert mcp == {
        "mcpServers": {
            "dashboard": {
                "type": "http",
                "url": "http://127.0.0.1:8787/mcp",
                "headers": {"Authorization": "Bearer secret"},
            }
        }
    }


class FakeGuard:
    """サーバーの確かめの代わり。決まった答えを返し、尋ねられた道具を覚える"""

    def __init__(self, *decisions: dict) -> None:
        self.decisions = list(decisions)
        self.checked: list[tuple[str, dict]] = []
        self.waited: list[str] = []

    async def check(self, tool: str, tool_input: dict) -> dict:
        self.checked.append((tool, tool_input))
        return self.decisions.pop(0)

    async def wait(self, request_id: str) -> dict:
        self.waited.append(request_id)
        return self.decisions.pop(0)


async def collect_with(conversation: ClaudeConversation, text: str, guard) -> str:
    async with contextlib.aclosing(conversation.ask(text, PLAIN.personas[0], None, (), guard)) as stream:
        return "".join([delta async for delta in stream])


def control_responses(make_conversation) -> list[dict]:
    return [e["response"]["response"] for e in make_conversation.events() if e["event"] == "control_response"]


def test_tool_use_is_decided_by_the_guard(make_conversation):
    """道具を使ってよいかは、Claude ではなくサーバーの確かめで決まる"""
    conversation = make_conversation()
    guard = FakeGuard({"decision": "allow"})
    assert asyncio.run(collect_with(conversation, "TOOL 天気は？", guard)) == "[allow]受け取りました。\n"
    assert guard.checked == [("mcp__dashboard__get_weather", {"day": 1})]
    (response,) = control_responses(make_conversation)
    assert response == {
        "subtype": "success",
        "request_id": "req-1",
        "response": {"behavior": "allow", "updatedInput": {"day": 1}},
    }


def test_denied_tool_use_passes_the_reason_to_claude(make_conversation):
    conversation = make_conversation()
    guard = FakeGuard({"decision": "deny", "message": "了承が要ります"})
    assert asyncio.run(collect_with(conversation, "TOOL 鍵を開けて", guard)).startswith("[deny]")
    (response,) = control_responses(make_conversation)
    assert response["response"] == {"behavior": "deny", "message": "了承が要ります"}


def test_waits_for_approval_on_screen_and_says_so(make_conversation):
    """画面での許可を待つ間は、その旨を読み上げ、答えが出るまで待つ"""
    conversation = make_conversation()
    guard = FakeGuard(
        {"decision": "pending", "requestId": "r1", "say": "画面で許可をお願いします。"},
        {"decision": "pending", "requestId": "r1", "say": ""},
        {"decision": "allow"},
    )
    reply = asyncio.run(collect_with(conversation, "TOOL 鍵を開けて", guard))
    assert reply == "画面で許可をお願いします。\n[allow]受け取りました。\n"
    assert guard.waited == ["r1", "r1"]


def test_tools_are_refused_without_a_guard_or_when_it_fails(make_conversation):
    conversation = make_conversation()

    class BrokenGuard(FakeGuard):
        async def check(self, tool: str, tool_input: dict) -> dict:
            raise RuntimeError("server is down")

    async def scenario() -> list[str]:
        return [
            await collect_with(conversation, "TOOL 天気は？", None),
            await collect_with(conversation, "TOOL 天気は？", BrokenGuard()),
        ]

    assert all(reply.startswith("[deny]") for reply in asyncio.run(scenario()))


def test_guest_mode_starts_an_unsaved_conversation_without_history(make_conversation):
    conversation = make_conversation()

    async def scenario() -> str | None:
        await collect(conversation, "こんにちは")
        first = conversation.session_id
        await conversation.set_guest(True)
        await collect(conversation, "こんにちは")
        return first

    first = asyncio.run(scenario())
    assert conversation.guest is True
    starts = [e for e in make_conversation.events() if e["event"] == "start"]
    assert "--no-session-persistence" in starts[-1]["args"]
    assert conversation.session_id != first


def test_dashboard_tools_can_be_disabled(make_conversation):
    conversation = make_conversation(dashboard_mcp=False)
    asyncio.run(collect(conversation, "こんにちは"))
    (start,) = [e for e in make_conversation.events() if e["event"] == "start"]
    assert "--mcp-config" not in start["args"]


def test_message_includes_current_time(make_conversation):
    conversation = make_conversation()
    asyncio.run(collect(conversation, "今何時？"))
    (message,) = [e for e in make_conversation.events() if e["event"] == "message"]
    assert message["content"].startswith("[現在日時: ")
    assert message["content"].endswith("\n今何時？")


def test_attachments_are_passed_as_content_blocks(make_conversation):
    conversation = make_conversation()
    blocks = [
        attachment_block("image", "photo.png", "image/png", b"\x89PNG"),
        attachment_block("pdf", "doc.pdf", "application/pdf", b"%PDF-1.4"),
        attachment_block("text", "memo.txt", "text/plain; charset=utf-8", "牛乳を買う".encode()),
    ]

    async def scenario() -> None:
        async with contextlib.aclosing(conversation.ask("これ見て", PLAIN.personas[0], None, blocks)) as stream:
            async for _ in stream:
                pass

    asyncio.run(scenario())
    (message,) = [e for e in make_conversation.events() if e["event"] == "message"]
    text, image, pdf, memo = message["content"]
    assert text["type"] == "text" and text["text"].endswith("\nこれ見て")
    assert image == {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "iVBORw=="}}
    assert pdf["type"] == "document" and pdf["title"] == "doc.pdf"
    assert memo == {"type": "text", "text": "[添付ファイル: memo.txt]\n牛乳を買う"}


def test_reuses_one_process_across_turns(make_conversation):
    conversation = make_conversation()

    async def scenario() -> None:
        await conversation.start()
        await collect(conversation, "1つ目")
        await collect(conversation, "2つ目")

    asyncio.run(scenario())
    events = make_conversation.events()
    assert [e["event"] for e in events] == ["start", "message", "message"]
    assert len({e["pid"] for e in events}) == 1


def test_cancel_restarts_process_and_resumes_conversation(make_conversation):
    """中止したら読みかけの応答を捨てるためにプロセスを作り直し、--resume で会話を引き継ぐ"""
    conversation = make_conversation()

    async def scenario() -> str:
        received: list[str] = []

        async def slow_turn() -> None:
            async with contextlib.aclosing(conversation.ask("SLOW な質問", PLAIN.personas[0])) as stream:
                async for delta in stream:
                    received.append(delta)

        task = asyncio.create_task(slow_turn())

        async def first_delta() -> None:
            while not received:
                await asyncio.sleep(0.05)

        # 壊れたときに止まらなくならないよう、待つのは5秒まで
        await asyncio.wait_for(first_delta(), 5)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        return await collect(conversation, "次の質問")

    assert asyncio.run(scenario()) == "受け取りました。\n"
    starts = [e for e in make_conversation.events() if e["event"] == "start"]
    assert len(starts) == 2
    assert "--resume" not in starts[0]["args"]
    assert option(starts[1]["args"], "--resume") == option(starts[0]["args"], "--session-id")


def test_starts_new_conversation_after_idle(make_conversation):
    conversation = make_conversation(session_idle_s=0.3)

    async def scenario() -> None:
        await collect(conversation, "1つ目")
        # 期限が来たら、次の質問を待たずに新しい会話用のプロセスを起動しておく
        await asyncio.sleep(2)
        await collect(conversation, "2つ目")

    asyncio.run(scenario())
    events = make_conversation.events()
    starts = [e for e in events if e["event"] == "start"]
    assert len(starts) == 2
    assert "--resume" not in starts[1]["args"]
    assert events[-1]["pid"] == starts[1]["pid"]


def test_every_character_is_in_the_system_prompt(make_conversation):
    """記憶を共有するため会話は1本にし、全員の設定を最初から渡しておく"""
    conversation = make_conversation(personas=CHARACTERS)
    asyncio.run(collect(conversation, "こんにちは", PLUM))
    (start,) = [e for e in make_conversation.events() if e["event"] == "start"]
    prompt = option(start["args"], "--append-system-prompt")
    assert "姉妹たちは一緒に暮らしている。" in prompt
    assert "## プラム\n一人称はプラム。明るく弾む口調。\n\n使える表情: （にっこり）、（ドヤ顔）" in prompt
    # 表情の設定が無いキャラクターには（ ）を使わせない
    assert "## カリン\n一人称はわたし。お姉さんぶる。\n\n表情の指定（ ）は使わない。" in prompt


def test_message_names_who_should_answer(make_conversation):
    """同じ会話の中で、質問ごとに応答するキャラクターを切り替える（誰が答えたかが会話に残る）"""
    conversation = make_conversation(personas=CHARACTERS)

    async def scenario() -> None:
        await collect(conversation, "明日の天気は？", PLUM)
        await collect(conversation, "さっきプラムは何て言ってた？", KARIN)

    asyncio.run(scenario())
    messages = [e["content"] for e in make_conversation.events() if e["event"] == "message"]
    assert "[話しかけられた相手: プラム]\n明日の天気は？" in messages[0]
    assert "[話しかけられた相手: カリン]\nさっきプラムは何て言ってた？" in messages[1]
    assert len({e["pid"] for e in make_conversation.events()}) == 1


def test_plain_assistant_has_no_character_header(make_conversation):
    conversation = make_conversation()
    asyncio.run(collect(conversation, "こんにちは"))
    (message,) = [e for e in make_conversation.events() if e["event"] == "message"]
    assert "話しかけられた相手" not in message["content"]


def history_record(at: str, persona: str, source: str, text: str, output: str, status: str = "answered") -> dict:
    return {
        "id": "t1",
        "at": at,
        "conversationId": "c1",
        "persona": {"id": persona, "name": {"plum": "プラム", "karin": "カリン"}[persona]},
        "input": {"source": source, "text": text},
        "output": {"text": output, "segments": [{"expression": None, "text": output}]},
        "status": status,
    }


def test_history_is_passed_only_when_a_new_conversation_starts(make_conversation):
    """前の会話（エージェントの再起動前や、間が空いた後）で誰が何に答えたかを、新しい会話の最初に渡す"""
    calls = []

    async def history(owner: str | None) -> list[dict]:
        calls.append(owner)
        return [history_record(datetime.now().astimezone().isoformat(), "karin", "wake", "明日の天気は？", "明日は雨よ。")]

    conversation = make_conversation(personas=CHARACTERS, history=history)

    async def scenario() -> None:
        await collect(conversation, "おはよう", PLUM)
        await collect(conversation, "さっきの話だけど", PLUM)

    asyncio.run(scenario())
    first, second = [e["content"] for e in make_conversation.events() if e["event"] == "message"]
    assert "これまでのやり取りの記録" in first
    assert "これまでのやり取りの記録" not in second
    assert len(calls) == 1


def test_history_is_given_as_structured_entries():
    """文章だと「プラムに「…」 → プラム「…」」をキャラクターが質問したと読み違えたので、項目に分けて渡す"""
    now = datetime(2026, 9, 17, 12, 0)
    records = [
        history_record("2026-09-15T12:00:00", "plum", "wake", "古い", "古い返事"),
        history_record("2026-09-17T11:00:00", "plum", "text", "エラー", "", status="error"),
        history_record("2026-09-17T11:20:00", "plum", "wake", "長い話して", "途中まで", status="cancelled"),
        history_record("2026-09-17T11:30:00", "karin", "button", "新しい", "新しい返事"),
    ]
    header, *lines = format_history(records, now, hours=24, limit=20).split("\n")
    entries = [json.loads(line) for line in lines]
    assert "1行1件のJSON" in header
    assert entries == [
        {
            "時刻": "09/17 11:20",
            "話しかけた人": "ユーザー",
            "話しかけられた相手": "プラム",
            "話しかけ方": "ウェイクワードで呼んで声で",
            "ユーザーの発言": "長い話して",
            "返答した相手": "プラム",
            "返答": "途中まで",
            "備考": "返答の途中でユーザーが中止した",
        },
        {
            "時刻": "09/17 11:30",
            "話しかけた人": "ユーザー",
            "話しかけられた相手": "カリン",
            "話しかけ方": "ボタンを押して声で",
            "ユーザーの発言": "新しい",
            "返答した相手": "カリン",
            "返答": "新しい返事",
        },
    ]


CHAT_A = "11111111-1111-4111-8111-111111111111"
CHAT_B = "22222222-2222-4222-8222-222222222222"


def test_chat_can_start_and_switch_conversations(make_conversation):
    """チャットで選んだ会話で答える。まだ無い会話はそのIDで新しく始め、保存済みの会話は再開する"""
    conversation = make_conversation()

    async def scenario() -> list[str | None]:
        ids = []
        await collect(conversation, "いつもの会話")
        ids.append(conversation.session_id)
        await collect(conversation, "新しいチャット", conversation_id=CHAT_A)
        ids.append(conversation.session_id)
        await collect(conversation, "同じチャットの続き", conversation_id=CHAT_A)
        await collect(conversation, "前の会話に戻る", conversation_id=ids[0])
        ids.append(conversation.session_id)
        return ids

    first, chat, back = asyncio.run(scenario())
    assert chat == CHAT_A and back == first
    starts = [e["args"] for e in make_conversation.events() if e["event"] == "start"]
    # 同じ会話の続きではプロセスを作り直さない
    assert len(starts) == 3
    assert option(starts[0], "--session-id") == first
    assert option(starts[1], "--session-id") == CHAT_A
    assert option(starts[2], "--resume") == first


def test_chat_conversation_is_not_expired_by_idle_time(make_conversation):
    """間が空いても、チャットで選んだ会話は新しい会話に作り直さずに続ける"""
    conversation = make_conversation(session_idle_s=0.3)

    async def scenario() -> None:
        await collect(conversation, "1つ目", conversation_id=CHAT_B)
        await asyncio.sleep(1)
        await collect(conversation, "2つ目", conversation_id=CHAT_B)

    asyncio.run(scenario())
    events = make_conversation.events()
    starts = [e for e in events if e["event"] == "start"]
    messages = [e for e in events if e["event"] == "message"]
    assert len(starts) == 1 and option(starts[0]["args"], "--session-id") == CHAT_B
    assert {e["pid"] for e in messages} == {starts[0]["pid"]}


def test_new_chat_conversation_gets_recent_history(make_conversation):
    """チャットで新しく始めた会話にも直近の記録を添える（再開した会話には添えない）"""

    async def history(owner: str | None) -> list[dict]:
        return [history_record(datetime.now().astimezone().isoformat(), "karin", "wake", "明日の天気は？", "明日は雨よ。")]

    conversation = make_conversation(personas=CHARACTERS, history=history)
    async def scenario() -> None:
        await collect(conversation, "はじめまして", PLUM, conversation_id=CHAT_A)
        await collect(conversation, "別の会話", PLUM, conversation_id=CHAT_B)
        # 保存済みの会話に戻ったときは、その会話の中身があるので添えない
        await collect(conversation, "さっきの続き", PLUM, conversation_id=CHAT_A)

    asyncio.run(scenario())
    first, other, back = [e["content"] for e in make_conversation.events() if e["event"] == "message"]
    assert "明日は雨よ。" in first and "明日は雨よ。" in other
    assert "これまでのやり取りの記録" not in back


def test_history_is_bounded_however_long_the_records_are():
    """記録がいくら増えても・長くても、添えるのは件数と文字数で区切った分だけ"""
    now = datetime.now().astimezone()
    records = [history_record(now.isoformat(), "plum", "text", "質" * 1000, "答" * 1000) for _ in range(500)]
    block = format_history(records, now.replace(tzinfo=None), hours=24, limit=20)
    assert block.count("\n") == 20
    assert len(block) < 20 * 700


MOM = "55555555-5555-4555-8555-555555555555"


def test_each_owner_gets_their_own_conversation(make_conversation):
    """自分の画面の会話と部屋の会話は分ける。持ち主の違う質問が来たら新しい会話にして、その人に見せてよい記録だけを添える"""
    owners = []

    async def history(owner: str | None) -> list[dict]:
        owners.append(owner)
        return []

    conversation = make_conversation(personas=CHARACTERS, history=history)

    async def scenario() -> list[str | None]:
        ids = []
        await collect(conversation, "電気を消して", PLUM)
        ids.append(conversation.session_id)
        await collect(conversation, "病院の予約は？", PLUM, owner=MOM)
        ids.append(conversation.session_id)
        assert conversation.owner == MOM
        await collect(conversation, "続き", PLUM, owner=MOM)
        ids.append(conversation.session_id)
        # 部屋のマイクから話しかけたら、お母さんの会話は続けない
        await collect(conversation, "おはよう", PLUM)
        ids.append(conversation.session_id)
        return ids

    room, mom, mom_again, room_again = asyncio.run(scenario())
    assert mom == mom_again
    assert len({room, mom, room_again}) == 3
    assert owners == [None, MOM, None]
    assert conversation.owner is None
