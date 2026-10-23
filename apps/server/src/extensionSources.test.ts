import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
const root = await mkdtemp(join(tmpdir(), "extension-sources-"));
process.env.DATA_DIR = join(root, "data");
process.env.EXTENSIONS_DIR = join(root, "builtin");

/** 拡張機能1つ分（GET /version で版を返す） */
async function writeExtension(dir: string, id: string, version: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ id, name: id, version, apiVersion: 1 }));
  await writeFile(
    join(dir, "server.js"),
    `export default { register(api) { api.route("GET", "/version", () => ({ version: ${JSON.stringify(version)} })); } };`,
  );
}

// 本体に入っている拡張機能（greeter 1.0.0）
await writeExtension(join(root, "builtin", "greeter", "dist"), "greeter", "1.0.0");

// 公開用の枝（dist-extensions）を持つリポジトリ。greeter 1.1.0 と newbie 0.1.0 を置く
const repo = join(root, "repo");
const run = (...args: string[]) => execFileSync("git", args, { cwd: repo, stdio: "pipe" }).toString().trim();
async function publish(entries: [string, string][]) {
  for (const [id, version] of entries) await writeExtension(join(repo, id), id, version);
  await writeFile(
    join(repo, "catalog.json"),
    JSON.stringify({
      format: 1,
      commit: "x",
      extensions: entries.map(([id, version]) => ({ id, name: id, version, path: id })),
    }),
  );
  run("add", "--all");
  run("commit", "--quiet", "-m", "置く");
}
await mkdir(repo, { recursive: true });
run("init", "--quiet", "-b", "dist-extensions");
run("config", "user.email", "test@example.com");
run("config", "user.name", "test");
await publish([
  ["greeter", "1.1.0"],
  ["newbie", "0.1.0"],
]);

const host = await import("./extensions/host.js");
const sources = await import("./extensions/sources.js");
const settings = await import("./connectionSettings.js");
await settings.loadConnectionSettings();
await host.loadExtensions();

const version = async (id: string) =>
  ((await host.dispatchExtensionRoute(id, "GET", "/version", { query: {}, body: null, account: null, fromAgent: false, bearer: null, locale: "ja" })) as {
    body: { version: string };
  }).body.version;

let sourceId = "";

test("リポジトリを登録すると取ってきて、入っていないもの・更新があるもの（本体の拡張機能も）が分かる", async () => {
  const source = await sources.addSource({ url: `file://${repo}` });
  sourceId = source.id;
  assert.equal(source.error, null);
  assert.equal(source.name, "repo");
  assert.deepEqual(
    source.extensions.map((e) => [e.id, e.version, e.installedVersion, e.updatable]),
    [
      ["greeter", "1.1.0", "1.0.0", true],
      ["newbie", "0.1.0", null, false],
    ],
  );
  const status = await sources.updateStatus();
  assert.deepEqual(status.greeter.update, { version: "1.1.0", sourceId, sourceName: "repo" });
  // トークンを持つかもしれないので、持ち主だけが読める
  assert.equal((await stat(join(root, "data", "extension-sources.json"))).mode & 0o777, 0o600);
});

test("リポジトリから入れられ、本体の拡張機能も新しい版に置き換えられる。消すと本体の版に戻る", async () => {
  const newbie = await sources.installFromSource(sourceId, "newbie");
  assert.equal(newbie.active, true);
  assert.deepEqual(newbie.origin, { kind: "source", sourceId, commit: newbie.origin.kind === "source" ? newbie.origin.commit : "" });

  const greeter = await sources.installFromSource(sourceId, "greeter");
  assert.equal(greeter.version, "1.1.0");
  assert.equal(greeter.builtinVersion, "1.0.0");
  assert.equal(await version("greeter"), "1.1.0");
  assert.equal((await sources.updateStatus()).greeter.update, null);

  await host.uninstallExtension("greeter");
  const back = host.listExtensions().find((ext) => ext.id === "greeter")!;
  assert.equal(back.version, "1.0.0");
  assert.equal(back.builtin, true);
  assert.equal(await version("greeter"), "1.0.0");
});

test("自動で更新するものは、確かめたときに新しい版へ入れ替わる。そうでないものは知らせるだけ", async () => {
  await sources.setAutoUpdate("newbie", true);
  await publish([
    ["greeter", "1.2.0"],
    ["newbie", "0.2.0"],
  ]);
  const updated = await sources.checkAllSources();
  assert.deepEqual(updated, [{ id: "newbie", version: "0.2.0", error: null }]);
  assert.equal(await version("newbie"), "0.2.0");
  // greeter は自動にしていないので、本体の版のまま更新を知らせる
  assert.equal(await version("greeter"), "1.0.0");
  assert.equal((await sources.updateStatus()).greeter.update?.version, "1.2.0");
});

test("入れたものの出どころは覚えていて、起動し直しても置き換えたまま読み込む", async () => {
  await sources.installFromSource(sourceId, "greeter");
  const origin = JSON.parse(await readFile(join(root, "data", "extensions", "greeter", ".origin.json"), "utf-8"));
  assert.equal(origin.sourceId, sourceId);
  host.resetExtensionsForTest();
  await host.loadExtensions();
  const greeter = host.listExtensions().find((ext) => ext.id === "greeter")!;
  assert.equal(greeter.version, "1.2.0");
  assert.equal(greeter.builtinVersion, "1.0.0");
});

test("読めないリポジトリは理由を残し、形の違う URL は受けない", async () => {
  const missing = await sources.addSource({ url: `file://${join(root, "nothing")}` });
  assert.match(missing.error ?? "", /見つかりません|取ってこられません/);
  await assert.rejects(sources.addSource({ url: "ssh://example.com/x.git" }), /https/);
  await assert.rejects(sources.addSource({ url: `file://${repo}` }), /もう登録してあります/);
  await sources.removeSource(missing.id);
  assert.equal((await sources.listSources()).length, 1);
});
