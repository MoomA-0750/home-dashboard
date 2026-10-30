import { defineMessages, textFor, useLocale } from "@home-dashboard/widget-sdk";
import { Sidebar as SidebarNav, type SidebarItem } from "@home-dashboard/ui/shell";
import type { ExtensionScreen } from "../lib/extensions";

const messages = defineMessages({
  ja: { home: "ホーム", chat: "チャット", settings: "設定", mainMenu: "メインメニュー" },
  en: { home: "Home", chat: "Chat", settings: "Settings", mainMenu: "Main menu" },
});

/** "home"・"chat"・"settings" と、拡張機能の画面（「拡張機能の id:画面の id」） */
export type ScreenId = string;

interface SidebarProps {
  activeScreen: ScreenId;
  /** 拡張機能の画面（Media・Home Control など）。切った拡張機能のものは出ない */
  screens: ExtensionScreen[];
  chatEnabled: boolean;
  chatOpen: boolean;
  onSelect: (screen: ScreenId) => void;
}

/** サイドバーの項目。ホームの下に拡張機能の画面を並べ、チャット（設定で選んだときだけ）と設定を最後に置く */
export function Sidebar({ activeScreen, screens, chatEnabled, chatOpen, onSelect }: SidebarProps) {
  const locale = useLocale();
  const t = messages.useT();
  const items: SidebarItem[] = [
    { id: "home", label: t("home"), ariaLabel: t("home"), icon: "home" },
    ...screens.map((screen) => ({
      id: screen.key,
      label: textFor(screen.label, locale),
      ariaLabel: textFor(screen.ariaLabel ?? screen.label, locale),
      icon: screen.icon,
    })),
    ...(chatEnabled ? [{ id: "chat", label: t("chat"), ariaLabel: t("chat"), icon: "chat" as const }] : []),
    { id: "settings", label: t("settings"), ariaLabel: t("settings"), icon: "settings" },
  ];
  return (
    <SidebarNav items={items} active={(id) => (id === "chat" ? chatOpen : id === activeScreen)} onSelect={onSelect} label={t("mainMenu")} />
  );
}


export { SIDEBAR_LABEL_THRESHOLD, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, SidebarHandle } from "@home-dashboard/ui/shell";
