import asyncio
import contextlib
import json
import logging
import time
from collections.abc import AsyncIterator
from datetime import datetime

from .config import Config

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
あなたは家のリビングに置かれたスマートスピーカー兼ディスプレイの音声アシスタントです。
あなたの返答はすべて音声合成で読み上げられ、画面にも表示されます。

- 話し言葉の日本語で、ふつうは1〜3文で短く答える。長い説明を求められたときだけ詳しく話す
- Markdown・箇条書き・表・絵文字・URL・コードブロックは使わない（読み上げで意味を成さないため）
- 数字や単位は読み上げやすい形で書く（例: 「25℃」より「25度」）
- ユーザーの発話は音声認識の結果なので、誤字や聞き間違いがあり得る。意図を汲んで答え、
  どうしても判断できないときだけ短く聞き返す
- 道具を使う前に「調べますね」のような前置きは言わない
"""

DASHBOARD_PROMPT = """
この家のダッシュボードの機能を dashboard のツールとして使える。Web検索より速く正確なので、使えるときはこちらを優先する。
- 天気（今日・明日・明後日、今後の降水確率）: get_weather。それ以外の地域や、もっと先の予報だけWeb検索する
- 家電の操作: control_home_device の説明に家電の一覧があれば、それを見て直接操作する。
  今の状態（ついているか・室温・湿度など）を答えるときは list_home_devices で確かめる。
  どの家電か曖昧なら推測で操作せず短く聞き返す。操作したら何をしたかを一言で伝える
- 音楽: get_now_playing / control_music（Spotify）
- ツールが失敗したら、返ってきた理由を短く伝える
"""

WEEKDAYS = "月火水木金土日"


class ClaudeError(RuntimeError):
    pass


class ClaudeConversation:
    """
    Claude Code を `--input-format stream-json` で常駐させ、質問のたびに標準入力へ流し込む。

    1ターンごとに `claude -p` を起動すると、起動とMCPサーバーへの接続で最初の1文字までに1.6〜2.7秒かかった。
    常駐させておくと約0.7秒になる（実測）。会話は同じプロセスの中で続き、最後のやり取りから
    session_idle_s が経ったらプロセスごと作り直して新しい会話にする（次の質問に備えて先に起動しておく）。

    部屋にいる人（やテレビの音）なら誰でも話しかけられるので、Claude Code の権限は絞って起動する:
    --restricted でユーザー/プロジェクト設定（許可ルールやhooks）を読まず、--strict-mcp-config で
    ダッシュボードのMCPサーバー以外を読み込まず、使えるツールを明示したものだけにする。
    """

    def __init__(self, config: Config) -> None:
        self._config = config
        self._proc: asyncio.subprocess.Process | None = None
        self._stderr_tail = b""
        self._session_id: str | None = None
        self._last_turn_at = 0.0
        self._expire_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        config.claude_cwd.mkdir(parents=True, exist_ok=True)

    async def start(self) -> None:
        """待ち時間を減らすため、最初の質問が来る前に起動しておく"""
        async with self._lock:
            await self._ensure_process()

    def _args(self, resume: str | None) -> list[str]:
        c = self._config
        allowed = [t for t in c.claude_tools.split(",") if t]
        system_prompt = SYSTEM_PROMPT
        args = [
            c.claude_bin,
            "-p",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--restricted",
            "--strict-mcp-config",
            "--tools",
            c.claude_tools,
        ]
        if c.dashboard_mcp:
            headers = {"Authorization": f"Bearer {c.agent_token}"} if c.agent_token else {}
            server = {"type": "http", "url": f"{c.server_url}/mcp", "headers": headers}
            # ファイルではなく文字列で渡す（トークンをディスクに書かないため）
            args += ["--mcp-config", json.dumps({"mcpServers": {"dashboard": server}})]
            allowed.append("mcp__dashboard")
            system_prompt += DASHBOARD_PROMPT
        # --tools は「使える」ようにするだけで、-p では許可を求める場面で拒否になる。同じものを事前に許可しておく
        args += ["--allowedTools", ",".join(allowed), "--append-system-prompt", system_prompt]
        if c.claude_model:
            args += ["--model", c.claude_model]
        if resume:
            args += ["--resume", resume]
        return args

    async def _ensure_process(self) -> asyncio.subprocess.Process:
        if self._session_id and time.monotonic() - self._last_turn_at > self._config.session_idle_s:
            self._session_id = None
            await self._kill()
        if self._proc and self._proc.returncode is None:
            return self._proc

        # 途中で落ちた・中止で止めた場合は、会話が続いていれば --resume で文脈を引き継ぐ
        proc = await asyncio.create_subprocess_exec(
            *self._args(self._session_id),
            cwd=self._config.claude_cwd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            # system/init の行（スラッシュコマンド一覧など）が既定の64KiBを超えることがある
            limit=16 * 1024 * 1024,
        )
        self._proc = proc
        asyncio.create_task(self._drain_stderr(proc))
        log.info("Claude Code を起動しました（%s）", "会話を再開" if self._session_id else "新しい会話")
        return proc

    async def _drain_stderr(self, proc: asyncio.subprocess.Process) -> None:
        assert proc.stderr is not None
        while chunk := await proc.stderr.read(4096):
            self._stderr_tail = (self._stderr_tail + chunk)[-2000:]

    async def _kill(self) -> None:
        proc, self._proc = self._proc, None
        if proc and proc.returncode is None:
            proc.kill()
            await proc.wait()

    def _schedule_expiry(self) -> None:
        """会話の区切りが来たら、新しい会話用のプロセスを先に起動しておく"""
        if self._expire_task:
            self._expire_task.cancel()

        async def expire() -> None:
            await asyncio.sleep(self._config.session_idle_s + 1)
            async with self._lock:
                await self._ensure_process()

        self._expire_task = asyncio.create_task(expire())

    async def ask(self, text: str) -> AsyncIterator[str]:
        """返答のテキストを差分で返す。ツール呼び出しを挟んで複数メッセージに分かれた場合は間に改行を入れる"""
        async with self._lock, contextlib.aclosing(self._ask(text)) as stream:
            async for delta in stream:
                yield delta

    async def _ask(self, text: str) -> AsyncIterator[str]:
        proc = await self._ensure_process()
        assert proc.stdin is not None and proc.stdout is not None

        now = datetime.now()
        content = f"[現在日時: {now:%Y-%m-%d %H:%M}（{WEEKDAYS[now.weekday()]}）]\n{text}"
        message = {"type": "user", "message": {"role": "user", "content": content}}
        completed = False
        try:
            proc.stdin.write((json.dumps(message, ensure_ascii=False) + "\n").encode())
            await proc.stdin.drain()
        except (BrokenPipeError, ConnectionResetError):
            await self._kill()
            raise ClaudeError("Claude Code のプロセスが終了していました") from None

        deadline = time.monotonic() + self._config.claude_timeout_s
        try:
            while True:
                remaining = deadline - time.monotonic()
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), max(remaining, 0))
                except TimeoutError:
                    raise ClaudeError("Claude Code の応答がタイムアウトしました") from None
                if not line:
                    await proc.wait()
                    tail = self._stderr_tail.decode(errors="replace").strip()
                    raise ClaudeError(f"Claude Code が応答の途中で終了しました (exit {proc.returncode}): {tail[-500:]}")
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if event.get("session_id"):
                    self._session_id = event["session_id"]
                kind = event.get("type")
                if kind == "stream_event" and event.get("parent_tool_use_id") is None:
                    inner = event["event"]
                    if inner.get("type") == "content_block_delta" and inner["delta"].get("type") == "text_delta":
                        yield inner["delta"]["text"]
                    elif inner.get("type") == "message_stop":
                        yield "\n"
                elif kind == "assistant":
                    for block in event["message"].get("content", []):
                        if block.get("type") == "tool_use":
                            log.info("ツール呼び出し: %s %s", block["name"], json.dumps(block["input"], ensure_ascii=False))
                elif kind == "result":
                    self._last_turn_at = time.monotonic()
                    completed = True
                    if event.get("is_error"):
                        raise ClaudeError(f"Claude Code がエラーを返しました: {event.get('result') or event.get('subtype')}")
                    return
        finally:
            if completed:
                self._schedule_expiry()
            else:
                # 中止・タイムアウトで応答を読み切っていないプロセスは、次の質問に前の応答の残りが混ざるので捨てる。
                # 次の質問に備えて、会話を引き継いだプロセスを起動し直しておく
                self._last_turn_at = time.monotonic()
                await self._kill()
                asyncio.create_task(self.start())
