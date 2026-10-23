import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 別のプロセスで動かすようになる前の data/ の代わり（持ち込んだ拡張機能が1つ入っている）
const root = await mkdtemp(join(tmpdir(), "extensions-migration-"));
const dataDir = join(root, "data");
process.env.DATA_DIR = dataDir;
process.env.EXTENSIONS_DIR = join(root, "builtin");
const old = join(dataDir, "extensions", "old");
await mkdir(old, { recursive: true });
await writeFile(join(old, "manifest.json"), JSON.stringify({ id: "old", name: "前から", version: "1.0.0", apiVersion: 1 }));
await writeFile(join(old, "server.js"), `export default { register(api) { api.route("GET", "/pid", () => ({ pid: process.pid })); } };`);
await writeFile(join(dataDir, "extensions.json"), JSON.stringify({ disabled: [] }));

const host = await import("./extensions/host.js");
const settings = await import("./connectionSettings.js");

test("前から入っていた拡張機能は、急に動かなくならないよう本体と同じ権限のまま動かす（一度だけ）", async () => {
  await settings.loadConnectionSettings();
  await host.loadExtensions();
  const info = host.listExtensions().find((ext) => ext.id === "old")!;
  assert.equal(info.sandboxed, false);
  assert.equal(info.active, true);
  const state = JSON.parse(await readFile(join(dataDir, "extensions.json"), "utf-8"));
  assert.deepEqual(state.trusted, ["old"]);
  assert.equal(state.sandboxMigrated, true);
  assert.equal(host.isTrustedExtension("old"), true);
});
