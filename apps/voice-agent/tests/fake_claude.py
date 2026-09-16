"""
`claude -p --input-format stream-json` の代わりに起動する偽物。受け取った引数とメッセージを FAKE_CLAUDE_LOG に書き、
決まった返答を stream-json で返す。メッセージに "SLOW" を含めると返答の途中で止まる（中止のテスト用）。
"""

import json
import os
import sys
import time
import uuid

args = sys.argv[1:]
session_id = args[args.index("--resume") + 1] if "--resume" in args else str(uuid.uuid4())


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
for line in sys.stdin:
    content = json.loads(line)["message"]["content"]
    record(event="message", content=content)
    emit({"type": "system", "subtype": "init"})
    emit(text_delta("受け"))
    if "SLOW" in content:
        time.sleep(60)
    emit(text_delta("取りました。"))
    emit({"type": "stream_event", "parent_tool_use_id": None, "event": {"type": "message_stop"}})
    emit({"type": "result", "subtype": "success", "is_error": False, "result": "受け取りました。"})
