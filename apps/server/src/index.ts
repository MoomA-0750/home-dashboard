import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
// config は自身の先頭で .env を読み込む。ここで読み込んでも import 評価順の都合で間に合わない
import { config } from "./config.js";
import { registerLayoutRoutes } from "./routes/layout.js";
import { registerWeatherRoutes } from "./routes/weather.js";
import { registerSpotifyRoutes } from "./routes/spotify.js";
import { registerHomelabRoutes } from "./routes/homelab.js";
import { registerHomeAssistantRoutes } from "./routes/homeassistant.js";
import { registerClaudeUsageRoutes } from "./routes/claudeUsage.js";
import { registerTailscaleRoutes } from "./routes/tailscale.js";
import { registerGitRepoRoutes } from "./routes/gitRepos.js";
import { registerMailRoutes } from "./routes/mail.js";
import { registerVoiceRoutes } from "./routes/voice.js";
import { registerWebSocket } from "./ws.js";

const app = Fastify({ logger: true });

await app.register(fastifyWebsocket);
await registerWebSocket(app);

await registerLayoutRoutes(app);
await registerWeatherRoutes(app);
await registerSpotifyRoutes(app);
await registerHomelabRoutes(app);
await registerHomeAssistantRoutes(app);
await registerClaudeUsageRoutes(app);
await registerTailscaleRoutes(app);
await registerGitRepoRoutes(app);
await registerMailRoutes(app);
await registerVoiceRoutes(app);

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

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
