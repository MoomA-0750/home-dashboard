import { Icon, type IconName } from "./Icon";

export type ScreenId = "home" | "media" | "home-control" | "toolbox" | "settings";

interface NavItem {
  id: ScreenId;
  label: string;
  ariaLabel: string;
  icon: IconName;
}

/** 設計図のサイドバー5項目。Home以外の画面はまだ実装していないので Settings 以外は無効にしてある。 */
const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", ariaLabel: "ホーム", icon: "home" },
  { id: "media", label: "Media", ariaLabel: "メディア", icon: "play" },
  { id: "home-control", label: "Home Control", ariaLabel: "ホームコントロール", icon: "lightbulb" },
  { id: "toolbox", label: "Toolbox", ariaLabel: "ツールボックス", icon: "toolbox" },
  { id: "settings", label: "Settings", ariaLabel: "設定", icon: "settings" },
];

const IMPLEMENTED: ScreenId[] = ["home", "settings"];

interface SidebarProps {
  activeScreen: ScreenId;
  settingsOpen: boolean;
  onSelect: (screen: ScreenId) => void;
}

export function Sidebar({ activeScreen, settingsOpen, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="メインメニュー">
      {NAV_ITEMS.map((item) => {
        const active = item.id === "settings" ? settingsOpen : item.id === activeScreen;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-button${active ? " nav-button--active" : ""}`}
            aria-label={item.ariaLabel}
            aria-current={active && item.id !== "settings" ? "page" : undefined}
            disabled={!IMPLEMENTED.includes(item.id)}
            title={IMPLEMENTED.includes(item.id) ? undefined : `${item.label}（未実装）`}
            onClick={() => onSelect(item.id)}
          >
            <Icon name={item.icon} />
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
      aria-label="サイドバーの幅"
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
