/**
 * タイムゾーンの扱い（サーバーは UTC で動くことがあるので、音声アシスタントへは決めたタイムゾーンで伝える）。
 * 画面（ブラウザ）は端末のタイムゾーンをそのまま使う
 */

/** その時刻での、タイムゾーンの UTC からのずれ（「+09:00」） */
function offsetOf(timeZone: string, at: Date): string {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-]\d{2}):?(\d{2})?/.exec(name);
  return match ? `${match[1]}:${match[2] ?? "00"}` : "+00:00";
}

/** そのタイムゾーンでの日付（YYYY-MM-DD） */
export function localDate(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return parts; // en-CA は YYYY-MM-DD
}

/** 今日から offsetDays 日後の 0 時から、days 日分（そのタイムゾーンで） */
export function dayRange(timeZone: string, offsetDays: number, days: number, now = new Date()): { from: string; to: string } {
  const today = localDate(timeZone, now);
  const at = (shift: number) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + shift);
    const day = date.toISOString().slice(0, 10);
    return new Date(`${day}T00:00:00${offsetOf(timeZone, new Date(`${day}T12:00:00Z`))}`).toISOString();
  };
  return { from: at(offsetDays), to: at(offsetDays + days) };
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 「10/21(水) 9:00〜10:00」「10/21(水) 終日」のような言い方 */
export function describeEvent(event: { start: string; end: string; allDay: boolean }, timeZone: string): string {
  if (event.allDay) {
    const start = new Date(`${event.start}T00:00:00Z`);
    const end = new Date(`${event.end}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    const day = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
    return start.getTime() >= end.getTime() ? `${day(start)} 終日` : `${day(start)}〜${day(end)} 終日`;
  }
  const format = (iso: string, withDay: boolean) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(iso))
        .map((p) => [p.type, p.value]),
    );
    const weekday = WEEKDAYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)];
    const time = `${Number(parts.hour)}:${parts.minute}`;
    return withDay ? `${parts.month}/${parts.day}(${weekday}) ${time}` : time;
  };
  const sameDay = localDate(timeZone, new Date(event.start)) === localDate(timeZone, new Date(event.end));
  return `${format(event.start, true)}〜${format(event.end, !sameDay)}`;
}
