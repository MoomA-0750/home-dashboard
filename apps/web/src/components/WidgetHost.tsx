import { memo, useState } from "react";
import { createPortal } from "react-dom";
import {
  defineMessages,
  textFor,
  useLocale,
  type WidgetInstance,
  type WidgetProps,
  type WidgetRegistry,
  type WidgetRuntimeContext,
  type WidgetSize,
} from "@home-dashboard/widget-sdk";
import { ErrorBoundary } from "./ErrorBoundary";
import { Icon } from "./Icon";

const messages = defineMessages({
  ja: {
    dragToReorder: "ドラッグで並べ替え",
    settingsOf: "{name}の設定",
    moveUp: "{name}を上へ",
    moveDown: "{name}を下へ",
    remove: "{name}を削除",
    close: "閉じる",
    unavailable: "このウィジェットの拡張機能は切ってあるか、入っていません（設定画面の「拡張機能」）",
  },
  en: {
    dragToReorder: "Drag to reorder",
    settingsOf: "{name} settings",
    moveUp: "Move {name} up",
    moveDown: "Move {name} down",
    remove: "Remove {name}",
    close: "Close",
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
    <div className={`widget-host${editMode ? " widget-host--editing" : ""}`}>
      {editMode && (
        <div className="widget-host__edit">
          <span className="widget-host__drag" aria-hidden="true" title={t("dragToReorder")}>
            <span className="widget-host__grip" />
          </span>
          <div className="widget-host__edit-actions">
            {SettingsComponent && (
              <button
                type="button"
                className="widget-host__edit-button"
                onClick={() => setSettingsOpen(true)}
                aria-label={t("settingsOf", { name })}
              >
                <Icon name="settings" />
              </button>
            )}
            <button
              type="button"
              className="widget-host__edit-button"
              onClick={() => onMove(instance.instanceId, -1)}
              disabled={!canMoveUp}
              aria-label={t("moveUp", { name })}
            >
              <Icon name="chevron-up" />
            </button>
            <button
              type="button"
              className="widget-host__edit-button"
              onClick={() => onMove(instance.instanceId, 1)}
              disabled={!canMoveDown}
              aria-label={t("moveDown", { name })}
            >
              <Icon name="chevron-down" />
            </button>
            <button
              type="button"
              className="widget-host__edit-button widget-host__edit-button--remove"
              onClick={() => onRemove(instance.instanceId)}
              aria-label={t("remove", { name })}
            >
              <Icon name="delete" />
            </button>
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
      {/*
        詳細ビューは body 直下にポータルで出す。
        react-grid-layout は各アイテムを CSS transform で配置しており、transform された要素は
        position: fixed の包含ブロックになってしまうため、ここに直接書くとオーバーレイが
        画面全体ではなくウィジェットの矩形を基準に配置され、パネルが見切れる。
      */}
      {DetailComponent &&
        detailOpen &&
        createPortal(
          <div className="widget-detail-overlay" onClick={() => setDetailOpen(false)}>
            <div className="widget-detail-panel" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="widget-detail-panel__close"
                onClick={() => setDetailOpen(false)}
                aria-label={t("close")}
              >
                <Icon name="dismiss" />
              </button>
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
            </div>
          </div>,
          document.body,
        )}
      {SettingsComponent &&
        settingsOpen &&
        createPortal(
          <div className="widget-detail-overlay" onClick={() => setSettingsOpen(false)}>
            <div
              className="widget-detail-panel widget-settings"
              role="dialog"
              aria-modal="true"
              aria-label={t("settingsOf", { name })}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="widget-detail-panel__close"
                onClick={() => setSettingsOpen(false)}
                aria-label={t("close")}
              >
                <Icon name="dismiss" />
              </button>
              <h2 className="widget-settings__title">{t("settingsOf", { name })}</h2>
              <SettingsComponent
                config={config}
                ctx={ctx}
                onChange={(next) => onConfigChange(instance.instanceId, next)}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

function UnavailableWidget({ instanceId }: WidgetProps) {
  const t = messages.useT();
  return (
    <div className="widget-card widget-card--unknown" data-instance={instanceId}>
      <span className="widget-hint">
        {t("unavailable")}
      </span>
    </div>
  );
}
