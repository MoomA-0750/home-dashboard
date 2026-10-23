import { HttpError, type ExtensionAccount, type FeatureProvider, type ServerExtensionApi } from "@home-dashboard/extension-sdk";
import { aggregate } from "./aggregate";
import { dayRange, describeEvent } from "./time";
import { jaText, localizedRoute } from "../serverMessages";
import type { CalendarBackend, CalendarEvent, EventInput, Viewer } from "./types";

/**
 * カレンダーの道と音声アシスタントのツール。この拡張機能のアカウント（own）と、機能の口「calendar」に入っているものを束ねる。
 * - /calendar/calendars・/calendar/events … ウィジェットと Calendar 画面。ログインしている人として読む（自分の分と家で共有の分）
 * - 音声アシスタントの list_events・create_event・update_event・delete_event（だれが話しかけたか分からないので、家で共有の分だけ）
 */

// 一度に読める予定の期間（月の表示の前後を含めても足りる長さ）
const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

const viewerOf = (account: ExtensionAccount | null): Viewer => ({ accountId: account?.id ?? null });

export function registerCalendar(api: ServerExtensionApi, own: FeatureProvider<CalendarBackend>): void {
  const calendar: CalendarBackend = aggregate(() => [own, ...api.providers<CalendarBackend>("calendar")]);
  const route = localizedRoute(api);
  const timeZone = () => String(api.settings.timeZone || "Asia/Tokyo");

  route("GET", "/calendar/calendars", ({ account }) => calendar.listCalendars(viewerOf(account)));
  route("PUT", "/calendar/calendars/:id/enabled", async ({ account, params, body }) => {
    const enabled = (body as { enabled?: unknown } | null)?.enabled;
    if (typeof enabled !== "boolean") throw new HttpError(400, jaText("badRequest"));
    await calendar.setCalendarEnabled!(viewerOf(account), params.id, enabled);
    return { ok: true };
  });
  route("GET", "/calendar/events", ({ account, query }) => {
    if (!query.from || !query.to) throw new HttpError(400, jaText("rangeRequired"));
    // 期間は日時として読めて、長すぎないものだけ（何十年分も頼まれると、外の問い合わせと繰り返し予定の展開が重い）
    const from = Date.parse(query.from);
    const to = Date.parse(query.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > MAX_RANGE_MS)
      throw new HttpError(400, jaText("rangeInvalid"));
    return calendar.listEvents(viewerOf(account), { from: query.from, to: query.to });
  });
  route("POST", "/calendar/events", async ({ account, body }) => ({
    event: await calendar.createEvent(viewerOf(account), body as EventInput),
  }));
  route("PUT", "/calendar/events/:id", async ({ account, params, body }) => ({
    event: await calendar.updateEvent(viewerOf(account), params.id, body as EventInput),
  }));
  route("DELETE", "/calendar/events/:id", async ({ account, params }) => {
    await calendar.deleteEvent(viewerOf(account), params.id);
    return { ok: true };
  });

  // 音声アシスタントからは、家で共有するカレンダーだけ
  const household: Viewer = { accountId: null };
  const brief = (event: CalendarEvent, names: Map<string, string>) => ({
    id: event.id,
    calendarId: event.calendarId,
    calendar: names.get(event.calendarId) ?? null,
    title: event.title,
    when: describeEvent(event, timeZone()),
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    location: event.location,
  });

  api.tool({
    name: "list_events",
    description: async () =>
      `家で共有しているカレンダーの予定を返す。days を省くと今日だけ、offsetDays で何日先から（明日なら 1）。時刻は ${timeZone()} の時刻で when に入る。変える・消すときは id と calendarId を使う。`,
    inputSchema: (z) => ({
      offsetDays: z.number().int().min(-30).max(365).optional().describe("何日先から（今日は 0）"),
      days: z.number().int().min(1).max(31).optional().describe("何日分（既定は 1）"),
    }),
    readOnly: true,
    personal: true,
    // 予定の名前・場所は、招待を送ってきた外の人が書いたものでもある
    untrusted: true,
    handler: async ({ offsetDays, days }) => {
      const range = dayRange(timeZone(), offsetDays ?? 0, days ?? 1);
      const [{ calendars }, { events, errors }] = await Promise.all([
        calendar.listCalendars(household),
        calendar.listEvents(household, range),
      ]);
      const names = new Map(calendars.map((c) => [c.id, c.name]));
      return {
        events: events.map((e) => brief(e, names)),
        calendars: calendars.filter((c) => c.writable && c.enabled !== false).map((c) => ({ id: c.id, name: c.name })),
        errors,
      };
    },
  });

  api.tool({
    name: "create_event",
    description: async () =>
      `家で共有しているカレンダーに予定を足す。start・end はタイムゾーン付きの ISO 8601（${timeZone()} なら +09:00 などを付ける）。終日なら allDay を true にして start・end を日付（YYYY-MM-DD、end はその日を含まない次の日）にする。end を省くと1時間（終日なら1日）。calendar を省くと最初の書けるカレンダー。足したら何をいつに入れたかを一言で伝える。`,
    inputSchema: (z) => ({
      title: z.string().min(1).max(200),
      start: z.string(),
      end: z.string().optional(),
      allDay: z.boolean().optional(),
      location: z.string().max(500).optional(),
      calendar: z.string().optional().describe("カレンダーの名前か id"),
    }),
    // 足すだけなら間違えても消せる
    risk: "low",
    personal: true,
    describe: ({ title, start }) => `予定「${title}」（${start}）をカレンダーに足す`,
    handler: async ({ title, start, end, allDay, location, calendar: wanted }) => {
      const { calendars } = await calendar.listCalendars(household);
      const writable = calendars.filter((c) => c.writable && c.enabled !== false);
      const target = wanted
        ? writable.find((c) => c.id === wanted || c.name === wanted)
        : writable[0];
      if (!target)
        throw new HttpError(404, wanted ? `書けるカレンダー「${wanted}」がありません` : "家で共有している書けるカレンダーがありません");
      const event = await calendar.createEvent(household, {
        calendarId: target.id,
        title,
        start,
        end: end ?? defaultEnd(start, allDay === true),
        allDay: allDay === true,
        location: location ?? null,
      });
      return { ok: true, calendar: target.name, event: brief(event, new Map([[target.id, target.name]])) };
    },
  });

  api.tool({
    name: "update_event",
    description:
      "家で共有しているカレンダーの予定を変える。id と calendarId は list_events のもの。変えない項目も、今の値（list_events の title・start・end・allDay・location）をそのまま渡す。繰り返しの予定は、繰り返し全体が変わることがある。",
    inputSchema: (z) => ({
      id: z.string(),
      calendarId: z.string(),
      title: z.string().min(1).max(200),
      start: z.string(),
      end: z.string(),
      allDay: z.boolean(),
      location: z.string().max(500).nullable().optional(),
    }),
    risk: "confirm",
    personal: true,
    describe: ({ title, start }) => `予定「${title}」を ${start} からの内容に変える`,
    handler: async ({ id, calendarId, title, start, end, allDay, location }) => {
      const event = await calendar.updateEvent(household, id, { calendarId, title, start, end, allDay, location: location ?? null });
      return { ok: true, event: brief(event, new Map()) };
    },
  });

  api.tool({
    name: "delete_event",
    description: "家で共有しているカレンダーの予定を消す。id は list_events のもの、title にはその予定の名前を入れる。",
    inputSchema: (z) => ({ id: z.string(), title: z.string().optional().describe("消す予定の名前（確かめの画面に出す）") }),
    risk: "confirm",
    personal: true,
    describe: ({ title }) => (title ? `予定「${title}」を消す` : "カレンダーの予定を1つ消す"),
    handler: async ({ id }) => {
      await calendar.deleteEvent(household, id);
      return { ok: true };
    },
  });
}

/** 終わりを省いたとき: 時刻なら1時間後、終日なら次の日 */
function defaultEnd(start: string, allDay: boolean): string {
  if (allDay) {
    const date = new Date(`${start.slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }
  const time = Date.parse(start);
  if (Number.isNaN(time)) throw new HttpError(400, "時刻が読めません");
  return new Date(time + 60 * 60 * 1000).toISOString();
}
