"""
音声アシスタントの Claude に使わせる MCP サーバーの選び方。

選べるのは、claude.ai のコネクター（Gmail・Google カレンダーなど、アカウントにつないだもの）と、
このホストの Claude Code に登録済みの MCP サーバー（`claude mcp add` したもの）と、設定画面で足したもの（URL）。
どれを使うかは設定画面で選んでサーバーに保存され、つなぐたびにサーバーから届く（McpSelection）。

部屋にいる人なら誰でも話しかけられるので、既定では何も使わない（ダッシュボードのMCPだけ）。
どの道具をどこまで使わせるか（そのまま・了承・画面での許可）は、ダッシュボードのサーバーが道具ごとに決める
（Claude Code の権限の問い合わせを、claude.py がサーバーの /api/voice/guard へ回す）。
使えるものの一覧はこのホストで `claude mcp list` して作る（claude.ai のコネクターはアカウント側で増減する）。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

SCAN_TIMEOUT_S = 120
CONNECTOR_PREFIX = "claude.ai "
CUSTOM_NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
# `claude mcp list` の1行（"名前: 接続先 - ✔ Connected"）
LIST_LINE = re.compile(r"^(?P<name>[^:]+): (?P<target>.+) - (?P<status>.+)$")


@dataclass(frozen=True)
class McpServer:
    """`claude mcp list` で見つかったもの"""

    name: str
    # connector: claude.ai のコネクター / local: このホストの Claude Code に登録済みのもの
    kind: str
    # 接続先（URL か、起動するコマンド）。画面に出すのと、コネクターを許可するのに使う
    target: str
    # connected / needs-auth / failed
    status: str
    # local のときの設定（~/.claude.json の mcpServers。--mcp-config にそのまま渡す）。プロジェクト単位の登録など、
    # ここから読めないものは None で、選べない
    config: dict | None = None

    def to_message(self) -> dict:
        return {
            "name": self.name,
            "kind": self.kind,
            "target": self.target,
            "status": self.status,
            "available": self.kind == "connector" or self.config is not None,
        }


@dataclass(frozen=True)
class CustomServer:
    """設定画面で URL を入れて足したもの（Streamable HTTP の MCP サーバー）"""

    name: str
    url: str
    token: str = ""


@dataclass(frozen=True)
class McpSelection:
    """設定画面で選んだもの。enabled は McpServer.name"""

    enabled: tuple[str, ...] = ()
    custom: tuple[CustomServer, ...] = ()

    @classmethod
    def from_message(cls, message: dict) -> McpSelection:
        enabled = message.get("enabled")
        custom = message.get("custom")
        return cls(
            enabled=tuple(sorted(n for n in enabled if isinstance(n, str))) if isinstance(enabled, list) else (),
            custom=tuple(
                CustomServer(c["name"], c["url"], c.get("token") or "")
                for c in (custom if isinstance(custom, list) else [])
                if isinstance(c, dict)
                and isinstance(c.get("name"), str)
                and CUSTOM_NAME.match(c["name"])
                and isinstance(c.get("url"), str)
                and c["url"].startswith(("http://", "https://"))
            ),
        )


@dataclass
class McpCatalog:
    servers: list[McpServer] = field(default_factory=list)
    scanned_at: str | None = None
    error: str | None = None

    def get(self, name: str) -> McpServer | None:
        return next((s for s in self.servers if s.name == name), None)

    def to_message(self) -> dict:
        return {
            "type": "mcp-catalog",
            "servers": [s.to_message() for s in self.servers],
            "scannedAt": self.scanned_at,
            "error": self.error,
        }


def _status(text: str) -> str:
    lowered = text.lower()
    if "connected" in lowered:
        return "connected"
    if "auth" in lowered:
        return "needs-auth"
    return "failed"


def _user_servers(claude_json: Path) -> dict[str, dict]:
    try:
        data = json.loads(claude_json.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    servers = data.get("mcpServers")
    return servers if isinstance(servers, dict) else {}


def parse_list(output: str, user_servers: dict[str, dict]) -> list[McpServer]:
    servers = []
    for line in output.splitlines():
        match = LIST_LINE.match(line.strip())
        if not match:
            continue
        name = match["name"].strip()
        kind = "connector" if name.startswith(CONNECTOR_PREFIX) else "local"
        config = user_servers.get(name) if kind == "local" else None
        servers.append(
            McpServer(
                name=name,
                kind=kind,
                target=match["target"].strip().removesuffix(" (HTTP)").removesuffix(" (SSE)"),
                status=_status(match["status"]),
                config=config if isinstance(config, dict) else None,
            )
        )
    return servers


async def scan(claude_bin: str, cwd: Path, claude_json: Path | None = None) -> McpCatalog:
    """このホストの Claude Code で使える MCP サーバーを調べる（各サーバーへの接続確認を含むので数秒かかる）"""
    scanned_at = datetime.now().astimezone().isoformat(timespec="seconds")
    try:
        proc = await asyncio.create_subprocess_exec(
            claude_bin,
            "mcp",
            "list",
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(proc.communicate(), SCAN_TIMEOUT_S)
        except TimeoutError:
            proc.kill()
            await proc.wait()
            return McpCatalog(scanned_at=scanned_at, error=f"{SCAN_TIMEOUT_S}秒たっても一覧が取れませんでした")
    except OSError as error:
        return McpCatalog(scanned_at=scanned_at, error=f"claude を起動できません: {error}")
    if proc.returncode != 0:
        return McpCatalog(scanned_at=scanned_at, error=err.decode(errors="replace").strip()[-300:] or "一覧が取れませんでした")
    servers = parse_list(out.decode(errors="replace"), _user_servers(claude_json or Path.home() / ".claude.json"))
    return McpCatalog(servers=servers, scanned_at=scanned_at)


@dataclass(frozen=True)
class McpPlan:
    """Claude Code の起動引数にする形（選んだもののうち、今使えるもの）"""

    # --mcp-config に渡すサーバー（ダッシュボード・このホストに登録済みのもの・画面で足したもの）
    servers: dict[str, dict] = field(default_factory=dict)
    # 使う claude.ai コネクターの接続先 URL
    connector_urls: tuple[str, ...] = ()
    connector_names: tuple[str, ...] = ()

    def args(self) -> list[str]:
        args = []
        if self.servers:
            # ファイルではなく文字列で渡す（トークンをディスクに書かないため）
            args += ["--mcp-config", json.dumps({"mcpServers": self.servers})]
        if self.connector_urls:
            # claude.ai のコネクターは --mcp-config では渡せず、--strict-mcp-config を付けると全部読まれなくなる。
            # 付けずに、許可リストで選んだものだけに絞る（プラグインのMCPなど、ほかのものは読まれない）。
            # 許可リストに URL があると、URL を持つサーバーは名前では通らず URL でしか照合されない（実測）ので、
            # --mcp-config で渡すものも、URL かコマンドで許可する
            allowed = [_allow_entry(name, server) for name, server in self.servers.items()]
            allowed += [{"serverUrl": url} for url in self.connector_urls]
            args += ["--settings", json.dumps({"allowedMcpServers": allowed})]
        else:
            args += ["--strict-mcp-config"]
        return args


def _allow_entry(name: str, server: dict) -> dict:
    if isinstance(server.get("url"), str):
        return {"serverUrl": server["url"]}
    if isinstance(server.get("command"), str):
        return {"serverCommand": [server["command"], *server.get("args", [])]}
    return {"serverName": name}


def build_plan(dashboard: dict | None, selection: McpSelection, catalog: McpCatalog) -> McpPlan:
    servers: dict[str, dict] = {}
    if dashboard:
        servers["dashboard"] = dashboard
    urls, names = [], []
    for name in selection.enabled:
        server = catalog.get(name)
        if server is None:
            # 一覧を取り直す前・コネクターを外した後など。使えるかどうか分からないものは渡さない
            continue
        if server.kind == "connector":
            urls.append(server.target)
            names.append(server.name)
        elif server.config is not None and name not in servers:
            servers[name] = server.config
    for custom in selection.custom:
        if custom.name in servers:
            continue
        server = {"type": "http", "url": custom.url}
        if custom.token:
            server["headers"] = {"Authorization": f"Bearer {custom.token}"}
        servers[custom.name] = server
    return McpPlan(servers=servers, connector_urls=tuple(urls), connector_names=tuple(names))
