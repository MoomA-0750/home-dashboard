import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { agentTokenMatches } from "../agentToken.js";
import { appendTurn, readRecentTurns } from "../voiceHistory.js";
import { readDefaultPersonaId, readPersonas, writeDefaultPersonaId } from "../voicePersonas.js";
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
  /** 返答の直後で、ウェイクワード無しで続けて話せる間 */
  followUp: boolean;
  /** いま応答しているキャラクター */
  personaId: string | null;
  personaName: string | null;
}

const idleSnapshot = (): VoiceSnapshot => ({
  connected: false,
  state: "idle",
  turnId: null,
  transcript: "",
  response: "",
  error: null,
  followUp: false,
  personaId: null,
  personaName: null,
});

let snapshot = idleSnapshot();
let agent: WebSocket | null = null;

function publish(next: VoiceSnapshot): void {
  snapshot = next;
  broadcast({ type: "voice", snapshot });
}

function sendToAgent(message: unknown): boolean {
  if (!agent || agent.readyState !== agent.OPEN) return false;
  agent.send(JSON.stringify(message));
  return true;
}

export async function registerVoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { token?: string } }>("/ws/voice-agent", { websocket: true }, (socket, request) => {
    if (!agentTokenMatches(request.query.token)) {
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
        if (message.type === "lipsync") {
          // 読み上げる1文ごとの口の形の時系列。覚えておく必要は無いのでそのまま画面へ流す
          if (!Array.isArray(message.cues) || typeof message.durationS !== "number") return;
          broadcast({
            type: "voice-lipsync",
            turnId: message.turnId ?? null,
            cues: message.cues,
            durationS: message.durationS,
            // その文を読み上げる間の表情（VRMの表情名と重み）。指定が無ければ null
            expression: message.expression ?? null,
          });
          return;
        }
        if (message.type === "turn") {
          // 誰がどこから話しかけられて何に答えたか。キャラクター同士で共有する会話の記憶として残す
          appendTurn(message.record ?? {})
            .then((record) => record && broadcast({ type: "voice-history", record }))
            .catch((err) => app.log.error(err, "failed to record voice turn"));
          return;
        }
        if (message.type !== "state") return;
        publish({
          connected: true,
          state: message.state,
          turnId: message.turnId ?? null,
          transcript: message.transcript ?? "",
          response: message.response ?? "",
          error: message.error ?? null,
          followUp: Boolean(message.followUp),
          personaId: message.personaId ?? null,
          personaName: message.personaName ?? null,
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

  // キャラクターの一覧と、画面のマイクボタン・文字入力で応答する既定のキャラクター
  app.get("/api/voice/personas", async () => {
    const personas = await readPersonas();
    return {
      defaultPersonaId: await readDefaultPersonaId(personas),
      personas: personas.map(({ avatarPath, ...persona }) => ({ ...persona, hasAvatar: avatarPath !== null })),
    };
  });

  app.put<{ Body: { defaultPersonaId?: unknown } }>("/api/voice/settings", async (request, reply) => {
    const personas = await readPersonas();
    const id = request.body?.defaultPersonaId;
    if (typeof id !== "string" || !personas.some((persona) => persona.id === id)) {
      return reply.code(400).send({ error: "unknown persona" });
    }
    await writeDefaultPersonaId(id);
    // 他の端末の設定画面・マイクボタンの表示にも反映する
    broadcast({ type: "voice-personas" });
    return { ok: true };
  });

  app.get<{ Querystring: { limit?: string } }>("/api/voice/history", async (request) => {
    const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 20));
    return { records: await readRecentTurns(limit) };
  });

  // キャラクターのVRMアバター。置いていなければ404で、画面は円だけを出す。
  // 数十MBあるので、ファイルが変わらない限りブラウザのキャッシュを使わせる
  app.get<{ Params: { personaId: string } }>("/api/voice/avatars/:personaId", async (request, reply) => {
    const persona = (await readPersonas()).find((p) => p.id === request.params.personaId);
    const info = persona?.avatarPath ? await stat(persona.avatarPath).catch(() => null) : null;
    if (!persona?.avatarPath || !info?.isFile()) return reply.code(404).send({ error: "avatar not found" });
    const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    reply.header("ETag", etag).header("Cache-Control", "no-cache");
    if (request.headers["if-none-match"] === etag) return reply.code(304).send();
    return reply
      .type("model/gltf-binary")
      .header("Content-Length", info.size)
      .send(createReadStream(persona.avatarPath));
  });

  // 画面からテキストで話しかける（マイクが無い端末や、声を出せない場面向け）。応答するのは既定のキャラクター
  app.post<{ Body: { text?: unknown } }>("/api/voice/ask", async (request, reply) => {
    const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";
    if (!text) return reply.code(400).send({ error: "text is required" });
    if (text.length > 2000) return reply.code(400).send({ error: "text is too long" });
    const personaId = await readDefaultPersonaId(await readPersonas());
    if (!sendToAgent({ type: "ask", text, personaId })) {
      return reply.code(503).send({ error: "voice agent is not connected" });
    }
    return { ok: true };
  });

  // 画面のマイクボタン。ウェイクワード無しで、既定のキャラクターが聞き始める
  app.post("/api/voice/listen", async (_request, reply) => {
    const personaId = await readDefaultPersonaId(await readPersonas());
    if (!sendToAgent({ type: "listen", personaId })) {
      return reply.code(503).send({ error: "voice agent is not connected" });
    }
    return { ok: true };
  });

  app.post("/api/voice/cancel", async (_request, reply) => {
    if (!sendToAgent({ type: "cancel" })) return reply.code(503).send({ error: "voice agent is not connected" });
    return { ok: true };
  });
}
