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

export async function askVoiceAssistant(apiBaseUrl: string, text: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(res.status === 503 ? "音声エージェントが起動していません" : `voice API error: ${res.status}`);
}

export async function cancelVoiceAssistant(apiBaseUrl: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/voice/cancel`, { method: "POST" });
}
