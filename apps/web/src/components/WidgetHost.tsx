import { useState } from "react";
import type { WidgetInstance, WidgetRegistry, WidgetRuntimeContext, WidgetSize } from "@home-dashboard/widget-sdk";

interface WidgetHostProps {
  instance: WidgetInstance;
  registry: WidgetRegistry;
  ctx: WidgetRuntimeContext;
  editMode: boolean;
  onRemove: (instanceId: string) => void;
}

export function WidgetHost({ instance, registry, ctx, editMode, onRemove }: WidgetHostProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const definition = registry.get(instance.widgetId);
  const size: WidgetSize = { w: instance.w, h: instance.h };

  if (!definition) {
    return <div className="widget-card widget-card--unknown">不明なウィジェット: {instance.widgetId}</div>;
  }

  const { Component, DetailComponent } = definition;

  return (
    <div className="widget-host">
      {editMode && (
        <button
          type="button"
          className="widget-host__remove"
          onClick={() => onRemove(instance.instanceId)}
          aria-label="ウィジェットを削除"
        >
          ×
        </button>
      )}
      <Component
        instanceId={instance.instanceId}
        config={instance.config}
        size={size}
        ctx={ctx}
        openDetail={() => DetailComponent && setDetailOpen(true)}
      />
      {DetailComponent && detailOpen && (
        <div className="widget-detail-overlay" onClick={() => setDetailOpen(false)}>
          <div className="widget-detail-panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="widget-detail-panel__close" onClick={() => setDetailOpen(false)}>
              ×
            </button>
            <DetailComponent
              instanceId={instance.instanceId}
              config={instance.config}
              size={size}
              ctx={ctx}
              openDetail={() => setDetailOpen(true)}
              closeDetail={() => setDetailOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
