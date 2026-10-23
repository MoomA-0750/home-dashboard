import { useMemo } from "react";
import {
  defineWidget,
  DetailFrame,
  List,
  ListItem,
  Note,
  defineMessages,
  useLocale,
  usePolling,
  WidgetCard,
  WidgetHint,
  type WidgetDetailProps,
  type WidgetProps,
} from "@home-dashboard/widget-sdk";
import { addDays, dayLabel, eventOnDay, eventTimeText, fetchCalendars, fetchEvents, startOfDay } from "./client";
import type { CalendarEvent } from "./types";
import { MonthGrid } from "./MonthGrid";

/**
 * 予定のウィジェット。今日と明日の予定を時刻の順に出し、押すと1週間分を開く。
 * カレンダーのアカウントがまだ無いときは、今月のカレンダーを出す（予定の代わりに日付を見られるように）
 */

const messages = defineMessages({
  ja: {
    cardLabel: "予定（1週間分を開く）",
    loadFailed: "読めませんでした",
    noCalendars: "設定の「アカウント → インターネットアカウント」でカレンダーを足すと、予定が出ます",
    noCalendarsShort: "アカウントが未設定（設定 → アカウント）",
    emptyTwoDays: "今日と明日の予定はありません",
    detailTitle: "これからの予定",
    emptyWeek: "1週間の予定はありません",
  },
  en: {
    cardLabel: "Events (open the week)",
    loadFailed: "Couldn't load",
    noCalendars: "Add a calendar in Settings → Accounts → Internet Accounts to see your events",
    noCalendarsShort: "No account yet (Settings → Accounts)",
    emptyTwoDays: "No events today or tomorrow",
    detailTitle: "Upcoming events",
    emptyWeek: "No events this week",
  },
});

interface Config {
  pollIntervalMs: number;
}

/** 日ごとの予定（これから先のものだけ。終日は残す） */
function upcoming(events: CalendarEvent[], days: number) {
  const today = startOfDay(new Date());
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => addDays(today, i))
    .map((day) => ({
      day,
      events: events.filter((e) => eventOnDay(e, day) && (e.allDay || new Date(e.end).getTime() > now)),
    }))
    .filter((group) => group.events.length > 0);
}

function useAgenda(ctx: WidgetProps["ctx"], days: number, intervalMs: number) {
  return usePolling(async () => {
    const from = startOfDay(new Date());
    const [calendars, events] = await Promise.all([fetchCalendars(ctx), fetchEvents(ctx, from, addDays(from, days))]);
    return { calendars: calendars.calendars, events: events.events, errors: [...calendars.errors, ...events.errors] };
  }, intervalMs);
}

function AgendaView({ ctx, config, size, openDetail }: WidgetProps<Config>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error } = useAgenda(ctx, 2, config.pollIntervalMs);
  const colors = useMemo(() => new Map(data?.calendars.map((c) => [c.id, c.color]) ?? []), [data]);
  // 1行の高さに入る数だけ出す
  const room = Math.max(3, size.h * 4 - 1);
  const groups = data ? upcoming(data.events, 2) : [];
  let left = room;
  return (
    <WidgetCard className="calendar-widget" onClick={openDetail} label={t("cardLabel")}>
      {Boolean(error) && !data && <WidgetHint tone="error">{t("loadFailed")}</WidgetHint>}
      {data && data.calendars.length === 0 && (
        <>
          <MonthGrid month={new Date()} compact />
          <WidgetHint>{t("noCalendarsShort")}</WidgetHint>
        </>
      )}
      {data && data.calendars.length > 0 && groups.length === 0 && <span className="calendar-widget__empty">{t("emptyTwoDays")}</span>}
      {groups.map(({ day, events }) => {
        if (left <= 0) return null;
        const shown = events.slice(0, left - 1);
        left -= shown.length + 1;
        return (
          <div key={day.getTime()} className="calendar-widget__day">
            <span className="calendar-widget__label">{dayLabel(day, undefined, locale)}</span>
            {shown.map((event) => (
              <span key={`${event.id}:${event.start}`} className="calendar-widget__event">
                <span className="calendar-dot" style={{ background: colors.get(event.calendarId) ?? undefined }} />
                <span className="calendar-widget__time">{eventTimeText(event, day, locale)}</span>
                <span className="calendar-widget__title">{event.title}</span>
              </span>
            ))}
          </div>
        );
      })}
    </WidgetCard>
  );
}

function AgendaDetail({ ctx, config }: WidgetDetailProps<Config>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data } = useAgenda(ctx, 7, config.pollIntervalMs);
  const colors = new Map(data?.calendars.map((c) => [c.id, c.color]) ?? []);
  const names = new Map(data?.calendars.map((c) => [c.id, c.name]) ?? []);
  const groups = data ? upcoming(data.events, 7) : [];
  return (
    <DetailFrame title={t("detailTitle")} className="calendar-detail">
      {data?.errors.map((e) => (
        <Note key={e.source}>
          {e.source}: {e.message}
        </Note>
      ))}
      {data && data.calendars.length === 0 && (
        <>
          <MonthGrid month={new Date()} />
          <Note>{t("noCalendars")}</Note>
        </>
      )}
      {data && data.calendars.length > 0 && groups.length === 0 && <Note>{t("emptyWeek")}</Note>}
      {groups.map(({ day, events }) => (
        <section key={day.getTime()}>
          <h3 className="calendar-detail__day">{dayLabel(day, undefined, locale)}</h3>
          <List>
            {events.map((event) => (
              <ListItem
                key={`${event.id}:${event.start}`}
                leading={<span className="calendar-dot" style={{ background: colors.get(event.calendarId) ?? undefined }} />}
                title={event.title}
                detail={[eventTimeText(event, day, locale), event.location, names.get(event.calendarId)].filter(Boolean).join(" · ")}
              />
            ))}
          </List>
        </section>
      ))}
    </DetailFrame>
  );
}

export const agendaWidget = defineWidget<Config>({
  id: "calendar-agenda",
  name: { ja: "予定", en: "Events" },
  description: {
    ja: "今日と明日の予定を出します（設定の「アカウント → インターネットアカウント」で足したカレンダー）",
    en: "Shows today's and tomorrow's events (from calendars added in Settings → Accounts → Internet Accounts)",
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 5 * 60 * 1000 },
  Component: AgendaView,
  DetailComponent: AgendaDetail,
});
