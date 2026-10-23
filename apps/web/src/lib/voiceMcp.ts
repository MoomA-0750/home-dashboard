import { useCallback, useEffect, useState } from "react";
import { defineMessages, type WidgetRuntimeContext } from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: { agentDown: "音声エージェントが起動していません" },
  en: { agentDown: "The voice agent isn't running" },
});

/** 音声アシスタントの Claude に使わせるコネクター・MCPサーバー（apps/server/src/voiceMcp.ts） */

export interface McpCatalogServer {
  name: string;
  /** connector: claude.ai のコネクター / local: ホストの Claude Code に登録済みのもの */
  kind: "connector" | "local";
  target: string;
  status: "connected" | "needs-auth" | "failed";
  available: boolean;
}

export interface CustomMcpServerInfo {
  name: string;
  url: string;
  hasToken: boolean;
}

export interface VoiceMcpState {
  connected: boolean;
  scanning: boolean;
  catalog: { servers: McpCatalogServer[]; scannedAt: string | null; error: string | null } | null;
  enabled: string[];
  custom: CustomMcpServerInfo[];
}

/** 保存するときの形。token を省くと保存済みのものを引き継ぐ（空文字で消す） */
export interface McpSettingsInput {
  enabled: string[];
  custom: { name: string; url: string; token?: string }[];
}

export interface VoiceMcpControl {
  state: VoiceMcpState | null;
  save(settings: McpSettingsInput): Promise<void>;
  scan(): Promise<void>;
}

async function apiError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  if (res.status === 503) return new Error(messages.t("agentDown"));
  return new Error(typeof body?.error === "string" ? body.error : `voice API error: ${res.status}`);
}

/** 設定画面を開いている間だけ読む（変わったらサーバーが voice-mcp で知らせてくる） */
export function useVoiceMcp(ctx: WidgetRuntimeContext, enabled: boolean): VoiceMcpControl {
  const [state, setState] = useState<VoiceMcpState | null>(null);
  const [version, setVersion] = useState(0);
  const url = `${ctx.apiBaseUrl}/api/voice/mcp`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<VoiceMcpState>) : null))
      .then((data) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, enabled, version, ctx.socket]);

  useEffect(() => {
    if (!ctx.socket || !enabled) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data).type === "voice-mcp") setVersion((v) => v + 1);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, enabled]);

  const save = useCallback(
    async (settings: McpSettingsInput) => {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw await apiError(res);
      setVersion((v) => v + 1);
    },
    [url],
  );

  const scan = useCallback(async () => {
    const res = await fetch(`${url}/scan`, { method: "POST" });
    if (!res.ok) throw await apiError(res);
  }, [url]);

  return { state, save, scan };
}
