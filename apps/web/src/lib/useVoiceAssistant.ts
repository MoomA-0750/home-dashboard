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
  /** いま応答しているキャラクター */
  personaId: string | null;
  personaName: string | null;
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

export interface VoicePersona {
  id: string;
  name: string;
  /** 表示用のウェイクワード（例: 「ねえプラム」） */
  wakePhrase: string;
  hasAvatar: boolean;
}

export interface VoicePersonas {
  /** 画面のマイクボタン・文字入力で応答するキャラクター（設定画面で変えられる） */
  defaultPersonaId: string;
  personas: VoicePersona[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** ウェイクワードごとに呼び分けるキャラクターの一覧。既定のキャラクターが（他の端末で）変わったら取り直す */
export function useVoicePersonas(ctx: WidgetRuntimeContext): VoicePersonas | null {
  const [personas, setPersonas] = useState<VoicePersonas | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchJson<VoicePersonas>(`${ctx.apiBaseUrl}/api/voice/personas`).then((data) => {
      if (!cancelled && data) setPersonas(data);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket, version]);

  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data).type === "voice-personas") setVersion((v) => v + 1);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket]);

  return personas;
}

export function avatarUrlFor(apiBaseUrl: string, personas: VoicePersonas | null, personaId: string | null): string | null {
  const persona = personas?.personas.find((p) => p.id === personaId);
  return persona?.hasAvatar ? `${apiBaseUrl}/api/voice/avatars/${encodeURIComponent(persona.id)}` : null;
}

export async function setDefaultPersona(apiBaseUrl: string, personaId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultPersonaId: personaId }),
  });
  if (!res.ok) throw new Error(`voice settings error: ${res.status}`);
}

export type VoiceTurnSource = "wake" | "follow-up" | "button" | "text";

/** 誰が・どこから話しかけられて・何に答えたかの記録（サーバーの data/voice-history.jsonl） */
export interface VoiceTurnRecord {
  at: string;
  turnId: string | null;
  personaId: string;
  personaName: string;
  source: VoiceTurnSource;
  transcript: string;
  response: string;
  status: "answered" | "cancelled" | "error";
}

/** 直近のやり取りの記録。enabled の間だけ取得し、新しい記録が届いたら先頭に足す */
export function useVoiceHistory(ctx: WidgetRuntimeContext, enabled: boolean, limit = 10): VoiceTurnRecord[] {
  const [records, setRecords] = useState<VoiceTurnRecord[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchJson<{ records: VoiceTurnRecord[] }>(`${ctx.apiBaseUrl}/api/voice/history?limit=${limit}`).then((data) => {
      if (!cancelled && data) setRecords([...data.records].reverse());
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket, enabled, limit]);

  useEffect(() => {
    if (!enabled || !ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "voice-history") setRecords((prev) => [message.record, ...prev].slice(0, limit));
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, enabled, limit]);

  return records;
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
