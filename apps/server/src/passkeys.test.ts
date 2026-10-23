import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
process.env.DATA_DIR = await mkdtemp(join(tmpdir(), "passkeys-"));

const Fastify = (await import("fastify")).default;
const accounts = await import("./accounts.js");
const passkeys = await import("./passkeys.js");
const { registerAuth } = await import("./routes/auth.js");

const ORIGIN = "https://dash.tailnet-name.ts.net";
const HOST = "dash.tailnet-name.ts.net";

async function buildApp() {
  const app = Fastify();
  await registerAuth(app);
  app.get("/api/secret", async (request) => ({ user: request.auth?.account.username ?? null }));
  return app;
}

const cookieOf = (res: { headers: Record<string, unknown> }) => String(res.headers["set-cookie"]).split(";")[0];

// --- 試験用のソフトウェアの認証器（CBOR は使う分だけ自前で書く） ---

function cborHead(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
}

function cbor(value: unknown): Buffer {
  if (typeof value === "number") return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  if (typeof value === "string") return Buffer.concat([cborHead(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (Buffer.isBuffer(value)) return Buffer.concat([cborHead(2, value.length), value]);
  if (value instanceof Map)
    return Buffer.concat([cborHead(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])]);
  throw new Error("unsupported");
}

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest();
const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

class SoftAuthenticator {
  readonly credentialId = randomBytes(16);
  private readonly privateKey: KeyObject;
  private readonly publicJwk: { x: string; y: string };
  private counter = 0;
  userHandle = "";

  constructor() {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = pair.privateKey;
    this.publicJwk = pair.publicKey.export({ format: "jwk" }) as { x: string; y: string };
  }

  private clientData(type: string, challenge: string, origin: string) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  create(options: { challenge: string; rp: { id: string }; user: { id: string } }, origin = ORIGIN) {
    this.userHandle = options.user.id;
    const coseKey = new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(this.publicJwk.x, "base64url")],
      [-3, Buffer.from(this.publicJwk.y, "base64url")],
    ]);
    const idLength = Buffer.from([0, this.credentialId.length]);
    const authData = Buffer.concat([
      sha256(options.rp.id),
      Buffer.from([0x01 | 0x04 | 0x40]),
      Buffer.alloc(4),
      Buffer.alloc(16),
      idLength,
      this.credentialId,
      cbor(coseKey),
    ]);
    const attestationObject = cbor(
      new Map<string, unknown>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: b64url(this.credentialId),
      rawId: b64url(this.credentialId),
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(this.clientData("webauthn.create", options.challenge, origin)),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
    };
  }

  get(options: { challenge: string; rpId: string }, origin = ORIGIN, flags = 0x01 | 0x04) {
    this.counter += 1;
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.counter);
    const authData = Buffer.concat([sha256(options.rpId), Buffer.from([flags]), count]);
    const clientDataJSON = this.clientData("webauthn.get", options.challenge, origin);
    const signature = sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.privateKey);
    return {
      id: b64url(this.credentialId),
      rawId: b64url(this.credentialId),
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
        userHandle: this.userHandle,
      },
    };
  }
}

// --- ここから試験 ---

beforeEach(() => {
  accounts.resetAccountsForTest();
  passkeys.resetPasskeysForTest();
});

async function setup(app: Awaited<ReturnType<typeof buildApp>>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    headers: { host: HOST, origin: ORIGIN },
    payload: {
      username: "mooma",
      password: "correct horse",
      deviceName: "壁",
      setupCode: await accounts.announceSetupCode(() => undefined),
    },
  });
  return cookieOf(res);
}

async function register(app: Awaited<ReturnType<typeof buildApp>>, cookie: string, authenticator: SoftAuthenticator) {
  const headers = { host: HOST, origin: ORIGIN, cookie };
  const start = await app.inject({ method: "POST", url: "/api/auth/passkeys/options", headers });
  assert.equal(start.statusCode, 200, start.body);
  const { challengeId, options } = start.json();
  assert.equal(options.rp.id, HOST);
  assert.equal(options.authenticatorSelection.userVerification, "required");
  return app.inject({
    method: "POST",
    url: "/api/auth/passkeys",
    headers,
    payload: { challengeId, response: authenticator.create(options), name: "iPhone" },
  });
}

async function passkeyLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  answer: (options: { challenge: string; rpId: string }) => unknown,
) {
  const headers = { host: HOST, origin: ORIGIN };
  const start = await app.inject({ method: "POST", url: "/api/auth/passkey/options", headers });
  assert.equal(start.statusCode, 200, start.body);
  const { challengeId, options } = start.json();
  return app.inject({
    method: "POST",
    url: "/api/auth/passkey/login",
    headers,
    payload: { challengeId, response: answer(options), deviceName: "スマホ" },
  });
}

test("パスキーを登録して、名前を打たずにログインできる", async () => {
  const app = await buildApp();
  const cookie = await setup(app);
  const authenticator = new SoftAuthenticator();

  const registered = await register(app, cookie, authenticator);
  assert.equal(registered.statusCode, 200, registered.body);
  assert.equal(registered.json().passkey.name, "iPhone");
  assert.equal(registered.json().passkey.rpId, HOST);
  // 公開鍵などの中身は一覧に出さない
  const list = await app.inject({ url: "/api/auth/passkeys", headers: { cookie } });
  assert.deepEqual(Object.keys(list.json().passkeys[0]).sort(), [
    "accountId",
    "backedUp",
    "createdAt",
    "id",
    "lastUsedAt",
    "name",
    "rpId",
  ]);

  const login = await passkeyLogin(app, (options) => authenticator.get(options));
  assert.equal(login.statusCode, 200, login.body);
  assert.equal(login.json().account.username, "mooma");
  const secret = await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(login) } });
  assert.equal(secret.json().user, "mooma");

  const after = await app.inject({ url: "/api/auth/passkeys", headers: { cookie } });
  assert.ok(after.json().passkeys[0].lastUsedAt);
});

test("答え合わせの値は一度しか使えず、違うアドレス・本人確認なし・知らない鍵では入れない", async () => {
  const app = await buildApp();
  const cookie = await setup(app);
  const authenticator = new SoftAuthenticator();
  await register(app, cookie, authenticator);

  // 同じ答え合わせの値をもう一度
  const headers = { host: HOST, origin: ORIGIN };
  const { challengeId, options } = (
    await app.inject({ method: "POST", url: "/api/auth/passkey/options", headers })
  ).json();
  const first = await app.inject({
    method: "POST",
    url: "/api/auth/passkey/login",
    headers,
    payload: { challengeId, response: authenticator.get(options) },
  });
  assert.equal(first.statusCode, 200);
  const replay = await app.inject({
    method: "POST",
    url: "/api/auth/passkey/login",
    headers,
    payload: { challengeId, response: authenticator.get(options) },
  });
  assert.equal(replay.statusCode, 400);

  // 偽のサイトで署名させたもの
  const phished = await passkeyLogin(app, (o) => authenticator.get(o, "https://evil.example"));
  assert.equal(phished.statusCode, 401);
  // 指紋・PIN での本人確認をしていないもの
  const noUv = await passkeyLogin(app, (o) => authenticator.get(o, ORIGIN, 0x01));
  assert.equal(noUv.statusCode, 401);
  // 登録していない鍵
  const stranger = new SoftAuthenticator();
  stranger.userHandle = authenticator.userHandle;
  const unknown = await passkeyLogin(app, (o) => stranger.get(o));
  assert.equal(unknown.statusCode, 401);
});

test("IP アドレスで開いているときはパスキーを使わせない", async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/passkey/options",
    headers: { host: "192.168.1.10", origin: "https://192.168.1.10" },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /IP アドレス/);
});

test("パスキーを消すと、そのパスキーでは入れない。ほかの人のパスキーは消せない", async () => {
  const app = await buildApp();
  const cookie = await setup(app);
  const authenticator = new SoftAuthenticator();
  const id = (await register(app, cookie, authenticator)).json().passkey.id;

  await app.inject({
    method: "POST",
    url: "/api/accounts",
    headers: { host: HOST, origin: ORIGIN, cookie },
    payload: { username: "guest", password: "guest password", role: "member" },
  });
  const guest = cookieOf(
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { host: HOST, origin: ORIGIN },
      payload: { username: "guest", password: "guest password" },
    }),
  );
  const denied = await app.inject({
    method: "DELETE",
    url: `/api/auth/passkeys/${id}`,
    headers: { host: HOST, origin: ORIGIN, cookie: guest },
  });
  assert.equal(denied.statusCode, 404);

  const removed = await app.inject({
    method: "DELETE",
    url: `/api/auth/passkeys/${id}`,
    headers: { host: HOST, origin: ORIGIN, cookie },
  });
  assert.equal(removed.statusCode, 200);
  const login = await passkeyLogin(app, (options) => authenticator.get(options));
  assert.equal(login.statusCode, 401);
});
