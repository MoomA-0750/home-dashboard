import { useEffect } from "react";
import { Badge, defineMessages, textFor, useLocale, type WidgetRegistry } from "@home-dashboard/widget-sdk";
import { Icon } from "./Icon";

const messages = defineMessages({
  ja: {
    editWidgets: "ウィジェットの編集",
    hint: "つまみをドラッグするか、矢印で並べ替えます",
    addWidget: "ウィジェットを追加",
    done: "完了",
    close: "閉じる",
    placed: "配置済み",
  },
  en: {
    editWidgets: "Edit widgets",
    hint: "Drag a handle or use the arrows to reorder",
    addWidget: "Add widget",
    done: "Done",
    close: "Close",
    placed: "Added",
  },
});

interface WidgetEditBarProps {
  /** 消える動きの間 */
  closing?: boolean;
  onAdd: () => void;
  onDone: () => void;
}

/**
 * 編集モードの間、画面の下に出す操作帯。
 * 設定パネルはウィジェットの列の右側を覆ってしまうので、編集中の操作はパネルではなくここに置く。
 */
export function WidgetEditBar({ closing = false, onAdd, onDone }: WidgetEditBarProps) {
  const t = messages.useT();
  return (
    <div className={`widget-edit-bar${closing ? " is-closing" : ""}`} role="toolbar" aria-label={t("editWidgets")}>
      <span className="widget-edit-bar__hint">{t("hint")}</span>
      <button type="button" className="widget-edit-bar__button" onClick={onAdd}>
        <Icon name="add" />
        <span>{t("addWidget")}</span>
      </button>
      <button type="button" className="widget-edit-bar__button widget-edit-bar__button--primary" onClick={onDone}>
        <span>{t("done")}</span>
      </button>
    </div>
  );
}

interface WidgetPickerProps {
  registry: WidgetRegistry;
  /** 画面に固定表示していてレールには追加できないウィジェット（時刻・天気） */
  hiddenWidgetIds: string[];
  /** すでにレールにあるもの（同じ種類も重ねて置けるが、置いてあることは見せる） */
  placedWidgetIds: string[];
  onAdd: (widgetId: string) => void;
  onClose: () => void;
  /** 消える動きの間 */
  closing?: boolean;
}

export function WidgetPicker({ registry, hiddenWidgetIds, placedWidgetIds, onAdd, onClose, closing = false }: WidgetPickerProps) {
  const locale = useLocale();
  const t = messages.useT();
  const addable = registry.getAll().filter((def) => !hiddenWidgetIds.includes(def.id));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={`widget-picker-overlay${closing ? " is-closing" : ""}`} onClick={onClose}>
      <div
        className="widget-picker"
        role="dialog"
        aria-modal="true"
        aria-label={t("addWidget")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="widget-picker__header">
          <h2>{t("addWidget")}</h2>
          <button type="button" className="settings-panel__close" onClick={onClose} aria-label={t("close")}>
            <Icon name="dismiss" />
          </button>
        </div>
        <ul className="widget-picker__list">
          {addable.map((def) => {
            const placed = placedWidgetIds.filter((id) => id === def.id).length;
            return (
              <li key={def.id}>
                <button type="button" className="widget-picker__item" onClick={() => onAdd(def.id)}>
                  <span className="widget-picker__name">
                    {textFor(def.name, locale)}
                    {placed > 0 && (
                      <Badge>
                        {t("placed")}
                        {placed > 1 ? ` ×${placed}` : ""}
                      </Badge>
                    )}
                  </span>
                  {def.description && <span className="widget-picker__desc">{textFor(def.description, locale)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
