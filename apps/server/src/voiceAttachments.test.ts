import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = await mkdtemp(join(tmpdir(), "voice-attachments-"));
process.env.DATA_DIR = dataDir;

const { readAttachment, resolveAttachments, saveAttachment, sniffAttachment } = await import("./voiceAttachments.js");
const { ServiceError } = await import("./serviceError.js");

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");

test("種類は中身から決め、画像・PDF・UTF-8 のテキスト以外は受け取らない", () => {
  assert.deepEqual(sniffAttachment(png), { type: "image/png", kind: "image" });
  assert.deepEqual(sniffAttachment(pdf), { type: "application/pdf", kind: "pdf" });
  assert.equal(sniffAttachment(Buffer.from("買い物: 牛乳\n"))?.kind, "text");
  assert.equal(sniffAttachment(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff])), null);
  assert.equal(sniffAttachment(Buffer.from([0xc3, 0x28])), null);
});

test("置いたファイルは id で取り出せ、話しかけるときの id の並びを確かめる", async () => {
  const saved = await saveAttachment(png, "../写真.png", null);
  assert.equal(saved.name, "..写真.png");
  assert.equal(saved.kind, "image");
  assert.equal((await stat(join(dataDir, "voice-attachments", saved.id))).mode & 0o777, 0o600);
  const found = await readAttachment(saved.id);
  assert.deepEqual(found?.data, png);

  const text = await saveAttachment(Buffer.from("memo"), "memo.txt", null);
  assert.deepEqual((await resolveAttachments([saved.id, text.id, saved.id], null)).map((a) => a.id), [saved.id, text.id]);
  assert.deepEqual(await resolveAttachments(undefined, null), []);
  await assert.rejects(resolveAttachments(["00000000-0000-4000-8000-000000000000"], null), ServiceError);
  await assert.rejects(resolveAttachments(["../../accounts.json"], null), ServiceError);
  await assert.rejects(resolveAttachments(Array(6).fill(saved.id), null), ServiceError);

  // 自分の画面から置いたものは、ほかの人の話しかけには添えられない
  const mine = await saveAttachment(Buffer.from("secret"), "memo.txt", "55555555-5555-4555-8555-555555555555");
  assert.equal(mine.owner, "55555555-5555-4555-8555-555555555555");
  assert.equal((await resolveAttachments([mine.id], "55555555-5555-4555-8555-555555555555")).length, 1);
  await assert.rejects(resolveAttachments([mine.id], null), ServiceError);
  await assert.rejects(resolveAttachments([mine.id], "66666666-6666-4666-8666-666666666666"), ServiceError);
});

test("空・大きすぎる・知らない種類のファイルは断る", async () => {
  await assert.rejects(saveAttachment(Buffer.alloc(0), "a", null), (err: InstanceType<typeof ServiceError>) => err.statusCode === 400);
  await assert.rejects(
    saveAttachment(Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]), "big.png", null),
    (err: InstanceType<typeof ServiceError>) => err.statusCode === 413,
  );
  await assert.rejects(
    saveAttachment(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), "a.zip", null),
    (err: InstanceType<typeof ServiceError>) => err.statusCode === 415,
  );
});
