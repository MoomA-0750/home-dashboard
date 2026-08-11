import { useEffect, useRef, useState } from "react";
import type { WidgetInstance } from "@home-dashboard/widget-sdk";
import { widgetRegistry } from "./widgets";
import { fetchLayout, saveLayout } from "./api/layout";
import { useRuntimeContext } from "./lib/useRuntimeContext";
import { Canvas } from "./components/Canvas";
import { Sidebar } from "./components/Sidebar";
import { AddWidgetPanel } from "./components/AddWidgetPanel";

function newInstanceId(): string {
  return crypto.randomUUID();
}

export function App() {
  const ctx = useRuntimeContext();
  const [instances, setInstances] = useState<WidgetInstance[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  if (instances === null) {
    return <div className="app-loading">読み込み中…</div>;
  }

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

  return (
    <div className="app-shell">
      <Sidebar
        editMode={editMode}
        onToggleEditMode={() => setEditMode((v) => !v)}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />
      <main className="app-main">
        <Canvas
          instances={instances}
          registry={widgetRegistry}
          ctx={ctx}
          editMode={editMode}
          onLayoutChange={setInstances}
          onRemove={handleRemove}
        />
      </main>
      {settingsOpen && (
        <AddWidgetPanel registry={widgetRegistry} onAdd={handleAdd} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
