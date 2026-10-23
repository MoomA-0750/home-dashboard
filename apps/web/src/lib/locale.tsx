import { useEffect, useState, type ReactNode } from "react";
import {
  DisplayContext,
  LocaleContext,
  normalizeDisplay,
  setCurrentDisplay,
  setCurrentLocale,
  type DisplaySettings,
  type Locale,
} from "@home-dashboard/widget-sdk";

/**
 * 画面の言語（日本語・英語）。設定の「一般」で選び、アカウントに覚える（どの端末でログインしても同じ言語）。
 * ブラウザにも控えを置き、ログインの画面や読み込みの間は、その端末で最後に使った言語で出す。
 * まだ選んでいなければ、ブラウザの言語が日本語なら日本語、それ以外は英語
 */

const STORAGE_KEY = "home-dashboard:locale";
// サーバー（拡張機能の道）がエラーの理由などを同じ言語で返せるよう、Cookie にも書く
const COOKIE = "hd_locale";

function writeCookie(locale: Locale): void {
  document.cookie = `${COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 400}; SameSite=Strict`;
}
const CHANGE_EVENT = "home-dashboard:locale-change";

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ja" || stored === "en") return stored;
  } catch {
    // 読めなければブラウザの言語で決める
  }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/** 言語を変えて、ログインしているアカウントに覚える */
export async function chooseLocale(apiBaseUrl: string, locale: Locale): Promise<void> {
  changeLocale(locale);
  const res = await fetch(`${apiBaseUrl}/api/auth/locale`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!res.ok) throw new Error(`locale ${res.status}`);
}

/** この画面の言語だけを変える（どこから呼んでも、画面全体が描き直る） */
export function changeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 保存できなくても、この表示中は変わる
  }
  window.dispatchEvent(new CustomEvent<Locale>(CHANGE_EVENT, { detail: locale }));
}

// 表示の設定（暦・温度の単位・週の始まり・日付の形・時刻）。言語と同じく、アカウントに覚えて、ブラウザにも控えを置く
const DISPLAY_STORAGE_KEY = "home-dashboard:display";
const DISPLAY_EVENT = "home-dashboard:display-change";

function initialDisplay(): DisplaySettings {
  try {
    return normalizeDisplay(JSON.parse(localStorage.getItem(DISPLAY_STORAGE_KEY) ?? "null"));
  } catch {
    return normalizeDisplay(null);
  }
}

/** この画面の表示の設定だけを変える */
export function changeDisplay(display: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(display));
  } catch {
    // 保存できなくても、この表示中は変わる
  }
  window.dispatchEvent(new CustomEvent<DisplaySettings>(DISPLAY_EVENT, { detail: display }));
}

/** 表示の設定の一部を変えて、ログインしているアカウントに覚える */
export async function chooseDisplay(apiBaseUrl: string, patch: Partial<DisplaySettings>): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/auth/display`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`display ${res.status}`);
  changeDisplay(normalizeDisplay((await res.json()).display));
}

/** 画面全体（ログインの画面も）を包んで、選んだ言語と表示の設定を本体と拡張機能に渡す */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [display, setDisplay] = useState<DisplaySettings>(() => {
    const value = initialDisplay();
    setCurrentDisplay(value);
    return value;
  });

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<DisplaySettings>).detail;
      setCurrentDisplay(next);
      setDisplay(next);
    };
    window.addEventListener(DISPLAY_EVENT, onChange);
    return () => window.removeEventListener(DISPLAY_EVENT, onChange);
  }, []);

  const [locale, setLocale] = useState<Locale>(() => {
    const value = initialLocale();
    setCurrentLocale(value);
    writeCookie(value);
    return value;
  });

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Locale>).detail;
      setCurrentLocale(next);
      writeCookie(next);
      setLocale(next);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={locale}>
      <DisplayContext.Provider value={display}>{children}</DisplayContext.Provider>
    </LocaleContext.Provider>
  );
}
