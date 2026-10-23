import type { FastifyInstance, FastifyReply } from "fastify";
import { describeConnectionSettings, updateConnectionSettings } from "../connectionSettings.js";
import { activeExtensionIds } from "../extensions/host.js";
import { ServiceError } from "../serviceError.js";
import { requireAdmin } from "./auth.js";
import { requestLocale } from "../locale.js";

/**
 * 設定画面の「接続設定」。節は動いている拡張機能ごと（拡張機能の一覧と同じ並び）。
 * 見るのはログインした人なら誰でも、変えるのは管理者だけ。「接続を確かめる」は各拡張機能の道で受ける
 */
async function respond<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ServiceError)
      return reply.code(err.statusCode).send({ error: err.messageFor(requestLocale(reply.request.headers.cookie)) });
    throw err;
  }
}

export async function registerConnectionSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/settings/connections", async (request) => ({
    sections: describeConnectionSettings(activeExtensionIds()),
    editable: request.auth?.account.role === "admin",
  }));

  app.put<{ Params: { section: string }; Body: { values?: unknown } }>(
    "/api/settings/connections/:section",
    (request, reply) =>
      respond(reply, async () => {
        requireAdmin(request);
        return { section: await updateConnectionSettings(request.params.section, request.body?.values) };
      }),
  );
}
