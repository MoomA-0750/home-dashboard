import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { RouteContext, RouteHandler, ServerExtensionApi, ToolDefinition } from "@home-dashboard/extension-sdk";
import extension from "./server";
import type { StickyNote } from "./notes";

/** 作り物の本体。道・道具・知らせを覚える */
async function host(dataDir?: string) {
  const dir = dataDir ?? (await mkdtemp(join(tmpdir(), "sticky-notes-")));
  const routes = new Map<string, RouteHandler>();
  const tools = new Map<string, ToolDefinition>();
  const broadcasts: string[] = [];
  const api = {
    dataDir: dir,
    settings: { timeZone: "Asia/Tokyo" },
    onSettingsChange() {},
    route: (method: string, path: string, handler: RouteHandler) => routes.set(`${method} ${path}`, handler),
    tool: (definition: ToolDefinition) => tools.set(definition.name, definition),
    broadcast: (type: string) => broadcasts.push(type),
  } as unknown as ServerExtensionApi;
  await extension.register(api);
  const call = async (key: string, ctx: Partial<RouteContext> = {}) =>
    routes.get(key)!({ params: {}, query: {}, body: null, account: null, fromAgent: false, bearer: null, locale: "ja", ...ctx });
  const add = async (body: unknown) => ((await call("POST /notes", { body })) as { note: StickyNote }).note;
  const list = async () => ((await call("GET /notes")) as { notes: StickyNote[] }).notes;
  return { dir, call, add, list, tools, broadcasts };
}

test("揃えと効果を保存し、知らない値は既定に戻す", async () => {
  const { add } = await host();
  const note = await add({ text: " 牛乳を買って\r\n ", alignX: "center", alignY: "bottom", bubble: "slam", screen: "hearts", repeat: true });
  assert.equal(note.text, "牛乳を買って");
  assert.deepEqual(
    { alignX: note.alignX, alignY: note.alignY, bubble: note.bubble, screen: note.screen, repeat: note.repeat },
    { alignX: "center", alignY: "bottom", bubble: "slam", screen: "hearts", repeat: true },
  );
  const odd = await add({ text: "x", color: "red", alignX: "diagonal", bubble: "explode", screen: "lasers", repeat: "yes" });
  assert.deepEqual(
    { color: odd.color, alignX: odd.alignX, alignY: odd.alignY, bubble: odd.bubble, screen: odd.screen, repeat: odd.repeat },
    { color: "yellow", alignX: "start", alignY: "top", bubble: "none", screen: "none", repeat: false },
  );
});

test("本文が空なら貼らない", async () => {
  const { call } = await host();
  await assert.rejects(call("POST /notes", { body: { text: "   " } }), { statusCode: 400 });
});

test("「今日中」は家のタイムゾーンのその日の終わりまで", async () => {
  const { add } = await host();
  const note = await add({ text: "x", expires: "today" });
  const end = new Date(note.expiresAt!);
  // 東京の 0 時 ＝ UTC の 15 時
  assert.equal(end.getUTCHours(), 15);
  assert.equal(end.getUTCMinutes(), 0);
  assert.ok(end.getTime() > Date.now() && end.getTime() - Date.now() <= 24 * 60 * 60 * 1000);
});

test("貼る・はがすと画面へ知らせ、はがしたものは消える", async () => {
  const { add, call, list, broadcasts } = await host();
  const note = await add({ text: "x" });
  await call("DELETE /notes/:id", { params: { id: note.id } });
  assert.deepEqual(broadcasts, ["changed", "changed"]);
  assert.equal((await list()).length, 0);
  await assert.rejects(call("DELETE /notes/:id", { params: { id: note.id } }), { statusCode: 404 });
});

test("同時に貼られても40枚で止まる", async () => {
  const { call, list } = await host();
  const results = await Promise.allSettled(
    Array.from({ length: 45 }, (_, i) => call("POST /notes", { body: { text: `n${i}` } })),
  );
  assert.equal(results.filter((r) => r.status === "rejected").length, 5);
  assert.equal((await list()).length, 40);
});

test("期限の切れた付箋と、前の版で保存した付箋を読む", async () => {
  const first = await host();
  await first.add({ text: "残る" });
  const path = join(first.dir, "notes.json");
  const saved = JSON.parse(await readFile(path, "utf-8"));
  saved.notes.push(
    { id: "old", text: "前の版", from: "", color: "pink", createdAt: "2026-01-01T00:00:00.000Z", expiresAt: null },
    { id: "gone", text: "切れた", from: "", color: "blue", createdAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-01-02T00:00:00.000Z" },
  );
  await writeFile(path, JSON.stringify(saved));

  const notes = await (await host(first.dir)).list();
  assert.deepEqual(notes.map((n) => n.text), ["残る", "前の版"]);
  const old = notes.find((n) => n.id === "old")!;
  assert.deepEqual([old.color, old.alignX, old.alignY, old.bubble, old.screen, old.repeat], ["pink", "start", "top", "none", "none", false]);
});

test("音声アシスタントの道具は、引数の形と危なさを本体に渡せる", async () => {
  const { tools } = await host();
  const add = tools.get("add_sticky_note")!;
  const args = z.object(add.inputSchema!(z)).parse({ text: "鍵は玄関", bubble: "loud", alignX: "center" });
  assert.equal(add.risk, "low");
  assert.equal(tools.get("remove_sticky_note")!.risk, "confirm");
  const { note } = (await add.handler(args as never, { approvedBy: null })) as { note: StickyNote };
  assert.equal(note.bubble, "loud");
  assert.equal(note.alignX, "center");
});
