import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerLayoutRoutes } from "./routes/layout.js";
import { registerWeatherRoutes } from "./routes/weather.js";
import { registerSpotifyRoutes } from "./routes/spotify.js";
import { registerHomelabRoutes } from "./routes/homelab.js";
import { registerWebSocket } from "./ws.js";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const app = Fastify({ logger: true });

await app.register(fastifyWebsocket);
await registerWebSocket(app);

await registerLayoutRoutes(app);
await registerWeatherRoutes(app);
await registerSpotifyRoutes(app);
await registerHomelabRoutes(app);

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
