import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { TurnRecord } from "./voiceHistory.js";

// config は読み込み時に環境変数を見るので、モジュールより先に一時ディレクトリを指しておく
const root = await mkdtemp(join(tmpdir(), "voice-history-"));
process.env.DATA_DIR = root;
const { appendTurn, conversationOwner, normalizeTurn, readConversations, readConversationTurns, readRecentTurns, summarizeConversations } =
  await import("./voiceHistory.js");

after(() => rm(root, { recursive: true, force: true }));

function turn(conversationId: string | null, at: string, personaId: string, text: string): TurnRecord {
  const record = normalizeTurn({
    id: at,
    at,
    conversationId,
    persona: { id: personaId, name: personaId.toUpperCase() },
    input: { source: "text", text },
    output: { text: "はい", segments: [] },
    status: "answered",
  });
  assert.ok(record);
  return record;
}

test("記録を会話ごとにまとめ、最近話した会話から並べる", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const summaries = summarizeConversations([
    turn(a, "2026-10-17T10:00:00+09:00", "plum", "おはよう"),
    turn(b, "2026-10-17T11:00:00+09:00", "karin", "x".repeat(80)),
    turn(a, "2026-10-17T12:00:00+09:00", "karin", "@カリン 続き"),
    // 会話のIDが無い古い記録は一覧に出さない
    turn(null, "2026-10-17T13:00:00+09:00", "plum", "昔の記録"),
  ]);
  assert.deepEqual(
    summaries.map((s) => [s.id, s.turns, s.personas.map((p) => p.id), s.updatedAt]),
    [
      [a, 2, ["plum", "karin"], "2026-10-17T12:00:00+09:00"],
      [b, 1, ["karin"], "2026-10-17T11:00:00+09:00"],
    ],
  );
  assert.equal(summaries[0].title, "おはよう");
  assert.equal(summaries[1].title, `${"x".repeat(60)}…`);
});

test("追記した記録は読み直さずに一覧へ反映され、ファイルを書き換えられたら読み直す", async () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const record = (text: string) => ({
    at: "2026-10-17T10:00:00+09:00",
    conversationId: a,
    persona: { id: "plum", name: "プラム" },
    input: { source: "text", text },
    output: { text: "はい", segments: [] },
  });
  await appendTurn(record("1つ目"));
  assert.equal((await readConversations(10, null))[0].turns, 1);
  await appendTurn(record("2つ目"));
  assert.equal((await readConversations(10, null))[0].turns, 2);
  // 手で書き換えた（消した）ときは読み直す
  await writeFile(join(root, "voice-history.jsonl"), "");
  assert.deepEqual(await readConversations(10, null), []);
});

test("チャットで添えたファイルは記録に残り、ファイルだけで始めた会話はその名前を題にする", () => {
  const c = "33333333-3333-4333-8333-333333333333";
  const photo = { id: "44444444-4444-4444-8444-444444444444", name: "夕焼け.png", type: "image/jpeg" };
  const record = normalizeTurn({
    id: "t1",
    at: "2026-10-21T10:00:00+09:00",
    conversationId: c,
    persona: { id: "plum", name: "プラム" },
    input: { source: "text", text: "", attachments: [photo, { id: "../x", name: "bad" }, "bad"] },
    output: { text: "きれいですね", segments: [] },
    status: "answered",
  });
  assert.ok(record);
  assert.deepEqual(record.input.attachments, [photo]);
  assert.equal(turn(c, "2026-10-21T10:00:00+09:00", "plum", "x").input.attachments, undefined);
  assert.equal(summarizeConversations([record])[0].title, "夕焼け.png");
});

test("自分の画面で話した会話は本人だけに見せ、部屋の会話は家族みんなに見せる", async () => {
  await writeFile(join(root, "voice-history.jsonl"), "");
  const mom = "55555555-5555-4555-8555-555555555555";
  const kid = "66666666-6666-4666-8666-666666666666";
  const room = "77777777-7777-4777-8777-777777777777";
  const momChat = "88888888-8888-4888-8888-888888888888";
  const record = (conversationId: string, owner: string | null, text: string) => ({
    at: "2026-10-22T10:00:00+09:00",
    conversationId,
    owner,
    persona: { id: "plum", name: "プラム" },
    input: { source: owner ? "text" : "wake", text },
    output: { text: "はい", segments: [] },
  });
  await appendTurn(record(room, null, "電気を消して"));
  await appendTurn(record(momChat, mom, "病院の予約は？"));
  // アカウントの ID の形でない owner は、家族みんなのものとして扱う（記録に紛れ込ませても人のものにはならない）
  assert.equal(normalizeTurn({ ...record(room, "../x", "y"), id: "z" })?.owner, null);

  assert.deepEqual((await readRecentTurns(10, mom)).map((r) => r.input.text), ["電気を消して", "病院の予約は？"]);
  assert.deepEqual((await readRecentTurns(10, kid)).map((r) => r.input.text), ["電気を消して"]);
  assert.deepEqual((await readRecentTurns(10, null)).map((r) => r.input.text), ["電気を消して"]);
  assert.deepEqual((await readConversations(10, kid)).map((c) => c.id), [room]);
  assert.deepEqual(await readConversationTurns(momChat, 10, kid), []);
  assert.equal((await readConversationTurns(momChat, 10, mom)).length, 1);
  assert.equal(await conversationOwner(momChat), mom);
  assert.equal(await conversationOwner(room), null);
  assert.equal(await conversationOwner("99999999-9999-4999-8999-999999999999"), undefined);
});
