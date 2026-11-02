import type { FastifyInstance, FastifyReply } from "fastify";
import { ServiceError } from "../serviceError.js";
import { listStateReadings, loadNightSettings, nightState, onNightChange, setNightSettings, startNightWatch } from "../nightMode.js";
import { stateSources } from "../extensions/host.js";
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
  // 条件（照度・照明・時間帯）を、家の状態を差し出している拡張機能の値で確かめ続ける
  startNightWatch(stateSources);

  app.get("/api/night", () => nightState());
  // 条件に選べる値（Home Assistant など、家の状態を差し出している拡張機能ごと）
  app.get("/api/night/readings", async () => ({ sources: await listStateReadings() }));

  app.put<{ Body: unknown }>("/api/night", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      return setNightSettings(request.body);
    }),
  );
}
