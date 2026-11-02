import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { buttonClass } from "./ui";
import { defineMessages } from "./i18n";
import { usePresence } from "./motion";

const messages = defineMessages({
  ja: { empty: "ありません" },
  en: { empty: "Nothing here" },
});

export interface PillMenuItem {
  id: string;
  label: string;
  detail?: string;
  selected?: boolean;
  disabled?: boolean;
}

/**
 * 画面の右上に置くピル型のボタン。押すと選べるものの一覧が下に開く（Media の音楽アプリ・鳴らす端末、Home Control の部屋）
 */
export function PillMenu({
  label,
  icon,
  ariaLabel,
  items,
  onSelect,
  onOpen,
  empty,
}: {
  label: string;
  icon: IconName;
  ariaLabel: string;
  items: PillMenuItem[];
  onSelect: (id: string) => void;
  onOpen?: () => void;
  empty?: string;
}) {
  const t = messages.useT();
  const [open, setOpen] = useState(false);
  // 閉じるときも、上へ縮みながら薄くなってから消す
  const menu = usePresence(open, "fast");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cx(
          buttonClass(),
          "tap-lg max-w-64 pr-3.5 text-small font-normal hover:bg-tint/16 aria-expanded:bg-tint/16",
        )}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        <Icon name={icon} />
        <span className="ellipsis">{label}</span>
        <Icon name="chevron-down" className="change opacity-75 in-aria-expanded:rotate-180" />
      </button>
      {menu.shown && (
        <ul
          className={cx(
            "raised layer-popover absolute top-full right-0 mt-1.5 max-h-menu min-w-56 list-none overflow-y-auto rounded-inner p-1.5 text-shadow-none",
            // 上から落ちてくるように出し、閉じるときは上へ縮みながら薄くなる
            "origin-top-right animate-drop closing:pointer-events-none closing:animate-drop-out",
            menu.closing && "is-closing",
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
          {items.length === 0 && <li className="px-3 py-2.5 text-caption text-muted">{empty ?? t("empty")}</li>}
          {items.map((item) => (
            <li key={item.id} role="option" aria-selected={item.selected ?? false}>
              <button
                type="button"
                className={cx(
                  "press-wide flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-nested px-3 py-2 text-left",
                  "disabled:cursor-default disabled:opacity-45",
                  item.selected ? "fill-bright text-on-fill" : "text-text enabled:hover:bg-tint/10",
                )}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  if (!item.selected) onSelect(item.id);
                }}
              >
                {/* 名前と補足を2行で並べるので、文字の上下は詰めない（詰めると2行が重なる） */}
                <span className="leading-tight untrim">{item.label}</span>
                {item.detail && (
                  <span className={cx("text-caption leading-tight untrim", item.selected ? "text-on-fill/70" : "text-muted")}>
                    {item.detail}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
