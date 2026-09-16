import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { config } from "../config.js";
import { broadcast } from "../ws.js";

/**
 * 音声アシスタント（apps/voice-agent）と画面をつなぐ中継。
 *
 * マイク・スピーカーを扱うエージェントはホスト上で常駐し、`/ws/voice-agent` に接続してくる。
 * 状態（聞いている / 考えている / 話している…）の正はエージェント側にあり、ここは最新の状態を覚えて
 * 画面（`/ws` の全クライアント）に配信するのと、画面からの操作をエージェントへ渡すだけにしている。
 */

type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

interface VoiceSnapshot {
  connected: boolean;
  state: VoiceState;
  turnId: string | null;
  transcript: string;
  response: string;
  error: string | null;
  wakePhrase: string | null;
}

const idleSnapshot = (): VoiceSnapshot => ({
  connected: false,
  state: "idle",
  turnId: null,
  transcript: "",
  response: "",
  error: null,
  wakePhrase: null,
});

let snapshot = idleSnapshot();
let agent: WebSocket | null = null;

function publish(next: VoiceSnapshot): void {
  snapshot = next;
  broadcast({ type: "voice", snapshot });
}

function tokenMatches(given: string | undefined): boolean {
  const expected = config.voice.agentToken;
  if (!expected) return true;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sendToAgent(message: unknown): boolean {
  if (!agent || agent.readyState !== agent.OPEN) return false;
  agent.send(JSON.stringify(message));
  return true;
}

export async function registerVoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { token?: string } }>("/ws/voice-agent", { websocket: true }, (socket, request) => {
    if (!tokenMatches(request.query.token)) {
      socket.close(4401, "invalid token");
      return;
    }
    // エージェントは1つだけの想定。再接続などで新しいものが来たら古い接続を閉じる
    agent?.close(4000, "replaced by a new agent connection");
    agent = socket;
    app.log.info("voice agent connected");

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type !== "state") return;
        publish({
          connected: true,
          state: message.state,
          turnId: message.turnId ?? null,
          transcript: message.transcript ?? "",
          response: message.response ?? "",
          error: message.error ?? null,
          wakePhrase: message.wakePhrase ?? null,
        });
      } catch {
        // ignore malformed messages
      }
    });

    socket.on("close", () => {
      if (agent !== socket) return;
      agent = null;
      app.log.info("voice agent disconnected");
      publish(idleSnapshot());
    });
  });

  app.get("/api/voice/state", async () => snapshot);

  // 画面からテキストで話しかける（マイクが無い端末や、声を出せない場面向け）
  app.post<{ Body: { text?: unknown } }>("/api/voice/ask", async (request, reply) => {
    const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";
    if (!text) return reply.code(400).send({ error: "text is required" });
    if (text.length > 2000) return reply.code(400).send({ error: "text is too long" });
    if (!sendToAgent({ type: "ask", text })) return reply.code(503).send({ error: "voice agent is not connected" });
    return { ok: true };
  });

  app.post("/api/voice/cancel", async (_request, reply) => {
    if (!sendToAgent({ type: "cancel" })) return reply.code(503).send({ error: "voice agent is not connected" });
    return { ok: true };
  });
}
