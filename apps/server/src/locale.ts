/** 画面の言語。画面が言語を選ぶと Cookie（hd_locale）に書く（apps/web の lib/locale.tsx） */
export function requestLocale(cookie: string | undefined): "ja" | "en" {
  return /(?:^|;\s*)hd_locale=en(?:;|$)/.test(cookie ?? "") ? "en" : "ja";
}
