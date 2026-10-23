import { useState, type FormEvent } from "react";
import { Button, ButtonRow, Check, defineMessages, Field, Group, Message, SectionTitle } from "@home-dashboard/widget-sdk";
import { addDays, dateKey, timeText } from "./client";
import type { CalendarEvent, CalendarInfo, EventInput } from "./types";
import { commonMessages } from "../webMessages";

/**
 * 予定を足す・変える欄。終日は日付だけ（終わりの日は「その日まで」で入れ、保存するときに次の日に直す）。
 * 書けないカレンダーの予定は見るだけ
 */

const messages = defineMessages({
  ja: {
    viewTitle: "予定",
    editTitle: "予定を変える",
    addTitle: "予定を足す",
    name: "名前",
    calendar: "カレンダー",
    calendarHint: "ほかのアカウントのカレンダーへは移せません",
    calendarOption: "{name}（{source}）",
    allDay: "終日",
    start: "始まり",
    time: "時刻",
    endAllDay: "終わり（その日まで）",
    end: "終わり",
    location: "場所",
    notes: "メモ",
    recurring: "繰り返しの予定です。変えると、繰り返し全体が変わることがあります。",
    saving: "保存しています…",
    confirmDelete: "もう一度押して消す",
    delete: "消す",
  },
  en: {
    viewTitle: "Event",
    editTitle: "Edit event",
    addTitle: "Add event",
    name: "Title",
    calendar: "Calendar",
    calendarHint: "Events can't be moved to another account's calendar",
    calendarOption: "{name} ({source})",
    allDay: "All day",
    start: "Starts",
    time: "Time",
    endAllDay: "Ends (through that day)",
    end: "Ends",
    location: "Location",
    notes: "Notes",
    recurring: "This is a recurring event. Changing it may change the whole series.",
    saving: "Saving…",
    confirmDelete: "Press again to delete",
    delete: "Delete",
  },
});

interface Draft {
  calendarId: string;
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
}

function draftOf(event: CalendarEvent | null, calendars: CalendarInfo[], day: Date): Draft {
  if (!event) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.min(new Date().getHours() + 1, 23));
    return {
      calendarId: calendars.find((c) => c.writable)?.id ?? "",
      title: "",
      allDay: false,
      startDate: dateKey(start),
      startTime: timeText(start).padStart(5, "0"),
      endDate: dateKey(start),
      endTime: timeText(new Date(start.getTime() + 3600_000)).padStart(5, "0"),
      location: "",
      description: "",
    };
  }
  if (event.allDay) {
    const lastDay = addDays(new Date(`${event.end}T00:00:00`), -1);
    return {
      calendarId: event.calendarId,
      title: event.title,
      allDay: true,
      startDate: event.start,
      startTime: "09:00",
      endDate: dateKey(lastDay),
      endTime: "10:00",
      location: event.location ?? "",
      description: event.description ?? "",
    };
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  return {
    calendarId: event.calendarId,
    title: event.title,
    allDay: false,
    startDate: dateKey(start),
    startTime: timeText(start).padStart(5, "0"),
    endDate: dateKey(end),
    endTime: timeText(end).padStart(5, "0"),
    location: event.location ?? "",
    description: event.description ?? "",
  };
}

function inputOf(draft: Draft): EventInput {
  const base = {
    calendarId: draft.calendarId,
    title: draft.title,
    allDay: draft.allDay,
    location: draft.location || null,
    description: draft.description || null,
  };
  if (draft.allDay)
    return { ...base, start: draft.startDate, end: dateKey(addDays(new Date(`${draft.endDate}T00:00:00`), 1)) };
  return {
    ...base,
    start: new Date(`${draft.startDate}T${draft.startTime}`).toISOString(),
    end: new Date(`${draft.endDate}T${draft.endTime}`).toISOString(),
  };
}

export function EventEditor({
  event,
  calendars,
  day,
  onSave,
  onDelete,
  onClose,
}: {
  /** null なら新しい予定 */
  event: CalendarEvent | null;
  calendars: CalendarInfo[];
  /** 新しい予定の日 */
  day: Date;
  onSave: (input: EventInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const [draft, setDraft] = useState(() => draftOf(event, calendars, day));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const calendar = calendars.find((c) => c.id === draft.calendarId);
  const readOnly = event !== null && calendar?.writable === false;
  const writable = calendars.filter((c) => c.writable || c.id === draft.calendarId);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => onSave(inputOf(draft)));
  };

  return (
    <form className="calendar-editor" onSubmit={submit}>
      <SectionTitle>{event ? (readOnly ? t("viewTitle") : t("editTitle")) : t("addTitle")}</SectionTitle>
      <Group>
        <fieldset className="calendar-editor__fields" disabled={busy || readOnly}>
          <Field label={t("name")}>
            <input value={draft.title} maxLength={200} autoFocus={!event} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={t("calendar")} hint={event ? t("calendarHint") : undefined}>
            <select value={draft.calendarId} onChange={(e) => set({ calendarId: e.target.value })}>
              {writable.map((c) => (
                <option key={c.id} value={c.id}>
                  {t("calendarOption", { name: c.name, source: c.source })}
                </option>
              ))}
            </select>
          </Field>
          <Check checked={draft.allDay} onChange={(allDay) => set({ allDay })}>
            {t("allDay")}
          </Check>
          <div className="calendar-editor__when">
            <Field label={t("start")}>
              <input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: e.target.value > draft.endDate ? e.target.value : draft.endDate })} />
            </Field>
            {!draft.allDay && (
              <Field label={t("time")}>
                <input type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />
              </Field>
            )}
            <Field label={draft.allDay ? t("endAllDay") : t("end")}>
              <input type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} />
            </Field>
            {!draft.allDay && (
              <Field label={t("time")}>
                <input type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} />
              </Field>
            )}
          </div>
          <Field label={t("location")}>
            <input value={draft.location} maxLength={500} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label={t("notes")}>
            <textarea rows={3} value={draft.description} maxLength={5000} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          {event?.recurring && <Message>{t("recurring")}</Message>}
        </fieldset>
        {error && <Message tone="error">{error}</Message>}
        <ButtonRow>
          {!readOnly && (
            <Button variant="primary" type="submit" disabled={busy || !draft.title.trim() || !draft.calendarId}>
              {busy ? t("saving") : tc("save")}
            </Button>
          )}
          <Button onClick={onClose}>{readOnly ? tc("close") : tc("cancel")}</Button>
          {event && !readOnly && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => (deleting ? void run(onDelete) : setDeleting(true))}
            >
              {deleting ? t("confirmDelete") : t("delete")}
            </Button>
          )}
        </ButtonRow>
      </Group>
    </form>
  );
}
