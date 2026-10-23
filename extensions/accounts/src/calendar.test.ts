import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, checkInput } from "./calendar/aggregate";
import { dayRange, describeEvent } from "./calendar/time";
import type { CalendarBackend } from "./calendar/types";

function fake(name: string, fail = false): CalendarBackend & { writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    listCalendars: async () => {
      if (fail) throw new Error("落ちています");
      return { calendars: [{ id: "c1", name, color: null, source: name, writable: true, shared: true }], errors: [] };
    },
    listEvents: async () => {
      if (fail) throw new Error("落ちています");
      return {
      events: [
        { id: "e1", calendarId: "c1", title: `${name}の予定`, start: name === "A" ? "2026-10-21T01:00:00.000Z" : "2026-10-21T00:00:00.000Z", end: "2026-10-21T02:00:00.000Z", allDay: false, location: null, description: null, recurring: false },
      ],
      errors: [{ source: `${name}の一部`, message: "読めません" }],
      };
    },
    createEvent: async (_v, input) => {
      writes.push(`create ${input.calendarId} ${input.title}`);
      return { id: "new", calendarId: input.calendarId, title: input.title, start: input.start, end: input.end, allDay: input.allDay, location: null, description: null, recurring: false };
    },
    updateEvent: async () => {
      throw new Error("not used");
    },
    deleteEvent: async (_v, id) => void writes.push(`delete ${id}`),
  };
}

const a = fake("A");
const b = fake("B");
const broken = fake("壊れた", true);
const calendar = aggregate(() => [
  { extensionId: "accounts", name: "A", implementation: a },
  { extensionId: "school", name: "B", implementation: b },
  { extensionId: "broken", name: "壊れた", implementation: broken },
]);
const viewer = { accountId: "me" };

test("入っているものをまとめ、id に出どころを付け、時刻の順に並べる。落ちたものは理由を返す", async () => {
  const { calendars, errors } = await calendar.listCalendars(viewer);
  assert.deepEqual(calendars.map((c) => c.id), ["accounts:c1", "school:c1"]);
  assert.deepEqual(errors, [{ source: "壊れた", message: "落ちています" }]);
  const { events } = await calendar.listEvents(viewer, { from: "2026-10-21T00:00:00Z", to: "2026-10-22T00:00:00Z" });
  assert.deepEqual(events.map((e) => [e.id, e.title]), [
    ["school:e1", "Bの予定"],
    ["accounts:e1", "Aの予定"],
  ]);
});

test("書くときは id の頭で出どころを選び、頭を外して渡す", async () => {
  const created = await calendar.createEvent(viewer, {
    calendarId: "school:c1",
    title: " 遠足 ",
    start: "2026-10-30",
    end: "2026-10-31",
    allDay: true,
  });
  assert.equal(b.writes.pop(), "create c1 遠足");
  assert.equal(created.id, "school:new");
  await calendar.deleteEvent(viewer, "accounts:e1");
  assert.equal(a.writes.pop(), "delete e1");
  await assert.rejects(calendar.deleteEvent(viewer, "nothing:e1"), /見つかりません/);
});

test("予定の中身を確かめる", () => {
  assert.throws(() => checkInput({ calendarId: "x", title: "", start: "2026-10-30", end: "2026-10-31", allDay: true }), /名前/);
  assert.throws(() => checkInput({ calendarId: "x", title: "a", start: "2026-10-30", end: "2026-10-30", allDay: true }), /次の日|後/);
  assert.throws(
    () => checkInput({ calendarId: "x", title: "a", start: "2026-10-30T10:00:00+09:00", end: "2026-10-30T09:00:00+09:00", allDay: false }),
    /後/,
  );
});

test("音声アシスタントへは決めたタイムゾーンで今日を決め、言い方を作る", () => {
  // UTC の 10/20 16:00 は、日本では 10/21 の 1:00
  const range = dayRange("Asia/Tokyo", 0, 1, new Date("2026-10-20T16:00:00Z"));
  assert.deepEqual(range, { from: "2026-10-20T15:00:00.000Z", to: "2026-10-21T15:00:00.000Z" });
  assert.equal(
    describeEvent({ start: "2026-10-21T00:00:00.000Z", end: "2026-10-21T01:30:00.000Z", allDay: false }, "Asia/Tokyo"),
    "10/21(水) 9:00〜10:30",
  );
  assert.equal(describeEvent({ start: "2026-12-29", end: "2026-12-31", allDay: true }, "Asia/Tokyo"), "12/29(火)〜12/30(水) 終日");
});
