import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
const root = await mkdtemp(join(tmpdir(), "extensions-"));
const dataDir = join(root, "data");
const builtinDir = join(root, "builtin");
process.env.DATA_DIR = dataDir;
process.env.EXTENSIONS_DIR = builtinDir;
process.env.TEST_GREETING = "やあ";

// 本体の拡張機能（extensions/<id>/dist）の代わり
const builtinDist = join(builtinDir, "greeter", "dist");
await mkdir(builtinDist, { recursive: true });
await writeFile(
  join(builtinDist, "manifest.json"),
  JSON.stringify({
    id: "greeter",
    name: "あいさつ",
    version: "1.0.0",
    apiVersion: 1,
    settings: [{ key: "greeting", label: "あいさつ", kind: "text", env: "TEST_GREETING" }],
  }),
);
await writeFile(
  join(builtinDist, "server.js"),
  `export default {
    register(api) {
      let disposed = 0;
      globalThis.__greeterDisposed = () => disposed;
      api.onDispose(() => { disposed++; });
      api.route("GET", "/hello/:name", ({ params, account }) => ({ text: api.settings.greeting + " " + params.name, user: account?.username ?? null }));
      api.route("POST", "/ping", () => ({ pong: true }), { public: true });
      api.route("POST", "/admin", () => ({ ok: true }), { adminOnly: true });
      api.route("GET", "/fail", () => { throw api.error(409, "だめです"); });
      api.route("GET", "/go", () => api.redirect("https://example.com/"));
      api.route("GET", "/picture", () => api.file(new Uint8Array([1, 2]), "image/png; x=1", { cacheSeconds: 60 }));
      api.route("GET", "/page", () => api.file(new Uint8Array([60]), "text/html"));
      api.tool({ name: "greet", description: "あいさつする", handler: () => "hi" });
    },
  };`,
);
await writeFile(join(builtinDist, "web.js"), "export default { widgets: [] };");

// 機能の口を持つ拡張機能（board）と、そこへ入る拡張機能（sign）
const boardDist = join(builtinDir, "board", "dist");
await mkdir(boardDist, { recursive: true });
await writeFile(
  join(boardDist, "manifest.json"),
  JSON.stringify({
    id: "board",
    name: "掲示板",
    version: "1.0.0",
    apiVersion: 1,
    features: [{ id: "notice", name: "お知らせの出どころ" }],
  }),
);
await writeFile(
  join(boardDist, "server.js"),
  `export default {
    register(api) {
      api.route("GET", "/notices", () => ({
        notices: api.providers("notice").map((p) => ({ from: p.extensionId, name: p.name, text: p.implementation.text() })),
      }));
    },
  };`,
);
const signDist = join(builtinDir, "sign", "dist");
await mkdir(signDist, { recursive: true });
await writeFile(
  join(signDist, "manifest.json"),
  JSON.stringify({ id: "sign", name: "看板", version: "1.0.0", apiVersion: 1, provides: ["notice"] }),
);
await writeFile(
  join(signDist, "server.js"),
  `export default {
    register(api) {
      api.provide("notice", { text: () => "本日休業" });
    },
  };`,
);

const host = await import("./extensions/host.js");
const settings = await import("./connectionSettings.js");
await settings.loadConnectionSettings();
await host.loadExtensions();

type Account = { id: string; username: string; role: "admin" | "member" };
const member: Account = { id: "m", username: "family", role: "member" };
const admin: Account = { id: "a", username: "mooma", role: "admin" };
// 返り値の形（json / redirect / text）をまたいで、状態コードと本文を見やすくする
async function call(id: string, method: string, path: string, account: Account | null = member, body: unknown = null) {
  const result = await host.dispatchExtensionRoute(id, method, path, { query: {}, body, account, fromAgent: false, bearer: null, locale: "ja" });
  return result as typeof result & { statusCode?: number; body?: unknown };
}

function zip(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}

const helloManifest = JSON.stringify({ id: "hello", name: "こんにちは", version: "0.1.0", apiVersion: 1 });

test("本体の拡張機能を読み込み、道・設定・ツールを動かす", async () => {
  assert.deepEqual(
    host.listExtensions().map((ext) => [ext.id, ext.builtin, ext.active, ext.hasWeb]),
    [
      ["greeter", true, true, true],
      ["sign", true, true, false],
      ["board", true, true, false],
    ],
  );
  assert.deepEqual(await call("greeter", "GET", "/hello/%E3%81%BF"), {
    kind: "json",
    statusCode: 200,
    body: { text: "やあ み", user: "family" },
  });
  assert.deepEqual(await call("greeter", "GET", "/fail"), {
    kind: "json",
    statusCode: 409,
    body: { error: "だめです" },
  });
  assert.deepEqual(await call("greeter", "GET", "/go"), { kind: "redirect", url: "https://example.com/" });
  // ファイルはそのまま返す。ダッシュボードの中で開かせると危ない形は、ダウンロードさせる形にする
  assert.deepEqual(await call("greeter", "GET", "/picture"), {
    kind: "file",
    body: new Uint8Array([1, 2]),
    contentType: "image/png",
    cacheSeconds: 60,
  });
  assert.equal(((await call("greeter", "GET", "/page")) as { contentType?: string }).contentType, "application/octet-stream");
  assert.equal(
    (await call("greeter", "GET", "/nothing")).kind === "json" && (await call("greeter", "GET", "/nothing")).statusCode,
    404,
  );
  assert.equal((await call("greeter", "POST", "/admin")).statusCode, 403);
  assert.equal((await call("greeter", "POST", "/admin", admin)).statusCode, 200);
  assert.equal(host.isPublicExtensionRoute("greeter", "POST", "/ping"), true);
  assert.equal(host.isPublicExtensionRoute("greeter", "GET", "/hello/x"), false);
  assert.deepEqual(
    host.extensionTools().map((tool) => tool.definition.name),
    ["greet"],
  );
  assert.ok(settings.describeConnectionSettings(host.activeExtensionIds()).some((s) => s.id === "greeter"));
});

test("切ると道・ツール・接続設定の節が消え、後片付けが呼ばれる。入れ直すと戻る", async () => {
  await host.setExtensionEnabled("greeter", false);
  assert.equal((await call("greeter", "GET", "/hello/x")).statusCode, 404);
  assert.deepEqual(host.extensionTools(), []);
  assert.deepEqual(settings.describeConnectionSettings(host.activeExtensionIds()), []);
  assert.equal((globalThis as unknown as { __greeterDisposed: () => number }).__greeterDisposed(), 1);
  assert.equal(host.extensionFilePath("greeter", "web.js"), null);

  await host.setExtensionEnabled("greeter", true);
  assert.equal((await call("greeter", "GET", "/hello/x")).statusCode, 200);
});

test("ZIP で持ち込み、入れ替え、消せる（本体のものは消せない）", async () => {
  const v1 = zip({
    "hello/manifest.json": helloManifest,
    "hello/server.js": `export default { register(api) { api.route("GET", "/v", () => ({ v: 1 })); } };`,
    "hello/web.js": "export default {};",
    "hello/assets/icon.svg": "<svg/>",
  });
  const info = await host.installExtension(v1);
  assert.deepEqual([info.id, info.builtin, info.active], ["hello", false, true]);
  assert.deepEqual((await call("hello", "GET", "/v")).body, { v: 1 });
  assert.ok(host.extensionFilePath("hello", "assets/icon.svg"));
  assert.equal(host.extensionFilePath("hello", "server.js"), null);
  assert.equal(host.extensionFilePath("hello", "../hello/server.js"), null);

  // 入れ替えると新しい server.js を読む
  await new Promise((resolve) => setTimeout(resolve, 20));
  const v2 = zip({
    "manifest.json": helloManifest.replace("0.1.0", "0.2.0"),
    "server.js": `export default { register(api) { api.route("GET", "/v", () => ({ v: 2 })); } };`,
  });
  assert.equal((await host.installExtension(v2)).version, "0.2.0");
  assert.deepEqual((await call("hello", "GET", "/v")).body, { v: 2 });

  await assert.rejects(host.uninstallExtension("greeter"), /消せません/);
  await host.uninstallExtension("hello");
  assert.equal((await call("hello", "GET", "/v")).statusCode, 404);
  assert.ok(!existsSync(join(dataDir, "extensions", "hello")));
});

test("危ない ZIP・形の合わない拡張機能は受け付けない", async () => {
  await assert.rejects(host.installExtension(zip({ "readme.txt": "x" })), /manifest\.json がありません/);
  await assert.rejects(
    host.installExtension(zip({ "manifest.json": helloManifest, "../evil.js": "x" })),
    /入れられないファイル/,
  );
  await assert.rejects(
    host.installExtension(zip({ "manifest.json": helloManifest, "node_modules/x.js": "x" })),
    /入れられないファイル/,
  );
  await assert.rejects(
    host.installExtension(zip({ "manifest.json": helloManifest.replace('"apiVersion":1', '"apiVersion":99') })),
    /形の版が合いません/,
  );
  await assert.rejects(
    host.installExtension(zip({ "manifest.json": helloManifest.replace('"hello"', '"greeter"') })),
    /本体の拡張機能と同じ名前/,
  );
  await assert.rejects(host.installExtension(new Uint8Array([1, 2, 3])), /ZIP を開けません/);
});

test("server.js が読めない拡張機能は、理由を残して動かさない", async () => {
  const info = await host.installExtension(
    zip({
      "manifest.json": helloManifest,
      "server.js": "export default { register() { throw new Error('壊れています'); } };",
    }),
  );
  assert.equal(info.active, false);
  assert.match(info.error ?? "", /壊れています/);
  await host.uninstallExtension("hello");
});

test("機能の口: 入った拡張機能のものを口を持つ側が集め、切ると外れる。一覧には口と入る先が出る", async () => {
  const notices = await call("board", "GET", "/notices");
  assert.deepEqual(notices.body, { notices: [{ from: "sign", name: "看板", text: "本日休業" }] });

  const list = host.listExtensions();
  assert.deepEqual(list.find((ext) => ext.id === "board")?.features, [
    { id: "notice", name: "お知らせの出どころ", description: null },
  ]);
  assert.deepEqual(list.find((ext) => ext.id === "sign")?.provides, ["notice"]);

  await host.setExtensionEnabled("sign", false);
  assert.deepEqual((await call("board", "GET", "/notices")).body, { notices: [] });
  await host.setExtensionEnabled("sign", true);
  assert.equal(((await call("board", "GET", "/notices")).body as { notices: unknown[] }).notices.length, 1);
});

test("機能の口: manifest の provides に無い口へは入れない。口の形が違う manifest は受けない", () => {
  assert.throws(() => host.validateManifest({ id: "x", name: "x", version: "1", apiVersion: 1, provides: ["Bad Id"] }));
  assert.throws(() => host.validateManifest({ id: "x", name: "x", version: "1", apiVersion: 1, features: [{ id: "a" }] }));
});

test("持ち込んだ拡張機能は別のプロセスで動き、自分の置き場の外や本体の秘密には触れない", async () => {
  // 本体の秘密の代わり（data/ の直下に置いたもの）
  await writeFile(join(dataDir, "secret.json"), '{"token":"s3cret"}');
  const info = await host.installExtension(
    zip({
      "manifest.json": JSON.stringify({
        id: "probe",
        name: "調べ役",
        version: "1.0.0",
        apiVersion: 1,
        provides: ["notice"],
        settings: [{ key: "word", label: "言葉", kind: "text", default: "はじめ" }],
      }),
      "server.js": `
        import { readFile, writeFile } from "node:fs/promises";
        import { join } from "node:path";
        const attempt = async (work) => { try { await work(); return "ok"; } catch (err) { return err.code ?? err.message; } };
        export default {
          register(api) {
            api.route("GET", "/probe", async () => ({
              pid: process.pid,
              secret: await attempt(() => readFile(${JSON.stringify(join(dataDir, "secret.json"))}, "utf-8")),
              own: await attempt(() => writeFile(join(api.dataDir, "note.txt"), "x")),
              spawn: await attempt(async () => (await import("node:child_process")).execSync("id")),
              env: process.env.TEST_GREETING ?? null,
              word: api.settings.word,
            }));
            api.route("GET", "/teapot", () => { throw api.error(418, "お茶です"); });
            api.route("GET", "/go", () => api.redirect("https://example.com/"));
            api.tool({
              name: "probe_tool",
              description: "調べる",
              inputSchema: (z) => ({ n: z.number().int() }),
              risk: (args) => (args.n > 1 ? "approve" : "low"),
              describe: (args) => "数を " + args.n + " にする",
              handler: (args, context) => ({ doubled: args.n * 2, by: context.approvedBy?.username ?? null }),
            });
            api.provide("notice", { text: async () => "別のプロセスから" });
            api.provideStates({
              list: async () => [{ id: "lux", name: "照度", kind: "number", value: 4, unit: "lx" }],
              read: async (ids) => ids.map((id) => ({ id, name: "照度", kind: "number", value: 4, unit: "lx" })),
            });
          },
        };`,
    }),
  );
  assert.equal(info.sandboxed, true);
  assert.equal(info.active, true, info.error ?? "");

  const probe = (await call("probe", "GET", "/probe")).body as Record<string, unknown>;
  assert.notEqual(probe.pid, process.pid);
  assert.equal(probe.secret, "ERR_ACCESS_DENIED");
  assert.equal(probe.own, "ok");
  assert.equal(probe.spawn, "ERR_ACCESS_DENIED");
  // 本体の環境変数は渡さない。接続設定はその拡張機能の分だけ渡す
  assert.equal(probe.env, null);
  assert.equal(probe.word, "はじめ");
  await settings.updateConnectionSettings("probe", { word: "かわった" });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(((await call("probe", "GET", "/probe")).body as Record<string, unknown>).word, "かわった");

  // 道の返り値・エラーも本体と同じ形で返る
  assert.deepEqual(await call("probe", "GET", "/teapot"), { kind: "json", statusCode: 418, body: { error: "お茶です" } });
  assert.deepEqual(await call("probe", "GET", "/go"), { kind: "redirect", url: "https://example.com/" });

  // 道具は引数の形・危なさ・説明ごと本体に写る
  const tool = host.extensionTools().find((t) => t.definition.name === "probe_tool")!.definition;
  const { z } = await import("zod");
  const shape = z.object(tool.inputSchema!(z));
  assert.ok(shape.safeParse({ n: 2 }).success);
  assert.ok(!shape.safeParse({ n: "x" }).success);
  const risk = tool.risk as unknown as (args: unknown) => Promise<string>;
  assert.equal(await risk({ n: 1 }), "low");
  assert.equal(await risk({ n: 5 }), "approve");
  assert.equal(await tool.describe!({ n: 3 }), "数を 3 にする");
  assert.deepEqual(await tool.handler({ n: 4 }, { approvedBy: admin }), { doubled: 8, by: "mooma" });

  // 機能の口に入ったものは、口を持つ本体の拡張機能から呼べる（返り値は Promise）
  const provider = host.featureProviders<{ text: () => Promise<string> }>("notice").find((p) => p.extensionId === "probe")!;
  assert.equal(await provider.implementation.text(), "別のプロセスから");
  // 家の状態の値（夜の表示の条件に使う）も、別のプロセスから差し出せる
  const states = host.stateSources().find((s) => s.extensionId === "probe")!;
  assert.deepEqual(await states.source.read(["lux"]), [{ id: "lux", name: "照度", kind: "number", value: 4, unit: "lx" }]);

  // 管理者が信頼すると、本体と同じプロセスで動く（秘密も読める）
  assert.equal((await host.setExtensionTrusted("probe", true)).sandboxed, false);
  const trustedProbe = (await call("probe", "GET", "/probe")).body as Record<string, unknown>;
  assert.equal(trustedProbe.pid, process.pid);
  assert.equal(trustedProbe.secret, "ok");
  assert.equal((await host.setExtensionTrusted("probe", false)).sandboxed, true);
  await assert.rejects(host.setExtensionTrusted("greeter", false), /本体の拡張機能/);

  await host.uninstallExtension("probe");
});

test("別のプロセスが落ちたら、理由を残して切れた扱いにする", async () => {
  await host.installExtension(
    zip({
      "manifest.json": JSON.stringify({ id: "crasher", name: "落ちる", version: "1.0.0", apiVersion: 1 }),
      "server.js": `export default { register(api) { api.route("POST", "/crash", () => { setTimeout(() => process.exit(3), 10); return { bye: true }; }); } };`,
    }),
  );
  assert.deepEqual((await call("crasher", "POST", "/crash")).body, { bye: true });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const info = host.listExtensions().find((ext) => ext.id === "crasher")!;
  assert.equal(info.active, false);
  assert.match(info.error ?? "", /止まりました/);
  assert.equal((await call("crasher", "POST", "/crash")).statusCode, 404);
  await host.uninstallExtension("crasher");
});
