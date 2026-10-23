import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate } from "./mail/aggregate";
import type { MailBackend, MailDraft } from "./mail/types";

function fake(name: string, date: string): MailBackend & { sent: MailDraft[] } {
  const sent: MailDraft[] = [];
  return {
    sent,
    listMailboxes: async () => ({ mailboxes: [{ id: "box", name, address: `${name}@example.com`, unread: 1, canSend: true, shared: true }], errors: [] }),
    listMessages: async (_v, options) => ({
      messages: [{ id: "m", mailboxId: "box", from: null, subject: `${name}から`, date, unread: true, snippet: String(options.mailboxId ?? "") }],
      errors: [],
    }),
    getMessage: async () => ({ id: "m", mailboxId: "box", from: null, to: [], cc: [], subject: "x", date: null, unread: false, snippet: "", text: "t" }),
    setRead: async () => undefined,
    send: async (_v, draft) => void sent.push(draft),
  };
}

const a = fake("A", "2026-10-20T00:00:00Z");
const b = fake("B", "2026-10-21T00:00:00Z");
const mail = aggregate(() => [
  { extensionId: "accounts", name: "A", implementation: a },
  { extensionId: "other", name: "B", implementation: b },
]);
const viewer = { accountId: "me" };

test("受信箱とメールをまとめ、新しい順に並べる。受信箱を選ぶとそこだけ", async () => {
  const { mailboxes } = await mail.listMailboxes(viewer);
  assert.deepEqual(mailboxes.map((m) => m.id), ["accounts:box", "other:box"]);
  const { messages } = await mail.listMessages(viewer, { limit: 10 });
  assert.deepEqual(messages.map((m) => [m.id, m.subject]), [
    ["other:m", "Bから"],
    ["accounts:m", "Aから"],
  ]);
  const only = await mail.listMessages(viewer, { mailboxId: "accounts:box", limit: 10 });
  assert.deepEqual(only.messages.map((m) => [m.subject, m.snippet]), [["Aから", "box"]]);
});

test("送るときは受信箱の頭で出どころを選び、返信は同じ出どころからだけ。宛先と本文は要る", async () => {
  await mail.send(viewer, { mailboxId: "other:box", to: [" x@example.com "], subject: "s", text: "本文", replyTo: "other:m" });
  assert.deepEqual(b.sent.pop(), { mailboxId: "box", to: ["x@example.com"], cc: [], subject: "s", text: "本文", replyTo: "m" });
  await assert.rejects(
    mail.send(viewer, { mailboxId: "other:box", to: ["x@example.com"], subject: "s", text: "t", replyTo: "accounts:m" }),
    /受け取ったアカウント/,
  );
  await assert.rejects(mail.send(viewer, { mailboxId: "other:box", to: [], subject: "s", text: "t" }), /宛先/);
  await assert.rejects(mail.send(viewer, { mailboxId: "other:box", to: ["x@example.com"], subject: "s", text: " " }), /本文/);
});
