import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

// config は読み込み時に環境変数を見るので、モジュールより先に一時ディレクトリを指しておく
const root = await mkdtemp(join(tmpdir(), "voice-mcp-"));
process.env.DATA_DIR = join(root, "data");
const { McpSettingsError, publicMcpSettings, readMcpSettings, writeMcpSettings } = await import("./voiceMcp.js");

after(() => rm(root, { recursive: true, force: true }));

describe("voice MCP settings", () => {
  test("nothing is enabled until chosen", async () => {
    assert.deepEqual(await readMcpSettings(), { enabled: [], custom: [] });
  });

  test("keeps the saved token when the screen omits it, and never returns it", async () => {
    await writeMcpSettings({
      enabled: ["claude.ai Gmail"],
      custom: [{ name: "home", url: "https://ha.example/mcp", token: "secret" }],
    });
    const saved = await writeMcpSettings({
      enabled: ["claude.ai Google Calendar", "claude.ai Google Calendar"],
      custom: [{ name: "home", url: "https://ha.example/v2/mcp" }],
    });
    assert.deepEqual(saved, {
      enabled: ["claude.ai Google Calendar"],
      custom: [{ name: "home", url: "https://ha.example/v2/mcp", token: "secret" }],
    });
    assert.deepEqual(publicMcpSettings(saved).custom, [
      { name: "home", url: "https://ha.example/v2/mcp", hasToken: true },
    ]);
    // トークンを含むので本人だけが読める
    assert.equal((await stat(join(root, "data", "voice-mcp.json"))).mode & 0o777, 0o600);
  });

  test("an empty token clears it", async () => {
    const saved = await writeMcpSettings({
      enabled: [],
      custom: [{ name: "home", url: "https://ha.example/mcp", token: "" }],
    });
    assert.equal(saved.custom[0].token, undefined);
  });

  test("rejects bad names, duplicates and non-http URLs", async () => {
    const bad = [
      { enabled: [], custom: [{ name: "has space", url: "https://x.example" }] },
      { enabled: [], custom: [{ name: "dashboard", url: "https://x.example" }] },
      {
        enabled: [],
        custom: [
          { name: "a", url: "https://x.example" },
          { name: "a", url: "https://y.example" },
        ],
      },
      { enabled: [], custom: [{ name: "a", url: "file:///etc/passwd" }] },
      { enabled: "all", custom: [] },
    ];
    for (const input of bad) {
      await assert.rejects(writeMcpSettings(input), McpSettingsError);
    }
  });
});
