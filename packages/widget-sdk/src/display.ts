import { createContext, useContext } from "react";
import { getLocale, useLocale, type Locale } from "./i18n";

/**
 * 表示の設定（設定の「一般」で選び、アカウントに覚える）。言語（i18n.ts）と合わせて、日付・時刻・温度の出し方を決める。
 * 本体が DisplayContext で渡し、本体と拡張機能はここの関数で日付・時刻・温度を出す（自分で toLocaleDateString しない）。
 *
 *   const date = useDateFormat();
 *   date(new Date(), "monthDayWeekday")  // 10月21日(水) / Wed Oct 21 / 2026/10/21 の形に合わせて 10/21 (水)
 *   const temp = useTemperature();
 *   temp(21.4)                           // 21° / 71°（設定の単位で。単位も付けるなら temp(21.4, { unit: true })）
 */

export interface DisplaySettings {
  /** 暦。japanese は和暦（令和8年） */
  calendar: "gregorian" | "japanese";
  temperatureUnit: "c" | "f";
  /** 週の始まり。0 は日曜、1 は月曜 */
  weekStart: 0 | 1;
  /** 日付の形。auto は言語に合わせる（10月21日 / Oct 21）。ほかは数字で並べる順 */
  dateFormat: "auto" | "ymd" | "mdy" | "dmy";
  /** 時刻。24 は 14:05、12 は 2:05 PM（日本語は 午後2:05） */
  clock: "24" | "12";
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  calendar: "gregorian",
  temperatureUnit: "c",
  weekStart: 0,
  dateFormat: "auto",
  clock: "24",
};

/** 届いた値（保存したもの・サーバーから来たもの）を確かめて、足りない所を既定で埋める */
export function normalizeDisplay(value: unknown): DisplaySettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof DisplaySettings, unknown>>;
  return {
    calendar: v.calendar === "japanese" ? "japanese" : "gregorian",
    temperatureUnit: v.temperatureUnit === "f" ? "f" : "c",
    weekStart: v.weekStart === 1 ? 1 : 0,
    dateFormat: v.dateFormat === "ymd" || v.dateFormat === "mdy" || v.dateFormat === "dmy" ? v.dateFormat : "auto",
    clock: v.clock === "12" ? "12" : "24",
  };
}

export const DisplayContext = createContext<DisplaySettings>(DEFAULT_DISPLAY);

// React の外から読むための控え（言語の getLocale と同じ）
let current: DisplaySettings = DEFAULT_DISPLAY;

/** 本体が使う。今の表示の設定を React の外にも知らせる */
export function setCurrentDisplay(display: DisplaySettings): void {
  current = display;
}

export function getDisplay(): DisplaySettings {
  return current;
}

export function useDisplay(): DisplaySettings {
  return useContext(DisplayContext);
}

const WEEKDAYS: Record<Locale, string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

/**
 * 日付の出し方
 * - monthDay: 10月21日 / Oct 21
 * - monthDayWeekday: 10月21日(水) / Wed Oct 21
 * - weekday: 水 / Wed
 * - full: 2026年10月21日（和暦なら 令和8年10月21日） / Oct 21, 2026
 * - fullWeekday: full に曜日を付けたもの
 * - monthYear: 2026年10月 / October 2026
 */
export type DateStyle = "monthDay" | "monthDayWeekday" | "weekday" | "full" | "fullWeekday" | "monthYear";

function intlTag(locale: Locale, display: DisplaySettings): string {
  const base = locale === "ja" ? "ja-JP" : "en-US";
  return display.calendar === "japanese" ? `${base}-u-ca-japanese` : base;
}

/** 年の数字（和暦なら「令和8」・「R8」の形の年号つき） */
function yearText(date: Date, locale: Locale, display: DisplaySettings, numeric: boolean): string {
  if (display.calendar !== "japanese") return String(date.getFullYear());
  const parts = new Intl.DateTimeFormat(intlTag("ja", display), { era: numeric ? "narrow" : "long", year: "numeric" })
    .formatToParts(date)
    .filter((p) => p.type === "era" || p.type === "year")
    .map((p) => p.value);
  // ja-JP-u-ca-japanese の year は「8」、era は「令和」か「R」
  return locale === "en" && !numeric ? parts.join(" ") : parts.join("");
}

export function formatDate(
  date: Date,
  style: DateStyle = "monthDay",
  locale: Locale = getLocale(),
  display: DisplaySettings = current,
): string {
  const weekday = WEEKDAYS[locale][date.getDay()];
  if (style === "weekday") return weekday;
  const m = date.getMonth() + 1;
  const d = date.getDate();

  if (display.dateFormat !== "auto") {
    const md = display.dateFormat === "dmy" ? `${d}/${m}` : `${m}/${d}`;
    const withWeekday = (text: string) => (locale === "ja" ? `${text}(${weekday})` : `${weekday} ${text}`);
    const year = yearText(date, locale, display, true);
    const full = display.dateFormat === "ymd" ? `${year}/${m}/${d}` : display.dateFormat === "mdy" ? `${m}/${d}/${year}` : `${d}/${m}/${year}`;
    switch (style) {
      case "monthDay":
        return md;
      case "monthDayWeekday":
        return withWeekday(md);
      case "full":
        return full;
      case "fullWeekday":
        return withWeekday(full);
      case "monthYear":
        return display.dateFormat === "ymd" ? `${year}/${m}` : `${m}/${year}`;
    }
  }

  if (locale === "ja") {
    const year = `${yearText(date, locale, display, false)}年`;
    switch (style) {
      case "monthDay":
        return `${m}月${d}日`;
      case "monthDayWeekday":
        return `${m}月${d}日(${weekday})`;
      case "full":
        return `${year}${m}月${d}日`;
      case "fullWeekday":
        return `${year}${m}月${d}日(${weekday})`;
      case "monthYear":
        return `${year}${m}月`;
    }
  }
  const tag = intlTag(locale, display);
  switch (style) {
    case "monthDay":
      return date.toLocaleDateString(tag, { month: "short", day: "numeric" });
    case "monthDayWeekday":
      // ホームの大きな日付の形（"Wed Oct 21"。カンマを入れない）
      return `${weekday} ${date.toLocaleDateString(tag, { month: "short", day: "numeric" })}`;
    case "full":
      return date.toLocaleDateString(tag, { year: "numeric", month: "short", day: "numeric" });
    case "fullWeekday":
      return date.toLocaleDateString(tag, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
    case "monthYear":
      return date.toLocaleDateString(tag, { year: "numeric", month: "long" });
  }
}

/** 時刻（14:05 / 2:05 PM / 午後2:05） */
export function formatTime(date: Date, locale: Locale = getLocale(), display: DisplaySettings = current): string {
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (display.clock === "24") return `${date.getHours()}:${minutes}`;
  const hour = date.getHours() % 12 || 12;
  const pm = date.getHours() >= 12;
  return locale === "ja" ? `${pm ? "午後" : "午前"}${hour}:${minutes}` : `${hour}:${minutes} ${pm ? "PM" : "AM"}`;
}

/** 摂氏を、設定の単位の数にする */
export function convertTemperature(celsius: number, display: DisplaySettings = current): number {
  return display.temperatureUnit === "f" ? (celsius * 9) / 5 + 32 : celsius;
}

export function temperatureUnit(display: DisplaySettings = current): string {
  return display.temperatureUnit === "f" ? "℉" : "℃";
}

/** 温度（21° / 70°。unit を付けると 21℃ / 70℉。digits は小数の桁） */
export function formatTemperature(
  celsius: number,
  options: { unit?: boolean; digits?: number } = {},
  display: DisplaySettings = current,
): string {
  const value = convertTemperature(celsius, display);
  const text = options.digits ? value.toFixed(options.digits) : String(Math.round(value));
  return options.unit ? `${text}${temperatureUnit(display)}` : `${text}°`;
}

/** 週の始まりの日（その日を含む週の、日曜か月曜の0時） */
export function startOfWeek(date: Date, display: DisplaySettings = current): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const back = (start.getDay() - display.weekStart + 7) % 7;
  start.setDate(start.getDate() - back);
  return start;
}

/** 画面の中で使う形（言語・表示の設定が変わると描き直す） */
export function useDateFormat() {
  const locale = useLocale();
  const display = useDisplay();
  return (date: Date, style: DateStyle = "monthDay") => formatDate(date, style, locale, display);
}

export function useTimeFormat() {
  const locale = useLocale();
  const display = useDisplay();
  return (date: Date) => formatTime(date, locale, display);
}

export function useTemperature() {
  const display = useDisplay();
  return (celsius: number, options: { unit?: boolean; digits?: number } = {}) =>
    formatTemperature(celsius, options, display);
}

const CELSIUS = ["°C", "℃"];
const FAHRENHEIT = ["°F", "℉"];

/**
 * 単位つきの読み値（Home Assistant のセンサーなど）を、設定の温度の単位に直す。温度でなければそのまま返す
 *   reading(21.4, "°C") → { value: 70.5, unit: "℉" }（設定が華氏のとき）
 */
export function convertReading(
  value: number,
  unit: string | null | undefined,
  display: DisplaySettings = current,
): { value: number; unit: string | null } {
  if (unit && CELSIUS.includes(unit))
    return display.temperatureUnit === "f" ? { value: (value * 9) / 5 + 32, unit: "℉" } : { value, unit: "℃" };
  if (unit && FAHRENHEIT.includes(unit))
    return display.temperatureUnit === "c" ? { value: ((value - 32) * 5) / 9, unit: "℃" } : { value, unit: "℉" };
  return { value, unit: unit ?? null };
}
