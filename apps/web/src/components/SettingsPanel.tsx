import type { WidgetRegistry } from "@home-dashboard/widget-sdk";
import { Icon } from "./Icon";

interface SettingsPanelProps {
  registry: WidgetRegistry;
  /** 画面に固定表示していてレールには追加できないウィジェット（時刻・天気） */
  hiddenWidgetIds: string[];
  editMode: boolean;
  onToggleEditMode: () => void;
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}

/**
 * サイドバーの Settings から開くパネル。
 * 設計図のサイドバーはアイコン5つで固定なので、編集モードの切り替えはここに置いている。
 */
export function SettingsPanel({
  registry,
  hiddenWidgetIds,
  editMode,
  onToggleEditMode,
  onAdd,
  onClose,
}: SettingsPanelProps) {
  const addable = registry.getAll().filter((def) => !hiddenWidgetIds.includes(def.id));

  return (
    <div className="settings-panel">
      <div className="settings-panel__header">
        <h2>設定</h2>
        <button type="button" className="settings-panel__close" onClick={onClose} aria-label="閉じる">
          <Icon name="dismiss" />
        </button>
      </div>

      <button
        type="button"
        className={`settings-panel__edit-toggle${editMode ? " settings-panel__edit-toggle--on" : ""}`}
        aria-pressed={editMode}
        onClick={onToggleEditMode}
      >
        <Icon name="edit" />
        <span>{editMode ? "編集モードを終了" : "編集モード（並べ替え・削除）"}</span>
      </button>

      <h3 className="settings-panel__section-title">ウィジェットを追加</h3>
      <ul className="settings-panel__list">
        {addable.map((def) => (
          <li key={def.id}>
            <button type="button" className="settings-panel__item" onClick={() => onAdd(def.id)}>
              <span className="settings-panel__name">{def.name}</span>
              {def.description && <span className="settings-panel__desc">{def.description}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
