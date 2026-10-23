import { randomUUID } from "node:crypto";
import ICAL from "ical.js";
import type { RawEvent, RawEventInput } from "./providers/types";
import { jaText } from "./serverMessages";

/**
 * iCalendar（.ics）を読む・作る。CalDAV（iCloud・一般）と公開カレンダー（iCal の URL）で使う。
 * 繰り返しの予定は、ここで期間の中の回に広げる（サーバーに広げてもらう方法は、対応していないサーバーがあるため使わない）
 */

/** 繰り返しを広げる回数の上限（何年も前から毎日続く予定で止まらないように） */
const MAX_OCCURRENCES = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

function toIso(time: ICAL.Time): { value: string; allDay: boolean } {
  if (time.isDate) return { value: `${time.year}-${pad(time.month)}-${pad(time.day)}`, allDay: true };
  return { value: time.toJSDate().toISOString(), allDay: false };
}

/** VCALENDAR の中の VTIMEZONE を覚える（TZID 付きの時刻を正しく読むため） */
function registerTimezones(calendar: ICAL.Component): void {
  for (const vtimezone of calendar.getAllSubcomponents("vtimezone")) {
    const tzid = vtimezone.getFirstPropertyValue("tzid");
    if (typeof tzid === "string" && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(vtimezone);
  }
}

function eventFields(event: ICAL.Event) {
  return {
    title: event.summary || jaText("untitledEvent"),
    location: event.location || null,
    description: event.description || null,
  };
}

/**
 * .ics の中から、from 以上 to 未満にかかる予定を取り出す。id は objectId（CalDAV なら .ics の URL）。
 * 繰り返しの予定は回ごとに出し、id は同じ（変える・消すは繰り返し全体）
 */
export function eventsFromIcs(
  ics: string,
  calendarId: string,
  objectId: string,
  range: { from: string; to: string },
): RawEvent[] {
  let calendar: ICAL.Component;
  try {
    calendar = new ICAL.Component(ICAL.parse(ics));
  } catch {
    return [];
  }
  registerTimezones(calendar);
  const from = ICAL.Time.fromJSDate(new Date(range.from), true);
  const to = ICAL.Time.fromJSDate(new Date(range.to), true);
  const vevents = calendar.getAllSubcomponents("vevent");
  // 繰り返しの中の1回だけを変えたもの（RECURRENCE-ID 付き）は、元の予定に結び付ける
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const exception of exceptions) masters.get(exception.uid)?.relateException(exception);

  const out: RawEvent[] = [];
  const push = (start: ICAL.Time, end: ICAL.Time, item: ICAL.Event, recurring: boolean) => {
    if (end.compare(from) <= 0 || start.compare(to) >= 0) return;
    const s = toIso(start);
    const e = toIso(end);
    out.push({ id: objectId, calendarId, start: s.value, end: e.value, allDay: s.allDay, recurring, ...eventFields(item) });
  };

  for (const event of masters.values()) {
    if (!event.startDate) continue;
    const end = event.endDate ?? event.startDate;
    if (!event.isRecurring()) {
      push(event.startDate, end, event, false);
      continue;
    }
    const iterator = event.iterator();
    for (let i = 0, next = iterator.next(); next && i < MAX_OCCURRENCES; i++, next = iterator.next()) {
      if (next.compare(to) >= 0) break;
      const details = event.getOccurrenceDetails(next);
      push(details.startDate, details.endDate, details.item, true);
    }
  }
  // 元の予定が無い変更だけの回（ほかのカレンダーから招待されたものなど）
  for (const exception of exceptions) {
    if (!masters.has(exception.uid) && exception.startDate)
      push(exception.startDate, exception.endDate ?? exception.startDate, exception, true);
  }
  return out;
}

function timeOf(value: string, allDay: boolean): ICAL.Time {
  if (allDay) {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    return ICAL.Time.fromData({ year: y, month: m, day: d, isDate: true });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(jaText("timeUnreadableValue", { value }));
  // UTC で書く（どのカレンダーでも同じ時刻に見える）
  return ICAL.Time.fromJSDate(date, true);
}

function setEventFields(vevent: ICAL.Component, input: RawEventInput): void {
  const event = new ICAL.Event(vevent);
  event.summary = input.title;
  event.startDate = timeOf(input.start, input.allDay);
  event.endDate = timeOf(input.end, input.allDay);
  for (const [name, value] of [
    ["location", input.location],
    ["description", input.description],
  ] as const) {
    vevent.removeAllProperties(name);
    if (value) vevent.addPropertyWithValue(name, value);
  }
  vevent.updatePropertyWithValue("dtstamp", ICAL.Time.now());
  const sequence = Number(vevent.getFirstPropertyValue("sequence") ?? 0);
  vevent.updatePropertyWithValue("sequence", Number.isFinite(sequence) ? sequence + 1 : 1);
}

/** 新しい予定の .ics と UID */
export function newEventIcs(input: RawEventInput): { uid: string; ics: string } {
  const uid = `${randomUUID()}@home-dashboard`;
  const calendar = new ICAL.Component(["vcalendar", [], []]);
  calendar.addPropertyWithValue("prodid", "-//home-dashboard//JA");
  calendar.addPropertyWithValue("version", "2.0");
  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("uid", uid);
  vevent.addPropertyWithValue("sequence", -1);
  setEventFields(vevent, input);
  calendar.addSubcomponent(vevent);
  return { uid, ics: calendar.toString() };
}

/** 今の .ics の予定（繰り返しなら元の予定）を書き換えた .ics */
export function updateEventIcs(ics: string, input: RawEventInput): string {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  registerTimezones(calendar);
  const master =
    calendar.getAllSubcomponents("vevent").find((vevent) => !vevent.hasProperty("recurrence-id")) ??
    calendar.getFirstSubcomponent("vevent");
  if (!master) throw new Error(jaText("eventMissing"));
  setEventFields(master, input);
  return calendar.toString();
}
