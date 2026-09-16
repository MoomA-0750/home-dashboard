import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import type { WidgetInstance, WidgetRegistry, WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { WidgetHost } from "./WidgetHost";

const ResponsiveGridLayout = WidthProvider(GridLayout);

/**
 * 設計図のウィジェット基本サイズ（650x200px）とカード間隔（30px）。
 * react-grid-layout を1カラムで使い、rowHeight=200 / margin=[0,30] にすることで
 * 「高さ200pxのカードが30px間隔で縦に並ぶ」というレールの見た目を保ちつつ、
 * 従来どおりドラッグでの並べ替えと高さのリサイズができるようにしている。
 * （横幅はレールの幅いっぱいなので x と w は使わない）
 */
const CARD_HEIGHT = 200;
const CARD_GAP = 30;

interface WidgetRailProps {
  instances: WidgetInstance[];
  registry: WidgetRegistry;
  ctx: WidgetRuntimeContext;
  editMode: boolean;
  onLayoutChange: (instances: WidgetInstance[]) => void;
  onRemove: (instanceId: string) => void;
}

export function WidgetRail({ instances, registry, ctx, editMode, onLayoutChange, onRemove }: WidgetRailProps) {
  const layout: Layout[] = instances.map((instance) => {
    const def = registry.get(instance.widgetId);
    return {
      i: instance.instanceId,
      x: 0,
      y: instance.y,
      w: 1,
      h: instance.h,
      minH: def?.minSize?.h,
    };
  });

  const handleLayoutChange = (nextLayout: Layout[]) => {
    const byId = new Map(nextLayout.map((item) => [item.i, item]));
    onLayoutChange(
      instances.map((instance) => {
        const item = byId.get(instance.instanceId);
        if (!item) return instance;
        return { ...instance, y: item.y, h: item.h };
      }),
    );
  };

  if (instances.length === 0) {
    return (
      <aside className="widget-rail" aria-label="ウィジェット">
        <div className="widget-stack">
          <p className="widget-rail__empty">サイドバーの Settings からウィジェットを追加できます。</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="widget-rail" aria-label="ウィジェット">
      <div className="widget-stack">
        <ResponsiveGridLayout
          className="canvas-grid"
          layout={layout}
          cols={1}
          rowHeight={CARD_HEIGHT}
          margin={[0, CARD_GAP]}
          containerPadding={[0, 0]}
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
      </div>
    </aside>
  );
}
