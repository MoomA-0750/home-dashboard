import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
const dataDir = await mkdtemp(join(tmpdir(), "accounts-"));
process.env.DATA_DIR = dataDir;
process.env.VOICE_AGENT_TOKEN = "agent-token-for-test";

const Fastify = (await import("fastify")).default;
const accounts = await import("./accounts.js");
const { registerAuth } = await import("./routes/auth.js");

async function buildApp() {
  const app = Fastify();
  await registerAuth(app);
  app.get("/api/secret", async (request) => ({ user: request.auth?.account.username ?? null }));
  app.get("/api/voice/history", async (request) => ({ agent: request.fromAgent }));
  app.get("/index.html", async () => "page");
  return app;
}

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const header = String(res.headers["set-cookie"]);
  return header.split(";")[0];
}

beforeEach(() => accounts.resetAccountsForTest());

test("アカウントが無いうちは最初のアカウントを作れ、作った人は管理者になる", async () => {
  const app = await buildApp();
  let status = await app.inject({ url: "/api/auth/status" });
  assert.equal(status.json().setupRequired, true);

  // サーバーのログに出した合言葉が無いと作れない（届く人なら誰でも管理者になれてしまうのを防ぐ）
  const logged: string[] = [];
  const code = await accounts.announceSetupCode((message) => logged.push(message));
  assert.ok(code && logged[0].includes(code));
  for (const setupCode of [undefined, "WRONGCOD"]) {
    const denied = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { username: "intruder", password: "password123", setupCode },
    });
    assert.equal(denied.statusCode, 401);
  }
  const setup = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "mooma", password: "correct horse", deviceName: "壁", setupCode: code!.toLowerCase() },
  });
  assert.equal(setup.statusCode, 200);
  assert.equal(setup.json().account.role, "admin");
  assert.match(String(setup.headers["set-cookie"]), /HttpOnly; SameSite=Lax; Max-Age=\d+/);

  status = await app.inject({ url: "/api/auth/status", headers: { cookie: cookieOf(setup) } });
  assert.equal(status.json().setupRequired, false);
  assert.equal(status.json().account.username, "mooma");

  // 2つ目の「最初のアカウント」は作れない
  const again = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "intruder", password: "password123" },
  });
  assert.equal(again.statusCode, 409);
  assert.equal((await stat(join(dataDir, "accounts.json"))).mode & 0o777, 0o600);
});

test("ログインしないと API は 401、画面のファイルは返す", async () => {
  const app = await buildApp();
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  assert.equal((await app.inject({ url: "/api/secret" })).statusCode, 401);
  // %xx で書き換えた道でも、確かめを素通りしない（ルートを探すときは %xx が戻される）
  assert.equal((await app.inject({ url: "/%61pi/secret" })).statusCode, 401);
  assert.equal((await app.inject({ url: "/api/secre%74" })).statusCode, 401);
  assert.equal((await app.inject({ url: "/api/%E0%A4%A" })).statusCode, 400);
  assert.equal((await app.inject({ url: "/api/secret", headers: { cookie: "hd_session=%E0%A4%A" } })).statusCode, 401);
  assert.equal(
    (await app.inject({ url: "/api/secret", headers: { cookie: "hd_session=forged-token-xxxxxxxx" } })).statusCode,
    401,
  );
  assert.equal((await app.inject({ url: "/index.html" })).statusCode, 200);

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "MOOMA", password: "correct horse" },
  });
  assert.equal(login.statusCode, 200);
  const res = await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(login) } });
  assert.deepEqual(res.json(), { user: "mooma" });
});

test("音声エージェントの Bearer で入れるのは、エージェントが使う道だけ", async () => {
  const app = await buildApp();
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  const bearer = { authorization: "Bearer agent-token-for-test" };
  const ok = await app.inject({ url: "/api/voice/history", headers: bearer });
  assert.deepEqual(ok.json(), { agent: true });
  // ほかの道（レイアウト・拡張機能の操作など）には、トークンがあっても入れない
  assert.equal((await app.inject({ url: "/api/secret", headers: bearer })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/api/voice/history", headers: bearer })).statusCode, 401);
  const ng = await app.inject({ url: "/api/voice/history", headers: { authorization: "Bearer wrong" } });
  assert.equal(ng.statusCode, 401);
});

test("パスワードの間違いが続くと、しばらくログインを受け付けない", async () => {
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  for (let i = 0; i < 5; i++) {
    await assert.rejects(accounts.login("mooma", "wrong password", "x"), /違います/);
  }
  await assert.rejects(accounts.login("mooma", "correct horse", "x"), /しばらく待って/);
});

test("ログアウトとログインの取り消しで、その端末は入れなくなる", async () => {
  const app = await buildApp();
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  const a = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "mooma", password: "correct horse" },
  });
  const b = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "mooma", password: "correct horse" },
  });

  const sessions = (await app.inject({ url: "/api/auth/sessions", headers: { cookie: cookieOf(a) } })).json().sessions;
  const bId = (await app.inject({ url: "/api/auth/status", headers: { cookie: cookieOf(b) } })).json().sessionId;
  assert.ok(sessions.some((s: { id: string }) => s.id === bId));

  const revoke = await app.inject({
    method: "DELETE",
    url: `/api/auth/sessions/${bId}`,
    headers: { cookie: cookieOf(a) },
  });
  assert.equal(revoke.statusCode, 200);
  assert.equal((await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(b) } })).statusCode, 401);

  await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie: cookieOf(a) } });
  assert.equal((await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(a) } })).statusCode, 401);
});

test("アカウントの管理は管理者だけ。最後の管理者は消せない", async () => {
  const app = await buildApp();
  const admin = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "mooma", password: "correct horse", setupCode: await accounts.announceSetupCode(() => undefined) },
  });
  const created = await app.inject({
    method: "POST",
    url: "/api/accounts",
    headers: { cookie: cookieOf(admin) },
    payload: { username: "family", password: "family-pass", role: "member" },
  });
  assert.equal(created.statusCode, 200);

  const member = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "family", password: "family-pass" },
  });
  assert.equal((await app.inject({ url: "/api/accounts", headers: { cookie: cookieOf(member) } })).statusCode, 403);

  const adminId = (await app.inject({ url: "/api/auth/status", headers: { cookie: cookieOf(admin) } })).json().account
    .id;
  const removeLast = await app.inject({
    method: "DELETE",
    url: `/api/accounts/${adminId}`,
    headers: { cookie: cookieOf(admin) },
  });
  assert.equal(removeLast.statusCode, 409);

  // 消したアカウントのログインは使えなくなる
  const memberId = created.json().account.id;
  await app.inject({ method: "DELETE", url: `/api/accounts/${memberId}`, headers: { cookie: cookieOf(admin) } });
  assert.equal((await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(member) } })).statusCode, 401);
});

test("自分のパスワードを変えるには今のパスワードが要り、ほかの端末のログインは外れる", async () => {
  const app = await buildApp();
  const a = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { username: "mooma", password: "correct horse", setupCode: await accounts.announceSetupCode(() => undefined) },
  });
  const b = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "mooma", password: "correct horse" },
  });
  const id = a.json().account.id;

  const wrong = await app.inject({
    method: "PUT",
    url: `/api/accounts/${id}/password`,
    headers: { cookie: cookieOf(a) },
    payload: { currentPassword: "nope", password: "new password" },
  });
  assert.equal(wrong.statusCode, 403);

  const ok = await app.inject({
    method: "PUT",
    url: `/api/accounts/${id}/password`,
    headers: { cookie: cookieOf(a) },
    payload: { currentPassword: "correct horse", password: "new password" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal((await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(a) } })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/secret", headers: { cookie: cookieOf(b) } })).statusCode, 401);
});

test("別のサイトの画面からの書き込みは断る", async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    headers: { origin: "http://evil.example", host: "dashboard.lan:8787" },
    payload: { username: "mooma", password: "correct horse" },
  });
  assert.equal(res.statusCode, 403);
});

test("画面の言語はアカウントに覚え、別の端末でログインしても同じ言語になる", async () => {
  const app = await buildApp();
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  const first = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "mooma", password: "correct horse" } });
  const cookie = cookieOf(first);
  assert.equal((await app.inject({ url: "/api/auth/status", headers: { cookie } })).json().account.locale, undefined);

  const bad = await app.inject({ method: "PUT", url: "/api/auth/locale", headers: { cookie }, payload: { locale: "fr" } });
  assert.equal(bad.statusCode, 400);
  const set = await app.inject({ method: "PUT", url: "/api/auth/locale", headers: { cookie }, payload: { locale: "en" } });
  assert.equal(set.json().locale, "en");

  const other = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "mooma", password: "correct horse" } });
  const status = await app.inject({ url: "/api/auth/status", headers: { cookie: cookieOf(other) } });
  assert.equal(status.json().account.locale, "en");
  assert.equal((await app.inject({ method: "PUT", url: "/api/auth/locale", payload: { locale: "ja" } })).statusCode, 401);
});

test("表示の設定はアカウントに覚え、送った項目だけを変える", async () => {
  const app = await buildApp();
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "mooma", password: "correct horse" } });
  const cookie = cookieOf(login);
  const first = await app.inject({ method: "PUT", url: "/api/auth/display", headers: { cookie }, payload: { calendar: "japanese", weekStart: 1 } });
  assert.deepEqual(first.json().display, { calendar: "japanese", temperatureUnit: "c", weekStart: 1, dateFormat: "auto", clock: "24" });
  const second = await app.inject({ method: "PUT", url: "/api/auth/display", headers: { cookie }, payload: { temperatureUnit: "f" } });
  assert.equal(second.json().display.calendar, "japanese");
  assert.equal(second.json().display.temperatureUnit, "f");
  assert.equal((await app.inject({ method: "PUT", url: "/api/auth/display", headers: { cookie }, payload: { weekStart: 3 } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PUT", url: "/api/auth/display", headers: { cookie }, payload: { other: "x" } })).statusCode, 400);
  const status = await app.inject({ url: "/api/auth/status", headers: { cookie } });
  assert.equal(status.json().account.display.weekStart, 1);
});

test("端末をダッシュボード端末にでき、自分の端末か管理者だけが変えられる", async () => {
  const app = await buildApp();
  await accounts.setupFirstAccount("mooma", "correct horse", "壁", await accounts.announceSetupCode(() => undefined));
  await accounts.createAccount("kid", "password123", "member");
  const admin = cookieOf(await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "mooma", password: "correct horse", deviceName: "リビング" } }));
  const kid = cookieOf(await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "kid", password: "password123" } }));
  const status = (await app.inject({ url: "/api/auth/status", headers: { cookie: admin } })).json();
  assert.deepEqual(status.device, { dashboard: false, lite: "auto" });

  const put = (cookie: string, payload: unknown, id = status.sessionId) =>
    app.inject({ method: "PUT", url: `/api/auth/sessions/${id}/device`, headers: { cookie }, payload: payload as object });
  assert.equal((await put(admin, { dashboard: "yes" })).statusCode, 400);
  assert.equal((await put(admin, { lite: "maybe" })).statusCode, 400);
  // ほかの人の端末は変えられない（見つからないことにする）
  assert.equal((await put(kid, { dashboard: true })).statusCode, 404);
  const set = await put(admin, { dashboard: true });
  assert.deepEqual(set.json().session.device, { dashboard: true, lite: "auto" });
  assert.deepEqual((await put(admin, { lite: "on" })).json().session.device, { dashboard: true, lite: "on" });
  assert.equal((await app.inject({ url: "/api/auth/status", headers: { cookie: admin } })).json().device.dashboard, true);
  // 管理者はほかの人の端末も変えられる
  const kidSession = (await app.inject({ url: "/api/auth/status", headers: { cookie: kid } })).json().sessionId;
  assert.equal((await put(admin, { dashboard: true }, kidSession)).statusCode, 200);
});
