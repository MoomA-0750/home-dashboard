import {
  defineMessages,
  extensionApiUrl,
  formatClock,
  formatDate,
  getLocale,
  type Locale,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import type { CalendarEvent, CalendarInfo, EventInput, SourceError } from "./types";
import { commonMessages } from "../webMessages";

/** 画面側からカレンダーの拡張機能の道を呼ぶ。日付と時刻は端末のタイムゾーンで扱う */

type Ctx = Pick<WidgetRuntimeContext, "apiBaseUrl">;

async function request<T>(ctx: Ctx, path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "accounts", `/calendar${path}`), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? commonMessages.t("requestFailed", { status: res.status }));
  return body as T;
}

export const fetchCalendars = (ctx: Ctx) =>
  request<{ calendars: CalendarInfo[]; errors: SourceError[] }>(ctx, "/calendars");

export const setCalendarEnabled = (ctx: Ctx, id: string, enabled: boolean) =>
  request<{ ok: true }>(ctx, `/calendars/${encodeURIComponent(id)}/enabled`, { method: "PUT", json: { enabled } });

export const fetchEvents = (ctx: Ctx, from: Date, to: Date) =>
  request<{ events: CalendarEvent[]; errors: SourceError[] }>(
    ctx,
    `/events?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`,
  );

export const createEvent = (ctx: Ctx, input: EventInput) =>
  request<{ event: CalendarEvent }>(ctx, "/events", { method: "POST", json: input });

export const updateEvent = (ctx: Ctx, id: string, input: EventInput) =>
  request<{ event: CalendarEvent }>(ctx, `/events/${encodeURIComponent(id)}`, { method: "PUT", json: input });

export const deleteEvent = (ctx: Ctx, id: string) =>
  request<{ ok: true }>(ctx, `/events/${encodeURIComponent(id)}`, { method: "DELETE" });

// --- 日付（端末のタイムゾーン） ---

const pad = (n: number) => String(n).padStart(2, "0");

const messages = defineMessages({
  ja: { today: "今日 {day}", tomorrow: "明日 {day}", allDay: "終日", range: "{start}〜{end}" },
  en: { today: "Today · {day}", tomorrow: "Tomorrow · {day}", allDay: "All day", range: "{start} – {end}" },
});

/** その日の0時（端末のタイムゾーン） */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** YYYY-MM-DD（端末のタイムゾーン） */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 時刻（設定の「時刻」に合わせて 14:05 / 午後2:05） */
export function timeText(date: Date): string {
  return formatClock(date);
}

/** 「10月21日(水)」（英語は「Wed Oct 21」。設定の日付の形に合わせる）。今日・明日はそう言う */
export function dayLabel(date: Date, today = startOfDay(new Date()), locale: Locale = getLocale()): string {
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
  const base = formatDate(date, "monthDayWeekday", locale);
  if (diff === 0) return messages.t("today", { day: base }, locale);
  if (diff === 1) return messages.t("tomorrow", { day: base }, locale);
  return base;
}

/** 予定がその日にかかるか（終日の終わりはその日を含まない） */
export function eventOnDay(event: CalendarEvent, day: Date): boolean {
  const key = dateKey(day);
  if (event.allDay) return event.start <= key && key < event.end;
  const start = new Date(event.start);
  const end = new Date(event.end);
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return start < dayEnd && end > dayStart;
}

/** 一覧に出す時刻（終日・日をまたぐものも分かるように） */
export function eventTimeText(event: CalendarEvent, day: Date, locale: Locale = getLocale()): string {
  if (event.allDay) return messages.t("allDay", undefined, locale);
  const start = new Date(event.start);
  const end = new Date(event.end);
  const dayStart = startOfDay(day);
  const startText = start < dayStart ? "" : formatClock(start, locale);
  const endText = end > addDays(dayStart, 1) ? "" : formatClock(end, locale);
  return messages.t("range", { start: startText, end: endText }, locale).trim();
}
