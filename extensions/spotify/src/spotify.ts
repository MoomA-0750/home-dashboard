import { randomBytes } from "node:crypto";
import { HttpError, type SettingValue } from "@home-dashboard/extension-sdk";
import { localizedError } from "./messages";

/**
 * 後半（プレイリスト・最近聴いた曲・よく聴く曲）は Media 画面で使う。
 * これより前に発行した refresh token には入っていないので、Media 画面を使うには /auth/spotify/login で認可し直す
 */
export const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-recently-played",
  "user-top-read",
].join(" ");

/** 接続設定の今の値（server.ts の register で api.settings を入れる） */
export const spotifySettings: { current: Record<string, SettingValue> } = { current: {} };
const setting = (key: string) => String(spotifySettings.current[key] ?? "");

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let currentRefreshToken = "";

/** 設定画面でアプリやトークンを変えたら、覚えているトークンを捨てて新しい値で取り直す */
export function resetSpotifyTokens(): void {
  currentRefreshToken = setting("refreshToken");
  cachedAccessToken = null;
}

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${setting("clientId")}:${setting("clientSecret")}`).toString("base64");
}

async function getAccessToken(): Promise<string | null> {
  if (!currentRefreshToken || !setting("clientId") || !setting("clientSecret")) return null;
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 5000) {
    return cachedAccessToken.token;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: currentRefreshToken }),
  });
  if (!res.ok) throw new Error(`spotify token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  if (data.refresh_token) currentRefreshToken = data.refresh_token;
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedAccessToken.token;
}

/**
 * 認可済みのトークンで Spotify Web API を呼ぶ。未設定なら null。
 * 404（再生中の端末が無い）と 401/403（認可の範囲が足りない）は HttpError にして呼び出し側へ伝える。
 */
export async function spotifyFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (res.status === 401 || res.status === 403) {
    // 認可の範囲が足りないとき（scope）と、開発モードのアプリでは使えない機能のとき（2026年2月の変更）がある
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    const insufficientScope = /scope/i.test(detail);
    throw localizedError(403, insufficientScope ? "reauthorize" : "refused", { detail });
  }
  return res;
}

interface SpotifyPlaybackState {
  is_playing: boolean;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
  item: {
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
  } | null;
}

export type SpotifyAction = "play" | "pause" | "next" | "previous" | "shuffle" | "repeat";
/** shuffle なら true/false、repeat なら "off" | "track" | "context" */
export type SpotifyActionState = boolean | "off" | "track" | "context";

export async function controlSpotify(action: SpotifyAction, state?: SpotifyActionState): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new HttpError(409, "spotify not configured");

  const endpoints: Record<SpotifyAction, { method: string; path: string }> = {
    play: { method: "PUT", path: "me/player/play" },
    pause: { method: "PUT", path: "me/player/pause" },
    next: { method: "POST", path: "me/player/next" },
    previous: { method: "POST", path: "me/player/previous" },
    shuffle: { method: "PUT", path: "me/player/shuffle" },
    repeat: { method: "PUT", path: "me/player/repeat" },
  };
  const endpoint = endpoints[action];
  if (!endpoint) throw new HttpError(400, `unknown action: ${action}`);

  const url = new URL(`https://api.spotify.com/v1/${endpoint.path}`);
  if (action === "shuffle" || action === "repeat") {
    if (state === undefined) throw new HttpError(400, `${action} requires state`);
    url.searchParams.set("state", String(state));
  }

  const res = await fetch(url, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${token}` },
  });
  // 再生中の端末が無いと 404 NO_ACTIVE_DEVICE が返る
  if (res.status === 404) throw new HttpError(409, "no active spotify device");
  if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify control error: ${res.status}`);
}

// 認可を始めた人と、戻ってきた認可を結び付ける印（state）。10分で切れ、一度使えば捨てる。
// 印が無いと、よその人が自分の Spotify の code を付けた戻り先のリンクを踏ませるだけで、家の連携を差し替えられる
const STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map<string, { accountId: string; expiresAt: number }>();

/** 認可のページ（Spotify のログイン画面）の URL。accountId は認可を始めた人 */
export function authorizeUrl(accountId: string): string {
  const now = Date.now();
  for (const [key, value] of pendingStates) if (value.expiresAt < now) pendingStates.delete(key);
  const state = randomBytes(24).toString("base64url");
  pendingStates.set(state, { accountId, expiresAt: now + STATE_TTL_MS });
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", setting("clientId"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", setting("redirectUri"));
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

/** 戻ってきた state が、同じ人が始めた期限内の認可のものか（一度きり） */
export function takeAuthorizeState(state: string | undefined, accountId: string): boolean {
  if (!state) return false;
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  return Boolean(pending && pending.accountId === accountId && pending.expiresAt >= Date.now());
}

/** 認可の戻り先で受け取った code を refresh token に換える */
export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: setting("redirectUri"),
    }),
  });
  if (!res.ok) throw new HttpError(502, `token exchange failed: ${res.status}`);
  const data = (await res.json()) as { refresh_token: string };
  return data.refresh_token;
}
