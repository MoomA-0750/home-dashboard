import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { defineMessages } from "./i18n";

const messages = defineMessages({
  ja: { mainMenu: "メインメニュー", sidebarWidth: "サイドバーの幅" },
  en: { mainMenu: "Main menu", sidebarWidth: "Sidebar width" },
});

/** サイドバーの項目 */
export interface SidebarItem {
  id: string;
  label: string;
  ariaLabel?: string;
  icon: IconName | { src: string };
}

/** 画面の左（狭い画面では下）に並ぶ、画面を切り替える項目 */
export function Sidebar({
  items,
  active,
  onSelect,
  label,
}: {
  items: SidebarItem[];
  /** 選ばれている項目の id（複数の項目を同時に選んだ見た目にするときは関数で渡す） */
  active: string | ((id: string) => boolean);
  onSelect: (id: string) => void;
  /** サイドバー全体の読み上げの名前（既定は「メインメニュー」） */
  label?: string;
}) {
  const t = messages.useT();
  return (
    <nav className="sidebar" aria-label={label ?? t("mainMenu")}>
      {items.map((item) => {
        const on = typeof active === "function" ? active(item.id) : item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-button${on ? " nav-button--active" : ""}`}
            aria-label={item.ariaLabel ?? item.label}
            aria-current={on ? "page" : undefined}
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

/** サイドバーの右端の、幅を変えるつまみ */
export function SidebarHandle({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const t = messages.useT();
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const startX = event.clientX;
    const startWidth = width;

    target.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing");

    const onMove = (moveEvent: globalThis.PointerEvent) => onResize(startWidth + moveEvent.clientX - startX);
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

/**
 * 画面全体の枠（.app-shell）。サイドバーと幅のつまみを置き、幅は storageKey の名前で端末に覚える。
 * children に、選んだ画面（ScreenFrame など）を入れる
 */
export function AppShell({
  items,
  active,
  onSelect,
  storageKey,
  children,
}: {
  items: SidebarItem[];
  active: string | ((id: string) => boolean);
  onSelect: (id: string) => void;
  storageKey: string;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : SIDEBAR_MIN_WIDTH;
    } catch {
      return SIDEBAR_MIN_WIDTH;
    }
  });
  const resize = (next: number) => {
    const clamped = clampSidebarWidth(next);
    setWidth(clamped);
    try {
      localStorage.setItem(storageKey, String(clamped));
    } catch {
      // 覚えられなくても、今の幅で使える
    }
  };
  return (
    <div
      className={`app-shell${width > SIDEBAR_LABEL_THRESHOLD ? " app-shell--sidebar-expanded" : ""}`}
      style={{ "--sidebar-width": `${width}px` } as CSSProperties}
    >
      <Sidebar items={items} active={active} onSelect={onSelect} />
      <SidebarHandle width={width} onResize={resize} />
      {children}
    </div>
  );
}

/** 設定の項目 */
export interface SettingsNavItem {
  id: string;
  label: string;
  icon: IconName;
}

/**
 * 設定画面の形（macOS の設定のように、左に大きな項目の一覧、選ぶと右に中身）。狭い画面では一覧と中身が入れ替わり、
 * 中身の上の「戻る」で一覧に戻る。children に、選んだ項目の中身を入れる
 */
export function SettingsLayout({
  title,
  navLabel,
  items,
  page,
  pageOpen,
  onSelect,
  onBack,
  children,
}: {
  /** 画面の見出し（狭い画面の「戻る」にも出す） */
  title: string;
  /** 項目の一覧の読み上げの名前 */
  navLabel: string;
  items: SettingsNavItem[];
  page: string;
  /** 狭い画面で、中身を出しているか */
  pageOpen: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="screen settings-screen" aria-label={title}>
      <div className="screen__inner settings-screen__inner">
        <header className="screen__header">
          <h1>{title}</h1>
        </header>

        <div className={`settings-panel__columns${pageOpen ? " settings-panel__columns--page-open" : ""}`}>
          {/* 左: 大きな項目の一覧（macOS の設定のように、選ぶと右に中身が出る） */}
          <nav className="settings-nav" aria-label={navLabel}>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`settings-nav__item${item.id === page ? " settings-nav__item--on" : ""}`}
                    aria-current={item.id === page ? "page" : undefined}
                    onClick={() => onSelect(item.id)}
                  >
                    <span className="settings-nav__icon">
                      <Icon name={item.icon} />
                    </span>
                    <span className="settings-nav__label">{item.label}</span>
                    <Icon name="chevron-right" className="settings-nav__chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* 右: 選んだ項目の中身。狭い画面では一覧と入れ替わり、見出しの名前の「戻る」で一覧に戻る */}
          <div className="settings-detail">
            <button type="button" className="settings-detail__back settings-detail__back--page" onClick={onBack}>
              <Icon name="chevron-left" />
              <span>{title}</span>
            </button>
            <h3 className="settings-detail__title">{items.find((item) => item.id === page)?.label}</h3>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
