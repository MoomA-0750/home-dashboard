import { test } from "node:test";
import assert from "node:assert/strict";
import { eventsFromIcs, newEventIcs, updateEventIcs } from "./ical";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//JA
BEGIN:VTIMEZONE
TZID:Asia/Tokyo
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0900
TZOFFSETTO:+0900
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:weekly@test
DTSTART;TZID=Asia/Tokyo:20261005T090000
DTEND;TZID=Asia/Tokyo:20261005T100000
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:朝会
END:VEVENT
BEGIN:VEVENT
UID:weekly@test
RECURRENCE-ID;TZID=Asia/Tokyo:20261012T090000
DTSTART;TZID=Asia/Tokyo:20261012T110000
DTEND;TZID=Asia/Tokyo:20261012T120000
SUMMARY:朝会（ずらした）
END:VEVENT
BEGIN:VEVENT
UID:holiday@test
DTSTART;VALUE=DATE:20261012
DTEND;VALUE=DATE:20261013
SUMMARY:スポーツの日
LOCATION:家
END:VEVENT
END:VCALENDAR`;

test("繰り返しの予定は期間の中の回に広げ、1回だけ変えた回はその中身にする。タイムゾーンも読む", () => {
  const events = eventsFromIcs(ICS, "cal", "obj.ics", { from: "2026-10-10T00:00:00Z", to: "2026-10-25T00:00:00Z" });
  const summary = events.map((e) => [e.title, e.start, e.allDay, e.recurring]).sort();
  assert.deepEqual(summary, [
    ["スポーツの日", "2026-10-12", true, false],
    ["朝会", "2026-10-19T00:00:00.000Z", false, true],
    ["朝会（ずらした）", "2026-10-12T02:00:00.000Z", false, true],
  ]);
  assert.equal(events.find((e) => e.title === "スポーツの日")?.location, "家");
});

test("新しい予定を作り、読み直すと同じ中身。書き換えると繰り返しを残したまま変わる", () => {
  const { uid, ics } = newEventIcs({
    title: "歯医者",
    start: "2026-11-02T06:30:00.000Z",
    end: "2026-11-02T07:30:00.000Z",
    allDay: false,
    location: "駅前",
  });
  assert.match(uid, /@home-dashboard$/);
  const [event] = eventsFromIcs(ics, "cal", "x", { from: "2026-11-01T00:00:00Z", to: "2026-11-03T00:00:00Z" });
  assert.deepEqual([event.title, event.start, event.end, event.location], [
    "歯医者",
    "2026-11-02T06:30:00.000Z",
    "2026-11-02T07:30:00.000Z",
    "駅前",
  ]);

  const changed = updateEventIcs(ICS, {
    title: "朝会（新）",
    start: "2026-10-05T01:00:00.000Z",
    end: "2026-10-05T02:00:00.000Z",
    allDay: false,
  });
  const again = eventsFromIcs(changed, "cal", "obj.ics", { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" });
  // 繰り返し（4回）は残り、どの回も新しい中身になる（時刻を変えたので、前に1回だけずらした回とは結び付かなくなる）
  assert.equal(again.filter((e) => e.title === "朝会（新）").length, 4);
  assert.match(changed, /RRULE:FREQ=WEEKLY;COUNT=4/);
});

test("終日の予定は日付で書く", () => {
  const { ics } = newEventIcs({ title: "旅行", start: "2026-12-29", end: "2026-12-31", allDay: true });
  assert.match(ics, /DTSTART;VALUE=DATE:20261229/);
  const [event] = eventsFromIcs(ics, "cal", "x", { from: "2026-12-01T00:00:00Z", to: "2027-01-01T00:00:00Z" });
  assert.deepEqual([event.start, event.end, event.allDay], ["2026-12-29", "2026-12-31", true]);
});
