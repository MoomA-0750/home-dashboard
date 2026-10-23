import { defineMessages, textFor, useLocale } from "@home-dashboard/widget-sdk";
import { Icon, type IconName } from "./Icon";
import type { ExtensionScreen } from "../lib/extensions";

const messages = defineMessages({
  ja: { home: "ホーム", chat: "チャット", settings: "設定", mainMenu: "メインメニュー", sidebarWidth: "サイドバーの幅" },
  en: { home: "Home", chat: "Chat", settings: "Settings", mainMenu: "Main menu", sidebarWidth: "Sidebar width" },
});

/** "home"・"chat"・"settings" と、拡張機能の画面（「拡張機能の id:画面の id」） */
export type ScreenId = string;

interface NavItem {
  id: ScreenId;
  label: string;
  ariaLabel: string;
  icon: IconName | { src: string };
}

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
  const items: NavItem[] = [
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
    <nav className="sidebar" aria-label={t("mainMenu")}>
      {items.map((item) => {
        const active = item.id === "chat" ? chatOpen : item.id === activeScreen;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-button${active ? " nav-button--active" : ""}`}
            aria-label={item.ariaLabel}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            {typeof item.icon === "string" ? <Icon name={item.icon} /> : <Icon src={item.icon.src} />}
            <span className="nav-button__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const SIDEBAR_MIN_WIDTH = 80;
export const SIDEBAR_MAX_WIDTH = 240;
/** この幅を超えたらアイコンの横にラベルを出す */
export const SIDEBAR_LABEL_THRESHOLD = 96;

interface SidebarHandleProps {
  width: number;
  onResize: (width: number) => void;
}

export function SidebarHandle({ width, onResize }: SidebarHandleProps) {
  const t = messages.useT();
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;

    target.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing");

    const onMove = (moveEvent: PointerEvent) => onResize(startWidth + moveEvent.clientX - startX);
    const onUp = () => {
      target.releasePointerCapture(event.pointerId);
      document.body.classList.remove("is-resizing");
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") return onResize(SIDEBAR_MIN_WIDTH);
    if (event.key === "End") return onResize(SIDEBAR_MAX_WIDTH);
    onResize(width + (event.key === "ArrowRight" ? 10 : -10));
  };

  return (
    <div
      className="sidebar-handle"
      role="separator"
      aria-label={t("sidebarWidth")}
      aria-orientation="vertical"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <span className="sidebar-handle__grip" aria-hidden="true" />
    </div>
  );
}
