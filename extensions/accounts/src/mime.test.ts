import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAddresses, parseMessage, replyHeaders } from "./mime";

const RAW = [
  "From: =?UTF-8?B?5q+N?= <mom@example.com>",
  "To: me@example.com",
  "Subject: =?UTF-8?B?5aSV6aOv?=",
  "Message-ID: <abc@example.com>",
  "Date: Tue, 20 Oct 2026 09:00:00 +0900",
  "MIME-Version: 1.0",
  'Content-Type: text/html; charset="UTF-8"',
  "",
  "<p>今日は<b>カレー</b>です</p><p>7時ごろ</p>",
].join("\r\n");

test("文字化けせずに読み、HTML のメールは文字にする", async () => {
  const message = await parseMessage(RAW, "1", true);
  assert.equal(message.subject, "夕飯");
  assert.deepEqual(message.from, { name: "母", address: "mom@example.com" });
  assert.equal(message.text, "今日はカレーです\n\n7時ごろ");
  assert.equal(message.date, "2026-10-20T00:00:00.000Z");
  assert.equal(message.snippet, "今日はカレーです 7時ごろ");
});

test("返信は Re: を付け、元のメールにつなぐ。宛先の形を確かめる", async () => {
  const original = await parseMessage(RAW, "1", false);
  assert.deepEqual(replyHeaders({ to: [], cc: [], subject: "", text: "", replyTo: original }), {
    subject: "Re: 夕飯",
    inReplyTo: "<abc@example.com>",
    references: ["<abc@example.com>"],
  });
  assert.deepEqual(checkAddresses([" a@example.com ", ""]), ["a@example.com"]);
  assert.throws(() => checkAddresses(["だれか"]), /宛先の形/);
});
