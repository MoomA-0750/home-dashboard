import { useEffect, useMemo, useState } from "react";
import {
  Button,
  ButtonRow,
  defineMessages,
  Group,
  List,
  ListItem,
  Note,
  ScreenFrame,
  ScreenNotice,
  ScreenSection,
  SectionTitle,
  SideLayout,
  ToggleSwitch,
  openSettings,
  useDisplay,
  useLocale,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import {
  addDays,
  createEvent,
  dayLabel,
  deleteEvent,
  eventOnDay,
  eventTimeText,
  fetchCalendars,
  fetchEvents,
  setCalendarEnabled,
  startOfDay,
  updateEvent,
} from "./client";
import { CalendarDot } from "./CalendarDot";
import { EventEditor } from "./EventEditor";
import { GRID_DAYS, gridStart, MonthGrid } from "./MonthGrid";
import type { CalendarEvent, CalendarInfo, SourceError } from "./types";
import { fetchCached, forgetCached, useCached } from "../swr";
import { commonMessages } from "../webMessages";

/**
 * Calendar 画面。左の欄にアカウントごとのカレンダー（入／切を切り替える。狭い画面では下に回す）、右の上に月のカレンダー
 * （予定のある日に点）、下に選んだ日の予定を並べ、押すと予定を変える欄が開く。
 * 自分のカレンダーと、家で共有しているカレンダーが出る。アカウントがまだ無くても月のカレンダーは出し、設定への入口を添える
 */

const messages = defineMessages({
  ja: {
    today: "今日",
    addEvent: "予定を足す",
    noCalendars: "カレンダーのアカウントが未設定です（押すと設定へ）",
    noEvents: "予定はありません",
    calendars: "カレンダー",
    noCalendarList: "カレンダーはまだありません",
    toggle: "{name}を出す",
    onlyOwner: "入／切はアカウントを足した人が変えます",
  },
  en: {
    today: "Today",
    addEvent: "Add event",
    noCalendars: "No calendar account yet (tap to set up)",
    noEvents: "No events",
    calendars: "Calendars",
    noCalendarList: "No calendars yet",
    toggle: "Show {name}",
    onlyOwner: "Only the person who added the account can change this",
  },
});

const eventsKey = (anchor: number) => `calendar:events:${anchor}`;

export function CalendarScreen({ ctx }: ScreenProps) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  // 週の始まり（設定の「週の始まり」）から2週間を並べる
  const display = useDisplay();
  // 表に出している月と、予定を並べる日
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const anchor = gridStart(month, display);
  const anchorTime = anchor.getTime();
  const eventsFor = (start: number) => fetchEvents(ctx, new Date(start), addDays(new Date(start), GRID_DAYS));
  // 読んだものは画面でも覚えておき（../swr）、月を戻したとき・開き直したときはすぐ出して裏で読み直す
  const calendarList = useCached("calendar:calendars", () => fetchCalendars(ctx), 5 * 60 * 1000);
  const eventList = useCached(eventsKey(anchorTime), () => eventsFor(anchorTime), 5 * 60 * 1000);
  // 入／切をすぐ見せる（読み直しが届くまで）
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map());
  const [failure, setFailure] = useState<string | null>(null);
  const calendars = useMemo(
    () => (calendarList.data?.calendars ?? []).map((c) => (toggled.has(c.id) ? { ...c, enabled: toggled.get(c.id) } : c)),
    [calendarList.data, toggled],
  );
  const events = eventList.data?.events ?? null;
  const errors = useMemo(() => {
    const seen = new Set<string>();
    return [...(calendarList.data?.errors ?? []), ...(eventList.data?.errors ?? [])].filter(
      (e: SourceError) => !seen.has(e.source) && seen.add(e.source),
    );
  }, [calendarList.data, eventList.data]);
  const loadError = eventList.error ?? calendarList.error;
  // 開いている予定（"new" は新しい予定）
  const [editing, setEditing] = useState<{ event: CalendarEvent | null; day: Date } | null>(null);

  /** 予定を変えたあと: 覚えた予定を捨てて読み直す（今の表は、新しいものが届くまで出したまま） */
  const load = async () => {
    forgetCached("calendar:events:");
    forgetCached("calendar:calendars");
    await Promise.all([eventList.reload(), calendarList.reload()]);
  };

  // 前後の月を裏で先読みする（月を送ったときにすぐ出す）
  useEffect(() => {
    if (!eventList.data) return;
    const timer = setTimeout(async () => {
      for (const delta of [1, -1]) {
        const next = gridStart(new Date(month.getFullYear(), month.getMonth() + delta, 1), display).getTime();
        await fetchCached(eventsKey(next), () => eventsFor(next), 5 * 60 * 1000).catch(() => undefined);
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventList.data]);

  const colors = useMemo(() => new Map(calendars.map((c) => [c.id, c.color])), [calendars]);
  const names = useMemo(() => new Map(calendars.map((c) => [c.id, c.name])), [calendars]);
  const today = startOfDay(new Date());
  const enabledCalendars = calendars.filter((c) => c.enabled !== false);
  const canWrite = enabledCalendars.some((c) => c.writable);
  // アカウントごとにまとめる（出てきた順）
  const bySource = useMemo(() => {
    const groups = new Map<string, CalendarInfo[]>();
    for (const c of calendars) groups.set(c.source, [...(groups.get(c.source) ?? []), c]);
    return [...groups];
  }, [calendars]);
  const toggle = async (calendar: CalendarInfo, enabled: boolean) => {
    // すぐ切り替えて見せ、だめなら戻す
    setToggled((m) => new Map(m).set(calendar.id, enabled));
    try {
      await setCalendarEnabled(ctx, calendar.id, enabled);
      await load();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
    setToggled((m) => {
      const next = new Map(m);
      next.delete(calendar.id);
      return next;
    });
  };
  const side = (
    <>
      {bySource.length === 0 && <ScreenNotice>{t("noCalendarList")}</ScreenNotice>}
      {bySource.map(([source, list]) => (
        <section key={source}>
          <SectionTitle>{source}</SectionTitle>
          <List boxed label={source}>
            {list.map((c) => (
              <ListItem
                key={c.id}
                leading={<CalendarDot color={c.color} />}
                title={c.name}
                off={c.enabled === false}
                trailing={
                  <ToggleSwitch
                    checked={c.enabled !== false}
                    disabled={!c.toggleable}
                    label={t("toggle", { name: c.name })}
                    onChange={(on) => void toggle(c, on)}
                  />
                }
              />
            ))}
          </List>
          {list.some((c) => !c.toggleable) && <Note>{t("onlyOwner")}</Note>}
        </section>
      ))}
    </>
  );
  const onSelected = events?.filter((e) => eventOnDay(e, selected)) ?? [];
  const select = (day: Date) => {
    setSelected(day);
    if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) setMonth(day);
  };

  const actions = (
    <ButtonRow>
      <Button onClick={() => select(today)}>{t("today")}</Button>
      {canWrite && (
        <Button variant="primary" icon="add" onClick={() => setEditing({ event: null, day: selected })}>
          {t("addEvent")}
        </Button>
      )}
    </ButtonRow>
  );

  return (
    <ScreenFrame title={{ ja: "カレンダー", en: "Calendar" }} actions={actions}>
      {(failure ?? (events === null ? loadError : null)) && (
        <ScreenNotice tone="error">{failure ?? loadError}</ScreenNotice>
      )}
      {errors.map((e) => (
        <ScreenNotice key={e.source} tone="error">
          {e.source}: {e.message}
        </ScreenNotice>
      ))}
      {editing && (
        <EventEditor
          key={editing.event?.id ?? "new"}
          event={editing.event}
          calendars={enabledCalendars}
          day={editing.day}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (editing.event) await updateEvent(ctx, editing.event.id, input);
            else await createEvent(ctx, input);
            setEditing(null);
            await load();
          }}
          onDelete={async () => {
            if (editing.event) await deleteEvent(ctx, editing.event.id);
            setEditing(null);
            await load();
          }}
        />
      )}
      <SideLayout side={side} sideLabel={t("calendars")} narrow="below">
      {events !== null && calendars.length === 0 && errors.length === 0 && (
        <div className="mb-3">
          {/* アカウントがまだ無いときの設定への入口。印だけ注意の色にし、狭い画面では折り返す */}
          <Button
            icon="warning"
            className="max-w-full text-left whitespace-normal [&_.fluent-icon]:shrink-0 [&_.fluent-icon]:text-warn"
            onClick={() => openSettings({ page: "account" })}>
            {t("noCalendars")}
          </Button>
        </div>
      )}
      <Group className="mb-4">
        <MonthGrid
          month={month}
          selected={selected}
          marked={(day) => events?.some((e) => eventOnDay(e, day)) ?? false}
          onSelect={select}
          onMonth={(next) => setMonth(next)}
        />
      </Group>
      <ScreenSection title={dayLabel(selected, today, locale)}>
        {events === null && !loadError ? (
          <ScreenNotice>{tc("loading")}</ScreenNotice>
        ) : onSelected.length === 0 ? (
          <ScreenNotice>{t("noEvents")}</ScreenNotice>
        ) : (
          <List boxed label={dayLabel(selected, today, locale)}>
            {onSelected.map((event) => (
              <ListItem
                key={`${event.id}:${event.start}`}
                leading={<CalendarDot color={colors.get(event.calendarId)} />}
                title={event.title}
                detail={[eventTimeText(event, selected, locale), event.location, names.get(event.calendarId)].filter(Boolean).join(" · ")}
                onClick={() => setEditing({ event, day: selected })}
              />
            ))}
          </List>
        )}
      </ScreenSection>
      </SideLayout>
    </ScreenFrame>
  );
}
