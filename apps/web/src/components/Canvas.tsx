import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import type { WidgetInstance, WidgetRegistry, WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { WidgetHost } from "./WidgetHost";

const ResponsiveGridLayout = WidthProvider(GridLayout);

interface CanvasProps {
  instances: WidgetInstance[];
  registry: WidgetRegistry;
  ctx: WidgetRuntimeContext;
  editMode: boolean;
  onLayoutChange: (instances: WidgetInstance[]) => void;
  onRemove: (instanceId: string) => void;
}

export function Canvas({ instances, registry, ctx, editMode, onLayoutChange, onRemove }: CanvasProps) {
  const layout: Layout[] = instances.map((instance) => {
    const def = registry.get(instance.widgetId);
    return {
      i: instance.instanceId,
      x: instance.x,
      y: instance.y,
      w: instance.w,
      h: instance.h,
      minW: def?.minSize?.w,
      minH: def?.minSize?.h,
    };
  });

  const handleLayoutChange = (nextLayout: Layout[]) => {
    const byId = new Map(nextLayout.map((item) => [item.i, item]));
    onLayoutChange(
      instances.map((instance) => {
        const item = byId.get(instance.instanceId);
        if (!item) return instance;
        return { ...instance, x: item.x, y: item.y, w: item.w, h: item.h };
      }),
    );
  };

  return (
    <ResponsiveGridLayout
      className="canvas-grid"
      layout={layout}
      cols={12}
      rowHeight={90}
      margin={[16, 16]}
      isDraggable={editMode}
      isResizable={editMode}
      onLayoutChange={handleLayoutChange}
      compactType="vertical"
    >
      {instances.map((instance) => (
        <div key={instance.instanceId}>
          <WidgetHost instance={instance} registry={registry} ctx={ctx} editMode={editMode} onRemove={onRemove} />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
