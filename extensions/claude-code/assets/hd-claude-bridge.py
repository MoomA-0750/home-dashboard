#!/usr/bin/env python3
"""ダッシュボードの「Claude Code」の拡張機能が、SSH の先（この機械も）で動かす仲介のスクリプト。

~/.claude/projects のセッションのログを読み、Herdr があればそのエージェントを操作する。
ダッシュボードの鍵は authorized_keys の command= でこのスクリプトに縛る（鍵が漏れても、下の命令しか動かせない）。

    command="python3 ~/.local/bin/hd-claude-bridge.py",restrict ssh-ed25519 AAAA... home-dashboard-claude-code

命令の名前は SSH_ORIGINAL_COMMAND（ssh で渡したコマンド）か、引数の1つめ。引数は標準入力の JSON で受け取り、
答えは標準出力に JSON を1つ返す（{"ok": true, ...} か {"ok": false, "error": "..."}）。

  hello      版・機械の名前・Herdr の有無
  overview   セッションの一覧と、Herdr のエージェント・ワークスペースの一覧
  log        1つのセッションのやり取り（後ろから・続きから・前へ）
  screen     Herdr のエージェントの今の画面（文字）
  prompt     Herdr のエージェントに指示を送る
  keys       Herdr のエージェントにキーを送る（決まったものだけ）
  focus      Herdr の画面でそのエージェントを開く
  start      Herdr に新しいタブを作って Claude Code を始める（resume でセッションの続き）

Python 3.8 から動くように書く（macOS の python3 でも動かすため）。外のパッケージは使わない。
"""

import glob
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time

VERSION = 1

HOME = os.path.expanduser("~")
CLAUDE_DIR = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(HOME, ".claude")
PROJECTS_DIR = os.path.join(CLAUDE_DIR, "projects")

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
# Herdr のペインの id（w1:p3B）か、エージェントの名前
PANE_RE = re.compile(r"^(?:[A-Za-z0-9]{1,16}:p[A-Za-z0-9]{1,16}|[a-z][a-z0-9_-]{0,31})$")
WORKSPACE_RE = re.compile(r"^[A-Za-z0-9]{1,16}$")
# 送ってよいキー（Herdr の論理キー）。数字・英字1文字は選択肢を選ぶため
KEY_RE = re.compile(r"^(?:esc|enter|tab|shift\+tab|up|down|left|right|space|backspace|ctrl\+c|[0-9a-z])$")

# 1回の読み出しで読む量の上限（ログは数百 MB になることがある）
TAIL_SCAN_BYTES = 24 * 1024 * 1024
FORWARD_READ_BYTES = 8 * 1024 * 1024
LIST_TAIL_BYTES = 384 * 1024
LIST_HEAD_BYTES = 64 * 1024

TEXT_MAX = 20000
THINKING_MAX = 6000
RESULT_MAX = 8000
INPUT_STRING_MAX = 6000
PROMPT_MAX = 20000

REMINDER_RE = re.compile(r"<system-reminder>.*?</system-reminder>\s*", re.S)


class BridgeError(Exception):
    pass


# ---------------------------------------------------------------- Herdr


def herdr_path():
    extra = [
        os.path.join(HOME, ".local", "bin"),
        os.path.join(HOME, ".cargo", "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
    ]
    path = os.pathsep.join([os.environ.get("PATH", "")] + extra)
    return shutil.which("herdr", path=path)


def session_args():
    """Herdr の名前付きのセッション（HD_HERDR_SESSION。既定のセッションでないものを使うとき・試すとき）"""
    name = os.environ.get("HD_HERDR_SESSION", "")
    return ["--session", name] if re.match(r"^[A-Za-z0-9_-]{1,40}$", name) else []


def run_herdr(args, timeout=20):
    exe = herdr_path()
    if not exe:
        raise BridgeError("herdr-missing")
    try:
        proc = subprocess.run(
            [exe] + session_args() + args,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise BridgeError("herdr-timeout")
    out = proc.stdout.decode("utf-8", "replace")
    if proc.returncode != 0:
        message = proc.stderr.decode("utf-8", "replace").strip() or out.strip()
        # 失敗は JSON（{"error": {"code": ..., "message": ...}}）で返ってくる
        try:
            parsed = json.loads(message)
            err = parsed.get("error") or {}
            message = err.get("code") or err.get("message") or message
        except ValueError:
            pass
        raise BridgeError("herdr: " + message[:300])
    try:
        return json.loads(out)
    except ValueError:
        return {"text": out}


def herdr_state():
    """Herdr のエージェントとワークスペース。Herdr が無い・動いていなければ None"""
    if not herdr_path():
        return None
    try:
        agents = run_herdr(["agent", "list"]).get("result", {}).get("agents", [])
        workspaces = run_herdr(["workspace", "list"]).get("result", {}).get("workspaces", [])
    except BridgeError as err:
        return {"running": False, "error": str(err), "agents": [], "workspaces": []}
    return {
        "running": True,
        "agents": [
            {
                "pane": a.get("pane_id"),
                "name": a.get("name"),
                "kind": a.get("agent"),
                "status": a.get("agent_status"),
                "sessionId": (a.get("agent_session") or {}).get("value"),
                "cwd": a.get("foreground_cwd") or a.get("cwd"),
                "workspace": a.get("workspace_id"),
                "tab": a.get("tab_id"),
                "title": a.get("terminal_title_stripped") or "",
                "focused": bool(a.get("focused")),
            }
            for a in agents
        ],
        "workspaces": [
            {
                "id": w.get("workspace_id"),
                "label": w.get("label") or "",
                "number": w.get("number"),
                "status": w.get("agent_status"),
            }
            for w in workspaces
        ],
    }


def herdr_version():
    exe = herdr_path()
    if not exe:
        return None
    try:
        proc = subprocess.run([exe, "--version"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5)
        return proc.stdout.decode("utf-8", "replace").strip().replace("herdr ", "") or None
    except (OSError, subprocess.TimeoutExpired):
        return None


# ---------------------------------------------------------------- ログ


def read_tail(path, size):
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        end = f.tell()
        start = max(0, end - size)
        f.seek(start)
        data = f.read()
    if start > 0:
        # 途中から読んだ最初の行は欠けている
        cut = data.find(b"\n")
        data = data[cut + 1 :] if cut >= 0 else b""
    return data


def read_head(path, size):
    with open(path, "rb") as f:
        return f.read(size)


def json_lines(data):
    for raw in data.split(b"\n"):
        if not raw.strip():
            continue
        try:
            yield json.loads(raw)
        except ValueError:
            continue


def strip_reminders(text):
    return REMINDER_RE.sub("", text).strip()


def clip(text, limit):
    if text is None:
        return ""
    if len(text) <= limit:
        return text
    return text[:limit] + "\n…"


def session_summary(path):
    """一覧に出す1つのセッション。名前・最後の指示・場所は、ログの後ろ（無ければ頭）から拾う"""
    stat = os.stat(path)
    info = {
        "id": os.path.basename(path)[: -len(".jsonl")],
        "project": os.path.basename(os.path.dirname(path)),
        "mtime": stat.st_mtime,
        "size": stat.st_size,
        "title": None,
        "lastPrompt": None,
        "cwd": None,
        "branch": None,
    }
    for entry in json_lines(read_tail(path, LIST_TAIL_BYTES)):
        kind = entry.get("type")
        if kind == "custom-title" and entry.get("customTitle"):
            info["title"] = entry["customTitle"]
            info["_custom"] = True
        elif kind == "ai-title" and entry.get("aiTitle") and not info.get("_custom"):
            info["title"] = entry["aiTitle"]
        elif kind == "summary" and entry.get("summary") and not info["title"]:
            info["title"] = entry["summary"]
        elif kind == "last-prompt" and entry.get("lastPrompt"):
            info["lastPrompt"] = clip(entry["lastPrompt"], 200)
        if entry.get("gitBranch"):
            info["branch"] = entry["gitBranch"]
        if entry.get("cwd") and not info["cwd"]:
            info["cwd"] = entry["cwd"]
    # 場所は、始めたときのフォルダ（途中で cd しても、そのセッションのフォルダとして見せるもの）
    for entry in json_lines(read_head(path, LIST_HEAD_BYTES)):
        if entry.get("cwd"):
            info["cwd"] = entry["cwd"]
            break
        if not info["title"] and entry.get("type") in ("ai-title", "summary"):
            info["title"] = entry.get("aiTitle") or entry.get("summary")
    info.pop("_custom", None)
    return info


def find_session(session_id):
    if not UUID_RE.match(session_id or ""):
        raise BridgeError("bad-session")
    matches = glob.glob(os.path.join(glob.escape(PROJECTS_DIR), "*", session_id + ".jsonl"))
    if not matches:
        raise BridgeError("session-not-found")
    return max(matches, key=os.path.getmtime)


def trim_value(value, depth=0):
    """ツールの引数を小さくする（長い文は切る。深すぎるものは文にする）"""
    if isinstance(value, str):
        return clip(value, INPUT_STRING_MAX)
    if depth > 4:
        return clip(json.dumps(value, ensure_ascii=False), 400)
    if isinstance(value, dict):
        return {k: trim_value(v, depth + 1) for k, v in list(value.items())[:40]}
    if isinstance(value, list):
        return [trim_value(v, depth + 1) for v in value[:60]]
    return value


def result_text(content):
    if isinstance(content, str):
        return content, 0
    texts = []
    images = 0
    for block in content or []:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            texts.append(block.get("text") or "")
        elif block.get("type") == "image":
            images += 1
    return "\n".join(texts), images


def normalize(entry):
    """ログの1行を、画面に出す項目（0個以上）にする。出さないもの（API の記録・添付・サブエージェント）は捨てる"""
    if entry.get("isSidechain"):
        return []
    kind = entry.get("type")
    base_id = entry.get("uuid") or ""
    ts = entry.get("timestamp")
    items = []
    if kind == "user":
        if entry.get("isMeta"):
            return []
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, str):
            text = strip_reminders(content)
            if text:
                items.append({"k": "user", "id": base_id, "ts": ts, "text": clip(text, TEXT_MAX), "images": 0})
            return items
        texts = []
        images = 0
        for block in content or []:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "tool_result":
                text, result_images = result_text(block.get("content"))
                items.append(
                    {
                        "k": "result",
                        "id": block.get("tool_use_id") or base_id,
                        "ts": ts,
                        "text": clip(strip_reminders(text), RESULT_MAX),
                        "images": result_images,
                        "error": bool(block.get("is_error")),
                    }
                )
            elif btype == "text":
                texts.append(block.get("text") or "")
            elif btype == "image":
                images += 1
        text = strip_reminders("\n".join(texts))
        if text or images:
            items.append({"k": "user", "id": base_id, "ts": ts, "text": clip(text, TEXT_MAX), "images": images})
        return items
    if kind == "assistant":
        message = entry.get("message") or {}
        for index, block in enumerate(message.get("content") or []):
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            item_id = "%s:%d" % (base_id, index)
            if btype == "text" and (block.get("text") or "").strip():
                items.append({"k": "assistant", "id": item_id, "ts": ts, "text": clip(block["text"], TEXT_MAX)})
            elif btype == "thinking" and (block.get("thinking") or "").strip():
                items.append({"k": "thinking", "id": item_id, "ts": ts, "text": clip(block["thinking"], THINKING_MAX)})
            elif btype == "tool_use":
                items.append(
                    {
                        "k": "tool",
                        "id": block.get("id") or item_id,
                        "ts": ts,
                        "name": block.get("name") or "",
                        "input": trim_value(block.get("input") or {}),
                    }
                )
        if message.get("model") and items:
            items[-1]["model"] = message.get("model")
        return items
    if kind == "system":
        subtype = entry.get("subtype") or ""
        content = entry.get("content")
        if subtype in ("compact_boundary", "api_error", "local_command") or entry.get("level") == "error":
            text = content if isinstance(content, str) else ""
            items.append({"k": "system", "id": base_id, "ts": ts, "subtype": subtype, "text": clip(strip_reminders(text), 2000)})
        return items
    return []


def items_from(data):
    items = []
    for entry in json_lines(data):
        items.extend(normalize(entry))
    return items


def read_backwards(path, end, want):
    """end（バイトの位置）より前から、項目を want 個ほど集める。どこから読んだか（start）も返す"""
    step = 512 * 1024
    start = end
    items = []
    with open(path, "rb") as f:
        while start > 0 and end - start < TAIL_SCAN_BYTES:
            start = max(0, start - step)
            step = min(step * 2, 4 * 1024 * 1024)
            f.seek(start)
            data = f.read(end - start)
            begin = start
            if start > 0:
                cut = data.find(b"\n")
                if cut < 0:
                    continue
                data = data[cut + 1 :]
                begin = start + cut + 1
            items = items_from(data)
            if len(items) >= want:
                break
        else:
            begin = start
    if len(items) > want:
        # 頭の余りを捨てる。捨てた分の位置は分からないので、前を読むときは begin から読み直す（重なりは画面が id で除く）
        items = items[-want:]
    return begin, items


def cmd_log(args):
    path = find_session(str(args.get("sessionId") or ""))
    size = os.path.getsize(path)
    want = max(10, min(int(args.get("limit") or 200), 600))
    if args.get("from") is not None:
        # 続き（前に返した end から）
        start = max(0, min(int(args["from"]), size))
        with open(path, "rb") as f:
            f.seek(start)
            data = f.read(FORWARD_READ_BYTES)
        # 書きかけの最後の行は次に回す
        cut = data.rfind(b"\n")
        data = data[: cut + 1] if cut >= 0 else b""
        return {"start": start, "end": start + len(data), "size": size, "items": items_from(data), "more": start > 0}
    end = size if args.get("before") is None else max(0, min(int(args["before"]), size))
    begin, items = read_backwards(path, end, want)
    return {"start": begin, "end": size if args.get("before") is None else end, "size": size, "items": items, "more": begin > 0}


def cmd_overview(args):
    days = max(1, min(int(args.get("days") or 14), 365))
    limit = max(1, min(int(args.get("limit") or 80), 300))
    cutoff = time.time() - days * 86400
    herdr = herdr_state()
    live = set()
    if herdr:
        live = {a["sessionId"] for a in herdr["agents"] if a.get("sessionId")}
    paths = []
    for path in glob.glob(os.path.join(glob.escape(PROJECTS_DIR), "*", "*.jsonl")):
        name = os.path.basename(path)[: -len(".jsonl")]
        if not UUID_RE.match(name):
            continue
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if mtime >= cutoff or name in live:
            paths.append((mtime, path))
    paths.sort(reverse=True)
    sessions = []
    seen = set()
    for _, path in paths:
        info = session_summary(path)
        if info["id"] in seen:
            continue
        if len(sessions) >= limit and info["id"] not in live:
            continue
        seen.add(info["id"])
        sessions.append(info)
    return {"sessions": sessions, "herdr": herdr}


def cmd_hello(args):
    return {
        "version": VERSION,
        "hostname": socket.gethostname(),
        "home": HOME,
        "claude": os.path.isdir(PROJECTS_DIR),
        "herdr": herdr_version(),
    }


def pane_arg(args):
    pane = str(args.get("pane") or "")
    if not PANE_RE.match(pane):
        raise BridgeError("bad-pane")
    return pane


def cmd_screen(args):
    pane = pane_arg(args)
    lines = max(10, min(int(args.get("lines") or 60), 400))
    source = "recent-unwrapped" if args.get("recent") else "visible"
    result = run_herdr(["agent", "read", pane, "--source", source, "--lines", str(lines), "--format", "text"])
    text = result.get("text")
    if text is None:
        text = ((result.get("result") or {}).get("read") or {}).get("text") or json.dumps(result.get("result"), ensure_ascii=False)
    return {"text": text}


def cmd_prompt(args):
    pane = pane_arg(args)
    text = str(args.get("text") or "")
    if not text.strip():
        raise BridgeError("empty-prompt")
    if len(text) > PROMPT_MAX:
        raise BridgeError("prompt-too-long")
    run_herdr(["agent", "prompt", pane, text], timeout=60)
    return {}


def cmd_keys(args):
    pane = pane_arg(args)
    keys = args.get("keys") or []
    if not isinstance(keys, list) or not 1 <= len(keys) <= 16:
        raise BridgeError("bad-keys")
    for key in keys:
        if not isinstance(key, str) or not KEY_RE.match(key):
            raise BridgeError("bad-keys")
    run_herdr(["agent", "send-keys", pane] + keys)
    return {}


def cmd_focus(args):
    run_herdr(["agent", "focus", pane_arg(args)])
    return {}


def safe_cwd(raw):
    path = os.path.realpath(os.path.expanduser(str(raw or "~")))
    if not os.path.isdir(path):
        raise BridgeError("cwd-not-found")
    return path


def agent_name(cwd):
    """Herdr のエージェントの名前（[a-z][a-z0-9_-]{0,31}。同じ名前が生きていると始められないので、後ろに乱数を付ける）"""
    base = re.sub(r"[^a-z0-9]+", "-", os.path.basename(cwd).lower()).strip("-")[:20] or "claude"
    if not base[0].isalpha():
        base = "c-" + base
    return "%s-%s" % (base, os.urandom(2).hex())


def cmd_start(args):
    cwd = safe_cwd(args.get("cwd"))
    resume = args.get("resume")
    if resume is not None and not UUID_RE.match(str(resume)):
        raise BridgeError("bad-session")
    workspace = args.get("workspace")
    label = os.path.basename(cwd) or cwd
    if workspace:
        if not WORKSPACE_RE.match(str(workspace)):
            raise BridgeError("bad-workspace")
        created = run_herdr(["tab", "create", "--workspace", str(workspace), "--cwd", cwd, "--label", label, "--no-focus"])
    else:
        created = run_herdr(["workspace", "create", "--cwd", cwd, "--label", label, "--no-focus"])
    pane = ((created.get("result") or {}).get("root_pane") or {}).get("pane_id")
    if not pane:
        raise BridgeError("herdr: no pane")
    name = agent_name(cwd)
    command = ["agent", "start", name, "--kind", "claude", "--pane", pane, "--timeout", "45000"]
    if resume:
        command += ["--", "--resume", str(resume)]
    try:
        run_herdr(command, timeout=60)
    except BridgeError as err:
        # 起動中に確認（フォルダを信頼するかなど）が出たときは、画面で答えてもらう
        if "agent_not_ready" not in str(err):
            raise
    return {"pane": pane, "name": name}


COMMANDS = {
    "hello": cmd_hello,
    "overview": cmd_overview,
    "log": cmd_log,
    "screen": cmd_screen,
    "prompt": cmd_prompt,
    "keys": cmd_keys,
    "focus": cmd_focus,
    "start": cmd_start,
}

MAX_INPUT = 256 * 1024


def main():
    original = os.environ.get("SSH_ORIGINAL_COMMAND")
    words = original.split() if original is not None else sys.argv[1:]
    name = words[0] if words else ""
    handler = COMMANDS.get(name)
    if handler is None:
        out = {"ok": False, "error": "unknown-command"}
    else:
        try:
            raw = sys.stdin.read(MAX_INPUT) if not sys.stdin.isatty() else ""
            args = json.loads(raw) if raw.strip() else {}
            if not isinstance(args, dict):
                raise BridgeError("bad-input")
            out = dict(handler(args), ok=True)
        except BridgeError as err:
            out = {"ok": False, "error": str(err)}
        except (ValueError, TypeError) as err:
            out = {"ok": False, "error": "bad-input: %s" % err}
        except OSError as err:
            out = {"ok": False, "error": "os: %s" % err.strerror}
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
