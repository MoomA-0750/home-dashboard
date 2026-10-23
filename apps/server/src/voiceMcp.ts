import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

/**
 * 音声アシスタントの Claude に使わせるコネクター・MCPサーバーの選択（設定画面で変える）。
 *
 * 使えるものの一覧（claude.ai のコネクター・ホストの Claude Code に登録済みの MCP サーバー）は、
 * ホスト上の音声エージェントが `claude mcp list` で調べて送ってくる（McpCatalog）。ここでは、そのうちどれを使うかと、
 * 画面から URL で足した MCP サーバーを data/voice-mcp.json に保存し、エージェントに渡す。
 * 足したサーバーのトークンは画面には返さない（変えるときだけ送ってもらう）。
 */

export const CUSTOM_MCP_NAME = /^[A-Za-z0-9_-]{1,40}$/;
// エージェントがダッシュボードのMCPに付ける名前。足したものと重ならないようにする
const RESERVED_NAMES = ["dashboard"];
const MAX_CUSTOM = 20;

export interface CustomMcpServer {
  name: string;
  url: string;
  token?: string;
}

export interface McpSettings {
  /** 一覧（McpCatalog）のうち使うものの名前 */
  enabled: string[];
  custom: CustomMcpServer[];
}

export interface McpCatalogServer {
  name: string;
  kind: "connector" | "local";
  target: string;
  status: "connected" | "needs-auth" | "failed";
  /** このエージェントから使えるか（ホストのプロジェクト単位の登録など、渡せないものは false） */
  available: boolean;
}

export interface McpCatalog {
  servers: McpCatalogServer[];
  scannedAt: string | null;
  error: string | null;
}

const settingsPath = () => join(config.dataDir, "voice-mcp.json");

export class McpSettingsError extends Error {}

export async function readMcpSettings(): Promise<McpSettings> {
  try {
    const raw = JSON.parse(await readFile(settingsPath(), "utf-8"));
    return {
      enabled: Array.isArray(raw.enabled) ? raw.enabled.filter((n: unknown) => typeof n === "string") : [],
      custom: Array.isArray(raw.custom) ? raw.custom.filter(isCustomServer) : [],
    };
  } catch {
    return { enabled: [], custom: [] };
  }
}

function isCustomServer(value: unknown): value is CustomMcpServer {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    CUSTOM_MCP_NAME.test(v.name) &&
    typeof v.url === "string" &&
    /^https?:\/\//.test(v.url) &&
    (v.token === undefined || typeof v.token === "string")
  );
}

/**
 * 画面から届いた選択を確かめて保存する。足したサーバーで token が省かれていれば、同じ名前の保存済みトークンを引き継ぐ
 * （画面にはトークンを返していないので、URLだけ直したときに消えないように）
 */
export async function writeMcpSettings(input: unknown): Promise<McpSettings> {
  if (!input || typeof input !== "object") throw new McpSettingsError("settings are required");
  const body = input as { enabled?: unknown; custom?: unknown };
  if (!Array.isArray(body.enabled) || !body.enabled.every((n) => typeof n === "string")) {
    throw new McpSettingsError("enabled must be a list of names");
  }
  if (!Array.isArray(body.custom) || body.custom.length > MAX_CUSTOM) {
    throw new McpSettingsError(`custom must be a list of up to ${MAX_CUSTOM} servers`);
  }
  const previous = await readMcpSettings();
  const custom: CustomMcpServer[] = [];
  for (const entry of body.custom as Record<string, unknown>[]) {
    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    const url = typeof entry?.url === "string" ? entry.url.trim() : "";
    if (!CUSTOM_MCP_NAME.test(name))
      throw new McpSettingsError(`名前は英数字・-・_ の40文字以内にしてください: ${name}`);
    if (RESERVED_NAMES.includes(name) || custom.some((c) => c.name === name)) {
      throw new McpSettingsError(`名前が重なっています: ${name}`);
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new McpSettingsError(`URL が読めません: ${url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new McpSettingsError(`URL は http(s) にしてください: ${url}`);
    }
    const token =
      typeof entry.token === "string" ? entry.token.trim() : previous.custom.find((c) => c.name === name)?.token;
    custom.push({ name, url: parsed.toString(), ...(token ? { token } : {}) });
  }
  const enabled = [...new Set(body.enabled as string[])].sort();
  // 道具ごとに何を許すかは、音声の道具の確かめ（voiceGuard）の設定で決める
  const settings: McpSettings = { enabled, custom };
  await mkdir(config.dataDir, { recursive: true });
  // トークンを含むので、書きかけのファイルを読まれないよう置き換えで保存する
  const tmp = `${settingsPath()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
  await rename(tmp, settingsPath());
  return settings;
}

/** 画面に返す形（トークンは持っているかどうかだけ） */
export function publicMcpSettings(settings: McpSettings) {
  return {
    enabled: settings.enabled,
    custom: settings.custom.map(({ name, url, token }) => ({ name, url, hasToken: Boolean(token) })),
  };
}

export function parseMcpCatalog(message: Record<string, unknown>): McpCatalog {
  const servers = Array.isArray(message.servers) ? message.servers : [];
  return {
    servers: servers
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object" && typeof s.name === "string")
      .map((s) => ({
        name: s.name as string,
        kind: s.kind === "connector" ? "connector" : "local",
        target: typeof s.target === "string" ? s.target : "",
        status: s.status === "connected" || s.status === "needs-auth" ? s.status : "failed",
        available: s.available === true,
      })),
    scannedAt: typeof message.scannedAt === "string" ? message.scannedAt : null,
    error: typeof message.error === "string" ? message.error : null,
  };
}
