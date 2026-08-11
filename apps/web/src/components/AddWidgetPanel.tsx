import type { WidgetRegistry } from "@home-dashboard/widget-sdk";

interface AddWidgetPanelProps {
  registry: WidgetRegistry;
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}

export function AddWidgetPanel({ registry, onAdd, onClose }: AddWidgetPanelProps) {
  return (
    <div className="add-widget-panel">
      <div className="add-widget-panel__header">
        <h2>ウィジェットを追加</h2>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <ul className="add-widget-panel__list">
        {registry.getAll().map((def) => (
          <li key={def.id}>
            <button type="button" className="add-widget-panel__item" onClick={() => onAdd(def.id)}>
              <span className="add-widget-panel__name">{def.name}</span>
              {def.description && <span className="add-widget-panel__desc">{def.description}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
