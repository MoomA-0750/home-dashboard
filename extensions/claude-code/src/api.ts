import { extensionApiUrl, type WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { strings } from "./i18n";
import type { AgentAction, LogChunk, MachineConfig, MachineOverview } from "./types";

/** 画面からこの拡張機能のサーバー側（./server）を呼ぶ */

type Ctx = Pick<WidgetRuntimeContext, "apiBaseUrl">;

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(ctx: Ctx, path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "claude-code", path), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(body.error ?? strings.t("requestFailed", { status: res.status }), res.status);
  return body as T;
}

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export const fetchOverview = (ctx: Ctx) => request<{ machines: MachineOverview[] }>(ctx, "/overview");

export const fetchLog = (
  ctx: Ctx,
  machineId: string,
  sessionId: string,
  position: { from?: number; before?: number; limit?: number } = {},
) =>
  request<LogChunk>(
    ctx,
    `/machines/${encodeURIComponent(machineId)}/log?${query({ session: sessionId, ...position })}`,
  );

export const fetchScreen = (ctx: Ctx, machineId: string, pane: string, lines = 60) =>
  request<{ text: string }>(ctx, `/machines/${encodeURIComponent(machineId)}/screen?${query({ pane, lines })}`);

export const runAction = (ctx: Ctx, machineId: string, action: AgentAction) =>
  request<{ ok: true; pane?: string; name?: string }>(ctx, `/machines/${encodeURIComponent(machineId)}/action`, {
    method: "POST",
    json: action,
  });

// --- 設定画面

export interface SshKeyInfo {
  publicKey: string;
  authorizedKeysLine: string;
  command: string;
  bridgeFile: string;
}

export const fetchMachines = async (ctx: Ctx) =>
  (await request<{ machines: MachineConfig[] }>(ctx, "/machines")).machines;
export const fetchSshKey = (ctx: Ctx) => request<SshKeyInfo>(ctx, "/ssh-key");
export const saveMachine = (ctx: Ctx, machine: Partial<MachineConfig>) =>
  machine.id
    ? request<MachineConfig>(ctx, `/machines/${encodeURIComponent(machine.id)}`, { method: "PUT", json: machine })
    : request<MachineConfig>(ctx, "/machines", {
        method: "POST",
        json: machine,
      });
export const deleteMachine = (ctx: Ctx, id: string) =>
  request<{ ok: true }>(ctx, `/machines/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
export const testMachine = (ctx: Ctx, machine: Partial<MachineConfig>) =>
  request<{ ok: boolean; message: string; fingerprint?: string }>(ctx, "/machines-test", {
    method: "POST",
    json: machine,
  });
export const bridgeUrl = (ctx: Ctx) => extensionApiUrl(ctx, "claude-code", "/bridge");
