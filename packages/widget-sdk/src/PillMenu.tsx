import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { defineMessages } from "./i18n";

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
    <div className="pill-menu" ref={rootRef}>
      <button
        type="button"
        className={`pill-menu__button${open ? " pill-menu__button--open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        <Icon name={icon} />
        <span className="pill-menu__label">{label}</span>
        <Icon name="chevron-down" className="pill-menu__chevron" />
      </button>
      {open && (
        <ul className="pill-menu__menu" role="listbox" aria-label={ariaLabel}>
          {items.length === 0 && <li className="pill-menu__empty">{empty ?? t("empty")}</li>}
          {items.map((item) => (
            <li key={item.id} role="option" aria-selected={item.selected ?? false}>
              <button
                type="button"
                className={`pill-menu__item${item.selected ? " pill-menu__item--selected" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  if (!item.selected) onSelect(item.id);
                }}
              >
                <span className="pill-menu__item-label">{item.label}</span>
                {item.detail && <span className="pill-menu__item-detail">{item.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
