import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

const clients = new Set<WebSocket>();
// 画面がつなぐときに名乗るID（タブごと）。音声アシスタントの返答の声のように、頼んだ画面にだけ届けたいものに使う
const clientsById = new Map<string, WebSocket>();

// つないでいる画面がどのログインのものか。ログインを外したら、その画面への知らせも止める
const sessionBySocket = new Map<WebSocket, string>();
// 画面を見ている人（アカウントの ID）。ダッシュボード端末は部屋のマイクと同じく誰か分からないので null。
// 自分の画面で話した会話（音声アシスタントの記録・途中経過）は、その人の画面にだけ送る
const viewerBySocket = new Map<WebSocket, string | null>();

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isClientId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_ID_PATTERN.test(value);
}

export function broadcast(message: unknown): void {
  const payload = JSON.stringify(message);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

/**
 * 誰の会話か（owner）に合わせて送る。家族みんなのもの（null）は全部の画面へ、人のものはその人の画面へ。
 * ほかの画面には redacted を送る（無ければ送らない）
 */
export function broadcastFor(owner: string | null, message: unknown, redacted?: unknown): void {
  const full = JSON.stringify(message);
  const hidden = redacted === undefined ? null : JSON.stringify(redacted);
  for (const socket of clients) {
    if (socket.readyState !== socket.OPEN) continue;
    const payload = owner === null || viewerBySocket.get(socket) === owner ? full : hidden;
    if (payload) socket.send(payload);
  }
}

/** 端末の設定（ダッシュボード端末か）が変わったら、その端末の画面を見ている人を差し替える */
export function setSessionViewer(sessionId: string, viewer: string | null): void {
  for (const [socket, id] of sessionBySocket) {
    if (id === sessionId) viewerBySocket.set(socket, viewer);
  }
}

/** その画面がつながっていなければ false（つながり直すまでの分は届かない） */
export function sendToClient(clientId: string, message: unknown): boolean {
  const socket = clientsById.get(clientId);
  if (!socket || socket.readyState !== socket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

/** そのログイン（端末）の画面にだけ送る */
export function sendToSession(sessionId: string, message: unknown): void {
  const payload = JSON.stringify(message);
  for (const [socket, id] of sessionBySocket) {
    if (id === sessionId && socket.readyState === socket.OPEN) socket.send(payload);
  }
}

/** 外したログインの画面との接続を切る（画面はつなぎ直そうとして、ログインを求められる） */
export function closeSessionSockets(sessionIds: string[]): void {
  for (const [socket, sessionId] of sessionBySocket) {
    if (sessionIds.includes(sessionId)) socket.close(4401, "logged out");
  }
}

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { clientId?: string } }>("/ws", { websocket: true }, (socket, request) => {
    clients.add(socket);
    if (request.auth) sessionBySocket.set(socket, request.auth.session.id);
    viewerBySocket.set(socket, request.auth && !request.auth.session.device.dashboard ? request.auth.account.id : null);
    const clientId = isClientId(request.query.clientId) ? request.query.clientId : null;
    if (clientId) clientsById.set(clientId, socket);
    socket.on("close", () => {
      clients.delete(socket);
      sessionBySocket.delete(socket);
      viewerBySocket.delete(socket);
      if (clientId && clientsById.get(clientId) === socket) clientsById.delete(clientId);
    });
  });
}
