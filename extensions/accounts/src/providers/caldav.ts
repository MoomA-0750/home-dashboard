import { DAVClient, type DAVCalendar } from "tsdav";
import { HttpError } from "@home-dashboard/extension-sdk";
import { eventsFromIcs, newEventIcs, updateEventIcs } from "../ical";
import type { AccountContext, CalendarClient, RawCalendar, RawEvent, RawEventInput } from "./types";
import { jaText } from "../serverMessages";

/**
 * CalDAV のカレンダー（iCloud・一般）。カレンダーの id はカレンダーの URL、予定の id は .ics の URL。
 * 入口から持ち主・カレンダーの置き場を探す手間（数回の問い合わせ）があるので、つないだものを少しのあいだ使い回す
 */

export const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";
const CLIENT_TTL_MS = 10 * 60 * 1000;

const clients = new Map<string, { client: DAVClient; calendars: DAVCalendar[]; key: string; expiresAt: number }>();

function serverUrlOf(ctx: AccountContext): string {
  if (ctx.account.provider === "icloud") return ICLOUD_CALDAV_URL;
  const url = ctx.account.servers.calendarUrl;
  if (!url) throw new HttpError(400, jaText("noCaldavUrl"));
  return url;
}

async function connect(ctx: AccountContext): Promise<{ client: DAVClient; calendars: DAVCalendar[] }> {
  const { account } = ctx;
  if (account.credentials.kind !== "password") throw new HttpError(400, jaText("noCredentials"));
  const serverUrl = serverUrlOf(ctx);
  const key = `${serverUrl}\0${account.credentials.username}\0${account.credentials.password}`;
  const cached = clients.get(account.id);
  if (cached && cached.key === key && cached.expiresAt > Date.now()) return cached;
  const client = new DAVClient({
    serverUrl,
    credentials: { username: account.credentials.username, password: account.credentials.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  try {
    await client.login();
  } catch (err) {
    throw new HttpError(502, describeError(err));
  }
  const calendars = (await client.fetchCalendars()).filter(
    (calendar) => !calendar.components || calendar.components.includes("VEVENT"),
  );
  clients.set(account.id, { client, calendars, key, expiresAt: Date.now() + CLIENT_TTL_MS });
  return { client, calendars };
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/401|unauthori[sz]ed|invalid credentials/i.test(message))
    return jaText("caldavLoginFailed");
  return jaText("caldavConnectFailed", { detail: message.slice(0, 200) });
}

function nameOf(calendar: DAVCalendar): string {
  return typeof calendar.displayName === "string" && calendar.displayName ? calendar.displayName : jaText("calendarDefault");
}

function findCalendar(calendars: DAVCalendar[], id: string): DAVCalendar {
  const calendar = calendars.find((c) => c.url === id);
  if (!calendar) throw new HttpError(404, jaText("calendarNotFound"));
  return calendar;
}

async function fetchObject(client: DAVClient, calendar: DAVCalendar, url: string) {
  const [object] = await client.fetchCalendarObjects({ calendar, objectUrls: [url], useMultiGet: true });
  if (!object?.data) throw new HttpError(404, jaText("eventNotFound"));
  return object;
}

/** 書き込んだあとの予定を、書いた中身から作る（読み直すと、サーバーによっては反映が遅れるため） */
function eventFromIcs(ics: string, calendarId: string, url: string, input: RawEventInput): RawEvent {
  const [first] = eventsFromIcs(ics, calendarId, url, { from: "1900-01-01T00:00:00Z", to: "2200-01-01T00:00:00Z" });
  return (
    first ?? {
      id: url,
      calendarId,
      recurring: false,
      title: input.title,
      start: input.start,
      end: input.end,
      allDay: input.allDay,
      location: input.location ?? null,
      description: input.description ?? null,
    }
  );
}

export const caldavCalendar: CalendarClient = {
  async listCalendars(ctx) {
    const { calendars } = await connect(ctx);
    return calendars.map(
      (calendar): RawCalendar => ({
        id: calendar.url,
        name: nameOf(calendar),
        color: typeof calendar.calendarColor === "string" ? calendar.calendarColor.slice(0, 7) : null,
        writable: true,
      }),
    );
  },

  async listEvents(ctx, calendarId, range) {
    const { client, calendars } = await connect(ctx);
    const calendar = findCalendar(calendars, calendarId);
    const objects = await client.fetchCalendarObjects({ calendar, timeRange: { start: range.from, end: range.to } });
    return objects.flatMap((object) =>
      typeof object.data === "string" ? eventsFromIcs(object.data, calendarId, object.url, range) : [],
    );
  },

  async createEvent(ctx, calendarId, input) {
    const { client, calendars } = await connect(ctx);
    const calendar = findCalendar(calendars, calendarId);
    const { uid, ics } = newEventIcs(input);
    const filename = `${uid.replace(/[^A-Za-z0-9-]/g, "")}.ics`;
    const res = await client.createCalendarObject({ calendar, iCalString: ics, filename });
    if (!res.ok) throw new HttpError(502, jaText("createFailed", { status: res.status }));
    return eventFromIcs(ics, calendarId, new URL(filename, calendar.url.endsWith("/") ? calendar.url : `${calendar.url}/`).href, input);
  },

  async updateEvent(ctx, calendarId, eventId, input) {
    const { client, calendars } = await connect(ctx);
    const calendar = findCalendar(calendars, calendarId);
    const object = await fetchObject(client, calendar, eventId);
    const ics = updateEventIcs(object.data, input);
    const res = await client.updateCalendarObject({ calendarObject: { ...object, data: ics } });
    if (!res.ok) throw new HttpError(502, jaText("updateFailed", { status: res.status }));
    return eventFromIcs(ics, calendarId, eventId, input);
  },

  async deleteEvent(ctx, calendarId, eventId) {
    const { client, calendars } = await connect(ctx);
    const calendar = findCalendar(calendars, calendarId);
    const object = await fetchObject(client, calendar, eventId);
    const res = await client.deleteCalendarObject({ calendarObject: object });
    if (!res.ok && res.status !== 404) throw new HttpError(502, jaText("deleteFailed", { status: res.status }));
  },
};

/** 公開カレンダー（iCal の URL。読むだけ）。webcal:// は https:// として読む */
export const icalUrlCalendar: CalendarClient = {
  async listCalendars(ctx) {
    return [{ id: "ical", name: ctx.account.label, color: null, writable: false }];
  },
  async listEvents(ctx, calendarId, range) {
    const url = (ctx.account.servers.calendarUrl ?? "").replace(/^webcal:\/\//, "https://");
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new HttpError(502, jaText("readFailed", { status: res.status }));
    return eventsFromIcs(await res.text(), calendarId, "ical", range);
  },
  async createEvent() {
    throw new HttpError(409, jaText("icalNoAdd"));
  },
  async updateEvent() {
    throw new HttpError(409, jaText("icalNoEdit"));
  },
  async deleteEvent() {
    throw new HttpError(409, jaText("icalNoDelete"));
  },
};

export function forgetCaldavClient(accountId: string): void {
  clients.delete(accountId);
}
