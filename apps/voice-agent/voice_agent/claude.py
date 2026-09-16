import asyncio
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
- 調べる必要があるときはWeb検索を使ってよい。調べる前に「調べますね」のような一言は要らない
"""

WEEKDAYS = "月火水木金土日"


class ClaudeError(RuntimeError):
    pass


class ClaudeConversation:
    """
    `claude -p` を1ターンごとに起動する。直前のやり取りから時間が空いていなければ --resume で会話を続ける。

    部屋にいる人（やテレビの音）なら誰でも話しかけられるので、Claude Code の権限は絞って起動する:
    --restricted でユーザー/プロジェクト設定（許可ルールやhooks）を読まず、--strict-mcp-config でMCPサーバーを
    読み込まず、--tools で使えるツールを明示したものだけにする。
    """

    def __init__(self, config: Config) -> None:
        self._config = config
        self._session_id: str | None = None
        self._last_turn_at = 0.0
        config.claude_cwd.mkdir(parents=True, exist_ok=True)

    def forget(self) -> None:
        self._session_id = None

    async def ask(self, text: str) -> AsyncIterator[str]:
        """返答のテキストを差分で返す。ツール呼び出しを挟んで複数メッセージに分かれた場合は間に改行を入れる"""
        c = self._config
        if self._session_id and time.monotonic() - self._last_turn_at > c.session_idle_s:
            self._session_id = None

        now = datetime.now()
        prompt = f"[現在日時: {now:%Y-%m-%d %H:%M}（{WEEKDAYS[now.weekday()]}）]\n{text}"
        args = [
            c.claude_bin,
            "-p",
            prompt,
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--restricted",
            "--strict-mcp-config",
            "--tools",
            c.claude_tools,
            # --tools は「使える」ようにするだけで、-p では許可を求める場面で拒否になる。同じものを事前に許可しておく
            "--allowedTools",
            c.claude_tools,
            "--append-system-prompt",
            SYSTEM_PROMPT,
        ]
        if c.claude_model:
            args += ["--model", c.claude_model]
        if self._session_id:
            args += ["--resume", self._session_id]

        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=c.claude_cwd,
            # stdinを開いたままにすると「no stdin data received in 3s」で3秒待たされる
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            # system/init の行（スラッシュコマンド一覧など）が既定の64KiBを超えることがある
            limit=16 * 1024 * 1024,
        )
        assert proc.stdout is not None and proc.stderr is not None
        deadline = time.monotonic() + c.claude_timeout_s
        result: dict | None = None
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ClaudeError("Claude Code の応答がタイムアウトしました")
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), remaining)
                except TimeoutError:
                    raise ClaudeError("Claude Code の応答がタイムアウトしました") from None
                if not line:
                    break
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
                elif kind == "result":
                    result = event

            await proc.wait()
            if result is None:
                stderr = (await proc.stderr.read()).decode(errors="replace").strip()
                raise ClaudeError(f"Claude Code が結果を返さずに終了しました (exit {proc.returncode}): {stderr[-500:]}")
            if result.get("is_error"):
                raise ClaudeError(f"Claude Code がエラーを返しました: {result.get('result') or result.get('subtype')}")
            self._last_turn_at = time.monotonic()
        finally:
            if proc.returncode is None:
                proc.kill()
                await proc.wait()
