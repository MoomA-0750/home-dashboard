import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyPassword } from "../accounts.js";
import { requestLocale } from "../locale.js";
import { finishReauth, startReauth } from "../passkeys.js";
import { ServiceError } from "../serviceError.js";
import {
  answerRequest,
  checkToolUse,
  GuardAnswerError,
  GuardSettingsError,
  listGuardTools,
  listPending,
  readGuardSettings,
  setGuestMode,
  waitForAnswer,
  writeGuardSettings,
  type GuardRequest,
} from "../voiceGuard.js";
import { requireAdmin, viewerOf } from "./auth.js";
import { sendToAgent } from "./voice.js";

/**
 * 音声アシスタントの道具の確かめ（voiceGuard）の道。
 * - POST /api/voice/guard・GET …/requests/:id/wait … 音声エージェントだけ（VOICE_AGENT_TOKEN）
 * - 確かめの一覧・答え・本人確認・設定 … ログインしている画面
 */

// 画面での許可を1回に待つ長さ（エージェントは時間切れまで繰り返し待つ）
const WAIT_MS = 50_000;

function str(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function parseGuardRequest(body: unknown): GuardRequest | null {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const tool = str(raw.tool, 200);
  if (!tool) return null;
  return {
    conversationId: str(raw.conversationId, 64) || null,
    turnId: str(raw.turnId, 64),
    source: str(raw.source, 32),
    accountId: str(raw.accountId, 64) || null,
    utterance: str(raw.utterance),
    attachments: raw.attachments === true,
    tool,
    input: raw.input && typeof raw.input === "object" && !Array.isArray(raw.input) ? (raw.input as Record<string, unknown>) : {},
  };
}

const fromAgent = (request: FastifyRequest) => request.fromAgent && request.auth === null;

function sendError(err: unknown, reply: FastifyReply) {
  if (err instanceof ServiceError)
    return reply.code(err.statusCode).send({ error: err.messageFor(requestLocale(reply.request.headers.cookie)) });
  if (err instanceof GuardAnswerError) return reply.code(err.statusCode).send({ error: err.message });
  if (err instanceof GuardSettingsError) return reply.code(400).send({ error: err.message });
  throw err;
}

export async function registerVoiceGuardRoutes(app: FastifyInstance): Promise<void> {
  // Claude Code の「この道具を使ってよいか」（音声エージェントが中継してくる）
  app.post("/api/voice/guard", async (request, reply) => {
    if (!fromAgent(request)) return reply.code(403).send({ error: "voice agent only" });
    const guardRequest = parseGuardRequest(request.body);
    if (!guardRequest) return reply.code(400).send({ error: "tool is required" });
    return checkToolUse(guardRequest);
  });

  app.get<{ Params: { id: string } }>("/api/voice/guard/requests/:id/wait", async (request, reply) => {
    if (!fromAgent(request)) return reply.code(403).send({ error: "voice agent only" });
    return waitForAnswer(request.params.id, WAIT_MS);
  });

  // 画面に出す、答えを待っている確かめ（変わると voice-guard で知らせる）
  // 自分の画面から話しかけた分は、その人の画面にだけ出す
  app.get("/api/voice/guard/requests", async (request) => ({ requests: listPending(viewerOf(request)) }));

  // 許可の前の本人確認（パスキー）の準備
  app.post("/api/voice/guard/reauth/options", async (request, reply) => {
    try {
      if (!request.auth) throw new ServiceError(401, "ログインしてください", "Please sign in");
      return await startReauth(request.auth, request.headers.origin);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  // 確かめへの答え。解錠などの許可（approve）は、パスキーかパスワードでの本人確認が要る
  app.post<{
    Params: { id: string };
    Body: { allow?: unknown; password?: unknown; passkey?: { challengeId?: unknown; response?: unknown } };
  }>("/api/voice/guard/requests/:id/answer", async (request, reply) => {
    try {
      const auth = request.auth;
      if (!auth) throw new ServiceError(401, "ログインしてください", "Please sign in");
      const allow = request.body?.allow === true;
      let verified = false;
      if (allow) {
        if (request.body?.passkey) {
          await finishReauth(auth, request.headers.origin, request.body.passkey.challengeId, request.body.passkey.response);
          verified = true;
        } else if (request.body?.password !== undefined) {
          await verifyPassword(auth.account.id, request.body.password);
          verified = true;
        }
      }
      const answered = answerRequest(request.params.id, allow, auth.account, verified, viewerOf(request));
      // 了承を画面で押したときは、音声アシスタントに続きをさせる（声で「はい」と答えたのと同じ）
      if (allow && answered.kind === "confirm")
        sendToAgent({ type: "guard-confirmed", conversationId: answered.conversationId });
      return { ok: true };
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.get("/api/voice/guard/settings", async () => ({
    settings: await readGuardSettings(),
    tools: await listGuardTools(),
  }));

  // 個人の情報の出し方・道具ごとの段は管理者だけが変える
  app.put("/api/voice/guard/settings", async (request, reply) => {
    try {
      requireAdmin(request);
      return { settings: await writeGuardSettings(request.body) };
    } catch (err) {
      return sendError(err, reply);
    }
  });

  // ゲストモードは家の人なら誰でも入／切できる（声でも変えられる）
  app.put<{ Body: { guest?: unknown } }>("/api/voice/guard/guest", async (request, reply) => {
    if (typeof request.body?.guest !== "boolean") return reply.code(400).send({ error: "guest must be a boolean" });
    await setGuestMode(request.body.guest);
    return { ok: true };
  });
}
