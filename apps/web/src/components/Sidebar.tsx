import { defineMessages, textFor, useLocale } from "@home-dashboard/widget-sdk";
import type { SidebarItem } from "@home-dashboard/ui/shell";
import type { ExtensionScreen } from "../lib/extensions";

const messages = defineMessages({
  ja: { home: "ホーム", chat: "チャット", settings: "設定" },
  en: { home: "Home", chat: "Chat", settings: "Settings" },
});

/** "home"・"chat"・"settings" と、拡張機能の画面（「拡張機能の id:画面の id」） */
export type ScreenId = string;

/**
 * サイドバーの項目（AppShell に渡す）。ホームの下に拡張機能の画面（Media・Home Control など。切った拡張機能のものは出ない）を並べ、
 * チャット（入っているときだけ）と設定を最後に置く
 */
export function useSidebarItems(screens: ExtensionScreen[], chatEnabled: boolean): SidebarItem[] {
  const locale = useLocale();
  const t = messages.useT();
  return [
    { id: "home", label: t("home"), icon: "home" },
    ...screens.map((screen) => ({
      id: screen.key,
      label: textFor(screen.label, locale),
      ariaLabel: textFor(screen.ariaLabel ?? screen.label, locale),
      icon: screen.icon,
    })),
    ...(chatEnabled ? [{ id: "chat", label: t("chat"), icon: "chat" as const }] : []),
    { id: "settings", label: t("settings"), icon: "settings" },
  ];
}
