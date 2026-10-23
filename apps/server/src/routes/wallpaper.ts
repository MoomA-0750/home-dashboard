import { createReadStream } from "node:fs";
import type { FastifyInstance, FastifyReply } from "fastify";
import { ServiceError } from "../serviceError.js";
import { getWallpaper, MAX_WALLPAPER_BYTES, resetWallpaper, setDimStrength, setWallpaper, wallpaperFile } from "../wallpaper.js";
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

/** 壁紙の道。読むのはログインした人なら誰でも、変えるのは管理者だけ。変えたら全部の画面に知らせる */
export async function registerWallpaperRoutes(app: FastifyInstance): Promise<void> {
  // 画像はそのまま本文で受ける（image/png の読み方は routes/voice.ts で登録してある）
  app.addContentTypeParser(["image/jpeg", "image/webp"], { parseAs: "buffer" }, (_request, body, done) =>
    done(null, body),
  );

  app.get("/api/wallpaper", () => getWallpaper());

  app.get("/api/wallpaper/image", async (_request, reply) => {
    const file = await wallpaperFile();
    if (!file) return reply.code(404).send({ error: "wallpaper not set" });
    // URL に版（?v=）を添えて読むので、同じ URL の中身は変わらない
    reply.header("Cache-Control", "private, max-age=31536000, immutable");
    return reply.type(file.type).send(createReadStream(file.path));
  });

  app.put<{ Body: Buffer }>("/api/wallpaper", { bodyLimit: MAX_WALLPAPER_BYTES + 1024 }, (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      if (!Buffer.isBuffer(request.body)) throw new ServiceError(415, "画像をそのまま送ってください", "Send the image as is");
      const info = await setWallpaper(new Uint8Array(request.body));
      broadcast({ type: "wallpaper-updated", ...info });
      return info;
    }),
  );

  // 壁紙の明るい所に足す暗さの強さ（全部の端末で同じ）
  app.put<{ Body: { dimStrength?: unknown } }>("/api/wallpaper/dim", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      const info = await setDimStrength(request.body?.dimStrength);
      broadcast({ type: "wallpaper-updated", ...info });
      return info;
    }),
  );

  app.delete("/api/wallpaper", (request, reply) =>
    respond(reply, async () => {
      requireAdmin(request);
      const info = await resetWallpaper();
      broadcast({ type: "wallpaper-updated", ...info });
      return info;
    }),
  );
}
