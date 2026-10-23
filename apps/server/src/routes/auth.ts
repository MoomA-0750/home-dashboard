import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { agentBearerMatches } from "../agentToken.js";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_S,
  authenticate,
  changePassword,
  createAccount,
  deleteAccount,
  isSetupRequired,
  listAccounts,
  listSessions,
  login,
  logout,
  readSessionCookie,
  revokeSession,
  setAccountDisplay,
  setAccountLocale,
  setDeviceSettings,
  setupFirstAccount,
  type AuthContext,
} from "../accounts.js";
import {
  deletePasskey,
  finishLogin,
  finishRegistration,
  listPasskeys,
  renamePasskey,
  startLogin,
  startRegistration,
} from "../passkeys.js";
import { ServiceError } from "../serviceError.js";
import { closeSessionSockets, sendToSession, setSessionViewer } from "../ws.js";
import { isPublicExtensionRoute } from "../extensions/host.js";
import { requestLocale } from "../locale.js";

declare module "fastify" {
  interface FastifyRequest {
    /** ログインしている持ち主。ログインの要らない道（ログイン画面・音声エージェント）では null */
    auth: AuthContext | null;
    /** 音声エージェントが VOICE_AGENT_TOKEN を添えて呼んだか */
    fromAgent: boolean;
  }
}

/** ログインしなくても通す道。音声エージェント向けの2つは、それぞれ VOICE_AGENT_TOKEN で確かめる */
const PUBLIC_ROUTES = new Set([
  "GET /api/auth/status",
  "POST /api/auth/login",
  "POST /api/auth/setup",
  "POST /api/auth/passkey/options",
  "POST /api/auth/passkey/login",
  "GET /ws/voice-agent",
  "GET /mcp",
  "POST /mcp",
  "DELETE /mcp",
]);

/**
 * 音声エージェントが VOICE_AGENT_TOKEN の Bearer で入れる道（/ws/voice-agent と /mcp は、それぞれの道でトークンを確かめる）。
 * トークンは家の中の1台に置くものなので、漏れても使えるのはここに挙げた道だけにする（外のサービスの scope と同じ考え方）
 */
const AGENT_ROUTES: [method: string, path: RegExp][] = [
  ["GET", /^\/api\/voice\/history$/],
  ["GET", /^\/api\/voice\/attachments\/[^/]+$/],
  ["POST", /^\/api\/voice\/guard$/],
  ["GET", /^\/api\/voice\/guard\/requests\/[^/]+\/wait$/],
];

const isAgentRoute = (method: string, path: string) =>
  AGENT_ROUTES.some(([m, pattern]) => m === method && pattern.test(path));

/** URL の道の部分を、%xx を戻した形で返す（壊れた %xx なら null） */
function decodedPath(url: string): string | null {
  try {
    return decodeURIComponent(url.split("?")[0]);
  } catch {
    return null;
  }
}

/** ログインが要る道。これ以外（画面の HTML・JS・画像）はログイン画面を出すために誰にでも返す */
function isProtected(path: string): boolean {
  return path.startsWith("/api/") || path === "/ws" || path.startsWith("/auth/") || path === "/mcp";
}

/** 別のサイトの画面から、ログインしている人になりすまして書き込ませない（Origin が自分と違えば断る） */
function isCrossOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin || origin === "null") return origin === "null";
  try {
    // 手前に置いたプロキシが Host を書き換えるときは、元の Host を x-forwarded-host で渡してくる
    const hosts = [request.headers.host, request.headers["x-forwarded-host"]].flat().filter(Boolean);
    return !hosts.includes(new URL(origin).host);
  } catch {
    return true;
  }
}

function sessionCookie(request: FastifyRequest, token: string, maxAge: number): string {
  // tailscale serve など https の前置きを通っているときだけ Secure を付ける（LAN の http では付けると送られない）
  const secure = request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new ServiceError(401, "ログインしてください", "Please sign in");
  return request.auth;
}

/**
 * 画面の前にいる人（アカウントの ID）。ダッシュボード端末（家に置きっぱなしの端末）は誰が前にいるか分からないので、
 * 部屋のマイクと同じく null にする（家族みんなのものだけを見せ、そこで話した会話も家族みんなのものにする）
 */
export function viewerOf(request: FastifyRequest): string | null {
  const auth = request.auth;
  if (!auth || auth.session.device.dashboard) return null;
  return auth.account.id;
}

export function requireAdmin(request: FastifyRequest): AuthContext {
  const auth = requireAuth(request);
  if (auth.account.role !== "admin") throw new ServiceError(403, "管理者だけができます", "Only administrators can do this");
  return auth;
}

async function respond<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ServiceError)
      return reply.code(err.statusCode).send({ error: err.messageFor(requestLocale(reply.request.headers.cookie)) });
    throw err;
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest("auth", null);
  app.decorateRequest("fromAgent", false);

  // ほかのルートより先に登録する（フックは登録した後のルートにだけ掛かる）
  app.addHook("onRequest", async (request, reply) => {
    // 道は、ルートを探すときと同じく %xx を戻してから見る（戻さないと /%61pi/... が /api/ と見なされず、確かめを素通りする）
    const path = decodedPath(request.url);
    if (path === null) return reply.code(400).send({ error: "bad request path" });
    if (!isProtected(path)) return;
    // 書き込みと、画面の WebSocket（GET で始まるが、つながると状態や声の文字が流れてくる）は、別のサイトからは断る
    if ((path === "/ws" || (request.method !== "GET" && request.method !== "HEAD")) && isCrossOrigin(request)) {
      return reply.code(403).send({ error: "cross-origin request" });
    }
    // 拡張機能が「ログインしなくても通す」と決めた道（外のプログラムから値を受け取るものなど）
    // 認可の戻り先（/auth/<id>/...）は、拡張機能の /auth/... の道として見る
    const ext = /^\/api\/ext\/([^/]+)(\/.*)$/.exec(path);
    const extAuth = /^\/auth\/([^/]+)(\/.*)$/.exec(path);
    if (
      PUBLIC_ROUTES.has(`${request.method} ${path}`) ||
      (ext && isPublicExtensionRoute(ext[1], request.method, ext[2])) ||
      (extAuth && isPublicExtensionRoute(extAuth[1], request.method, `/auth${extAuth[2]}`))
    ) {
      request.auth = await authenticate(readSessionCookie(request.headers.cookie));
      return;
    }
    if (isAgentRoute(request.method, path) && agentBearerMatches(request.headers.authorization)) {
      request.fromAgent = true;
      return;
    }

    const auth = await authenticate(readSessionCookie(request.headers.cookie));
    if (!auth) {
      if (path.startsWith("/auth/")) {
        return reply
          .code(401)
          .type("text/plain; charset=utf-8")
          .send("先にこのダッシュボードにログインしてから、もう一度開いてください。");
      }
      return reply.code(401).send({ error: "login required" });
    }
    request.auth = auth;
    // 使っている間は cookie を延ばし、ずっと開いている端末でも切れないようにする
    if (auth.refreshCookie) {
      const token = readSessionCookie(request.headers.cookie)!;
      reply.header("Set-Cookie", sessionCookie(request, token, SESSION_COOKIE_MAX_AGE_S));
    }
  });

  app.get("/api/auth/status", async (request) => ({
    setupRequired: await isSetupRequired(),
    account: request.auth?.account ?? null,
    sessionId: request.auth?.session.id ?? null,
    device: request.auth?.session.device ?? null,
  }));

  app.post<{ Body: { username?: unknown; password?: unknown; deviceName?: unknown; setupCode?: unknown } }>(
    "/api/auth/setup",
    (request, reply) =>
      respond(reply, async () => {
        const { username, password, deviceName, setupCode } = request.body ?? {};
        const { token, account } = await setupFirstAccount(username, password, deviceName, setupCode);
        reply.header("Set-Cookie", sessionCookie(request, token, SESSION_COOKIE_MAX_AGE_S));
        return { account };
      }),
  );

  app.post<{ Body: { username?: unknown; password?: unknown; deviceName?: unknown } }>(
    "/api/auth/login",
    (request, reply) =>
      respond(reply, async () => {
        const { username, password, deviceName } = request.body ?? {};
        const { token, account } = await login(username, password, deviceName);
        reply.header("Set-Cookie", sessionCookie(request, token, SESSION_COOKIE_MAX_AGE_S));
        return { account };
      }),
  );

  // パスキーでのログイン（名前を打たずに、端末に覚えさせたパスキーを選ぶ）
  app.post("/api/auth/passkey/options", (request, reply) =>
    respond(reply, () => startLogin(request.headers.origin)),
  );

  app.post<{ Body: { challengeId?: unknown; response?: unknown; deviceName?: unknown } }>(
    "/api/auth/passkey/login",
    (request, reply) =>
      respond(reply, async () => {
        const { challengeId, response, deviceName } = request.body ?? {};
        const { token, account } = await finishLogin(request.headers.origin, challengeId, response, deviceName);
        reply.header("Set-Cookie", sessionCookie(request, token, SESSION_COOKIE_MAX_AGE_S));
        return { account };
      }),
  );

  // 自分のパスキーの登録・名前の変更・削除
  app.get("/api/auth/passkeys", (request, reply) =>
    respond(reply, async () => ({ passkeys: await listPasskeys(requireAuth(request)) })),
  );

  app.post("/api/auth/passkeys/options", (request, reply) =>
    respond(reply, () => startRegistration(requireAuth(request), request.headers.origin)),
  );

  app.post<{ Body: { challengeId?: unknown; response?: unknown; name?: unknown } }>(
    "/api/auth/passkeys",
    (request, reply) =>
      respond(reply, async () => {
        const { challengeId, response, name } = request.body ?? {};
        const auth = requireAuth(request);
        return { passkey: await finishRegistration(auth, request.headers.origin, challengeId, response, name) };
      }),
  );

  app.patch<{ Params: { id: string }; Body: { name?: unknown } }>("/api/auth/passkeys/:id", (request, reply) =>
    respond(reply, async () => ({
      passkey: await renamePasskey(requireAuth(request), request.params.id, request.body?.name),
    })),
  );

  app.delete<{ Params: { id: string } }>("/api/auth/passkeys/:id", (request, reply) =>
    respond(reply, async () => {
      await deletePasskey(requireAuth(request), request.params.id);
      return { ok: true };
    }),
  );

  app.post("/api/auth/logout", (request, reply) =>
    respond(reply, async () => {
      const auth = requireAuth(request);
      await logout(auth.session.id);
      closeSessionSockets([auth.session.id]);
      reply.header("Set-Cookie", sessionCookie(request, "", 0));
      return { ok: true };
    }),
  );

  app.get("/api/auth/sessions", (request, reply) =>
    respond(reply, async () => ({ sessions: await listSessions(requireAuth(request)) })),
  );

  app.delete<{ Params: { id: string } }>("/api/auth/sessions/:id", (request, reply) =>
    respond(reply, async () => {
      closeSessionSockets(await revokeSession(requireAuth(request), request.params.id));
      return { ok: true };
    }),
  );

  // 端末ごとの設定（ダッシュボード端末か・軽い表示）。変えた端末の画面は、知らせを受けて確かめ直す
  app.put<{ Params: { id: string }; Body: unknown }>("/api/auth/sessions/:id/device", (request, reply) =>
    respond(reply, async () => {
      const session = await setDeviceSettings(requireAuth(request), request.params.id, request.body);
      setSessionViewer(session.id, session.device.dashboard ? null : session.accountId);
      sendToSession(session.id, { type: "device-settings", device: session.device });
      return { session };
    }),
  );

  app.put<{ Body: unknown }>("/api/auth/display", (request, reply) =>
    respond(reply, async () => ({ display: await setAccountDisplay(requireAuth(request), request.body) })),
  );

  app.put<{ Body: { locale?: unknown } }>("/api/auth/locale", (request, reply) =>
    respond(reply, async () => ({ locale: await setAccountLocale(requireAuth(request), request.body?.locale) })),
  );

  app.put<{ Params: { id: string }; Body: { currentPassword?: unknown; password?: unknown } }>(
    "/api/accounts/:id/password",
    (request, reply) =>
      respond(reply, async () => {
        const auth = requireAuth(request);
        const { currentPassword, password } = request.body ?? {};
        closeSessionSockets(await changePassword(auth, request.params.id, currentPassword, password));
        return { ok: true };
      }),
  );

  // アカウントの管理は管理者だけ
  app.get("/api/accounts", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      return { accounts: await listAccounts() };
    }),
  );

  app.post<{ Body: { username?: unknown; password?: unknown; role?: unknown } }>("/api/accounts", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      const { username, password, role } = request.body ?? {};
      return { account: await createAccount(username, password, role) };
    }),
  );

  app.delete<{ Params: { id: string } }>("/api/accounts/:id", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      closeSessionSockets(await deleteAccount(request.params.id));
      return { ok: true };
    }),
  );
}
