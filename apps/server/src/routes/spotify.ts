import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let currentRefreshToken = config.spotify.refreshToken;

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64");
}

async function getAccessToken(): Promise<string | null> {
  if (!currentRefreshToken || !config.spotify.clientId || !config.spotify.clientSecret) return null;
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

export async function registerSpotifyRoutes(app: FastifyInstance): Promise<void> {
  const idleState = (configured: boolean) => ({
    configured,
    isPlaying: false,
    shuffle: false,
    repeat: "off" as const,
    track: null,
  });

  app.get("/api/spotify/now-playing", async () => {
    const token = await getAccessToken();
    if (!token) return idleState(false);

    // currently-playing ではなく player を使う。シャッフル/リピートの状態はこちらにしか入っていない。
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return idleState(true);
    if (!res.ok) throw new Error(`spotify now-playing error: ${res.status}`);

    const data = (await res.json()) as SpotifyPlaybackState;
    if (!data.item) return idleState(true);

    return {
      configured: true,
      isPlaying: data.is_playing,
      shuffle: data.shuffle_state,
      repeat: data.repeat_state,
      track: {
        name: data.item.name,
        artist: data.item.artists.map((a) => a.name).join(", "),
        albumArtUrl: data.item.album.images[0]?.url ?? null,
      },
    };
  });

  interface ControlBody {
    action: "play" | "pause" | "next" | "previous" | "shuffle" | "repeat";
    /** shuffle なら true/false、repeat なら "off" | "track" | "context" */
    state?: boolean | "off" | "track" | "context";
  }

  app.post<{ Body: ControlBody }>("/api/spotify/control", async (request, reply) => {
    const token = await getAccessToken();
    if (!token) return reply.code(409).send({ error: "spotify not configured" });

    const { action, state } = request.body;
    const endpoints: Record<ControlBody["action"], { method: string; path: string }> = {
      play: { method: "PUT", path: "me/player/play" },
      pause: { method: "PUT", path: "me/player/pause" },
      next: { method: "POST", path: "me/player/next" },
      previous: { method: "POST", path: "me/player/previous" },
      shuffle: { method: "PUT", path: "me/player/shuffle" },
      repeat: { method: "PUT", path: "me/player/repeat" },
    };
    const endpoint = endpoints[action];
    if (!endpoint) return reply.code(400).send({ error: `unknown action: ${action}` });

    const url = new URL(`https://api.spotify.com/v1/${endpoint.path}`);
    if (action === "shuffle" || action === "repeat") {
      if (state === undefined) return reply.code(400).send({ error: `${action} requires state` });
      url.searchParams.set("state", String(state));
    }

    const res = await fetch(url, {
      method: endpoint.method,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 204) {
      return reply.code(502).send({ error: `spotify control error: ${res.status}` });
    }
    return { ok: true };
  });

  // 一度だけ実行する認可コードフロー。SPOTIFY_REFRESH_TOKEN 未設定時の初期セットアップ用。
  app.get("/auth/spotify/login", async (_request, reply) => {
    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id", config.spotify.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", config.spotify.redirectUri);
    url.searchParams.set("scope", SCOPES);
    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code?: string } }>("/auth/spotify/callback", async (request, reply) => {
    const { code } = request.query;
    if (!code) return reply.code(400).send("missing code");

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.spotify.redirectUri,
      }),
    });
    if (!res.ok) return reply.code(502).send(`token exchange failed: ${res.status}`);

    const data = (await res.json()) as { refresh_token: string };
    reply.type("text/plain");
    return (
      "認可に成功しました。以下のrefresh tokenを.envのSPOTIFY_REFRESH_TOKENに設定し、サーバーを再起動してください:\n\n" +
      data.refresh_token
    );
  });
}
