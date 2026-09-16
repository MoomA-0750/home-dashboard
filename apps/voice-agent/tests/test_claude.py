"""Claude Code の起動引数（権限を絞るフラグ）と、常駐プロセスの使い回し・作り直しのテスト。偽の claude を使う"""

import asyncio
import contextlib
import dataclasses
import json
import os
import signal
import sys
from pathlib import Path

import pytest

from voice_agent.claude import ClaudeConversation
from voice_agent.config import load_config

FAKE_CLAUDE = Path(__file__).with_name("fake_claude.py")


@pytest.fixture
def make_conversation(tmp_path, monkeypatch):
    log = tmp_path / "claude.log"
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(log))
    wrapper = tmp_path / "claude"
    wrapper.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{FAKE_CLAUDE}" "$@"\n')
    wrapper.chmod(0o755)

    def make(**overrides) -> ClaudeConversation:
        defaults = {
            "claude_bin": str(wrapper),
            "claude_cwd": tmp_path / "workspace",
            "server_url": "http://127.0.0.1:8787",
            "agent_token": "",
            "dashboard_mcp": True,
            "claude_timeout_s": 10,
        }
        config = dataclasses.replace(load_config(), **{**defaults, **overrides})
        return ClaudeConversation(config)

    def events() -> list[dict]:
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    make.events = events
    yield make

    # プロセスはテストごとの asyncio.run の中で起動しているので、終わった後はPIDで直接止める
    for event in events():
        with contextlib.suppress(ProcessLookupError):
            os.kill(event["pid"], signal.SIGKILL)


async def collect(conversation: ClaudeConversation, text: str) -> str:
    async with contextlib.aclosing(conversation.ask(text)) as stream:
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
            async with contextlib.aclosing(conversation.ask("SLOW な質問")) as stream:
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
