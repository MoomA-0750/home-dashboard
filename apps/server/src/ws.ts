import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

const clients = new Set<WebSocket>();

export function broadcast(message: unknown): void {
  const payload = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });
}
