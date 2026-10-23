"""設定画面で選んだコネクター・MCPサーバーを、Claude Code の起動引数にする"""

import json

from voice_agent.mcp import CustomServer, McpCatalog, McpSelection, build_plan, parse_list

LIST_OUTPUT = """Checking MCP server health…

claude.ai Gmail: https://gmailmcp.googleapis.com/mcp/v1 - ✔ Connected
claude.ai Google Calendar: https://calendarmcp.googleapis.com/mcp/v1 - ✔ Connected
playwright: npx -y @playwright/mcp@0.0.80 --browser chrome - ✔ Connected
to-fu-computer: http://mcp-host.example.test:8000/mcp (HTTP) - ✗ Failed to connect
project-only: node server.js - ! Needs authentication
"""

USER_SERVERS = {
    "playwright": {"type": "stdio", "command": "npx", "args": ["-y", "@playwright/mcp@0.0.80"]},
    "to-fu-computer": {"type": "http", "url": "http://mcp-host.example.test:8000/mcp"},
}

DASHBOARD = {"type": "http", "url": "http://127.0.0.1:8787/mcp", "headers": {}}


def catalog() -> McpCatalog:
    return McpCatalog(servers=parse_list(LIST_OUTPUT, USER_SERVERS))


def test_parse_list():
    servers = {s.name: s for s in catalog().servers}
    assert list(servers) == ["claude.ai Gmail", "claude.ai Google Calendar", "playwright", "to-fu-computer", "project-only"]
    assert servers["claude.ai Gmail"].kind == "connector"
    assert servers["claude.ai Gmail"].target == "https://gmailmcp.googleapis.com/mcp/v1"
    assert servers["to-fu-computer"].target == "http://mcp-host.example.test:8000/mcp"
    assert servers["to-fu-computer"].status == "failed"
    assert servers["project-only"].status == "needs-auth"
    # ~/.claude.json から設定を読めないもの（プロジェクト単位の登録）は選べない
    assert servers["project-only"].to_message()["available"] is False
    assert servers["playwright"].config == USER_SERVERS["playwright"]


def test_nothing_selected_keeps_only_dashboard():
    plan = build_plan(DASHBOARD, McpSelection(), catalog())
    args = plan.args()
    assert "--strict-mcp-config" in args
    assert json.loads(args[args.index("--mcp-config") + 1]) == {"mcpServers": {"dashboard": DASHBOARD}}


def test_connector_is_allowed_by_url_without_strict_mode():
    selection = McpSelection(enabled=("claude.ai Google Calendar", "playwright"))
    plan = build_plan(DASHBOARD, selection, catalog())
    args = plan.args()
    assert "--strict-mcp-config" not in args
    settings = json.loads(args[args.index("--settings") + 1])
    assert settings["allowedMcpServers"] == [
        {"serverUrl": "http://127.0.0.1:8787/mcp"},
        {"serverCommand": ["npx", "-y", "@playwright/mcp@0.0.80"]},
        {"serverUrl": "https://calendarmcp.googleapis.com/mcp/v1"},
    ]
    assert json.loads(args[args.index("--mcp-config") + 1])["mcpServers"]["playwright"] == USER_SERVERS["playwright"]


def test_unknown_and_unavailable_servers_are_skipped():
    selection = McpSelection(enabled=("claude.ai Removed", "project-only"))
    plan = build_plan(None, selection, catalog())
    assert plan.servers == {}
    assert plan.connector_urls == ()
    assert "--strict-mcp-config" in plan.args()


def test_custom_server_with_token():
    selection = McpSelection(custom=(CustomServer("home-assistant", "https://ha.example/mcp", "secret"),))
    plan = build_plan(DASHBOARD, selection, catalog())
    assert plan.servers["home-assistant"] == {
        "type": "http",
        "url": "https://ha.example/mcp",
        "headers": {"Authorization": "Bearer secret"},
    }


def test_selection_from_message_rejects_bad_custom_entries():
    selection = McpSelection.from_message(
        {
            "enabled": ["b", "a", 3],
            "custom": [
                {"name": "ok", "url": "https://x.example/mcp"},
                {"name": "bad name", "url": "https://x.example/mcp"},
                {"name": "file", "url": "file:///etc/passwd"},
            ],
        }
    )
    assert selection.enabled == ("a", "b")
    assert [c.name for c in selection.custom] == ["ok"]

