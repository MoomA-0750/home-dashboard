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

// extensions/wave/src/messages.ts
var messages = defineServerMessages({
  ja: {
    token_required: "wave \u306E\u30C8\u30FC\u30AF\u30F3\u304C\u901A\u308A\u307E\u305B\u3093\uFF08\u63A5\u7D9A\u8A2D\u5B9A\u306E\u300Cwave\u300D\u306E\u30C8\u30FC\u30AF\u30F3\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\uFF09",
    login_required: "wave \u306B\u30ED\u30B0\u30A4\u30F3\u304C\u6E21\u3055\u308C\u3066\u3044\u307E\u305B\u3093\uFF08\u5BB6\u306E\u7AEF\u672B\u306E\u300C\u7AEF\u672B\u306E\u9023\u643A\u300D\u3067\u300Cwave API\u300D\u306B\u300C\u30ED\u30B0\u30A4\u30F3\u3092\u6E21\u3059\u300D\uFF09",
    not_sent: "\u9CF4\u3063\u3066\u3044\u308B wave \u306E\u7AEF\u672B\u304C\u3042\u308A\u307E\u305B\u3093\uFF08\u30B9\u30DE\u30DB\u3084 PC \u306E wave \u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044\uFF09",
    no_device: "\u9CF4\u3089\u3059 wave \u306E\u7AEF\u672B\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30B9\u30DE\u30DB\u3084 PC \u306E wave \u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044\uFF09",
    unsupported: "wave \u3067\u306F\u3053\u306E\u64CD\u4F5C\u306F\u3067\u304D\u307E\u305B\u3093",
    not_found: "\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
    notConfigured: "wave \u304C\u672A\u63A5\u7D9A\u3067\u3059\u3002\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u63A5\u7D9A\u8A2D\u5B9A \u2192 wave\u300D\u3067 URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    unreachable: "wave \u306B\u5C4A\u304D\u307E\u305B\u3093\uFF08{url}\uFF09",
    httpError: "wave \u304C {status} \u3092\u8FD4\u3057\u307E\u3057\u305F\uFF08{name}\uFF09",
    queueMoved: "\u30AD\u30E5\u30FC\u304C\u5909\u308F\u3063\u305F\u306E\u3067\u98DB\u3079\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u9078\u3093\u3067\u304F\u3060\u3055\u3044",
    liked: "\u9AD8\u304F\u8A55\u4FA1\u3057\u305F\u66F2",
    suggestionNote: "YouTube Music \u306E\u304A\u3059\u3059\u3081",
    notJoined: "\u3064\u306A\u304C\u308A\u307E\u3057\u305F\u304C\u3001wave-api \u304C\u307E\u3060\u5BB6\u306B\u52A0\u308F\u3063\u3066\u3044\u307E\u305B\u3093",
    noLogin: "\u3064\u306A\u304C\u308A\u307E\u3057\u305F\uFF08\u30ED\u30B0\u30A4\u30F3\u304C\u7121\u3044\u306E\u3067\u3001\u30D7\u30EC\u30A4\u30EA\u30B9\u30C8\u3068\u304A\u3059\u3059\u3081\u306F\u8AAD\u3081\u307E\u305B\u3093\uFF09",
    connected: "\u3064\u306A\u304C\u308A\u307E\u3057\u305F"
  },
  en: {
    token_required: `wave didn't accept the token (check the token in the "wave" connection settings)`,
    login_required: `wave hasn't been given a login (on a home device, open Device linking and choose "Share login" for "wave API")`,
    not_sent: "No wave device is playing (open wave on your phone or PC)",
    no_device: "Couldn't find a wave device to play on (open wave on your phone or PC)",
    unsupported: "wave can't do this",
    not_found: "Not found",
    notConfigured: "wave isn't connected. Enter the URL and token in Settings under Connection settings \u2192 wave",
    unreachable: "Can't reach wave ({url})",
    httpError: "wave returned {status} ({name})",
    queueMoved: "The queue changed, so it couldn't skip. Please choose again",
    liked: "Liked songs",
    suggestionNote: "YouTube Music suggestions",
    notJoined: "Connected, but wave-api hasn't joined the home yet",
    noLogin: "Connected (no login, so playlists and suggestions can't be read)",
    connected: "Connected"
  }
});
function localizedError(statusCode, key, params) {
  const localized = { ja: messages.t("ja", key, params), en: messages.t("en", key, params) };
  return Object.assign(new HttpError(statusCode, localized.ja), { localized });
}

// extensions/wave/src/wave.ts
var waveSettings = { current: {} };
var TIMEOUT_MS = 1e4;
var LIKED_PLAYLIST_ID = "LM";
var ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var ERRORS = /* @__PURE__ */ new Set(["token_required", "login_required", "not_sent", "no_device", "unsupported", "not_found"]);
function isConfigured() {
  return Boolean(waveSettings.current.url && waveSettings.current.token);
}
async function waveFetch(path, init) {
  const url = String(waveSettings.current.url ?? "").replace(/\/+$/, "");
  if (!isConfigured())
    throw localizedError(409, "notConfigured");
  let res;
  try {
    res = await fetch(`${url}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${String(waveSettings.current.token)}`,
        ...init?.body !== void 0 ? { "Content-Type": "application/json" } : {}
      },
      body: init?.body !== void 0 ? JSON.stringify(init.body) : void 0,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    throw localizedError(502, "unreachable", { url });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const name = body?.error ?? "";
    const status = res.status === 401 ? 409 : res.status;
    throw ERRORS.has(name) ? localizedError(status, name) : localizedError(status, "httpError", { status: res.status, name });
  }
  return body;
}
function toTrack(track) {
  return {
    uri: track.videoId,
    title: track.title,
    artist: track.artist,
    album: track.album ?? null,
    artUrl: track.artUrl ?? null,
    durationMs: track.durationMs ?? null
  };
}
function toPlaylist(playlist) {
  return {
    id: playlist.id,
    uri: playlist.id,
    name: playlist.name,
    owner: playlist.subtitle ?? null,
    artUrl: playlist.artUrl ?? null,
    trackCount: null,
    browsable: true
  };
}
function checkId(id, what) {
  if (!id || !ID_PATTERN.test(id)) throw new HttpError(400, `invalid ${what}`);
  return id;
}
var waveProvider = {
  id: "wave",
  name: "wave",
  async getPlayback() {
    const idle = (configured) => ({
      configured,
      provider: "wave",
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      track: null,
      progressMs: null,
      observedAt: (/* @__PURE__ */ new Date()).toISOString(),
      deviceName: null,
      volumePercent: null,
      capabilities: { shuffle: false, repeat: false }
    });
    if (!isConfigured()) return idle(false);
    const data = await waveFetch("/v1/playback");
    if (!data.track) return { ...idle(true), deviceName: data.device?.name ?? null };
    return {
      configured: true,
      provider: "wave",
      isPlaying: data.isPlaying,
      shuffle: false,
      repeat: data.repeat ?? "off",
      track: toTrack(data.track),
      progressMs: data.progressMs ?? null,
      observedAt: data.observedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
      deviceName: data.device?.name ?? null,
      volumePercent: data.volumePercent ?? null,
      capabilities: { shuffle: false, repeat: false }
    };
  },
  async getQueue() {
    return (await waveFetch("/v1/queue")).slice(0, 20).map(toTrack);
  },
  async getPlaylists(locale = "ja") {
    const playlists = (await waveFetch("/v1/playlists")).map(toPlaylist);
    if (!playlists.some((playlist) => playlist.id === LIKED_PLAYLIST_ID)) {
      playlists.unshift({
        id: LIKED_PLAYLIST_ID,
        uri: LIKED_PLAYLIST_ID,
        name: messages.t(locale, "liked"),
        owner: null,
        artUrl: null,
        trackCount: null,
        browsable: true
      });
    }
    return playlists;
  },
  async getPlaylistTracks(id) {
    checkId(id, "playlist id");
    return (await waveFetch(`/v1/playlists/${encodeURIComponent(id)}/tracks`)).map(toTrack);
  },
  // wave のホームの棚（YouTube Music のおすすめ）。棚の中のプレイリストは出さず、曲だけを並べる
  async getSuggestions(_seed, locale = "ja") {
    const shelves = await waveFetch("/v1/suggestions");
    return shelves.filter((shelf) => shelf.tracks.length > 0).map((shelf, index) => ({
      id: `shelf-${index}`,
      title: shelf.title,
      note: messages.t(locale, "suggestionNote"),
      tracks: shelf.tracks.map(toTrack)
    }));
  },
  async control(action) {
    if (action === "shuffle" || action === "repeat") throw localizedError(400, "unsupported");
    await waveFetch("/v1/control", { method: "POST", body: { action } });
  },
  // 画面は Spotify と同じ形で頼む: contextUri = プレイリスト、offsetUri = その中の始める曲、trackUri = 曲（その曲からのラジオ）
  async play(target) {
    if (target.contextUri) {
      const body = { playlistId: checkId(target.contextUri, "playlist id") };
      if (target.offsetUri) body.startVideoId = checkId(target.offsetUri, "video id");
      await waveFetch("/v1/play", { method: "POST", body });
    } else if (target.trackUri) {
      await waveFetch("/v1/play", { method: "POST", body: { videoId: checkId(target.trackUri, "video id") } });
    } else {
      throw new HttpError(400, "nothing to play");
    }
  },
  // wave-api 自身（音を出さない「wave API」）は除く
  async getDevices() {
    const devices = await waveFetch("/v1/devices");
    return devices.filter((device) => !device.self).map((device) => ({
      id: device.id,
      name: device.name,
      kind: device.kind ?? null,
      active: device.active,
      online: device.online
    }));
  },
  async transfer(deviceId) {
    await waveFetch("/v1/transfer", { method: "POST", body: { deviceId: checkId(deviceId, "device id") } });
  },
  // 「次に再生」の index 番目へ1回で飛ぶ。videoId も添え、読んだ後にキューが動いていたら違う曲へは飛ばない
  async skipTo(index, trackUri) {
    try {
      await waveFetch("/v1/queue/jump", { method: "POST", body: { index, videoId: checkId(trackUri, "video id") } });
    } catch (err) {
      if (err.statusCode === 404)
        throw localizedError(409, "queueMoved");
      throw err;
    }
  },
  async seek(positionMs) {
    await waveFetch("/v1/control", { method: "POST", body: { action: "seek", positionMs } });
  },
  async addToQueue(trackUri) {
    await waveFetch("/v1/queue", { method: "POST", body: { videoIds: [checkId(trackUri, "video id")], next: false } });
  }
};

// extensions/wave/src/server.ts
var server_default = defineServerExtension({
  register(api) {
    waveSettings.current = api.settings;
    api.provide("music", waveProvider);
    api.route(
      "POST",
      "/test",
      async ({ locale }) => {
        try {
          const playback = await waveFetch("/v1/playback");
          if (!playback.joined) return { ok: false, message: messages.t(locale, "notJoined") };
          if (!playback.loggedIn)
            return { ok: true, message: messages.t(locale, "noLogin") };
          return { ok: true, message: messages.t(locale, "connected") };
        } catch (err) {
          const localized = err?.localized;
          return { ok: false, message: localized?.[locale] ?? (err instanceof Error ? err.message : String(err)) };
        }
      },
      { adminOnly: true }
    );
  }
});
export {
  server_default as default
};
