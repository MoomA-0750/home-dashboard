import { createHash, randomBytes } from "node:crypto";
import { HttpError, type SettingValue } from "@home-dashboard/extension-sdk";
import type { AccountStore, OAuthCredentials, StoredAccount } from "./store";
import { jaText } from "./serverMessages";

/**
 * Google・Microsoft の OAuth（ログインして、カレンダーとメールを扱う許しをもらう）。
 * - クライアント ID・シークレットは管理者が拡張機能の接続設定で入れる（Google Cloud・Microsoft Entra で作る）
 * - 戻り先は「戻り先の URL の頭」/auth/accounts/<google|microsoft>/callback。各サービスにこの URL を登録する
 * - PKCE と state で、始めた本人のログインにだけ結び付ける。refresh token はアカウントの置き場に入れ、画面には返さない
 */

export type OAuthProvider = "google" | "microsoft";

/** 試すときに偽のサーバーへ向けられるよう、入口をまとめる */
export const endpoints = {
  googleAuthorize: "https://accounts.google.com/o/oauth2/v2/auth",
  googleToken: "https://oauth2.googleapis.com/token",
  googleUserinfo: "https://openidconnect.googleapis.com/v1/userinfo",
  googleApi: "https://www.googleapis.com",
  microsoftLogin: "https://login.microsoftonline.com",
  graph: "https://graph.microsoft.com/v1.0",
};

const SCOPES: Record<OAuthProvider, string[]> = {
  google: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  microsoft: ["openid", "email", "offline_access", "User.Read", "Calendars.ReadWrite", "Mail.ReadWrite", "Mail.Send"],
};

const PENDING_TTL_MS = 10 * 60 * 1000;

interface Pending {
  provider: OAuthProvider;
  ownerId: string;
  verifier: string;
  redirectUri: string;
  /** ログインし直し（トークンが切れたとき）なら、そのアカウント */
  accountId: string | null;
  expiresAt: number;
}

const pending = new Map<string, Pending>();
const refreshing = new Map<string, Promise<string>>();

function clientOf(provider: OAuthProvider, settings: Record<string, SettingValue>) {
  const id = String(settings[`${provider}ClientId`] ?? "").trim();
  const secret = String(settings[`${provider}ClientSecret`] ?? "").trim();
  if (!id || !secret)
    throw new HttpError(
      409,
      jaText("oauthNotConfigured", { provider: provider === "google" ? "Google" : "Microsoft" }),
    );
  return { id, secret };
}

function tokenUrl(provider: OAuthProvider, settings: Record<string, SettingValue>): string {
  if (provider === "google") return endpoints.googleToken;
  const tenant = String(settings.microsoftTenant || "common");
  return `${endpoints.microsoftLogin}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

/** その種類のアカウントを OAuth で足せるか（管理者がクライアントを設定したか） */
export function oauthAvailable(provider: OAuthProvider, settings: Record<string, SettingValue>): boolean {
  return Boolean(String(settings[`${provider}ClientId`] ?? "").trim() && String(settings[`${provider}ClientSecret`] ?? "").trim());
}

export function redirectUriOf(provider: OAuthProvider, settings: Record<string, SettingValue>): string {
  const base = String(settings.redirectBase ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base))
    throw new HttpError(409, jaText("redirectBaseMissing"));
  return `${base}/auth/accounts/${provider}/callback`;
}

/** ログインのページの URL を作る（画面はそこへ移る） */
export function startOAuth(
  provider: OAuthProvider,
  ownerId: string,
  settings: Record<string, SettingValue>,
  accountId: string | null = null,
): string {
  const client = clientOf(provider, settings);
  const redirectUri = redirectUriOf(provider, settings);
  const now = Date.now();
  for (const [key, value] of pending) if (value.expiresAt < now) pending.delete(key);
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  pending.set(state, { provider, ownerId, verifier, redirectUri, accountId, expiresAt: now + PENDING_TTL_MS });
  const params = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES[provider].join(" "),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    // refresh token をもらう（Google は毎回の同意で必ず出す）
    ...(provider === "google" ? { access_type: "offline", prompt: "consent" } : { prompt: "select_account" }),
  });
  const authorize =
    provider === "google"
      ? endpoints.googleAuthorize
      : `${endpoints.microsoftLogin}/${encodeURIComponent(String(settings.microsoftTenant || "common"))}/oauth2/v2.0/authorize`;
  return `${authorize}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  /** 許された範囲（空白区切り）。Google では、同意の画面で外した項目は入ってこない */
  scope?: string;
  error?: string;
  error_description?: string;
}

async function requestToken(
  provider: OAuthProvider,
  settings: Record<string, SettingValue>,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const client = clientOf(provider, settings);
  const res = await fetch(tokenUrl(provider, settings), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant")
      throw new HttpError(401, jaText("loginExpired"));
    throw new HttpError(502, jaText("loginFailed", { reason: json.error_description ?? json.error ?? res.status }));
  }
  return json;
}

async function emailOf(provider: OAuthProvider, accessToken: string): Promise<string | null> {
  const url = provider === "google" ? endpoints.googleUserinfo : `${endpoints.graph}/me`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const body = (await res.json()) as { email?: string; mail?: string; userPrincipalName?: string };
  return body.email ?? body.mail ?? body.userPrincipalName ?? null;
}

/**
 * ログインのページから戻ってきたとき。始めた本人のログインと同じかを確かめ、アカウントを足す（ログインし直しなら書き換える）
 */
export async function finishOAuth(
  provider: OAuthProvider,
  query: Record<string, string | undefined>,
  /** 戻ってきた画面でログインしている人。ログインが付いてこなければ null */
  ownerId: string | null,
  settings: Record<string, SettingValue>,
  store: AccountStore,
): Promise<StoredAccount> {
  if (query.error) throw new HttpError(400, jaText("loginCancelled", { reason: query.error }));
  const entry = query.state ? pending.get(query.state) : undefined;
  if (query.state) pending.delete(query.state);
  if (!entry || entry.provider !== provider || entry.expiresAt < Date.now() || !query.code)
    throw new HttpError(400, jaText("loginStale"));
  // ダッシュボードのログイン（cookie）が付いてこない戻り（Android でアプリとして開いたダッシュボードから、別のブラウザーの画面で
  // ログインしたときなど）は、始めたときに覚えた人のものにする。state は推し量れず、一度だけ・10分だけ使える。
  // 付いてきたときは、始めた人と同じかを確かめる
  if (ownerId !== null && entry.ownerId !== ownerId) throw new HttpError(403, jaText("loginWrongUser"));
  const owner = entry.ownerId;

  const tokens = await requestToken(provider, settings, {
    grant_type: "authorization_code",
    code: query.code,
    redirect_uri: entry.redirectUri,
    code_verifier: entry.verifier,
  });
  if (!tokens.refresh_token) throw new HttpError(502, jaText("noRefreshToken"));
  // Google の同意の画面は項目ごとにチェックを外せる。外したまま進むとつながったように見えて、使うときに初めて断られるので、ここで止める
  const missing = missingScopes(provider, tokens.scope);
  if (missing.length > 0)
    throw new HttpError(403, jaText("scopesMissing", { provider: provider === "google" ? "Google" : "Microsoft" }));
  const credentials: OAuthCredentials = {
    kind: "oauth",
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token!,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };
  const email = await emailOf(provider, tokens.access_token!);
  if (entry.accountId) return store.update(entry.accountId, (account) => ({ ...account, credentials, email: email ?? account.email }));
  return store.add({
    provider,
    label: email ?? (provider === "google" ? "Google" : "Microsoft"),
    email,
    ownerId: owner,
    shared: false,
    services: { calendar: true, mail: true },
    credentials,
    servers: {},
  });
}

/** 求めたのに許されなかった範囲（Google だけを見る。Microsoft は項目ごとに外せず、返す名前の形も揃わない） */
export function missingScopes(provider: OAuthProvider, granted: string | undefined): string[] {
  if (provider !== "google" || granted === undefined) return [];
  const have = new Set(granted.split(/\s+/));
  return SCOPES.google.filter((scope) => scope.startsWith("https://") && !have.has(scope));
}

/** Google の 403 の理由を、管理者・本人がすることの分かる文にする */
function forbiddenText(reason: string | undefined, body: unknown): string {
  const text = `${reason ?? ""} ${JSON.stringify(body)}`;
  if (/SERVICE_DISABLED|accessNotConfigured|has not been used in project/i.test(text)) {
    const api = /^(.+? API) has not been used/.exec(reason ?? "")?.[1] ?? "API";
    return jaText("apiDisabled", { api });
  }
  if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes|insufficientPermissions/i.test(text))
    return jaText("scopesInsufficient");
  return jaText("forbidden", { reason: reason ?? "403" });
}

/** 使える access token。切れそうなら refresh token で取り直して覚える（同じアカウントで同時に取り直さない） */
export function tokenFor(
  account: StoredAccount,
  settings: Record<string, SettingValue>,
  store: AccountStore,
): Promise<string> {
  const credentials = account.credentials;
  if (credentials.kind !== "oauth") return Promise.reject(new HttpError(400, jaText("notOAuth")));
  if (credentials.accessToken && credentials.expiresAt - 60_000 > Date.now()) return Promise.resolve(credentials.accessToken);
  let running = refreshing.get(account.id);
  if (!running) {
    running = (async () => {
      const provider = account.provider as OAuthProvider;
      const tokens = await requestToken(provider, settings, {
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        ...(provider === "microsoft" ? { scope: SCOPES.microsoft.join(" ") } : {}),
      });
      const next: OAuthCredentials = {
        kind: "oauth",
        // Microsoft は取り直すたびに新しい refresh token をくれる
        refreshToken: tokens.refresh_token ?? credentials.refreshToken,
        accessToken: tokens.access_token!,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      };
      await store.update(account.id, (current) => ({ ...current, credentials: next }));
      account.credentials = next;
      return next.accessToken!;
    })().finally(() => refreshing.delete(account.id));
    refreshing.set(account.id, running);
  }
  return running;
}

/** Bearer を付けて JSON の API を呼ぶ。失敗は画面に出せる理由にする */
export async function apiFetch<T>(
  url: string,
  token: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
  if (!res.ok) {
    const reason = typeof body.error === "string" ? body.error : body.error?.message;
    if (res.status === 401) throw new HttpError(401, jaText("loginExpired"));
    if (res.status === 403) throw new HttpError(403, forbiddenText(reason, body));
    if (res.status === 404) throw new HttpError(404, jaText("notFound"));
    throw new HttpError(502, jaText("serviceFailed", { reason: reason ?? res.status }));
  }
  return body as T;
}
