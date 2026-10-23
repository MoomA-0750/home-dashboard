import { createContext, useContext } from "react";
import { DisplayContext, formatDate, formatTime, getDisplay } from "./display";

/**
 * 画面の言語（日本語・英語）。本体が設定（設定の「一般」）で選んだ言語を LocaleContext で渡し、
 * 本体と拡張機能は defineMessages で作った辞書から、その言語の文言を引く。
 *
 *   const messages = defineMessages({
 *     ja: { title: "天気", updated: "{time}に更新" },
 *     en: { title: "Weather", updated: "Updated at {time}" },
 *   });
 *   function Screen() {
 *     const t = messages.useT();
 *     return <h1>{t("title")}</h1>;
 *   }
 *
 * 英語の辞書は日本語の辞書と同じ鍵をすべて持つ（型で確かめる）。数で言い方が変わる英語は、文言の代わりに関数を書ける
 * （`items: (p) => (p.n === 1 ? "1 item" : `${p.n} items`)`）。
 */

export type Locale = "ja" | "en";

/** 選べる言語（設定に並べる順） */
export const LOCALES: { id: Locale; label: string }[] = [
  { id: "ja", label: "日本語" },
  { id: "en", label: "English" },
];

export const LocaleContext = createContext<Locale>("ja");

// React の外（fetch のエラーの文など）から今の言語を読むための控え。本体が言語を決めるたびに書き換える
let current: Locale = "ja";

/** 本体が使う。今の言語を React の外にも知らせる */
export function setCurrentLocale(locale: Locale): void {
  current = locale;
}

/** 今の言語（画面の中では useLocale を使う） */
export function getLocale(): Locale {
  return current;
}

export function useLocale(): Locale {
  // 日付・時刻は言語と表示の設定（display.ts）の両方で決まるので、言語を見ている部品は表示の設定が変わっても描き直す
  useContext(DisplayContext);
  return useContext(LocaleContext);
}

export type MessageParams = Record<string, string | number>;
export type MessageValue = string | ((params: MessageParams) => string);
export type Translate<K extends string> = (key: K, params?: MessageParams) => string;

function render(value: MessageValue, params?: MessageParams): string {
  if (typeof value === "function") return value(params ?? {});
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** 日本語と英語の辞書から、言語ごとの文言を引く関数を作る */
export function defineMessages<const J extends Record<string, MessageValue>>(dicts: {
  ja: J;
  en: { [K in keyof J]: MessageValue };
}) {
  type Key = keyof J & string;
  const translate =
    (locale: Locale): Translate<Key> =>
    (key, params) =>
      render((dicts[locale] as Record<string, MessageValue>)[key] ?? dicts.ja[key], params);
  return {
    /** 画面の中で。言語が変わると描き直す */
    useT: (): Translate<Key> => translate(useLocale()),
    /** React の外で。言語を省くと今の言語 */
    t: (key: Key, params?: MessageParams, locale: Locale = current) => translate(locale)(key, params),
  };
}

/** Intl に渡す言語の名前 */
export function intlLocale(locale: Locale = current): string {
  return locale === "ja" ? "ja-JP" : "en-US";
}

const dayWords = defineMessages({
  ja: { yesterday: "昨日", daysAgo: "{n}日前" },
  en: { yesterday: "Yesterday", daysAgo: (p) => `${p.n} days ago` },
});

/** 時刻（設定の「時刻」に合わせて 14:05 / 2:05 PM。display.ts の formatTime と同じ） */
export function formatClock(date: Date, locale: Locale = current): string {
  return formatTime(date, locale, getDisplay());
}

/** 今日でない日の言い方。昨日・6日前までは「N日前」、それより前は日付（去年より前は年も）。今日なら null */
export function formatPastDay(date: Date, locale: Locale = current, now = new Date()): string | null {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return null;
  if (days === 1) return dayWords.t("yesterday", undefined, locale);
  if (days < 7) return dayWords.t("daysAgo", { n: days }, locale);
  const sameYear = date.getFullYear() === now.getFullYear();
  return formatDate(date, sameYear ? "monthDay" : "full", locale, getDisplay());
}

/** 言語ごとの文（画面の名前・ウィジェットの名前など、拡張機能が本体に渡す文）。文字だけなら、どの言語でもそのまま出す */
export type LocalizedText = string | { ja: string; en: string };

/** LocalizedText を、その言語の文にする */
export function textFor(value: LocalizedText, locale?: Locale): string;
export function textFor(value: LocalizedText | undefined, locale?: Locale): string | undefined;
export function textFor(value: LocalizedText | undefined, locale: Locale = current): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  return value[locale] ?? value.ja;
}
