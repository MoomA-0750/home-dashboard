/**
 * ログインまわりの API。ログインのトークンは HttpOnly の cookie に置かれ、画面の JS からは見えない
 * （同じオリジンの fetch・WebSocket には、ブラウザが自動で添える）。
 */

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

import { defineMessages, getLocale, type DisplaySettings, type Locale } from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    requestFailed: "うまくいきませんでした（{status}）",
    androidPhone: "Android スマホ",
    androidTablet: "Android タブレット",
    thisDevice: "この端末",
    today: "今日",
    daysAgo: "{n}日前",
    noWebAuthn: "このブラウザはパスキーに対応していません",
    ipAddress: "IP アドレスで開いているとパスキーは使えません。名前のあるアドレス（tailnet の …ts.net など）で開いてください",
    httpsOnly: "パスキーは https で開いたときだけ使えます",
    passkeyExists: "この端末には、もうこのアカウントのパスキーがあります",
  },
  en: {
    requestFailed: "Something went wrong ({status})",
    androidPhone: "Android phone",
    androidTablet: "Android tablet",
    thisDevice: "This device",
    today: "today",
    daysAgo: (p) => (p.n === 1 ? "1 day ago" : `${p.n} days ago`),
    noWebAuthn: "This browser doesn't support passkeys",
    ipAddress: "Passkeys don't work when the page is opened by IP address. Open it with a host name (such as your tailnet's …ts.net address)",
    httpsOnly: "Passkeys only work over https",
    passkeyExists: "This device already has a passkey for this account",
  },
});

export type Role = "admin" | "member";

export interface Account {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  /** 画面の言語（選んでいなければ無い） */
  locale?: Locale;
  /** 日付・時刻・温度の出し方（選んでいなければ無い） */
  display?: DisplaySettings;
}

/** 端末ごとの設定（ダッシュボード端末か・軽い表示） */
export interface DeviceSettings {
  dashboard: boolean;
  lite: "auto" | "on" | "off";
}

export interface Session {
  id: string;
  accountId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  device: DeviceSettings;
}

export interface AuthStatus {
  setupRequired: boolean;
  account: Account | null;
  sessionId: string | null;
  device: DeviceSettings | null;
}

async function request<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body as T;
}

export function fetchAuthStatus(apiBaseUrl: string): Promise<AuthStatus> {
  return request(apiBaseUrl, "/api/auth/status");
}

export function signIn(
  apiBaseUrl: string,
  mode: "login" | "setup",
  username: string,
  password: string,
  deviceName: string,
  /** 最初のアカウントを作るときの合言葉（サーバーのログに出ている） */
  setupCode?: string,
) {
  return request<{ account: Account }>(apiBaseUrl, `/api/auth/${mode}`, {
    method: "POST",
    body: JSON.stringify({ username, password, deviceName, setupCode }),
  });
}

export function signOut(apiBaseUrl: string) {
  return request(apiBaseUrl, "/api/auth/logout", { method: "POST" });
}

export async function fetchSessions(apiBaseUrl: string): Promise<Session[]> {
  return (await request<{ sessions: Session[] }>(apiBaseUrl, "/api/auth/sessions")).sessions;
}

export function setDeviceSettings(apiBaseUrl: string, id: string, change: Partial<DeviceSettings>) {
  return request<{ session: Session }>(apiBaseUrl, `/api/auth/sessions/${encodeURIComponent(id)}/device`, {
    method: "PUT",
    body: JSON.stringify(change),
  });
}

export function revokeSession(apiBaseUrl: string, id: string) {
  return request(apiBaseUrl, `/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function changePassword(
  apiBaseUrl: string,
  accountId: string,
  currentPassword: string | null,
  password: string,
) {
  return request(apiBaseUrl, `/api/accounts/${encodeURIComponent(accountId)}/password`, {
    method: "PUT",
    body: JSON.stringify({ currentPassword, password }),
  });
}

export async function fetchAccounts(apiBaseUrl: string): Promise<Account[]> {
  return (await request<{ accounts: Account[] }>(apiBaseUrl, "/api/accounts")).accounts;
}

export function createAccount(apiBaseUrl: string, username: string, password: string, role: Role) {
  return request(apiBaseUrl, "/api/accounts", { method: "POST", body: JSON.stringify({ username, password, role }) });
}

export function deleteAccount(apiBaseUrl: string, id: string) {
  return request(apiBaseUrl, `/api/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** ログインした端末の一覧で見分けるための、端末の名前の初期値 */
export function defaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return messages.t(/Mobile/.test(ua) ? "androidPhone" : "androidTablet");
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Linux/.test(ua)) return "Linux";
  return messages.t("thisDevice");
}

export function relativeDate(iso: string, locale: Locale = getLocale()): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return messages.t("today", undefined, locale);
  return messages.t("daysAgo", { n: days }, locale);
}

// --- パスキー ---

export interface Passkey {
  id: string;
  accountId: string;
  name: string;
  /** 作ったときのアドレスのホスト名。パスキーはこのアドレスで開いたときだけ使える */
  rpId: string;
  /** 端末をまたいで同期されるパスキーか */
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

/** この画面でパスキーが使えないときの理由。使えるなら null */
export function passkeyUnavailableReason(): string | null {
  if (!browserSupportsWebAuthn()) return messages.t("noWebAuthn");
  const host = location.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":"))
    return messages.t("ipAddress");
  if (!window.isSecureContext) return messages.t("httpsOnly");
  return null;
}

/** 端末の画面で取り消された・時間切れになったときは、何も言わずに戻す */
function isCancelled(err: unknown): boolean {
  return err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError");
}

/**
 * パスキーでログインする。autofill のときは、ユーザー名の欄の候補から選ばれるまで待つ。
 * 取り消されたときは null を返す
 */
export async function signInWithPasskey(apiBaseUrl: string, deviceName: string, autofill = false) {
  const { challengeId, options } = await request<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
    apiBaseUrl,
    "/api/auth/passkey/options",
    { method: "POST" },
  );
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill });
  } catch (err) {
    if (isCancelled(err)) return null;
    throw err;
  }
  return request<{ account: Account }>(apiBaseUrl, "/api/auth/passkey/login", {
    method: "POST",
    body: JSON.stringify({ challengeId, response, deviceName }),
  });
}

export async function fetchPasskeys(apiBaseUrl: string): Promise<Passkey[]> {
  return (await request<{ passkeys: Passkey[] }>(apiBaseUrl, "/api/auth/passkeys")).passkeys;
}

/** この端末でパスキーを作って登録する。取り消されたときは null を返す */
export async function addPasskey(apiBaseUrl: string, name: string): Promise<Passkey | null> {
  const { challengeId, options } = await request<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>(apiBaseUrl, "/api/auth/passkeys/options", { method: "POST" });
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (err) {
    if (isCancelled(err)) return null;
    if (err instanceof Error && err.name === "InvalidStateError")
      throw new Error(messages.t("passkeyExists"));
    throw err;
  }
  const { passkey } = await request<{ passkey: Passkey }>(apiBaseUrl, "/api/auth/passkeys", {
    method: "POST",
    body: JSON.stringify({ challengeId, response, name }),
  });
  return passkey;
}

export function deletePasskey(apiBaseUrl: string, id: string) {
  return request(apiBaseUrl, `/api/auth/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
}
