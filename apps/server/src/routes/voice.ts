import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAdmin, viewerOf } from "./auth.js";
import type { WebSocket } from "ws";
import { agentBearerMatches } from "../agentToken.js";
import { ServiceError } from "../serviceError.js";
import {
  MAX_ATTACHMENT_BYTES,
  attachmentVisibleTo,
  readAttachment,
  resolveAttachments,
  saveAttachment,
} from "../voiceAttachments.js";
import { appendTurn, conversationOwner, readConversations, readConversationTurns, readRecentTurns } from "../voiceHistory.js";
import {
  McpSettingsError,
  parseMcpCatalog,
  publicMcpSettings,
  readMcpSettings,
  writeMcpSettings,
  type McpCatalog,
} from "../voiceMcp.js";
import {
  deletePersona,
  deletePersonaIcon,
  exportPersonaPackage,
  importPersonaPackage,
  MAX_ICON_BYTES,
  personaWarnings,
  writePersonaIcon,
} from "../voicePersonaPackages.js";
import { readDefaultPersonaId, readPersonas, setPersonaEnabled, writeDefaultPersonaId } from "../voicePersonas.js";
import { broadcast, broadcastFor, isClientId, sendToClient } from "../ws.js";
import { onGuestChange, readGuardSettings } from "../voiceGuard.js";
import { requestLocale } from "../locale.js";

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
  /** いまのやり取りの会話（Claude Code の会話のID）。画面のチャットは自分が表示している会話のものだけを出す */
  conversationId: string | null;
  /** 誰の会話か（自分の画面から話しかけた人。部屋のマイク・ダッシュボード端末なら null）。ほかの人の画面には中身を出さない */
  owner: string | null;
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
  conversationId: null,
  owner: null,
});

let snapshot = idleSnapshot();
let agent: WebSocket | null = null;
// エージェントが確かめたキャラクターの問題（ウェイクワードが音声認識の語彙に無い、など）
let agentPersonaWarnings: Record<string, string[]> = {};
// エージェントが確定したキャラクターごとの表情（共通の表情と、身振りの推測を済ませたもの）。「動きを確認」で使う
let agentPersonaExpressions: Record<string, { expressions: Record<string, unknown> }> = {};
// エージェントが調べた、Claude に使わせられるコネクター・MCPサーバーの一覧（設定画面で選ぶ）
let mcpCatalog: McpCatalog | null = null;
let mcpScanning = false;

/** ほかの人の会話は、その画面では何も起きていないように見せる（言葉も、話していること自体も出さない） */
function redact(value: VoiceSnapshot): VoiceSnapshot {
  return { ...idleSnapshot(), connected: value.connected };
}

function snapshotFor(viewer: string | null): VoiceSnapshot {
  return snapshot.owner === null || snapshot.owner === viewer ? snapshot : redact(snapshot);
}

function publish(next: VoiceSnapshot): void {
  snapshot = next;
  broadcastFor(snapshot.owner, { type: "voice", snapshot }, { type: "voice", snapshot: redact(snapshot) });
}

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parseOwner(value: unknown): string | null {
  return typeof value === "string" && ACCOUNT_ID.test(value) ? value : null;
}

/**
 * 画面から話しかけたときの会話の持ち主と、続ける会話。選んだ会話がほかの人のものなら null を返して断る。
 * 続ける会話の持ち主はその会話のもの（家族の会話を自分の画面で続けても家族の会話のまま）、新しい会話なら話しかけた人
 */
async function resolveConversation(
  request: FastifyRequest,
  conversationId: string | null,
): Promise<{ owner: string | null } | null> {
  const viewer = viewerOf(request);
  if (!conversationId) return { owner: viewer };
  const owner = await conversationOwner(conversationId);
  if (owner === undefined) return { owner: viewer };
  return owner === null || owner === viewer ? { owner } : null;
}

/** 画面（ブラウザ）から話しかけたときの、返答の声の鳴らし先。host: ホストのスピーカー / browser: 話しかけた画面 / none: 鳴らさない */
type ReplySpeech = "host" | "browser" | "none";
const REPLY_SPEECH: ReplySpeech[] = ["host", "browser", "none"];

// ブラウザで録った声（16kHz mono s16le）の長さの上限。エージェント側（BROWSER_AUDIO_MAX_S）と揃える
const BROWSER_AUDIO_MAX_BYTES = 30 * 16000 * 2;

/** 指定が無い・読めないときはこれまでどおりホストのスピーカーで鳴らす。返答を届ける画面が分からなければ browser にはしない */
function parseReply(speech: unknown, clientId: unknown): { speech: ReplySpeech; clientId: string | null } {
  const kind = REPLY_SPEECH.includes(speech as ReplySpeech) ? (speech as ReplySpeech) : "host";
  if (kind === "browser" && !isClientId(clientId)) return { speech: "host", clientId: null };
  return {
    speech: kind,
    clientId: kind === "browser" ? (clientId as string) : null,
  };
}

// 画面のチャットが選んだ会話のID。新しい会話は画面が UUID を決めて送ってくる（エージェントがそのIDで Claude Code の会話を始める）
const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parseConversationId(value: unknown): string | null {
  return typeof value === "string" && CONVERSATION_ID.test(value) ? value : null;
}

/** 話しかける相手。指定が無い・知らないキャラクターなら既定のキャラクター（「@名前」はエージェントが本文から読む） */
async function resolvePersonaId(requested: unknown): Promise<string> {
  const personas = await readPersonas();
  if (typeof requested === "string" && personas.some((persona) => persona.id === requested)) return requested;
  return readDefaultPersonaId(personas);
}

export function sendToAgent(message: unknown): boolean {
  if (!agent || agent.readyState !== agent.OPEN) return false;
  agent.send(JSON.stringify(message));
  return true;
}

export async function registerVoiceRoutes(app: FastifyInstance): Promise<void> {
  // ゲストモードの間は、エージェントが記録の残らない会話に切り替える
  onGuestChange((guest) => sendToAgent({ type: "privacy", guest }));

  // キャラクターのパッケージはZIPのまま受け取る（multipart を使わず、ファイルをそのまま送ってもらう）
  app.addContentTypeParser(
    ["application/zip", "application/x-zip-compressed"],
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );
  // キャラクターのアイコン（画面で作った・選んだPNG）
  app.addContentTypeParser("image/png", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
  // ブラウザで録った声も、そのままのバイト列で受け取る
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) =>
    done(null, body),
  );

  app.get("/ws/voice-agent", { websocket: true }, (socket, request) => {
    // トークンは Authorization ヘッダーで受ける（URL に載せるとアクセスのログに残る）
    if (!agentBearerMatches(request.headers.authorization)) {
      socket.close(4401, "invalid token");
      return;
    }
    // エージェントは1つだけの想定。再接続などで新しいものが来たら古い接続を閉じる
    agent?.close(4000, "replaced by a new agent connection");
    agent = socket;
    app.log.info("voice agent connected");
    // 使うコネクター・MCPサーバーは画面で選んでここに保存しているので、つなぐたびに渡す
    readMcpSettings()
      .then((settings) => sendToAgent({ type: "mcp-settings", ...settings }))
      .catch((err) => app.log.error(err, "failed to read MCP settings"));
    readGuardSettings()
      .then((settings) => sendToAgent({ type: "privacy", guest: settings.guest }))
      .catch((err) => app.log.error(err, "failed to read voice guard settings"));

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "lipsync") {
          // 読み上げる1文ごとの口の形の時系列。覚えておく必要は無いのでそのまま画面へ流す
          if (!Array.isArray(message.cues) || typeof message.durationS !== "number") return;
          // ほかの人の会話の口の動きは、その人の画面にだけ送る
          broadcastFor(snapshot.owner, {
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
        if (message.type === "audio" || message.type === "audio-stop") {
          // 返答の声をブラウザで鳴らすとき。話しかけた画面にだけ届ける（ほかの画面では鳴らさない）
          if (!isClientId(message.clientId)) return;
          if (message.type === "audio-stop") {
            sendToClient(message.clientId, { type: "voice-audio-stop" });
          } else if (typeof message.wav === "string") {
            const sent = sendToClient(message.clientId, {
              type: "voice-audio",
              turnId: message.turnId ?? null,
              wav: message.wav,
            });
            if (!sent)
              app.log.warn({ clientId: message.clientId }, "reply audio not delivered: screen is not connected");
          }
          return;
        }
        if (message.type === "turn") {
          // 誰がどこから話しかけられて何に答えたか。キャラクター同士で共有する会話の記憶として残す
          // （ゲストモードの間は残さない。エージェントも guest を付けてくる）
          readGuardSettings()
            .then((settings) => (settings.guest || message.guest === true ? null : appendTurn(message.record ?? {})))
            .then((record) => record && broadcastFor(record.owner, { type: "voice-history", record }))
            .catch((err) => app.log.error(err, "failed to record voice turn"));
          return;
        }
        if (message.type === "mcp-catalog") {
          mcpCatalog = parseMcpCatalog(message);
          mcpScanning = false;
          broadcast({ type: "voice-mcp" });
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
          conversationId: typeof message.conversationId === "string" ? message.conversationId : null,
          owner: parseOwner(message.owner),
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
      mcpScanning = false;
      broadcast({ type: "voice-mcp" });
    });
  });

  app.get("/api/voice/state", async (request) => snapshotFor(viewerOf(request)));

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
          // アイコンのURLに付けて、置き換えたら読み直させる（無ければ null）
          iconVersion: persona.iconVersion,
          hasPrompt: persona.hasPrompt,
          builtIn: persona.builtIn,
          enabled: persona.enabled,
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
    if (err instanceof ServiceError)
      return reply.code(err.statusCode).send({ error: err.messageFor(requestLocale(reply.request.headers.cookie)) });
    throw err;
  };
  // キャラクター・既定の話し相手・Claude の道具は家の全員で共有するので、変えるのは管理者だけ（使うのは誰でも）
  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      requireAdmin(request);
    } catch (err) {
      return sendServiceError(err, reply);
    }
  };


  // キャラクターのパッケージ（persona.json・prompt.md・avatar.vrm のZIP）を取り込む。同じIDがあれば replace=true で上書き
  app.post<{ Querystring: { replace?: string } }>(
    "/api/voice/personas/import",
    { bodyLimit: 150 * 1024 * 1024, preHandler: adminOnly },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) return reply.code(400).send({ error: requestLocale(request.headers.cookie) === "en" ? "Send a ZIP file" : "ZIPファイルを送ってください" });
      try {
        const result = await importPersonaPackage(new Uint8Array(request.body), {
          replace: request.query.replace === "true",
        });
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

  app.delete<{ Params: { personaId: string } }>("/api/voice/personas/:personaId", { preHandler: adminOnly }, async (request, reply) => {
    try {
      await deletePersona(request.params.personaId);
      personasChanged();
      return { ok: true };
    } catch (err) {
      return sendServiceError(err, reply);
    }
  });

  // キャラクターの入／切。エージェントは common.json の変化で読み直す（念のため読み直しも頼む）
  app.put<{ Params: { personaId: string }; Body: { enabled?: unknown } }>(
    "/api/voice/personas/:personaId",
    { preHandler: adminOnly },
    async (request, reply) => {
      if (typeof request.body?.enabled !== "boolean")
        return reply.code(400).send({ error: "enabled must be a boolean" });
      try {
        await setPersonaEnabled(request.params.personaId, request.body.enabled);
        personasChanged();
        return { ok: true };
      } catch (err) {
        return sendServiceError(err, reply);
      }
    },
  );

  app.put<{ Body: { defaultPersonaId?: unknown } }>("/api/voice/settings", { preHandler: adminOnly }, async (request, reply) => {
    const personas = await readPersonas();
    const id = request.body?.defaultPersonaId;
    if (typeof id !== "string" || !personas.some((persona) => persona.id === id && persona.enabled)) {
      return reply.code(400).send({ error: "unknown persona" });
    }
    await writeDefaultPersonaId(id);
    // 他の端末の設定画面・マイクボタンの表示にも反映する
    broadcast({ type: "voice-personas" });
    return { ok: true };
  });

  // 直近のやり取り（見てよい会話から）。conversationId を付けるとその会話のやり取りだけ（古い順）。
  // 画面には家族みんなの会話と自分の会話を、音声エージェントには owner に渡した人の分（無ければ家族みんなの会話だけ）を返す
  app.get<{ Querystring: { limit?: string; conversationId?: string; owner?: string } }>(
    "/api/voice/history",
    async (request, reply) => {
      const viewer = request.auth ? viewerOf(request) : parseOwner(request.query.owner);
      if (request.query.conversationId !== undefined) {
        const conversationId = parseConversationId(request.query.conversationId);
        if (!conversationId) return reply.code(400).send({ error: "invalid conversationId" });
        const limit = Math.min(500, Math.max(1, Number(request.query.limit) || 200));
        return { records: await readConversationTurns(conversationId, limit, viewer) };
      }
      const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 20));
      return { records: await readRecentTurns(limit, viewer) };
    },
  );

  // チャットで選べる会話の一覧（見てよい記録を会話ごとにまとめたもの。最近話した会話から）
  app.get<{ Querystring: { limit?: string } }>("/api/voice/conversations", async (request) => {
    const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 50));
    return { conversations: await readConversations(limit, viewerOf(request)) };
  });

  // チャットに出すキャラクターのアイコン。無ければ404で、画面は名前の頭文字を出す
  app.get<{ Params: { personaId: string } }>("/api/voice/personas/:personaId/icon", async (request, reply) => {
    const persona = (await readPersonas()).find((p) => p.id === request.params.personaId);
    if (!persona?.iconPath) return reply.code(404).send({ error: "icon not found" });
    // URL に iconVersion を付けて読むので、同じURLの間は変わらない
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.type("image/png").send(createReadStream(persona.iconPath));
  });

  app.put<{ Params: { personaId: string } }>(
    "/api/voice/personas/:personaId/icon",
    { bodyLimit: MAX_ICON_BYTES + 1024, preHandler: adminOnly },
    async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) return reply.code(400).send({ error: requestLocale(request.headers.cookie) === "en" ? "Send a PNG image" : "PNG画像を送ってください" });
      try {
        await writePersonaIcon(request.params.personaId, request.body);
      } catch (err) {
        return sendServiceError(err, reply);
      }
      broadcast({ type: "voice-personas" });
      return { ok: true };
    },
  );

  app.delete<{ Params: { personaId: string } }>(
    "/api/voice/personas/:personaId/icon",
    { preHandler: adminOnly },
    async (request, reply) => {
      try {
        await deletePersonaIcon(request.params.personaId);
      } catch (err) {
        return sendServiceError(err, reply);
      }
      broadcast({ type: "voice-personas" });
      return { ok: true };
    },
  );

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

  // 画面からテキストで話しかける（マイクが無い端末や、声を出せない場面向け）。
  // personaId で答えるキャラクターを選べる（省略時は既定のキャラクター。本文の「@名前」が優先）。
  // conversationId を渡すとその会話で答える（チャットで選んだ会話。省略時はウェイクワードと同じ今の会話）。
  // speech で返答の声の鳴らし先を選べる（browser なら clientId の画面にだけ声を届ける）
  app.post<{
    Body: {
      text?: unknown;
      speech?: unknown;
      clientId?: unknown;
      personaId?: unknown;
      conversationId?: unknown;
      /** 先に /api/voice/attachments に置いたファイルの id（5つまで） */
      attachments?: unknown;
    };
  }>("/api/voice/ask", async (request, reply) => {
    const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";
    let attachments;
    try {
      attachments = await resolveAttachments(request.body?.attachments, viewerOf(request));
    } catch (err) {
      return sendServiceError(err, reply);
    }
    if (!text && attachments.length === 0) return reply.code(400).send({ error: "text is required" });
    if (text.length > 2000) return reply.code(400).send({ error: "text is too long" });
    const personaId = await resolvePersonaId(request.body?.personaId);
    const conversationId = parseConversationId(request.body?.conversationId);
    const replyTo = parseReply(request.body?.speech, request.body?.clientId);
    const conversation = await resolveConversation(request, conversationId);
    if (!conversation) return reply.code(404).send({ error: "conversation not found" });
    if (
      !sendToAgent({
        type: "ask",
        text,
        attachments: attachments.map(({ id, name, type, kind }) => ({ id, name, type, kind })),
        personaId,
        conversationId,
        reply: replyTo,
        // 画面から話しかけた人（道具の確かめで、家の人の情報を出してよいかを決めるのに使う）。
        // 家族みんなの会話を続けるときは、答えが家族みんなの記録に残るので部屋のマイクと同じ扱いにする
        accountId: conversation.owner,
        // 会話の持ち主（記録を見せる相手。持ち主が変われば、エージェントは別の会話にする）
        owner: conversation.owner,
      })
    ) {
      return reply.code(503).send({ error: "voice agent is not connected" });
    }
    return { ok: true };
  });

  // チャットに添えるファイル（画像・PDF・テキスト）。本文はファイルそのもので、名前は name で渡す。
  // 返した id を /api/voice/ask の attachments に入れて話しかける
  app.post<{ Querystring: { name?: string } }>(
    "/api/voice/attachments",
    { bodyLimit: MAX_ATTACHMENT_BYTES + 1024 },
    async (request, reply) => {
      try {
        return { attachment: await saveAttachment(request.body, request.query.name, viewerOf(request)) };
      } catch (err) {
        return sendServiceError(err, reply);
      }
    },
  );

  // 添えたファイルを返す（記録の画像を見せる・エージェントが取りに来る）。画像だけをその場で表示させ、ほかは保存させる
  app.get<{ Params: { id: string } }>("/api/voice/attachments/:id", async (request, reply) => {
    const found = await readAttachment(request.params.id);
    // 画面からは、家族みんなのものと自分が置いたものだけ（エージェントは会話に添えられたものを取りに来る）
    if (!found || (request.auth && !attachmentVisibleTo(found.info, viewerOf(request))))
      return reply.code(404).send({ error: "not found" });
    const { info, data } = found;
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "private, max-age=86400");
    if (info.kind !== "image")
      reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(info.name)}`);
    return reply.type(info.kind === "image" ? info.type : "application/octet-stream").send(data);
  });

  // 画面（ブラウザ）のマイクで録った声で話しかける。本文は 16kHz mono s16le の PCM。
  // 書き起こしはホストの音声エージェント（whisper）が行う。speech・clientId・personaId・conversationId は /api/voice/ask と同じ
  app.post<{
    Querystring: {
      speech?: string;
      clientId?: string;
      personaId?: string;
      conversationId?: string;
    };
  }>("/api/voice/ask-audio", { bodyLimit: BROWSER_AUDIO_MAX_BYTES + 1024 }, async (request, reply) => {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      return reply.code(400).send({ error: "audio is required" });
    }
    if (request.body.length > BROWSER_AUDIO_MAX_BYTES) return reply.code(400).send({ error: "audio is too long" });
    const personaId = await resolvePersonaId(request.query.personaId);
    const conversationId = parseConversationId(request.query.conversationId);
    const replyTo = parseReply(request.query.speech, request.query.clientId);
    const conversation = await resolveConversation(request, conversationId);
    if (!conversation) return reply.code(404).send({ error: "conversation not found" });
    // 端末ごとにマイクの癖が違うので、うまく聞き取れなかったときに見返せるよう、どの端末からかを残す
    request.log.info(
      {
        userAgent: request.headers["user-agent"],
        bytes: request.body.length,
      },
      "browser voice received",
    );
    if (
      !sendToAgent({
        type: "ask-audio",
        audio: request.body.toString("base64"),
        personaId,
        conversationId,
        reply: replyTo,
        accountId: conversation.owner,
        owner: conversation.owner,
      })
    ) {
      return reply.code(503).send({ error: "voice agent is not connected" });
    }
    return { ok: true };
  });

  // Claude に使わせるコネクター・MCPサーバー。一覧はエージェントから、どれを使うかはここに保存したもの
  app.get("/api/voice/mcp", async () => ({
    connected: Boolean(agent),
    scanning: mcpScanning,
    catalog: mcpCatalog,
    ...publicMcpSettings(await readMcpSettings()),
  }));

  app.put("/api/voice/mcp", { preHandler: adminOnly }, async (request, reply) => {
    let settings;
    try {
      settings = await writeMcpSettings(request.body);
    } catch (err) {
      if (err instanceof McpSettingsError) return reply.code(400).send({ error: err.message });
      throw err;
    }
    // つながっていなければ、次につないだときに渡る
    sendToAgent({ type: "mcp-settings", ...settings });
    broadcast({ type: "voice-mcp" });
    return publicMcpSettings(settings);
  });

  // 一覧を取り直す（claude.ai でコネクターをつないだ・ホストで claude mcp add した後など）。結果は voice-mcp で知らせる
  app.post("/api/voice/mcp/scan", { preHandler: adminOnly }, async (_request, reply) => {
    if (!sendToAgent({ type: "mcp-scan" })) return reply.code(503).send({ error: "voice agent is not connected" });
    mcpScanning = true;
    broadcast({ type: "voice-mcp" });
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
