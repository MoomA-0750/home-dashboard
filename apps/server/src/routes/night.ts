import type { FastifyInstance, FastifyReply } from "fastify";
import { ServiceError } from "../serviceError.js";
import { loadNightSettings, nightState, onNightChange, setNightSettings } from "../nightMode.js";
import { broadcast } from "../ws.js";
import { requireAdmin } from "./auth.js";
import { requestLocale } from "../locale.js";

async function respond<T>(reply: FastifyReply, work: () => Promise<T>) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ServiceError)
      return reply.code(err.statusCode).send({ error: err.messageFor(requestLocale(reply.request.headers.cookie)) });
    throw err;
  }
}

/** 夜の表示の道。読むのはログインした人なら誰でも、変えるのは管理者だけ。夜に入った・出たら全部の画面に知らせる */
export async function registerNightRoutes(app: FastifyInstance): Promise<void> {
  await loadNightSettings();
  onNightChange((state) => broadcast({ type: "night-updated", ...state }));

  app.get("/api/night", () => nightState());

  app.put<{ Body: unknown }>("/api/night", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      return setNightSettings(request.body);
    }),
  );
}
