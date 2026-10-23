"""
`claude -p --input-format stream-json` の代わりに起動する偽物。受け取った引数とメッセージを FAKE_CLAUDE_LOG に書き、
決まった返答を stream-json で返す。メッセージに "SLOW" を含めると返答の途中で止まる（中止のテスト用）。
"TOOL" を含めると、本物と同じく道具を使ってよいかを尋ね（control_request の can_use_tool）、答えを返答に入れる。
"""

import json
import os
import sys
import time
import uuid
from pathlib import Path

args = sys.argv[1:]
if "--resume" in args:
    session_id = args[args.index("--resume") + 1]
elif "--session-id" in args:
    session_id = args[args.index("--session-id") + 1]
else:
    session_id = str(uuid.uuid4())
# 本物と同じく、最初のメッセージを受け取ったら会話を保存する（エージェントは保存の有無で --resume するかを決める）
SESSION_FILE = Path(os.environ["CLAUDE_CONFIG_DIR"]) / "projects" / "workspace" / f"{session_id}.jsonl"


def record(**entry) -> None:
    with open(os.environ["FAKE_CLAUDE_LOG"], "a", encoding="utf-8") as f:
        f.write(json.dumps({"pid": os.getpid(), **entry}, ensure_ascii=False) + "\n")


def emit(event: dict) -> None:
    sys.stdout.write(json.dumps({**event, "session_id": session_id}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def text_delta(text: str) -> dict:
    return {
        "type": "stream_event",
        "parent_tool_use_id": None,
        "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": text}},
    }


record(event="start", args=args)
if "--resume" in args and not SESSION_FILE.exists():
    emit({"type": "result", "subtype": "error_during_execution", "is_error": True})
    sys.exit(1)
for line in sys.stdin:
    content = json.loads(line)["message"]["content"]
    record(event="message", content=content)
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    SESSION_FILE.touch()
    emit({"type": "system", "subtype": "init"})
    if "TOOL" in content:
        emit(
            {
                "type": "control_request",
                "request_id": "req-1",
                "request": {"subtype": "can_use_tool", "tool_name": "mcp__dashboard__get_weather", "input": {"day": 1}},
            }
        )
        answer = json.loads(sys.stdin.readline())
        record(event="control_response", response=answer)
        behavior = answer["response"]["response"]["behavior"]
        emit(text_delta(f"[{behavior}]"))
    emit(text_delta("受け"))
    if "SLOW" in content:
        time.sleep(60)
    emit(text_delta("取りました。"))
    emit({"type": "stream_event", "parent_tool_use_id": None, "event": {"type": "message_stop"}})
    emit({"type": "result", "subtype": "success", "is_error": False, "result": "受け取りました。"})
