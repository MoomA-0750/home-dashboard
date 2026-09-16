import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agentTokenMatches } from "../agentToken.js";
import { config } from "../config.js";
import { ServiceError } from "../serviceError.js";
import { callHomeAssistantService, getClimate, getControls } from "./homeassistant.js";
import { controlSpotify, getNowPlaying } from "./spotify.js";
import { getWeather } from "./weather.js";

/**
 * 音声アシスタント（apps/voice-agent が起動する Claude Code）に、ダッシュボードの機能をツールとして渡すMCPサーバー。
 *
 * Claude に Bash や任意のHTTPアクセスを許す代わりに、ここで定義した操作だけを使わせる。
 * 中身はウィジェット用のAPIと同じ関数なので、Home Assistant のサービスのホワイトリストや
 * 解錠の禁止（HOMEASSISTANT_ALLOW_UNLOCK）もそのまま効く。
 * このエンドポイントからできることは既存の /api/* でできることの範囲を超えない。
 */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await fn();
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  } catch (err) {
    const message =
      err instanceof ServiceError ? err.message : `failed: ${err instanceof Error ? err.message : String(err)}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

const HA_ACTIONS = ["turn_on", "turn_off", "toggle", "lock", "unlock", "set_temperature"] as const;

/**
 * 操作できる家電の一覧を、control_home_device の説明に埋め込むための文字列。
 * 先に list_home_devices を呼ばせると「電気つけて」1回にツールが2往復して2秒ほど余計にかかったので、
 * entity_id を最初から教えておき、1往復で操作できるようにする（状態は古くなるので載せない）。
 * HAにつながらないときは載せない（そのときは list_home_devices で調べさせる）。
 */
async function describeKnownDevices(): Promise<string> {
  try {
    const { configured, entities } = await getControls();
    if (!configured || entities.length === 0) return "";
    const lines = entities.map((e) => `${e.entityId}（${e.name}）`).join("、");
    return `この家の家電: ${lines}。`;
  } catch {
    return "";
  }
}

/** 解錠の可否は設定（HOMEASSISTANT_ALLOW_UNLOCK）で変わるので、説明もそれに合わせる */
function describeLockActions(): string {
  return config.homeAssistant.allowUnlock
    ? "lock は lock・unlock（施錠・解錠）"
    : "lock は lock（施錠）のみ。解錠はこの家の設定で禁止されていて実行できない";
}

function createServer(knownDevices: string): McpServer {
  const server = new McpServer({ name: "home-dashboard", version: "0.1.0" });

  server.registerTool(
    "get_weather",
    {
      description:
        "家の地点の天気。現在の気温と天気、今後12時間の降水確率（1時間ごと）、今日・明日・明後日の天気・最高/最低気温・最大降水確率を返す。",
      annotations: { readOnlyHint: true },
    },
    () => run(getWeather),
  );

  server.registerTool(
    "list_home_devices",
    {
      description:
        "Home Assistant の操作できる家電（照明・スイッチ・鍵・エアコン）と、室温・湿度センサーの現在の状態を返す。" +
        "家電を操作する前に entity_id を調べるのに使う。",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(async () => {
        const [controls, climate] = await Promise.all([getControls(), getClimate()]);
        return {
          configured: controls.configured,
          unlockAllowed: controls.allowUnlock,
          devices: controls.entities,
          sensors: climate.sensors,
          thermostats: climate.thermostats,
        };
      }),
  );

  server.registerTool(
    "control_home_device",
    {
      description:
        "Home Assistant の家電を操作する。" +
        (knownDevices || "entity_id は list_home_devices で調べる。") +
        `light/switch は turn_on・turn_off・toggle、${describeLockActions()}、` +
        "climate は turn_on・turn_off・set_temperature（temperature を指定）が使える。",
      inputSchema: {
        entity_id: z.string().describe("操作する家電の entity_id（例: light.living）"),
        action: z.enum(HA_ACTIONS),
        temperature: z.number().optional().describe("set_temperature のときの設定温度（℃）"),
      },
    },
    ({ entity_id, action, temperature }) =>
      run(async () => {
        if (action === "set_temperature" && temperature === undefined) {
          throw new ServiceError(400, "set_temperature requires temperature");
        }
        await callHomeAssistantService(
          entity_id,
          action,
          action === "set_temperature" ? { temperature } : undefined,
        );
        return { ok: true };
      }),
  );

  server.registerTool(
    "get_now_playing",
    {
      description: "Spotify で再生中の曲（曲名・アーティスト・再生中か）を返す。",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(async () => {
        const state = await getNowPlaying();
        const track = state.track && { name: state.track.name, artist: state.track.artist };
        return { configured: state.configured, isPlaying: state.isPlaying, track };
      }),
  );

  server.registerTool(
    "control_music",
    {
      description: "Spotify の再生を操作する（再生・一時停止・次の曲・前の曲）。再生中の端末が無いと失敗する。",
      inputSchema: { action: z.enum(["play", "pause", "next", "previous"]) },
    },
    ({ action }) => run(() => controlSpotify(action)),
  );

  return server;
}

export async function registerMcpRoutes(app: FastifyInstance): Promise<void> {
  // ステートレスで動かす（リクエストごとにサーバーとトランスポートを作る）。
  // 状態はすべてHAやSpotify側にあり、こちらでセッションを持つ理由がない
  app.post("/mcp", async (request, reply) => {
    const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!agentTokenMatches(bearer)) {
      return reply.code(401).send({ error: "invalid token" });
    }
    // 家電の一覧はツール一覧を返すときだけ取りに行く（Claudeの起動時に1回だけ）。
    // ツールを呼ぶたびにHAへ問い合わせると、HAが落ちているときに天気などまで遅くなる
    const body = request.body as { method?: string } | undefined;
    const server = createServer(body?.method === "tools/list" ? await describeKnownDevices() : "");
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // ステートレスなのでサーバーからのSSEストリームやセッション終了は受け付けない
  const methodNotAllowed = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.code(405).send({ error: "method not allowed" });
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);
}
