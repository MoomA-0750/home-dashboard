import { HttpError, type FeatureProvider } from "@home-dashboard/extension-sdk";
import type { CalendarBackend, CalendarEvent, CalendarInfo, EventInput, SourceError, Viewer } from "./types";
import { jaText } from "../serverMessages";

/**
 * 機能の口「calendar」に入っているもの（インターネットアカウントなど）をまとめて、1つのカレンダーのように扱う。
 * 画面に渡す id には、入っている拡張機能の id を頭に付ける（「accounts:…」）。書くときは、その頭でどれへ渡すかを決める
 */

type Providers = FeatureProvider<CalendarBackend>[];

function split(id: string): [string, string] {
  const index = String(id).indexOf(":");
  if (index <= 0) throw new HttpError(400, jaText("badId"));
  return [id.slice(0, index), id.slice(index + 1)];
}

function providerOf(providers: Providers, id: string): [FeatureProvider<CalendarBackend>, string] {
  const [extensionId, inner] = split(id);
  const provider = providers.find((p) => p.extensionId === extensionId);
  if (!provider) throw new HttpError(404, jaText("calendarNotFound"));
  return [provider, inner];
}

const prefixCalendar = (extensionId: string, c: CalendarInfo): CalendarInfo => ({ ...c, id: `${extensionId}:${c.id}` });
const prefixEvent = (extensionId: string, e: CalendarEvent): CalendarEvent => ({
  ...e,
  id: `${extensionId}:${e.id}`,
  calendarId: `${extensionId}:${e.calendarId}`,
});

const failed = (provider: FeatureProvider<unknown>, err: unknown): SourceError => ({
  source: provider.name,
  message: err instanceof Error ? err.message : String(err),
});

export function aggregate(providers: () => Providers): CalendarBackend {
  return {
    async listCalendars(viewer: Viewer) {
      const results = await Promise.all(
        providers().map(async (p) => {
          try {
            const r = await p.implementation.listCalendars(viewer);
            return { calendars: r.calendars.map((c) => prefixCalendar(p.extensionId, c)), errors: r.errors };
          } catch (err) {
            return { calendars: [], errors: [failed(p, err)] };
          }
        }),
      );
      return { calendars: results.flatMap((r) => r.calendars), errors: results.flatMap((r) => r.errors) };
    },

    async listEvents(viewer, range) {
      const from = new Date(range.from);
      const to = new Date(range.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from)
        throw new HttpError(400, jaText("rangeInvalid"));
      if (to.getTime() - from.getTime() > 400 * 24 * 60 * 60 * 1000) throw new HttpError(400, jaText("rangeTooLong"));
      const results = await Promise.all(
        providers().map(async (p) => {
          try {
            const r = await p.implementation.listEvents(viewer, { from: from.toISOString(), to: to.toISOString() });
            return { events: r.events.map((e) => prefixEvent(p.extensionId, e)), errors: r.errors };
          } catch (err) {
            return { events: [], errors: [failed(p, err)] };
          }
        }),
      );
      const events = results.flatMap((r) => r.events).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
      return { events, errors: results.flatMap((r) => r.errors) };
    },

    async createEvent(viewer, input: EventInput) {
      const [provider, calendarId] = providerOf(providers(), input.calendarId);
      return prefixEvent(provider.extensionId, await provider.implementation.createEvent(viewer, checkInput({ ...input, calendarId })));
    },

    async updateEvent(viewer, eventId, input) {
      const [provider, id] = providerOf(providers(), eventId);
      const [calendarProvider, calendarId] = providerOf(providers(), input.calendarId);
      if (calendarProvider.extensionId !== provider.extensionId) throw new HttpError(400, jaText("otherSource"));
      return prefixEvent(provider.extensionId, await provider.implementation.updateEvent(viewer, id, checkInput({ ...input, calendarId })));
    },

    async setCalendarEnabled(viewer, calendarId, enabled) {
      const [provider, id] = providerOf(providers(), calendarId);
      if (!provider.implementation.setCalendarEnabled) throw new HttpError(400, jaText("cannotToggleCalendar"));
      await provider.implementation.setCalendarEnabled(viewer, id, enabled);
    },

    async deleteEvent(viewer, eventId) {
      const [provider, id] = providerOf(providers(), eventId);
      await provider.implementation.deleteEvent(viewer, id);
    },
  };
}

/** 予定の中身を確かめる（題・時刻の形・終わりが始まりより後） */
export function checkInput(input: EventInput): EventInput {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) throw new HttpError(400, jaText("titleRequired"));
  const allDay = input.allDay === true;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (allDay) {
    if (!datePattern.test(input.start) || !datePattern.test(input.end)) throw new HttpError(400, jaText("allDayFormat"));
    if (input.end <= input.start) throw new HttpError(400, jaText("allDayOrder"));
  } else {
    const start = Date.parse(input.start);
    const end = Date.parse(input.end);
    if (Number.isNaN(start) || Number.isNaN(end)) throw new HttpError(400, jaText("timeUnreadable"));
    if (end <= start) throw new HttpError(400, jaText("timeOrder"));
  }
  return {
    calendarId: input.calendarId,
    title,
    start: input.start,
    end: input.end,
    allDay,
    location: input.location ? String(input.location).slice(0, 500) : null,
    description: input.description ? String(input.description).slice(0, 5000) : null,
  };
}
