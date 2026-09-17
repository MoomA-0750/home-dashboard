import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { WebSocket } from "ws";
import { agentTokenMatches } from "../agentToken.js";
import { ServiceError } from "../serviceError.js";
import { appendTurn, readRecentTurns } from "../voiceHistory.js";
import { deletePersona, exportPersonaPackage, importPersonaPackage, personaWarnings } from "../voicePersonaPackages.js";
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
// エージェントが確かめたキャラクターの問題（ウェイクワードが音声認識の語彙に無い、など）
let agentPersonaWarnings: Record<string, string[]> = {};
// エージェントが確定したキャラクターごとの表情（共通の表情と、身振りの推測を済ませたもの）。「動きを確認」で使う
let agentPersonaExpressions: Record<string, { expressions: Record<string, unknown> }> = {};

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
  // キャラクターのパッケージはZIPのまま受け取る（multipart を使わず、ファイルをそのまま送ってもらう）
  app.addContentTypeParser(["application/zip", "application/x-zip-compressed"], { parseAs: "buffer" }, (_request, body, done) =>
    done(null, body),
  );

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
            // 強調の時刻と強さ（VOICEVOX のアクセント核から）。アバターがうなずき・手の振りを合わせる
            beats: Array.isArray(message.beats) ? message.beats : [],
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
        if (message.type === "personas-info") {
          if (message.personas && typeof message.personas === "object") {
            agentPersonaExpressions = message.personas;
            broadcast({ type: "voice-personas" });
          }
          return;
        }
        if (message.type !== "state") return;
        if (message.personaWarnings && typeof message.personaWarnings === "object") {
          const changed = JSON.stringify(message.personaWarnings) !== JSON.stringify(agentPersonaWarnings);
          agentPersonaWarnings = message.personaWarnings;
          if (changed) broadcast({ type: "voice-personas" });
        }
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
      personas: await Promise.all(
        personas.map(async (persona) => ({
          id: persona.id,
          name: persona.name,
          wakePhrase: persona.wakePhrase,
          hasAvatar: persona.avatarPath !== null,
          hasPrompt: persona.hasPrompt,
          builtIn: persona.builtIn,
          rig: persona.meta?.rig ?? null,
          // エージェントが起動していなければ、persona.json に書いた分だけ
          expressions: agentPersonaExpressions[persona.id]?.expressions ?? persona.meta?.expressions ?? {},
          warnings: [...(await personaWarnings(persona)), ...(agentPersonaWarnings[persona.id] ?? [])],
        })),
      ),
    };
  });

  // キャラクターが増減したら、画面の一覧を取り直させ、エージェントに読み直させる
  const personasChanged = () => {
    broadcast({ type: "voice-personas" });
    sendToAgent({ type: "reload-personas" });
  };

  const sendServiceError = (err: unknown, reply: FastifyReply) => {
    if (err instanceof ServiceError) return reply.code(err.statusCode).send({ error: err.message });
    throw err;
  };

  // キャラクターのパッケージ（persona.json・prompt.md・avatar.vrm のZIP）を取り込む。同じIDがあれば replace=true で上書き
  app.post<{ Querystring: { replace?: string } }>(
    "/api/voice/personas/import",
    { bodyLimit: 150 * 1024 * 1024 },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) return reply.code(400).send({ error: "ZIPファイルを送ってください" });
      try {
        const result = await importPersonaPackage(new Uint8Array(request.body), { replace: request.query.replace === "true" });
        personasChanged();
        return result;
      } catch (err) {
        return sendServiceError(err, reply);
      }
    },
  );

  app.get<{ Params: { personaId: string } }>("/api/voice/personas/:personaId/export", async (request, reply) => {
    try {
      const { zip } = await exportPersonaPackage(request.params.personaId);
      return reply
        .type("application/zip")
        .header("Content-Disposition", `attachment; filename="${request.params.personaId}.zip"`)
        .send(Buffer.from(zip));
    } catch (err) {
      return sendServiceError(err, reply);
    }
  });

  app.delete<{ Params: { personaId: string } }>("/api/voice/personas/:personaId", async (request, reply) => {
    try {
      await deletePersona(request.params.personaId);
      personasChanged();
      return { ok: true };
    } catch (err) {
      return sendServiceError(err, reply);
    }
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
