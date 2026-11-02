import { useEffect, useState } from "react";
import type { WidgetRuntimeContext } from "@home-dashboard/widget-sdk";

/**
 * 夜の表示（部屋が暗い・電気が消えているときに画面をぐっと暗くする）。サーバーの /api/night を読み、
 * 夜に入った・出たの知らせ（night-updated）ですぐ替える。夜の間は <html data-night> と --night-darkness を付け、
 * styles/base.css が背景と文字を暗くする
 */

export interface NightSignal {
  source: string;
  reason: string | null;
  since: string;
}

/** 夜の表示の条件（apps/server/src/nightRules.ts と同じ形）。source は値を差し出す拡張機能の id */
export type NightCondition =
  | { kind: "below" | "above"; source: string; id: string; value: number }
  | { kind: "off" | "on"; source: string; id: string }
  | { kind: "time"; from: string; to: string };

export interface NightRules {
  match: "all" | "any";
  conditions: NightCondition[];
  holdMinutes: number;
}

export interface NightEvaluation {
  met: boolean;
  results: { condition: NightCondition; met: boolean; current: string | null; label: string }[];
  reason: string | null;
}

export interface NightState {
  mode: "auto" | "on" | "off";
  darkness: number;
  rules: NightRules;
  active: boolean;
  signals: NightSignal[];
  /** 最後に条件を確かめた結果（条件が無ければ null） */
  evaluation: NightEvaluation | null;
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
