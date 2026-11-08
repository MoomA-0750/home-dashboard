import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { defineMessages } from "./i18n";
import { ScreenFrame } from "./ScreenFrame";
import { BackButton, List, ListItem } from "./ui";

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
    <nav
      className="sidebar-rail layer-base flex min-w-0 flex-col phone:tabbar phone:layer-tabbar"
      aria-label={label ?? t("mainMenu")}
    >
      {items.map((item) => {
        const on = typeof active === "function" ? active(item.id) : item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            className={cx(
              "nav-item press flex w-full cursor-pointer items-center overflow-hidden border-0 text-left whitespace-nowrap text-text",
              "enabled:hover:fill-bright enabled:hover:text-on-fill enabled:hover:nav-lift disabled:cursor-default disabled:opacity-40 phone:tabbar-item",
              // 塗りの上の字の色も替える（text-text が CSS の並びで fill-bright の色に勝ち、明るい地に白いアイコンになっていた）
              on && "fill-bright text-on-fill nav-lift",
            )}
            aria-label={item.ariaLabel ?? item.label}
            aria-current={on ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            {typeof item.icon === "string" ? <Icon name={item.icon} /> : <Icon src={item.icon.src} />}
            {/* サイドバーを広げたときだけラベルを出す（80px のときはアイコンだけ） */}
            <span className="change -translate-x-2 opacity-0 in-data-expanded:translate-x-0 in-data-expanded:opacity-100 phone:hidden">
              {item.label}
            </span>
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
    document.body.dataset.resizing = "";

    const onMove = (moveEvent: globalThis.PointerEvent) => onResize(startWidth + moveEvent.clientX - startX);
    const onUp = () => {
      target.releasePointerCapture(event.pointerId);
      delete document.body.dataset.resizing;
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
      className={cx(
        "layer-handle relative flex cursor-col-resize touch-none items-center justify-center bg-transparent p-0 outline-0 phone:hidden",
        "*:change *:bg-tint/60 hover:*:bg-tint hover:*:ring-4 hover:*:ring-accent-soft/20 focus-visible:*:bg-tint focus-visible:*:ring-4 focus-visible:*:ring-accent-soft/20",
      )}
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
      <span className="grip-bar" aria-hidden="true" />
    </div>
  );
}

export function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

/**
 * 画面全体の枠。サイドバーと幅のつまみを置き、幅は storageKey の名前で端末に覚える。
 * children に、選んだ画面（ScreenFrame など）を入れる（サイドバー・つまみの右の列に入る。スマホではサイドバーが下のタブバーになる）。
 * 壁紙・壁紙を暗くする幕・夜の表示は、data-shell を目印に styles/base.css が付ける
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
      data-shell=""
      data-expanded={width > SIDEBAR_LABEL_THRESHOLD || undefined}
      className="shell-grid grid h-svh grid-rows-1 overflow-hidden phone:grid-cols-1 phone:pb-tabbar"
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
 * 中身の上の「戻る」で一覧に戻る。children に、選んだ項目の中身を入れる。
 * 画面の枠は ScreenFrame（fill: 画面は送らず、左の一覧と右の中身がそれぞれ送る）、項目は List と ListItem
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
    <ScreenFrame title={title} fill>
      <div className="flex min-h-0 flex-1 gap-7">
        {/* 左: 大きな項目の一覧（macOS の設定のように、選ぶと右に中身が出る） */}
        <nav
          className={cx("min-h-0 w-side-nav shrink-0 overflow-y-auto pr-1 tablet:w-full", pageOpen && "tablet:hidden")}
          aria-label={navLabel}
        >
          <List nav>
            {items.map((item) => (
              <ListItem
                key={item.id}
                title={item.label}
                icon={item.icon}
                selected={item.id === page}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </List>
        </nav>

        {/* 右: 選んだ項目の中身。狭い画面では一覧と入れ替わり、見出しの名前の「戻る」で一覧に戻る。
            文字の影が送りの枠で切れないよう、影の広がる分だけ内側に余白を取り、外側を同じだけ詰める（halo-room）。入力欄は fields でそろえる */}
        <div
          className={cx(
            "halo-room fields min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain *:animate-enter",
            !pageOpen && "tablet:hidden",
          )}
        >
          <div className="hidden tablet:block">
            <BackButton label={title} onClick={onBack} />
          </div>
          <h3 className="mt-1 mb-4 text-heading font-semibold">{items.find((item) => item.id === page)?.label}</h3>
          {children}
        </div>
      </div>
    </ScreenFrame>
  );
}
