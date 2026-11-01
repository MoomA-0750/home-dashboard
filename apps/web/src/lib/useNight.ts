import { useEffect, useState } from "react";
import type { WidgetRuntimeContext } from "@home-dashboard/widget-sdk";

/**
 * 夜の表示（部屋が暗い・電気が消えているときに画面をぐっと暗くする）。サーバーの /api/night を読み、
 * 夜に入った・出たの知らせ（night-updated）ですぐ替える。夜の間は <html data-night> と --night-darkness を付け、
 * theme.css が背景と文字を暗くする
 */

export interface NightSignal {
  source: string;
  reason: string | null;
  since: string;
}

export interface NightState {
  mode: "auto" | "on" | "off";
  darkness: number;
  active: boolean;
  signals: NightSignal[];
}

export function useNight(ctx: WidgetRuntimeContext) {
  const [night, setNight] = useState<NightState | null>(null);

  useEffect(() => {
    fetch(`${ctx.apiBaseUrl}/api/night`)
      .then((res) => (res.ok ? (res.json() as Promise<NightState>) : null))
      .then((state) => state && setNight(state))
      .catch(() => undefined);
  }, [ctx.apiBaseUrl]);

  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "night-updated") {
          const { type: _type, ...state } = message;
          setNight(state as NightState);
        }
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket]);

  useEffect(() => {
    const root = document.documentElement;
    if (night?.active) {
      root.dataset.night = "";
      root.style.setProperty("--night-darkness", String(night.darkness));
    } else {
      delete root.dataset.night;
    }
  }, [night?.active, night?.darkness]);

  return [night, setNight] as const;
}
