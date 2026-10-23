import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiFetch, endpoints, finishOAuth, startOAuth, tokenFor } from "./oauth";
import { AccountStore, type StoredAccount } from "./store";
import { gmail, googleCalendar } from "./providers/google";
import { microsoftCalendar, outlookMail } from "./providers/microsoft";
import type { AccountContext } from "./providers/types";

// Google・Microsoft の代わりの偽のサーバー。受けた要求を覚え、決まった返事をする
const seen: { method: string; path: string; body: string; auth: string | undefined }[] = [];
let refreshCount = 0;
const lastSeen = (match: (r: (typeof seen)[number]) => boolean) => [...seen].reverse().find(match);
const RAW_MAIL = [
  "From: Mom <mom@example.com>",
  "To: me@example.com",
  "Subject: hello",
  "Message-ID: <orig@example.com>",
  "Date: Tue, 20 Oct 2026 09:00:00 +0900",
  "",
  "body text",
].join("\r\n");

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

const server = createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url ?? "/", "http://x");
  seen.push({ method: req.method ?? "", path: url.pathname + url.search, body, auth: req.headers.authorization });
  const json = (value: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  const form = new URLSearchParams(body);
  if (url.pathname === "/token") {
    // code が narrow なら、同意の画面でカレンダーと Gmail のチェックを外して進んだときの返事
    if (form.get("grant_type") === "authorization_code" && form.get("code") === "narrow")
      return json({ access_token: "access-n", refresh_token: "refresh-n", expires_in: 3600, scope: "openid https://www.googleapis.com/auth/userinfo.email" });
    if (form.get("grant_type") === "authorization_code")
      return json({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600 });
    refreshCount++;
    return json({ access_token: `access-r${refreshCount}`, refresh_token: `refresh-r${refreshCount}`, expires_in: 3600 });
  }
  if (url.pathname === "/common/oauth2/v2.0/token") return json({ access_token: "ms-access", refresh_token: "ms-refresh-2", expires_in: 3600 });
  if (url.pathname === "/userinfo") return json({ email: "me@gmail.com" });
  if (url.pathname === "/calendar/v3/calendars/primary/events" && req.method === "GET")
    return json({
      items: [
        { id: "a", summary: "終日", start: { date: "2026-10-21" }, end: { date: "2026-10-22" } },
        { id: "b", summary: "会議", start: { dateTime: "2026-10-21T10:00:00+09:00" }, end: { dateTime: "2026-10-21T11:00:00+09:00" }, recurringEventId: "r" },
        { id: "c", status: "cancelled" },
      ],
    });
  if (url.pathname === "/calendar/v3/calendars/primary/events" && req.method === "POST")
    return json({ id: "new", ...JSON.parse(body) });
  if (url.pathname === "/gmail/v1/users/me/messages" && req.method === "GET") return json({ messages: [{ id: "m1" }] });
  if (url.pathname === "/gmail/v1/users/me/messages/m1" && url.searchParams.get("format") === "metadata")
    return json({
      id: "m1",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "it&#39;s me",
      payload: { headers: [{ name: "From", value: '"Mom" <mom@example.com>' }, { name: "Subject", value: "hello" }, { name: "Date", value: "Tue, 20 Oct 2026 09:00:00 +0900" }] },
    });
  if (url.pathname === "/gmail/v1/users/me/messages/m1")
    return json({ id: "m1", threadId: "t1", labelIds: ["INBOX"], raw: Buffer.from(RAW_MAIL).toString("base64url") });
  if (url.pathname === "/gmail/v1/users/me/messages/send") return json({ id: "sent" });
  if (url.pathname.endsWith("/calendarView"))
    return json({
      value: [
        { id: "x", subject: "歯医者", start: { dateTime: "2026-10-21T01:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-10-21T02:00:00.0000000", timeZone: "UTC" }, type: "singleInstance" },
        { id: "y", subject: "休み", isAllDay: true, start: { dateTime: "2026-10-22T00:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-10-23T00:00:00.0000000", timeZone: "UTC" } },
      ],
    });
  if (url.pathname === "/v1.0/me/messages/z/reply") return json({}, 202);
  if (url.pathname === "/disabled")
    return json({ error: { code: 403, message: "Google Calendar API has not been used in project 1 before or it is disabled.", status: "PERMISSION_DENIED", details: [{ reason: "SERVICE_DISABLED" }] } }, 403);
  if (url.pathname === "/narrow")
    return json({ error: { code: 403, message: "Request had insufficient authentication scopes.", status: "PERMISSION_DENIED", details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } }, 403);
  json({ error: { message: `unknown ${url.pathname}` } }, 404);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
after(() => server.close());

Object.assign(endpoints, {
  googleAuthorize: `${base}/authorize`,
  googleToken: `${base}/token`,
  googleUserinfo: `${base}/userinfo`,
  googleApi: base,
  microsoftLogin: base,
  graph: `${base}/v1.0`,
});

const settings = {
  googleClientId: "gid",
  googleClientSecret: "gsecret",
  microsoftClientId: "mid",
  microsoftClientSecret: "msecret",
  redirectBase: "https://dash.tailnet-name.ts.net/",
};
const store = new AccountStore(await mkdtemp(join(tmpdir(), "oauth-")));

test("ログインを始めた本人にだけ結び付け、戻ってきたらアカウントを足す（同じ state は2度使えない）", async () => {
  const url = new URL(startOAuth("google", "me", settings));
  assert.equal(url.searchParams.get("redirect_uri"), "https://dash.tailnet-name.ts.net/auth/accounts/google/callback");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "offline");
  const state = url.searchParams.get("state")!;

  await assert.rejects(finishOAuth("google", { state, code: "c" }, "someone-else", settings, store), /同じアカウント/);
  // 違う人で失敗した state は捨てたので、本人がやり直す
  const retry = new URL(startOAuth("google", "me", settings)).searchParams.get("state")!;
  const account = await finishOAuth("google", { state: retry, code: "c" }, "me", settings, store);
  assert.equal(account.email, "me@gmail.com");
  assert.equal(account.ownerId, "me");
  assert.equal(account.credentials.kind === "oauth" && account.credentials.refreshToken, "refresh-1");
  const token = seen.find((r) => r.path === "/token")!;
  assert.match(token.body, /code_verifier=/);
  await assert.rejects(finishOAuth("google", { state: retry, code: "c" }, "me", settings, store), /もう一度/);
});

test("同意の画面でカレンダー・Gmail のチェックを外して進んだら、足さずにその場で知らせる", async () => {
  const state = new URL(startOAuth("google", "me", settings)).searchParams.get("state")!;
  await assert.rejects(finishOAuth("google", { state, code: "narrow" }, "me", settings, store), /すべて選択/);
});

test("ダッシュボードのログインが付いてこない戻りは、始めた人のものにする", async () => {
  const state = new URL(startOAuth("google", "me", settings)).searchParams.get("state")!;
  const account = await finishOAuth("google", { state, code: "c" }, null, settings, store);
  assert.equal(account.ownerId, "me");
});

test("Google の 403 は、API が切ってあるのか許しが足りないのかを分けて知らせる", async () => {
  await assert.rejects(apiFetch(`${base}/disabled`, "t"), /Google Calendar API が有効になっていません/);
  await assert.rejects(apiFetch(`${base}/narrow`, "t"), /足し直し/);
});

test("切れた access token は取り直して覚え、取り直しは同時に1回だけ", async () => {
  const [account] = await store.all();
  if (account.credentials.kind === "oauth") account.credentials.expiresAt = 0;
  const [a, b] = await Promise.all([tokenFor(account, settings, store), tokenFor(account, settings, store)]);
  assert.equal(a, "access-r1");
  assert.equal(b, "access-r1");
  assert.equal(refreshCount, 1);
  const saved = (await store.get(account.id))!;
  assert.equal(saved.credentials.kind === "oauth" && saved.credentials.refreshToken, "refresh-r1");
});

const ctx = (account: Partial<StoredAccount> = {}): AccountContext => ({
  account: { email: "me@gmail.com", ...account } as StoredAccount,
  token: async () => "tok",
});

test("Google カレンダー: 終日と時刻の予定を読み、取り消した予定は出さない", async () => {
  const events = await googleCalendar.listEvents(ctx(), "primary", { from: "2026-10-21T00:00:00Z", to: "2026-10-23T00:00:00Z" });
  assert.deepEqual(
    events.map((e) => [e.title, e.start, e.allDay, e.recurring]),
    [
      ["終日", "2026-10-21", true, false],
      ["会議", "2026-10-21T01:00:00.000Z", false, true],
    ],
  );
  await googleCalendar.createEvent(ctx(), "primary", { title: "旅行", start: "2026-12-29", end: "2026-12-31", allDay: true });
  const posted = JSON.parse(lastSeen((r) => r.method === "POST" && r.path.includes("/events"))!.body);
  assert.deepEqual(posted.start, { date: "2026-12-29" });
  assert.equal(seen.at(-1)!.auth, "Bearer tok");
});

test("Gmail: 一覧・中身を読み、返信は同じスレッドに元のメールにつないで送る", async () => {
  const [summary] = await gmail.listMessages(ctx(), { unreadOnly: true, limit: 5, folder: "inbox" });
  assert.deepEqual(summary, {
    id: "m1",
    from: { name: "Mom", address: "mom@example.com" },
    subject: "hello",
    date: "2026-10-20T00:00:00.000Z",
    unread: true,
    snippet: "it's me",
    to: [],
  });
  assert.match(seen.find((r) => r.path.startsWith("/gmail/v1/users/me/messages?"))!.path, /q=is%3Aunread/);
  // 迷惑メールは SPAM のラベルで、頼んで一覧に入れてもらう
  await gmail.listMessages(ctx(), { unreadOnly: false, limit: 5, folder: "junk" });
  const junk = lastSeen((r) => r.path.startsWith("/gmail/v1/users/me/messages?"))!.path;
  assert.match(junk, /labelIds=SPAM/);
  assert.match(junk, /includeSpamTrash=true/);
  const message = await gmail.getMessage(ctx(), "m1");
  assert.equal(message.text, "body text");
  assert.equal(message.threadId, "t1");

  await gmail.send(ctx(), { to: ["mom@example.com"], cc: [], subject: "", text: "ok", replyTo: message });
  const sent = JSON.parse(lastSeen((r) => r.path.endsWith("/messages/send"))!.body);
  assert.equal(sent.threadId, "t1");
  const raw = Buffer.from(sent.raw, "base64url").toString();
  assert.match(raw, /In-Reply-To: <orig@example.com>/);
  assert.match(raw, /Subject: Re: hello/);
});

test("Microsoft: 時刻は UTC で読み、終日は日付にする。返信は返信の口で送る", async () => {
  const events = await microsoftCalendar.listEvents(ctx(), "cal", { from: "2026-10-21T00:00:00Z", to: "2026-10-23T00:00:00Z" });
  assert.deepEqual(
    events.map((e) => [e.title, e.start, e.end, e.allDay]),
    [
      ["歯医者", "2026-10-21T01:00:00.000Z", "2026-10-21T02:00:00.000Z", false],
      ["休み", "2026-10-22", "2026-10-23", true],
    ],
  );
  assert.match(lastSeen((r) => r.path.includes("calendarView"))!.path, /startDateTime=/);
  await outlookMail.send(ctx(), {
    to: ["mom@example.com"],
    cc: [],
    subject: "",
    text: "了解",
    replyTo: { id: "z" } as never,
  });
  const reply = JSON.parse(lastSeen((r) => r.path === "/v1.0/me/messages/z/reply")!.body);
  assert.equal(reply.comment, "了解");
});
