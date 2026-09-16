import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { WidgetInstance } from "@home-dashboard/widget-sdk";
import { widgetRegistry } from "./widgets";
import { fetchLayout, saveLayout } from "./api/layout";
import { useRuntimeContext } from "./lib/useRuntimeContext";
import { MainInfo } from "./components/MainInfo";
import { WidgetRail } from "./components/WidgetRail";
import {
  Sidebar,
  SidebarHandle,
  SIDEBAR_LABEL_THRESHOLD,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  type ScreenId,
} from "./components/Sidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { VoiceLauncher } from "./components/VoiceLauncher";
import { VoiceOverlay } from "./components/VoiceOverlay";
import {
  askVoiceAssistant,
  cancelVoiceAssistant,
  listenVoiceAssistant,
  useVoiceAssistant,
} from "./lib/useVoiceAssistant";

/**
 * 時刻・天気はメイン画面左側に固定表示（MainInfo）される画面の構成要素なので、
 * ウィジェットレールには出さない。レールに二重に出るのを防ぐためここで除外する。
 */
const CHROME_WIDGET_IDS = ["clock", "weather"];

const SIDEBAR_WIDTH_STORAGE_KEY = "home-dashboard:sidebar-width";

function newInstanceId(): string {
  return crypto.randomUUID();
}

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function readStoredSidebarWidth(): number {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampSidebarWidth(stored) : SIDEBAR_MIN_WIDTH;
}

export function App() {
  const ctx = useRuntimeContext();
  const voice = useVoiceAssistant(ctx);
  const [instances, setInstances] = useState<WidgetInstance[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(readStoredSidebarWidth);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchLayout(ctx.apiBaseUrl).then((layout) => {
      setInstances(layout.instances);
      loadedRef.current = true;
    });
  }, [ctx.apiBaseUrl]);

  useEffect(() => {
    if (!loadedRef.current || instances === null) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLayout(ctx.apiBaseUrl, { instances, updatedAt: new Date().toISOString() }).catch((err) =>
        console.error("failed to save layout", err),
      );
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [instances, ctx.apiBaseUrl]);

  // 他端末でのレイアウト変更をリアルタイムに反映する（複数端末からの同時アクセスを想定）
  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "layout-updated") {
          fetchLayout(ctx.apiBaseUrl).then((layout) => setInstances(layout.instances));
        }
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, ctx.apiBaseUrl]);

  const handleSidebarResize = useCallback((width: number) => {
    const next = clampSidebarWidth(width);
    setSidebarWidth(next);
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
  }, []);

  const handleSelectScreen = (screen: ScreenId) => {
    if (screen === "settings") setSettingsOpen((v) => !v);
  };

  const handleAdd = (widgetId: string) => {
    const def = widgetRegistry.get(widgetId);
    if (!def) return;
    const instance: WidgetInstance = {
      instanceId: newInstanceId(),
      widgetId,
      x: 0,
      y: Number.POSITIVE_INFINITY,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      config: def.defaultConfig,
    };
    setInstances((prev) => [...(prev ?? []), instance]);
  };

  const handleRemove = (instanceId: string) => {
    setInstances((prev) => (prev ?? []).filter((i) => i.instanceId !== instanceId));
  };

  const shellStyle = { "--sidebar-width": `${sidebarWidth}px` } as CSSProperties;
  const shellClassName = `app-shell${sidebarWidth > SIDEBAR_LABEL_THRESHOLD ? " app-shell--sidebar-expanded" : ""}`;

  if (instances === null) {
    return <div className="app-loading">読み込み中…</div>;
  }

  const railInstances = instances.filter((i) => !CHROME_WIDGET_IDS.includes(i.widgetId));

  return (
    <div className={shellClassName} style={shellStyle}>
      <Sidebar activeScreen="home" settingsOpen={settingsOpen} onSelect={handleSelectScreen} />
      <SidebarHandle width={sidebarWidth} onResize={handleSidebarResize} />
      <main className="main-screen">
        <MainInfo ctx={ctx} />
        <WidgetRail
          instances={railInstances}
          registry={widgetRegistry}
          ctx={ctx}
          editMode={editMode}
          onLayoutChange={(next) => setInstances(mergeRailLayout(instances, next))}
          onRemove={handleRemove}
        />
      </main>
      {settingsOpen && (
        <SettingsPanel
          registry={widgetRegistry}
          hiddenWidgetIds={CHROME_WIDGET_IDS}
          editMode={editMode}
          onToggleEditMode={() => setEditMode((v) => !v)}
          onAdd={handleAdd}
          voice={voice}
          onAskVoice={(text) => askVoiceAssistant(ctx.apiBaseUrl, text)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <VoiceLauncher snapshot={voice} onListen={() => listenVoiceAssistant(ctx.apiBaseUrl)} />
      <VoiceOverlay snapshot={voice} onCancel={() => cancelVoiceAssistant(ctx.apiBaseUrl)} />
    </div>
  );
}

/** レールに出していないウィジェット（時刻・天気）の配置情報は触らずに残す */
function mergeRailLayout(all: WidgetInstance[], rail: WidgetInstance[]): WidgetInstance[] {
  const byId = new Map(rail.map((instance) => [instance.instanceId, instance]));
  return all.map((instance) => byId.get(instance.instanceId) ?? instance);
}
