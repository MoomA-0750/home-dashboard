import { useEffect } from "react";

/**
 * 設定画面のページを開く（ウィジェット・画面・設定のページから）。
 * 「ログインの設定がまだなので押すと設定へ」のように、足りない設定の場所へ案内するときに使う。
 * page は設定の項目の id（general・account・extensions・voice・connectors・拡張機能が足したページの「拡張機能の id:ページの id」）、
 * extension を渡すと「拡張機能」の中のその拡張機能の詳細を開く
 */
export interface SettingsLink {
  page: string;
  extension?: string;
}

const EVENT = "home-dashboard:open-settings";

export function openSettings(link: SettingsLink): void {
  window.dispatchEvent(new CustomEvent<SettingsLink>(EVENT, { detail: link }));
}

/** 本体が受け取る（設定画面を出して、そのページを開く） */
export function useSettingsLinks(listener: (link: SettingsLink) => void): void {
  useEffect(() => {
    const onOpen = (event: Event) => listener((event as CustomEvent<SettingsLink>).detail);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [listener]);
}
