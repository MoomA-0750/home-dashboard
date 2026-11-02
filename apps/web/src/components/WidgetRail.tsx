import { memo, useEffect, useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import {
  defineMessages,
  motionMs,
  scrollBehavior,
  type WidgetInstance,
  type WidgetRegistry,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import { WidgetHost } from "./WidgetHost";

const ResponsiveGridLayout = WidthProvider(GridLayout);

const messages = defineMessages({
  ja: {
    widgets: "ウィジェット",
    emptyEditing: "下の「ウィジェットを追加」から追加できます。",
    empty: "サイドバーの「設定」からウィジェットを追加できます。",
  },
  en: {
    widgets: "Widgets",
    emptyEditing: "Add one with “Add widget” below.",
    empty: "You can add widgets from Settings in the sidebar.",
  },
});

/**
 * 設計図のウィジェット基本サイズ（650x200px）とカード間隔（30px）。
 * react-grid-layout を1カラムで使い、rowHeight=200 / margin=[0,30] にすることで
 * 「高さ200pxのカードが30px間隔で縦に並ぶ」というレールの見た目を保ちつつ、
 * 従来どおりドラッグでの並べ替えと高さのリサイズができるようにしている。
 * （横幅はレールの幅いっぱいなので x と w は使わない）
 */
const CARD_HEIGHT = 200;
const CARD_GAP = 30;

/** ウィジェットの列（ホームの4列目。タブレット幅では時計の下の段） */
const RAIL = "col-start-4 min-h-0 overflow-y-auto tablet:col-start-1 tablet:row-start-2";

interface WidgetRailProps {
  instances: WidgetInstance[];
  registry: WidgetRegistry;
  ctx: WidgetRuntimeContext;
  editMode: boolean;
  /** 追加した直後など、見える位置までスクロールして目立たせたいウィジェット */
  revealInstanceId: string | null;
  onRevealed: () => void;
  onLayoutChange: (instances: WidgetInstance[]) => void;
  onMove: (instanceId: string, direction: -1 | 1) => void;
  onRemove: (instanceId: string) => void;
  onConfigChange: (instanceId: string, config: Record<string, unknown>) => void;
}

// 渡すものが変わらなければ描き直さない（App は音声の状態などで頻繁に描き直る）
export const WidgetRail = memo(function WidgetRail({
  instances,
  registry,
  ctx,
  editMode,
  revealInstanceId,
  onRevealed,
  onLayoutChange,
  onMove,
  onRemove,
  onConfigChange,
}: WidgetRailProps) {
  const railRef = useRef<HTMLElement>(null);
  const t = messages.useT();
  // 縁を光らせているウィジェット
  const [glowingId, setGlowingId] = useState<string | null>(null);
  const order = [...instances].sort((a, b) => a.y - b.y).map((instance) => instance.instanceId);

  // 追加したウィジェットはレールの末尾に入り、画面の外で見えないので、そこまでスクロールして光らせる
  useEffect(() => {
    if (!revealInstanceId) return;
    const timer = setTimeout(() => {
      const element = railRef.current?.querySelector<HTMLElement>(`[data-instance-id="${revealInstanceId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
        setGlowingId(revealInstanceId);
      }
      onRevealed();
    }, 100);
    return () => clearTimeout(timer);
  }, [revealInstanceId, onRevealed]);
  useEffect(() => {
    if (!glowingId) return;
    const timer = setTimeout(() => setGlowingId(null), motionMs("reveal"));
    return () => clearTimeout(timer);
  }, [glowingId]);
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
      <aside className={RAIL} aria-label={t("widgets")}>
        <div className="widget-stack">
          <p className="halo text-note font-medium text-muted">
            {editMode ? t("emptyEditing") : t("empty")}
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside ref={railRef} className={RAIL} data-editing={editMode || undefined} aria-label={t("widgets")}>
      <div className="widget-stack">
        <ResponsiveGridLayout
          className="relative"
          layout={layout}
          cols={1}
          rowHeight={CARD_HEIGHT}
          margin={[0, CARD_GAP]}
          containerPadding={[0, 0]}
          isDraggable={editMode}
          isResizable={editMode}
          // カード全体をつかめるようにすると、タッチ端末で列をスクロールできなくなるので、つまみだけで動かす
          draggableHandle="[data-drag-handle]"
          onLayoutChange={handleLayoutChange}
          compactType="vertical"
        >
          {instances.map((instance) => (
            <div
              key={instance.instanceId}
              data-instance-id={instance.instanceId}
              data-revealed={glowingId === instance.instanceId || undefined}
              className="rounded-card data-revealed:animate-reveal"
            >
              <WidgetHost
                instance={instance}
                registry={registry}
                ctx={ctx}
                editMode={editMode}
                canMoveUp={order.indexOf(instance.instanceId) > 0}
                canMoveDown={order.indexOf(instance.instanceId) < order.length - 1}
                onMove={onMove}
                onRemove={onRemove}
                onConfigChange={onConfigChange}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </aside>
  );
});
