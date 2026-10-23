import { useCallback, useEffect, useState } from "react";
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

/**
 * 音声アシスタントの道具の確かめ（apps/server/src/voiceGuard.ts）の画面側。
 * - 答えを待っている確かめ（了承・許可）を、どの画面にも出す
 * - 個人の情報の出し方・ゲストモード・道具ごとの段の設定
 */

export type ToolLevel = "read" | "low" | "confirm" | "approve" | "deny";
export type PersonalPolicy = "all" | "screen" | "none";

export interface GuardRequest {
  id: string;
  /** confirm: 了承（押すだけでよい） / approve: 本人確認して許可 */
  kind: "confirm" | "approve";
  conversationId: string | null;
  tool: string;
  description: string;
  createdAt: number;
  expiresAt: number;
}

export interface GuardTool {
  name: string;
  label: string;
  kind: "dashboard" | "builtin" | "external";
  extensionId: string | null;
  /** 道具の宣言した段（引数で変わるものは varies）。外の道具では、決めていないときの段 */
  declared: ToolLevel | "varies" | null;
  personal: boolean;
  untrusted: boolean;
  override: { level?: ToolLevel; personal?: boolean } | null;
  lastUsedAt?: string | null;
}

export interface GuardSettings {
  personal: PersonalPolicy;
  guest: boolean;
  tools: Record<string, { level?: ToolLevel; personal?: boolean }>;
}

async function request<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : `voice guard API error: ${res.status}`);
  return body as T;
}

/** サーバーからの知らせ（type）が来たら読み直す */
function useReloadOn(socket: WebSocket | null, type: string, enabled: boolean): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!socket || !enabled) return;
    const onMessage = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data).type === type) setVersion((v) => v + 1);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket, type, enabled]);
  return version;
}

/** 答えを待っている確かめ。つなぎ直したときも読み直す */
export function useGuardRequests(apiBaseUrl: string, socket: WebSocket | null): GuardRequest[] {
  const [requests, setRequests] = useState<GuardRequest[]>([]);
  const version = useReloadOn(socket, "voice-guard", true);
  useEffect(() => {
    let cancelled = false;
    request<{ requests: GuardRequest[] }>(apiBaseUrl, "/api/voice/guard/requests")
      .then((data) => !cancelled && setRequests(data.requests))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, socket, version]);
  return requests;
}

/** 了承・断り（本人確認の要らない答え） */
export function answerGuard(apiBaseUrl: string, id: string, allow: boolean) {
  return request(apiBaseUrl, `/api/voice/guard/requests/${encodeURIComponent(id)}/answer`, {
    method: "POST",
    body: JSON.stringify({ allow }),
  });
}

export function approveWithPassword(apiBaseUrl: string, id: string, password: string) {
  return request(apiBaseUrl, `/api/voice/guard/requests/${encodeURIComponent(id)}/answer`, {
    method: "POST",
    body: JSON.stringify({ allow: true, password }),
  });
}

/** パスキーで本人確認して許可する。端末の画面で取り消されたら false */
export async function approveWithPasskey(apiBaseUrl: string, id: string): Promise<boolean> {
  const { challengeId, options } = await request<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
    apiBaseUrl,
    "/api/voice/guard/reauth/options",
    { method: "POST" },
  );
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (err) {
    if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError")) return false;
    throw err;
  }
  await request(apiBaseUrl, `/api/voice/guard/requests/${encodeURIComponent(id)}/answer`, {
    method: "POST",
    body: JSON.stringify({ allow: true, passkey: { challengeId, response } }),
  });
  return true;
}

export interface GuardSettingsControl {
  settings: GuardSettings | null;
  tools: GuardTool[];
  save(next: Partial<GuardSettings>): Promise<void>;
  setGuest(guest: boolean): Promise<void>;
}

/** 設定画面を開いている間だけ読む */
export function useGuardSettings(apiBaseUrl: string, socket: WebSocket | null, enabled: boolean): GuardSettingsControl {
  const [data, setData] = useState<{ settings: GuardSettings; tools: GuardTool[] } | null>(null);
  const version = useReloadOn(socket, "voice-guard-settings", enabled);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    request<{ settings: GuardSettings; tools: GuardTool[] }>(apiBaseUrl, "/api/voice/guard/settings")
      .then((next) => !cancelled && setData(next))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, enabled, version]);

  const save = useCallback(
    async (next: Partial<GuardSettings>) => {
      await request(apiBaseUrl, "/api/voice/guard/settings", { method: "PUT", body: JSON.stringify(next) });
    },
    [apiBaseUrl],
  );
  const setGuest = useCallback(
    async (guest: boolean) => {
      await request(apiBaseUrl, "/api/voice/guard/guest", { method: "PUT", body: JSON.stringify({ guest }) });
    },
    [apiBaseUrl],
  );
  return { settings: data?.settings ?? null, tools: data?.tools ?? [], save, setGuest };
}
