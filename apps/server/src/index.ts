import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
// config は自身の先頭で .env を読み込む。ここで読み込んでも import 評価順の都合で間に合わない
import { config } from "./config.js";
import { registerLayoutRoutes } from "./routes/layout.js";
import { registerVoiceRoutes } from "./routes/voice.js";
import { registerMcpRoutes } from "./routes/mcp.js";
import { registerVoiceGuardRoutes } from "./routes/voiceGuard.js";
import { registerConnectionSettingsRoutes } from "./routes/connectionSettings.js";
import { loadConnectionSettings } from "./connectionSettings.js";
import { registerWebSocket } from "./ws.js";
import { registerAuth } from "./routes/auth.js";
import { registerExtensionRoutes } from "./routes/extensions.js";
import { registerWallpaperRoutes } from "./routes/wallpaper.js";
import { loadExtensions } from "./extensions/host.js";
import { announceSetupCode } from "./accounts.js";
import { startExtensionSources } from "./extensions/sources.js";

// 設定画面で変えた接続設定（data/connections.json）を、拡張機能が読む前に入れておく
await loadConnectionSettings();
// 連携（Spotify・Home Assistant など）は拡張機能。本体の extensions/ と、持ち込んだ data/extensions/ を読む
await loadExtensions();
// 登録したリポジトリの拡張機能の更新を、定期的に確かめる（自動で更新するものは入れ替える）
await startExtensionSources();

const app = Fastify({ logger: true });

// 思いがけない失敗（ファイルが無いなど）の中身を画面に返さない（ファイルの場所などが漏れる）。理由はログに残る
app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
  const status = error.statusCode ?? 500;
  if (status < 500) return reply.code(status).send({ error: error.message });
  request.log.error(error);
  return reply.code(status).send({ error: "internal error" });
});

await app.register(fastifyWebsocket);
// ログインの確かめ。ほかのルートより先に置く（画面と API はログインしないと使えない）
await registerAuth(app);
await registerWebSocket(app);

await registerLayoutRoutes(app);
await registerVoiceRoutes(app);
await registerMcpRoutes(app);
await registerVoiceGuardRoutes(app);
await registerConnectionSettingsRoutes(app);
await registerExtensionRoutes(app);
await registerWallpaperRoutes(app);

if (existsSync(config.webDistDir)) {
  await app.register(fastifyStatic, {
    root: config.webDistDir,
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.method === "GET" && !request.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    reply.code(404).send({ error: "not found" });
  });
}

app
  .listen({ port: config.port, host: "0.0.0.0" })
  // アカウントがまだ無ければ、最初の管理者を作るための合言葉をログに出す
  .then(() => announceSetupCode())
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
