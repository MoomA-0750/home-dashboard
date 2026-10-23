import { createReadStream } from "node:fs";
import { extname } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  dispatchExtensionRoute,
  extensionFilePath,
  installExtension,
  listExtensions,
  setExtensionEnabled,
  setExtensionTrusted,
  uninstallExtension,
} from "../extensions/host.js";
import {
  addSource,
  checkAllSources,
  installFromSource,
  listSources,
  removeSource,
  setAutoUpdate,
  updateSource,
  updateStatus,
} from "../extensions/sources.js";
import { ServiceError } from "../serviceError.js";
import { requireAdmin } from "./auth.js";
import { requestLocale } from "../locale.js";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function respond<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ServiceError)
      return reply.code(err.statusCode).send({ error: err.messageFor(requestLocale(reply.request.headers.cookie)) });
    throw err;
  }
}

async function dispatch(
  request: FastifyRequest<{ Params: { id: string; "*": string } }>,
  reply: FastifyReply,
  prefix: string,
) {
  const result = await dispatchExtensionRoute(request.params.id, request.method, `${prefix}/${request.params["*"]}`, {
    query: request.query as Record<string, string | undefined>,
    body: request.body,
    account: request.auth?.account ?? null,
    fromAgent: request.auth === null && request.fromAgent === true,
    bearer: /^Bearer (\S{1,256})$/.exec(request.headers.authorization ?? "")?.[1] ?? null,
    locale: requestLocale(request.headers.cookie),
  });
  if (result.kind === "redirect") return reply.redirect(result.url);
  if (result.kind === "text") return reply.code(result.statusCode).type("text/plain; charset=utf-8").send(result.body);
  if (result.kind === "file") {
    reply
      .header("Cache-Control", result.cacheSeconds > 0 ? `private, max-age=${result.cacheSeconds}` : "no-store")
      .header("X-Content-Type-Options", "nosniff");
    if (result.contentType === "application/octet-stream") reply.header("Content-Disposition", "attachment");
    return reply.code(200).type(result.contentType).send(Buffer.from(result.body));
  }
  return reply.code(result.statusCode).send(result.body);
}

/**
 * 拡張機能の一覧・入切・持ち込み・削除・リポジトリ（登録・入れる・更新・自動更新）と、拡張機能の道（/api/ext/<id>/...）・画面に配るファイル。
 * 一覧とファイルはログインした人なら誰でも、それ以外は管理者だけ。
 */
export async function registerExtensionRoutes(app: FastifyInstance): Promise<void> {
  // 一覧には、リポジトリにある新しい版（更新）と、自動で更新するかを添える
  app.get("/api/extensions", async () => {
    const updates = await updateStatus();
    return {
      extensions: listExtensions().map((ext) => ({
        ...ext,
        update: updates[ext.id]?.update ?? null,
        autoUpdate: updates[ext.id]?.autoUpdate ?? false,
      })),
    };
  });

  app.put<{ Params: { id: string }; Body: { enabled?: unknown } }>("/api/extensions/:id/auto-update", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      if (typeof request.body?.enabled !== "boolean") throw new ServiceError(400, "enabled must be a boolean");
      await setAutoUpdate(request.params.id, request.body.enabled);
      return { ok: true };
    }),
  );

  // リポジトリ（トークンは返さない）
  app.get("/api/extension-sources", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      return { sources: await listSources() };
    }),
  );

  app.post<{ Body: { url?: unknown; branch?: unknown; token?: unknown; name?: unknown } }>(
    "/api/extension-sources",
    (request, reply) =>
      respond(reply, async () => {
        requireAdmin(request);
        return { source: await addSource(request.body ?? {}) };
      }),
  );

  app.post("/api/extension-sources/check", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      return { updated: await checkAllSources(), sources: await listSources() };
    }),
  );

  app.put<{ Params: { id: string }; Body: { name?: unknown; branch?: unknown; token?: unknown } }>(
    "/api/extension-sources/:id",
    (request, reply) =>
      respond(reply, async () => {
        requireAdmin(request);
        return { source: await updateSource(request.params.id, request.body ?? {}) };
      }),
  );

  app.delete<{ Params: { id: string } }>("/api/extension-sources/:id", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      await removeSource(request.params.id);
      return { ok: true };
    }),
  );

  // リポジトリの拡張機能を入れる・更新する
  app.post<{ Params: { id: string }; Body: { extensionId?: unknown } }>(
    "/api/extension-sources/:id/install",
    (request, reply) =>
      respond(reply, async () => {
        requireAdmin(request);
        return { extension: await installFromSource(request.params.id, request.body?.extensionId) };
      }),
  );

  // 持ち込んだ拡張機能を本体と同じ権限で動かす（信頼する）か、別のプロセスで権限を絞って動かすか
  app.put<{ Params: { id: string }; Body: { trusted?: unknown } }>("/api/extensions/:id/trust", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      if (typeof request.body?.trusted !== "boolean") throw new ServiceError(400, "trusted must be a boolean");
      return { extension: await setExtensionTrusted(request.params.id, request.body.trusted) };
    }),
  );

  app.put<{ Params: { id: string }; Body: { enabled?: unknown } }>("/api/extensions/:id", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      if (typeof request.body?.enabled !== "boolean") throw new ServiceError(400, "enabled must be a boolean");
      return { extension: await setExtensionEnabled(request.params.id, request.body.enabled) };
    }),
  );

  // ZIP はそのまま本文で受ける（application/zip の読み方は routes/voice.ts で登録してある）
  app.post<{ Body: Buffer }>("/api/extensions", { bodyLimit: 21 * 1024 * 1024 }, (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      if (!Buffer.isBuffer(request.body)) throw new ServiceError(415, "ZIP を application/zip で送ってください", "Send the ZIP as application/zip");
      return { extension: await installExtension(new Uint8Array(request.body)) };
    }),
  );

  app.delete<{ Params: { id: string } }>("/api/extensions/:id", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      await uninstallExtension(request.params.id);
      return { ok: true };
    }),
  );

  app.get<{ Params: { id: string; "*": string } }>("/api/extensions/:id/files/*", async (request, reply) => {
    const path = extensionFilePath(request.params.id, request.params["*"]);
    if (!path) return reply.code(404).send({ error: "not found" });
    const type = CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
    // URL に版（?v=）を付けて読むので、長く覚えてよい
    reply.header(
      "Cache-Control",
      request.query && "v" in (request.query as object) ? "private, max-age=31536000, immutable" : "no-cache",
    );
    return reply.type(type).send(createReadStream(path));
  });

  for (const method of METHODS) {
    app.route<{ Params: { id: string; "*": string } }>({
      method,
      url: "/api/ext/:id/*",
      bodyLimit: 10 * 1024 * 1024,
      handler: (request, reply) => dispatch(request, reply, ""),
    });
  }
  // 外のサービスの認可の戻り先（Spotify の Redirect URI など）。拡張機能の /auth/... の道へつなぐ
  app.get<{ Params: { id: string; "*": string } }>("/auth/:id/*", (request, reply) =>
    dispatch(request, reply, "/auth"),
  );
}
