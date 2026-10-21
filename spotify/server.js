import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// packages/extension-sdk/src/index.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
};
function defineServerMessages(dicts) {
  return {
    t(locale, key, params) {
      const value = dicts[locale][key] ?? dicts.ja[key];
      if (typeof value === "function") return value(params ?? {});
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
    }
  };
}
function defineServerExtension(extension) {
  return extension;
}

// extensions/spotify/src/messages.ts
var messages = defineServerMessages({
  ja: {
    reauthorize: "Spotify \u3067\u8A8D\u53EF\u3057\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\uFF08/auth/spotify/login\uFF09: {detail}",
    refused: "Spotify \u304C\u65AD\u308A\u307E\u3057\u305F: {detail}",
    noDevice: "\u518D\u751F\u4E2D\u306E Spotify \u306E\u7AEF\u672B\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u3069\u3053\u304B\u3067 Spotify \u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044",
    similarTo: "\u300C{title}\u300D\u306B\u4F3C\u305F\u66F2",
    topTitle: "\u6700\u8FD1\u3088\u304F\u8074\u304F\u66F2",
    topNote: "\u3053\u30534\u9031\u9593\u307B\u3069\u3067\u3088\u304F\u8074\u3044\u305F\u66F2",
    recentTitle: "\u6700\u8FD1\u8074\u3044\u305F\u66F2",
    needClient: "\u5148\u306B\u63A5\u7D9A\u8A2D\u5B9A\u3067 Client ID \u3068 Client Secret \u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    authorized: "\u8A8D\u53EF\u306B\u6210\u529F\u3057\u307E\u3057\u305F\u3002\u30C8\u30FC\u30AF\u30F3\u3092\u4FDD\u5B58\u3057\u305F\u306E\u3067\u3001\u3053\u306E\u30DA\u30FC\u30B8\u306F\u9589\u3058\u3066\u304B\u307E\u3044\u307E\u305B\u3093\u3002"
  },
  en: {
    reauthorize: "Authorize with Spotify again (/auth/spotify/login): {detail}",
    refused: "Spotify refused: {detail}",
    noDevice: "No Spotify device is playing. Open Spotify somewhere",
    similarTo: 'Similar to "{title}"',
    topTitle: "Your top tracks lately",
    topNote: "Songs you've played most in about the last 4 weeks",
    recentTitle: "Recently played",
    needClient: "Enter the Client ID and Client Secret in the connection settings first",
    authorized: "Authorization succeeded. The token has been saved, so you can close this page."
  }
});
function localizedError(statusCode, key, params) {
  const localized = { ja: messages.t("ja", key, params), en: messages.t("en", key, params) };
  return Object.assign(new HttpError(statusCode, localized.ja), { localized });
}

// extensions/spotify/src/spotify.ts
var SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-recently-played",
  "user-top-read"
].join(" ");
var spotifySettings = { current: {} };
var setting = (key) => String(spotifySettings.current[key] ?? "");
var cachedAccessToken = null;
var currentRefreshToken = "";
function resetSpotifyTokens() {
  currentRefreshToken = setting("refreshToken");
  cachedAccessToken = null;
}
function basicAuthHeader() {
  return "Basic " + Buffer.from(`${setting("clientId")}:${setting("clientSecret")}`).toString("base64");
}
async function getAccessToken() {
  if (!currentRefreshToken || !setting("clientId") || !setting("clientSecret")) return null;
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 5e3) {
    return cachedAccessToken.token;
  }
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: currentRefreshToken })
  });
  if (!res.ok) throw new Error(`spotify token refresh failed: ${res.status}`);
  const data = await res.json();
  if (data.refresh_token) currentRefreshToken = data.refresh_token;
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1e3 };
  return cachedAccessToken.token;
}
async function spotifyFetch(path, init) {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers }
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => null);
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    const insufficientScope = /scope/i.test(detail);
    throw localizedError(403, insufficientScope ? "reauthorize" : "refused", { detail });
  }
  return res;
}
async function controlSpotify(action, state) {
  const token = await getAccessToken();
  if (!token) throw new HttpError(409, "spotify not configured");
  const endpoints = {
    play: { method: "PUT", path: "me/player/play" },
    pause: { method: "PUT", path: "me/player/pause" },
    next: { method: "POST", path: "me/player/next" },
    previous: { method: "POST", path: "me/player/previous" },
    shuffle: { method: "PUT", path: "me/player/shuffle" },
    repeat: { method: "PUT", path: "me/player/repeat" }
  };
  const endpoint = endpoints[action];
  if (!endpoint) throw new HttpError(400, `unknown action: ${action}`);
  const url = new URL(`https://api.spotify.com/v1/${endpoint.path}`);
  if (action === "shuffle" || action === "repeat") {
    if (state === void 0) throw new HttpError(400, `${action} requires state`);
    url.searchParams.set("state", String(state));
  }
  const res = await fetch(url, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) throw new HttpError(409, "no active spotify device");
  if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify control error: ${res.status}`);
}
function authorizeUrl() {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", setting("clientId"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", setting("redirectUri"));
  url.searchParams.set("scope", SCOPES);
  return url.toString();
}
async function exchangeCode(code) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: setting("redirectUri")
    })
  });
  if (!res.ok) throw new HttpError(502, `token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.refresh_token;
}

// extensions/spotify/src/provider.ts
function pickImage(images) {
  if (!images || images.length === 0) return null;
  const sized = images.filter((image) => image.width);
  const near = sized.sort((a, b) => Math.abs((a.width ?? 0) - 300) - Math.abs((b.width ?? 0) - 300))[0];
  return (near ?? images[0]).url;
}
function toTrack(item) {
  return {
    uri: item.uri,
    title: item.name,
    artist: item.artists?.map((artist) => artist.name).join(", ") || item.show?.name || "",
    album: item.album?.name ?? null,
    artUrl: pickImage(item.album?.images ?? item.images ?? item.show?.images),
    durationMs: item.duration_ms ?? null
  };
}
async function readJson(path) {
  const res = await spotifyFetch(path);
  if (!res) return null;
  if (res.status === 204) return null;
  if (!res.ok) throw new HttpError(502, `spotify error: ${res.status} (${path.split("?")[0]})`);
  return await res.json();
}
function idFromUri(uri) {
  const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri);
  return match ? match[1] : null;
}
var URI_PATTERN = /^spotify:(track|episode|playlist|album|artist):[A-Za-z0-9]+$/;
var spotifyProvider = {
  id: "spotify",
  name: "Spotify",
  async getPlayback() {
    const observedAt = (/* @__PURE__ */ new Date()).toISOString();
    const idle = (configured) => ({
      configured,
      provider: "spotify",
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      track: null,
      progressMs: null,
      observedAt,
      deviceName: null,
      volumePercent: null
    });
    if (!spotifySettings.current.refreshToken) return idle(false);
    const data = await readJson("me/player?additional_types=episode");
    if (!data || !data.item) return idle(true);
    return {
      configured: true,
      provider: "spotify",
      isPlaying: data.is_playing,
      shuffle: data.shuffle_state,
      repeat: data.repeat_state,
      track: { ...toTrack(data.item), artUrl: data.item.album?.images?.[0]?.url ?? toTrack(data.item).artUrl },
      progressMs: data.progress_ms,
      observedAt,
      deviceName: data.device?.name ?? null,
      volumePercent: data.device?.volume_percent ?? null
    };
  },
  async getQueue() {
    const data = await readJson("me/player/queue");
    return (data?.queue ?? []).slice(0, 20).map(toTrack);
  },
  async getPlaylists() {
    const data = await readJson("me/playlists?limit=50");
    const me = await readJson("me").catch(() => null);
    return (data?.items ?? []).filter((item) => item !== null).map((item) => ({
      id: item.id,
      uri: item.uri,
      name: item.name,
      owner: item.owner?.display_name ?? null,
      artUrl: pickImage(item.images ?? void 0),
      trackCount: item.items?.total ?? item.tracks?.total ?? null,
      browsable: Boolean(item.collaborative) || me !== null && item.owner?.id === me.id
    }));
  },
  async getPlaylistTracks(id) {
    if (!/^[A-Za-z0-9]+$/.test(id)) throw new HttpError(400, "invalid playlist id");
    const data = await readJson(`playlists/${id}/items?limit=100&additional_types=episode`);
    return (data?.items ?? []).map((entry) => entry.item ?? entry.track).filter((track) => Boolean(track?.uri)).map(toTrack);
  },
  async getSuggestions(seed, locale = "ja") {
    const groups = [];
    const seedId = seed ? idFromUri(seed.uri) : null;
    if (seedId) {
      try {
        const data = await readJson(`recommendations?limit=20&seed_tracks=${seedId}`);
        if (data?.tracks?.length) {
          groups.push({
            id: "recommendations",
            title: messages.t(locale, "similarTo", { title: seed.title }),
            note: null,
            tracks: data.tracks.map(toTrack)
          });
        }
      } catch {
      }
    }
    const [top, recent] = await Promise.allSettled([
      readJson("me/top/tracks?limit=20&time_range=short_term"),
      readJson("me/player/recently-played?limit=30")
    ]);
    if (top.status === "fulfilled" && top.value?.items?.length) {
      groups.push({
        id: "top",
        title: messages.t(locale, "topTitle"),
        note: messages.t(locale, "topNote"),
        tracks: top.value.items.map(toTrack)
      });
    }
    if (recent.status === "fulfilled" && recent.value?.items?.length) {
      const seen = /* @__PURE__ */ new Set();
      const tracks = recent.value.items.map((entry) => toTrack(entry.track)).filter((track) => seen.has(track.uri) ? false : (seen.add(track.uri), true));
      groups.push({ id: "recent", title: messages.t(locale, "recentTitle"), note: null, tracks });
    }
    if (groups.length === 0) {
      const reason = [top, recent].find((r) => r.status === "rejected")?.reason;
      if (reason instanceof HttpError) throw reason;
    }
    return groups;
  },
  control: (action, state) => controlSpotify(action, state),
  async play(target) {
    const body = {};
    if (target.contextUri) {
      if (!URI_PATTERN.test(target.contextUri)) throw new HttpError(400, "invalid uri");
      body.context_uri = target.contextUri;
      if (target.offsetUri) {
        if (!URI_PATTERN.test(target.offsetUri)) throw new HttpError(400, "invalid uri");
        body.offset = { uri: target.offsetUri };
      }
    } else if (target.trackUri) {
      if (!URI_PATTERN.test(target.trackUri)) throw new HttpError(400, "invalid uri");
      body.uris = [target.trackUri];
    } else {
      throw new HttpError(400, "nothing to play");
    }
    const res = await spotifyFetch("me/player/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (res.status === 404)
      throw localizedError(409, "noDevice");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify play error: ${res.status}`);
  },
  async seek(positionMs) {
    const res = await spotifyFetch(`me/player/seek?position_ms=${positionMs}`, { method: "PUT" });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (res.status === 404)
      throw localizedError(409, "noDevice");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify seek error: ${res.status}`);
  },
  async getDevices() {
    const data = await readJson("me/player/devices");
    return (data?.devices ?? []).filter((device) => device.id && !device.is_restricted).map((device) => ({
      id: device.id,
      name: device.name,
      kind: device.type?.toLowerCase() ?? null,
      active: device.is_active,
      // Spotify が返すのは、いま Spotify を開いている端末だけ
      online: true
    }));
  },
  async transfer(deviceId) {
    if (!/^[A-Za-z0-9]+$/.test(deviceId)) throw new HttpError(400, "invalid device id");
    const res = await spotifyFetch("me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [deviceId] })
    });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify transfer error: ${res.status}`);
  },
  async addToQueue(trackUri) {
    if (!URI_PATTERN.test(trackUri)) throw new HttpError(400, "invalid uri");
    const res = await spotifyFetch(`me/player/queue?uri=${encodeURIComponent(trackUri)}`, { method: "POST" });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (res.status === 404)
      throw localizedError(409, "noDevice");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify queue error: ${res.status}`);
  }
};

// extensions/spotify/src/server.ts
var provider = spotifyProvider;
var server_default = defineServerExtension({
  register(api) {
    spotifySettings.current = api.settings;
    resetSpotifyTokens();
    api.onSettingsChange(resetSpotifyTokens);
    api.provide("music", provider);
    api.route("GET", "/auth/login", ({ locale }) => {
      if (!api.settings.clientId) throw new HttpError(409, messages.t(locale, "needClient"));
      return api.redirect(authorizeUrl());
    });
    api.route("GET", "/auth/callback", async ({ query, locale }) => {
      if (!query.code) return api.text("missing code", 400);
      await api.updateSettings({ refreshToken: await exchangeCode(query.code) });
      return api.text(messages.t(locale, "authorized"));
    });
  }
});
export {
  server_default as default
};
