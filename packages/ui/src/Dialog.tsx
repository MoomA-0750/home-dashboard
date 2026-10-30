import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { defineMessages } from "./i18n";
import { useClosing } from "./motion";

const messages = defineMessages({
  ja: { close: "閉じる" },
  en: { close: "Close" },
});

/**
 * 画面の上に重ねて出す小窓（「ウィジェットを追加」・Home Control のセンサーの詳細と同じ見た目）。
 * 背景を押す・Esc・右上の × で閉じる（薄くなってから onClose を呼ぶ）
 */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = messages.useT();
  const { closing, close } = useClosing(onClose);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return createPortal(
    <div className={`widget-picker-overlay${closing ? " is-closing" : ""}`} onClick={close}>
      <div className="widget-picker" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="widget-picker__header">
          <h2>{title}</h2>
          <button type="button" className="settings-panel__close" onClick={close} aria-label={t("close")}>
            <Icon name="dismiss" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
