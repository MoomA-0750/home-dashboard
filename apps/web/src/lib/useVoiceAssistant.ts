import { useEffect, useState } from "react";
import type { WidgetRuntimeContext } from "@home-dashboard/widget-sdk";

/** 音声アシスタント（apps/voice-agent）の状態。サーバーの /api/voice/state と WebSocket の "voice" メッセージで届く */
export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

export interface VoiceSnapshot {
  /** エージェントがサーバーに接続しているか */
  connected: boolean;
  state: VoiceState;
  /** ウェイクワードを聞いてから返答し終えるまでの1回のやり取りのID */
  turnId: string | null;
  transcript: string;
  response: string;
  error: string | null;
  /** 返答の直後で、ウェイクワード無しで続けて話せる間 */
  followUp: boolean;
  wakePhrase: string | null;
}

export const ACTIVE_VOICE_STATES: VoiceState[] = ["listening", "transcribing", "thinking", "speaking"];

export function useVoiceAssistant(ctx: WidgetRuntimeContext): VoiceSnapshot | null {
  const [snapshot, setSnapshot] = useState<VoiceSnapshot | null>(null);

  // WebSocketが（再）接続されるたびに取り直す。切れている間の変化を取りこぼさないため
  useEffect(() => {
    let cancelled = false;
    fetch(`${ctx.apiBaseUrl}/api/voice/state`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: VoiceSnapshot | null) => {
        if (!cancelled && data) setSnapshot(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket]);

  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "voice") setSnapshot(message.snapshot);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket]);

  return snapshot;
}

const AVATAR_ENABLED_STORAGE_KEY = "home-dashboard:voice-avatar";

/**
 * この端末でVRMアバターを出すか。非力な端末（LD290EJS 等）では描画が重いので、端末ごとに切れるようにする。
 * 端末ごとの好みなのでサーバーには保存しない
 */
export function useAvatarEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(AVATAR_ENABLED_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const update = (next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(AVATAR_ENABLED_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // 保存できなくてもこの表示中は反映される
    }
  };
  return [enabled, update];
}

/** 応答パネルに出すVRMアバターのURL。サーバーに置かれていなければ null */
export function useAvatarUrl(apiBaseUrl: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const candidate = `${apiBaseUrl}/api/voice/avatar`;
    let cancelled = false;
    fetch(candidate, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && res.ok) setUrl(candidate);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);
  return url;
}

export async function askVoiceAssistant(apiBaseUrl: string, text: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(res.status === 503 ? "音声エージェントが起動していません" : `voice API error: ${res.status}`);
}

export async function listenVoiceAssistant(apiBaseUrl: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/voice/listen`, { method: "POST" });
}

export async function cancelVoiceAssistant(apiBaseUrl: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/voice/cancel`, { method: "POST" });
}
