import { memo, useState } from "react";
import {
  cx,
  defineMessages,
  Dialog,
  IconButton,
  WidgetCard,
  WidgetHint,
  textFor,
  useLocale,
  usePresence,
  type WidgetInstance,
  type WidgetProps,
  type WidgetRegistry,
  type WidgetRuntimeContext,
  type WidgetSize,
} from "@home-dashboard/widget-sdk";
import { ErrorBoundary } from "./ErrorBoundary";

/** 編集の操作（設定・上へ・下へ）は、カードの上で目立つ明るい塗りの丸。外すものは危ない色 */
const EDIT_BUTTON = "fill-bright no-blur";
const REMOVE_BUTTON = "fill-bright no-blur bg-danger-strong text-on-danger";
import { Icon } from "./Icon";

const messages = defineMessages({
  ja: {
    dragToReorder: "ドラッグで並べ替え",
    settingsOf: "{name}の設定",
    moveUp: "{name}を上へ",
    moveDown: "{name}を下へ",
    remove: "{name}を削除",
    unavailable: "このウィジェットの拡張機能は切ってあるか、入っていません（設定画面の「拡張機能」）",
  },
  en: {
    dragToReorder: "Drag to reorder",
    settingsOf: "{name} settings",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    remove: "Remove {name}",
    unavailable: "This widget's extension is turned off or not installed (Settings → Extensions)",
  },
});

interface WidgetHostProps {
  instance: WidgetInstance;
  registry: WidgetRegistry;
  ctx: WidgetRuntimeContext;
  editMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (instanceId: string, direction: -1 | 1) => void;
  onRemove: (instanceId: string) => void;
  onConfigChange: (instanceId: string, config: Record<string, unknown>) => void;
}

// 渡すものが変わらなければ描き直さない（App は音声の状態などで頻繁に描き直る）
export const WidgetHost = memo(function WidgetHost({
  instance,
  registry,
  ctx,
  editMode,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  onConfigChange,
}: WidgetHostProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 編集を終えるときも、薄くなってから消す（詳細・設定の小窓は Dialog が自分で薄くなってから閉じる）
  const editTools = usePresence(editMode);
  const definition = registry.get(instance.widgetId);
  const size: WidgetSize = { w: instance.w, h: instance.h };

  // 拡張機能を切った・消したウィジェットは、置き場所を残したまま知らせだけ出す（入れ直すと戻る。編集中なら削除できる）
  const locale = useLocale();
  const t = messages.useT();
  const name = definition ? textFor(definition.name, locale) : instance.widgetId;
  const Component = definition?.Component ?? UnavailableWidget;
  const DetailComponent = definition?.DetailComponent;
  const SettingsComponent = definition?.SettingsComponent;
  // 後から足した設定の項目も既定の値で埋まるよう、既定の上に保存済みの値を重ねる
  const config = { ...definition?.defaultConfig, ...instance.config };

  return (
    <div className="relative h-full">
      {editTools.shown && (
        // 編集中はカードの中身を押せないよう、上に層を重ねる（押すと詳細が開いたり照明が切り替わったりするため）。
        // 層は縦のスクロールだけ通すので、タッチ端末でも列を送れる
        <div
          className={cx(
            "absolute inset-0 layer-handle flex items-center justify-between rounded-card border-2 border-dashed border-tint/55 bg-shade/35 px-4 touch-pan-y",
            "animate-fade closing:animate-fade-out closing:pointer-events-none",
            editTools.closing && "is-closing",
          )}
        >
          {/* つまみの上だけは、スクロールではなくドラッグにする */}
          <span
            data-drag-handle=""
            className="fill-bright grid h-30 w-14 cursor-grab touch-none place-items-center rounded-full active:cursor-grabbing [&_.fluent-icon]:size-7"
            aria-hidden="true"
            title={t("dragToReorder")}
          >
            <Icon name="grip" />
          </span>
          <div className="flex gap-2.5">
            {SettingsComponent && (
              <IconButton
                size="lg"
                icon="settings"
                className={EDIT_BUTTON}
                onClick={() => setSettingsOpen(true)}
                label={t("settingsOf", { name })}
              />
            )}
            <IconButton
              size="lg"
              icon="chevron-up"
              className={EDIT_BUTTON}
              onClick={() => onMove(instance.instanceId, -1)}
              disabled={!canMoveUp}
              label={t("moveUp", { name })}
            />
            <IconButton
              size="lg"
              icon="chevron-down"
              className={EDIT_BUTTON}
              onClick={() => onMove(instance.instanceId, 1)}
              disabled={!canMoveDown}
              label={t("moveDown", { name })}
            />
            <IconButton
              size="lg"
              icon="delete"
              className={REMOVE_BUTTON}
              onClick={() => onRemove(instance.instanceId)}
              label={t("remove", { name })}
            />
          </div>
        </div>
      )}
      <ErrorBoundary name={name}>
        <Component
          instanceId={instance.instanceId}
          config={config}
          size={size}
          ctx={ctx}
          openDetail={() => DetailComponent && setDetailOpen(true)}
        />
      </ErrorBoundary>
      {/* 詳細と設定は小窓（Dialog）。Dialog は body の直下に出すので、react-grid-layout の transform の中でも画面全体に重なる */}
      {DetailComponent && detailOpen && (
        <Dialog label={name} size="fit" onClose={() => setDetailOpen(false)}>
          <ErrorBoundary name={name}>
            <DetailComponent
              instanceId={instance.instanceId}
              config={config}
              size={size}
              ctx={ctx}
              openDetail={() => setDetailOpen(true)}
              closeDetail={() => setDetailOpen(false)}
            />
          </ErrorBoundary>
        </Dialog>
      )}
      {SettingsComponent && settingsOpen && (
        <Dialog title={t("settingsOf", { name })} onClose={() => setSettingsOpen(false)}>
          <SettingsComponent config={config} ctx={ctx} onChange={(next) => onConfigChange(instance.instanceId, next)} />
        </Dialog>
      )}
    </div>
  );
});

function UnavailableWidget(_props: WidgetProps) {
  const t = messages.useT();
  return (
    <WidgetCard>
      <WidgetHint>{t("unavailable")}</WidgetHint>
    </WidgetCard>
  );
}
