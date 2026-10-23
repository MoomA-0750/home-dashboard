import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBackends } from "./backend";
import { AccountStore, type StoredAccount } from "./store";
import type { CalendarClient, MailClient, RawDraft } from "./providers/types";

const dir = await mkdtemp(join(tmpdir(), "accounts-"));
const store = new AccountStore(dir);

// 偽のつなぎ方。アカウントごとに、カレンダー1つ・予定1つ・メール1通を持つ
const writes: string[] = [];
const sent: RawDraft[] = [];
const moves: string[] = [];
let listCalls = 0;
const calendarClient: CalendarClient = {
  listCalendars: async (ctx) => {
    if (ctx.account.label === "壊れた") throw new Error("つながりません");
    return [{ id: `cal/${ctx.account.label}`, name: "予定", color: "#ff0000", writable: true }];
  },
  listEvents: async (ctx, calendarId) => [
    {
      id: "ev.1",
      calendarId,
      title: `${ctx.account.label}の予定`,
      start: ctx.account.label === "母" ? "2026-10-21T00:00:00.000Z" : "2026-10-20T00:00:00.000Z",
      end: "2026-10-21T01:00:00.000Z",
      allDay: false,
      location: null,
      description: null,
      recurring: false,
    },
  ],
  createEvent: async (ctx, calendarId, input) => {
    writes.push(`create ${ctx.account.label} ${calendarId} ${input.title}`);
    return { id: "new", calendarId, recurring: false, location: null, description: null, ...input };
  },
  updateEvent: async (ctx, calendarId, eventId, input) => {
    writes.push(`update ${ctx.account.label} ${calendarId} ${eventId}`);
    return { id: eventId, calendarId, recurring: false, location: null, description: null, ...input };
  },
  deleteEvent: async (ctx, calendarId, eventId) => {
    writes.push(`delete ${ctx.account.label} ${calendarId} ${eventId}`);
  },
};
const mailClient: MailClient = {
  unreadCount: async () => 2,
  listFolders: async (ctx) => [{ id: `Label_${ctx.account.label}`, path: ["仕事"] }],
  move: async (ctx, id, target, from) => {
    moves.push(`${ctx.account.label} ${id} ${from}→${target}`);
  },
  listMessages: async (ctx) => (listCalls++, [
    { id: "7", from: null, subject: `${ctx.account.label}へ`, date: "2026-10-20T00:00:00.000Z", unread: true, snippet: "" },
  ]),
  getMessage: async (ctx, id) => ({
    id,
    from: { name: null, address: "a@example.com" },
    to: [],
    cc: [],
    subject: "元のメール",
    date: null,
    unread: true,
    snippet: "",
    text: "本文",
    messageId: "<m1@example.com>",
    references: [],
  }),
  setRead: async () => undefined,
  send: async (_ctx, draft) => void sent.push(draft),
};

const { calendar, mail } = createBackends(
  store,
  { calendar: { google: calendarClient, icloud: calendarClient }, mail: { google: mailClient } },
  async () => "token",
);

const base = (patch: Partial<StoredAccount>): Omit<StoredAccount, "id" | "createdAt"> => ({
  provider: "google",
  label: "",
  email: null,
  ownerId: "",
  shared: false,
  services: { calendar: true, mail: true },
  credentials: { kind: "none" },
  servers: {},
  ...patch,
});

const mine = await store.add(base({ label: "自分", ownerId: "me" }));
const family = await store.add(base({ label: "家族", ownerId: "mom", shared: true }));
await store.add(base({ label: "母", ownerId: "mom" }));
await store.add(base({ label: "壊れた", ownerId: "me", provider: "icloud" }));

test("見えるのは本人の分と家で共有の分。読めないアカウントは理由を返し、ほかは出す", async () => {
  const { events, errors } = await calendar.listEvents({ accountId: "me" }, { from: "2026-10-20T00:00:00Z", to: "2026-10-22T00:00:00Z" });
  assert.deepEqual(events.map((e) => e.title).sort(), ["家族の予定", "自分の予定"]);
  assert.deepEqual(errors, [{ source: "壊れた", message: "つながりません" }]);
  // 音声アシスタント（だれか分からない）からは家で共有の分だけ
  const shared = await calendar.listEvents({ accountId: null }, { from: "2026-10-20T00:00:00Z", to: "2026-10-22T00:00:00Z" });
  assert.deepEqual(shared.events.map((e) => e.title), ["家族の予定"]);
  // 母の個人のものは母にだけ
  const mom = await calendar.listEvents({ accountId: "mom" }, { from: "2026-10-20T00:00:00Z", to: "2026-10-22T00:00:00Z" });
  assert.deepEqual(mom.events.map((e) => e.title), ["家族の予定", "母の予定"]);
});

test("id からアカウントとサービスの中の id を取り出して書く。見えないアカウントへは書けない", async () => {
  const { calendars } = await calendar.listCalendars({ accountId: "me" });
  const target = calendars.find((c) => c.source === "自分")!;
  const created = await calendar.createEvent({ accountId: "me" }, {
    calendarId: target.id,
    title: "歯医者",
    start: "2026-10-22T01:00:00.000Z",
    end: "2026-10-22T02:00:00.000Z",
    allDay: false,
  });
  assert.equal(writes.pop(), "create 自分 cal/自分 歯医者");
  assert.ok(created.id.startsWith(`${mine.id}.`));

  const [event] = (await calendar.listEvents({ accountId: "me" }, { from: "2026-10-20T00:00:00Z", to: "2026-10-21T00:00:00Z" })).events.filter((e) => e.title === "自分の予定");
  await calendar.deleteEvent({ accountId: "me" }, event.id);
  assert.equal(writes.pop(), "delete 自分 cal/自分 ev.1");

  // ほかの人の個人のカレンダーは、id を知っていても書けない
  await assert.rejects(calendar.deleteEvent({ accountId: "mom" }, event.id), /見つかりません/);
  await assert.rejects(calendar.deleteEvent({ accountId: "me" }, "壊れた形"), /形が違います/);
});

test("カレンダーの入／切: 切ったカレンダーの予定は出さず、入／切はアカウントを足した本人だけが変える", async () => {
  const range = { from: "2026-10-20T00:00:00Z", to: "2026-10-22T00:00:00Z" };
  const own = (await calendar.listCalendars({ accountId: "me" })).calendars.find((c) => c.source === "自分")!;
  const shared = (await calendar.listCalendars({ accountId: "me" })).calendars.find((c) => c.source === "家族")!;
  assert.equal(own.enabled, true);
  assert.equal(own.toggleable, true);
  // 家で共有のものはほかの人が足したので、見えても変えられない
  assert.equal(shared.toggleable, false);
  await assert.rejects(calendar.setCalendarEnabled!({ accountId: "me" }, shared.id, false), /足した人だけ/);

  await calendar.setCalendarEnabled!({ accountId: "me" }, own.id, false);
  const after = (await calendar.listCalendars({ accountId: "me" })).calendars.find((c) => c.id === own.id)!;
  assert.equal(after.enabled, false);
  assert.deepEqual((await calendar.listEvents({ accountId: "me" }, range)).events.map((e) => e.title), ["家族の予定"]);
  await calendar.setCalendarEnabled!({ accountId: "me" }, own.id, true);
  assert.deepEqual((await calendar.listEvents({ accountId: "me" }, range)).events.map((e) => e.title).sort(), ["家族の予定", "自分の予定"]);
});

test("メール: 受信箱をまとめて読み、返信は元のメールを添えて送る", async () => {
  const { mailboxes } = await mail.listMailboxes({ accountId: "me" });
  assert.deepEqual(mailboxes.map((b) => [b.name, b.unread]).sort(), [
    ["家族", 2],
    ["自分", 2],
  ]);
  const { messages } = await mail.listMessages({ accountId: null }, { limit: 10 });
  assert.deepEqual(messages.map((m) => m.subject), ["家族へ"]);

  await mail.send({ accountId: null }, {
    mailboxId: family.id,
    to: ["a@example.com"],
    subject: "",
    text: "了解",
    replyTo: messages[0].id,
  });
  assert.equal(sent[0].replyTo?.messageId, "<m1@example.com>");
  // 家で共有していない自分のアカウントからは、音声アシスタント（だれか分からない）は送れない
  await assert.rejects(
    mail.send({ accountId: null }, { mailboxId: mine.id, to: ["a@example.com"], subject: "x", text: "x" }),
    /見つかりません/,
  );
});

test("メールボックス: 見えるアカウントのものを、どのアカウントのものか付けて返す", async () => {
  const { folders } = await mail.listFolders!({ accountId: "me" });
  assert.deepEqual(
    folders.map((f) => [f.id, f.name, f.mailboxId]).sort(),
    [
      ["box:Label_家族", "仕事", family.id],
      ["box:Label_自分", "仕事", mine.id],
    ],
  );
  const only = await mail.listFolders!({ accountId: "me" }, mine.id);
  assert.deepEqual(only.folders.map((f) => f.mailboxId), [mine.id]);
});

test("メール: 一覧は覚えておき、既読にしたり移したりしたら読み直す。移すときは今いるフォルダーも渡す", async () => {
  const read = () => mail.listMessages({ accountId: "me" }, { mailboxId: mine.id, limit: 10, folder: "junk" });
  const before = listCalls;
  const [first] = (await read()).messages;
  await read();
  assert.equal(listCalls - before, 1);
  await mail.move!({ accountId: "me" }, first.id, "trash", "junk");
  assert.equal(moves.pop(), "自分 7 junk→trash");
  await read();
  assert.equal(listCalls - before, 2);
  // 見えないアカウントのメールは移せない
  await assert.rejects(mail.move!({ accountId: "mom" }, first.id, "trash", "junk"), /見つかりません/);
});

test("置き場は持ち主だけが読める", async () => {
  assert.equal((await stat(join(dir, "accounts.json"))).mode & 0o777, 0o600);
});
