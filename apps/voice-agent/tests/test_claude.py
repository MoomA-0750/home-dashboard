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

from voice_agent.claude import ClaudeConversation, format_history
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


async def collect(conversation: ClaudeConversation, text: str, persona: Persona = PLAIN.personas[0]) -> str:
    async with contextlib.aclosing(conversation.ask(text, persona)) as stream:
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
    assert option(args, "--allowedTools") == "WebSearch,WebFetch,mcp__dashboard"
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


def test_dashboard_tools_can_be_disabled(make_conversation):
    conversation = make_conversation(dashboard_mcp=False)
    asyncio.run(collect(conversation, "こんにちは"))
    (start,) = [e for e in make_conversation.events() if e["event"] == "start"]
    assert "--mcp-config" not in start["args"]
    assert "mcp__dashboard" not in option(start["args"], "--allowedTools")


def test_message_includes_current_time(make_conversation):
    conversation = make_conversation()
    asyncio.run(collect(conversation, "今何時？"))
    (message,) = [e for e in make_conversation.events() if e["event"] == "message"]
    assert message["content"].startswith("[現在日時: ")
    assert message["content"].endswith("\n今何時？")


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
        while not received:
            await asyncio.sleep(0.05)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        return await collect(conversation, "次の質問")

    assert asyncio.run(scenario()) == "受け取りました。\n"
    starts = [e for e in make_conversation.events() if e["event"] == "start"]
    assert len(starts) == 2
    assert "--resume" not in starts[0]["args"]
    assert "--resume" in starts[1]["args"]


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

    async def history() -> list[dict]:
        calls.append(True)
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
