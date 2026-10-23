import { test } from "node:test";
import assert from "node:assert/strict";
import { ImsgClient, normalizePem, RateBudget, type ImsgRequest, type ImsgResponse } from "./client";

const json = (status: number, body: unknown): ImsgResponse => ({
  status,
  contentType: "application/json",
  body: Buffer.from(JSON.stringify(body)),
});

/** 作り物の imsg-web。届いたリクエストを覚え、道ごとの答えを返す */
function fakeServer(routes: Record<string, (req: ImsgRequest) => ImsgResponse>) {
  const seen: ImsgRequest[] = [];
  const transport = async (req: ImsgRequest) => {
    seen.push(req);
    const route = routes[`${req.method} ${req.url.pathname}`];
    return route ? route(req) : json(404, { code: "NOT_FOUND" });
  };
  return { seen, transport };
}

const config = () => ({ url: "https://mac.local:8787", token: "tok", ca: null });

test("貼り付けで改行が崩れた証明書を PEM に戻す", () => {
  const body = "A".repeat(70) + "B==";
  const pem = normalizePem(`-----BEGIN CERTIFICATE----- ${body.slice(0, 30)} ${body.slice(30)} -----END CERTIFICATE-----`);
  assert.equal(pem, `-----BEGIN CERTIFICATE-----\n${"A".repeat(64)}\n${"A".repeat(6)}B==\n-----END CERTIFICATE-----\n`);
  assert.equal(normalizePem("not a cert"), null);
  assert.equal(normalizePem("-----BEGIN CERTIFICATE----- <script> -----END CERTIFICATE-----"), null);
});

test("トークンだけを付け、ブラウザの印（Origin・Cookie）は付けない。一覧は覚えて使い回す", async () => {
  let now = 0;
  const server = fakeServer({
    "GET /api/chats": () => json(200, { epoch: "e1", chats: [], limit: 50 }),
  });
  const client = new ImsgClient(config, server.transport, new RateBudget(), () => now);
  await client.chats();
  await client.chats();
  assert.equal(server.seen.length, 1);
  const headers = server.seen[0].headers;
  assert.equal(headers.authorization, "Bearer tok");
  for (const name of Object.keys(headers)) assert.ok(!["origin", "cookie", "sec-fetch-site"].includes(name.toLowerCase()));
  assert.equal(server.seen[0].url.href, "https://mac.local:8787/api/chats?limit=50");
  now += 11_000;
  await client.chats();
  assert.equal(server.seen.length, 2);
});

test("epoch が変わったら、前の id で覚えた画像を捨てる。409 なら覚えたものを全部捨てる", async () => {
  let epoch = "e1";
  let now = 0;
  const server = fakeServer({
    "GET /api/chats": () => json(200, { epoch, chats: [], limit: 50 }),
    "GET /api/avatars/a1": () => ({ status: 200, contentType: "image/jpeg", body: Buffer.from([1]) }),
    "GET /api/chats/c1/messages": () => json(409, { code: "STALE_CHAT" }),
  });
  const client = new ImsgClient(config, server.transport, new RateBudget(), () => now);
  await client.chats();
  await client.file("avatars", "a1");
  await client.file("avatars", "a1");
  assert.equal(server.seen.filter((r) => r.url.pathname === "/api/avatars/a1").length, 1);
  epoch = "e2";
  now += 11_000;
  await client.chats();
  await client.file("avatars", "a1");
  assert.equal(server.seen.filter((r) => r.url.pathname === "/api/avatars/a1").length, 2);

  await assert.rejects(client.messages("c1"), { statusCode: 409 });
  await client.chats();
  assert.equal(server.seen.filter((r) => r.url.pathname === "/api/chats").length, 3);
});

test("送った結果はそのまま返し、unknown でも送り直さない。断られた理由を言葉にする", async () => {
  const server = fakeServer({
    "POST /api/send": () => json(200, { state: "unknown" }),
    "POST /api/uploads": () => json(403, { code: "SCOPE" }),
  });
  const client = new ImsgClient(config, server.transport);
  assert.deepEqual(await client.send({ chatId: "c1", text: "やあ" }), { state: "unknown" });
  assert.equal(server.seen.filter((r) => r.url.pathname === "/api/send").length, 1);
  assert.deepEqual(JSON.parse(Buffer.from(server.seen[0].body!).toString()), { chatId: "c1", text: "やあ" });
  await assert.rejects(client.upload("a.png", new Uint8Array([1])), {
    statusCode: 403,
    message: "このトークンではできません（読むだけのトークンです）",
  });
});

test("つながらない・証明書を確かめられない・設定が無いときの言葉", async () => {
  const failing = (code: string) => async () => {
    throw Object.assign(new Error(code), { code });
  };
  await assert.rejects(new ImsgClient(config, failing("ECONNREFUSED")).chats(), {
    statusCode: 502,
    message: "imsg-web につながりません（ECONNREFUSED）",
  });
  await assert.rejects(new ImsgClient(config, failing("DEPTH_ZERO_SELF_SIGNED_CERT")).chats(), /証明書を確かめられません/);
  await assert.rejects(new ImsgClient(() => null).chats(), { statusCode: 503 });
});

test("1分あたりの数を超えない。顔写真・画像は 3/4 まで使い、残りを一覧と送信に取っておく", () => {
  let now = 0;
  const budget = new RateBudget(8, () => now);
  for (let i = 0; i < 6; i++) assert.equal(budget.take(true), true);
  assert.equal(budget.take(true), false);
  assert.equal(budget.take(false), true);
  assert.equal(budget.take(false), true);
  assert.equal(budget.take(false), false);
  now += 60_001;
  assert.equal(budget.take(true), true);
});
