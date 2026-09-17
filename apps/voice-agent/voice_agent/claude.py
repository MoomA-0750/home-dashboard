import asyncio
import contextlib
import json
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime, timedelta

from .config import Config
from .personas import Persona, Personas

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

CHARACTERS_PROMPT = """
# キャラクター
この家の音声アシスタントは、次のキャラクターたちが声を担当している。

- 話しかけてくるのは、この家に住むユーザー（人間）。メッセージの先頭の [話しかけられた相手: 名前] は、
  ユーザーが呼んだキャラクター（あなたが演じる相手）で、話しかけた人ではない
- そのキャラクターとして、その一人称・口調で答える。ほかのキャラクターの台詞を代わりに書いたり、一人で何人も演じたりしない
- 会話の記録はキャラクター全員で共有している。前に別のキャラクターが答えたことも踏まえて、
  そのキャラクターがユーザーに話していたこととして自然に扱う（例: 「さっきカリンちゃんが教えてたやつだね」）
- （ ）の表情やしぐさの描写は画面にだけ表示され、読み上げられない。使うなら1回の返事に1つまで、短く書く
- キャラクターを演じていても、天気・家電・音楽などの頼まれごとはツールを使ってきちんとこなし、
  上の読み上げのルール（短く話す、Markdownを使わない など）も守る
"""

WEEKDAYS = "月火水木金土日"
SOURCE_LABELS = {"wake": "声で", "follow-up": "続けて声で", "button": "ボタンから声で", "text": "文字で"}

HistoryProvider = Callable[[], Awaitable[list[dict]]]


def build_system_prompt(personas: Personas, dashboard: bool) -> str:
    prompt = SYSTEM_PROMPT + (DASHBOARD_PROMPT if dashboard else "")
    if not personas.has_characters:
        return prompt
    sections = [CHARACTERS_PROMPT]
    if personas.world:
        sections.append(f"## キャラクターたちの共通の設定\n{personas.world}")
    for persona in personas.personas:
        body = persona.prompt or "特別なキャラクター設定は無い。落ち着いた素のアシスタントとして答える。"
        sections.append(f"## {persona.name}\n{body}")
    return prompt + "\n\n".join(sections)


def format_history(records: list[dict], now: datetime, hours: float, limit: int) -> str:
    """共有しているやり取りの記録を、新しい会話の最初に渡す文にする"""
    since = now - timedelta(hours=hours)
    lines = []
    for record in records[-limit:]:
        try:
            at = datetime.fromisoformat(record["at"]).astimezone().replace(tzinfo=None)
        except (KeyError, ValueError):
            continue
        if at < since or not record.get("response"):
            continue
        source = SOURCE_LABELS.get(record.get("source", ""), "")
        response = record["response"].replace("\n", " ")
        if len(response) > 160:
            response = response[:160] + "…"
        name = record.get("personaName", "?")
        # 「プラムに「…」 → プラム「…」」のような書き方だと、キャラクターが質問したと読み違えた。主語をはっきり書く
        lines.append(
            f"- {at:%m/%d %H:%M} ユーザーが{name}に{source}「{record.get('transcript', '')}」と話しかけ、"
            f"{name}が「{response}」と答えた"
        )
    if not lines:
        return ""
    return "[これまでのやり取りの記録（前の会話から引き継ぐ。誰が答えたかも含む）]\n" + "\n".join(lines)


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

    キャラクターが複数いても会話は1本にして、記憶を全員で共有する。全員の設定をシステムプロンプトに入れておき、
    質問ごとに「話しかけられた相手」を添えてそのキャラクターとして答えさせる（誰が答えたかが会話に残る）。
    新しい会話を始めるときは、history から直近のやり取りの記録をもらって最初の質問に添える。
    """

    def __init__(self, config: Config, personas: Personas, history: HistoryProvider | None = None) -> None:
        self._config = config
        self._personas = personas
        self._history = history
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
        system_prompt = build_system_prompt(self._personas, c.dashboard_mcp)
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

    async def ask(self, text: str, persona: Persona) -> AsyncIterator[str]:
        """返答のテキストを差分で返す。ツール呼び出しを挟んで複数メッセージに分かれた場合は間に改行を入れる"""
        async with self._lock, contextlib.aclosing(self._ask(text, persona)) as stream:
            async for delta in stream:
                yield delta

    async def _ask(self, text: str, persona: Persona) -> AsyncIterator[str]:
        proc = await self._ensure_process()
        assert proc.stdin is not None and proc.stdout is not None

        now = datetime.now()
        lines = [f"[現在日時: {now:%Y-%m-%d %H:%M}（{WEEKDAYS[now.weekday()]}）]"]
        if self._session_id is None and self._history:
            try:
                records = await self._history()
            except Exception as err:  # 記録が取れなくても質問には答える
                log.warning("やり取りの記録を取得できませんでした: %s", err)
                records = []
            if block := format_history(records, now, self._config.history_hours, self._config.history_turns):
                lines.append(block)
        if self._personas.has_characters:
            lines.append(f"[話しかけられた相手: {persona.name}]")
        lines.append(text)
        content = "\n".join(lines)
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
