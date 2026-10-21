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

// extensions/media/src/lyrics.ts
var LRCLIB = "https://lrclib.net/api";
var USER_AGENT = "home-dashboard (https://github.com/MoomA-0750/home-dashboard)";
var CACHE_LIMIT = 200;
var TIMEOUT_MS = 8e3;
var cache = /* @__PURE__ */ new Map();
var NOT_FOUND = { found: false, synced: false, instrumental: false, lines: [], source: null };
function parseLrc(lrc) {
  const lines = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const stamp of stamps) {
      const seconds = Number(stamp[2].replace(":", "."));
      lines.push({ timeMs: Math.round((Number(stamp[1]) * 60 + seconds) * 1e3), text });
    }
  }
  return lines.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
}
function toResult(record) {
  if (record.instrumental) return { found: true, synced: false, instrumental: true, lines: [], source: "lrclib" };
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    if (lines.length > 0) return { found: true, synced: true, instrumental: false, lines, source: "lrclib" };
  }
  if (record.plainLyrics) {
    const lines = record.plainLyrics.split(/\r?\n/).map((text) => ({ timeMs: null, text: text.trim() }));
    return { found: true, synced: false, instrumental: false, lines, source: "lrclib" };
  }
  return NOT_FOUND;
}
async function lrclib(path, params) {
  const url = new URL(`${LRCLIB}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `lrclib error: ${res.status}`);
  return await res.json();
}
function lyricLength(record) {
  return (record.syncedLyrics ?? record.plainLyrics ?? "").length;
}
function pickClosest(records, durationMs) {
  const usable = records.filter((record) => record.syncedLyrics || record.plainLyrics || record.instrumental);
  if (durationMs === null) return usable.find((record) => record.syncedLyrics) ?? usable[0] ?? null;
  const seconds = durationMs / 1e3;
  for (const tolerance of [2, 5]) {
    const near = usable.filter((record) => record.duration !== void 0 && Math.abs(record.duration - seconds) <= tolerance).sort(
      (a, b) => Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)) || lyricLength(a) - lyricLength(b)
    );
    if (near.length > 0) return near[0];
  }
  return null;
}
async function findLyrics(query) {
  const key = JSON.stringify([query.title, query.artist, query.album, query.durationMs]);
  const cached = cache.get(key);
  if (cached) return cached;
  const params = { track_name: query.title, artist_name: query.artist };
  if (query.album) params.album_name = query.album;
  if (query.durationMs) params.duration = String(Math.round(query.durationMs / 1e3));
  const [exact, searched] = await Promise.all([
    lrclib("get", params).catch(() => null),
    lrclib("search", { track_name: query.title, artist_name: query.artist })
  ]);
  const candidates = [...exact ? [exact] : [], ...searched ?? []];
  const closest = pickClosest(candidates, query.durationMs) ?? exact;
  const result = closest ? toResult(closest) : NOT_FOUND;
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return result;
}

// extensions/media/src/routes.ts
var MEDIA_ACTIONS = ["play", "pause", "next", "previous", "shuffle", "repeat"];
var MAX_SKIP_INDEX = 19;
var SKIP_INTERVAL_MS = 300;
var messages = defineServerMessages({
  ja: { notInstalled: "\u305D\u306E\u97F3\u697D\u30A2\u30D7\u30EA\u306F\u5165\u3063\u3066\u3044\u307E\u305B\u3093" },
  en: { notInstalled: "That music app isn't installed" }
});
function localizeError(err, locale) {
  const localized = err?.localized;
  const status = err?.statusCode;
  const text = localized?.[locale];
  return typeof status === "number" && typeof text === "string" ? new HttpError(status, text) : err;
}
var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function skipToQueueItem(provider, index, trackUri, intervalMs = SKIP_INTERVAL_MS) {
  if (!Number.isInteger(index) || index < 0 || index > MAX_SKIP_INDEX) throw new HttpError(400, "invalid index");
  if (provider.skipTo) return provider.skipTo(index, trackUri);
  for (let i = 0; i <= index; i += 1) {
    if (i > 0) await wait(intervalMs);
    await provider.control("next");
  }
}
function providerOf(api, id, locale) {
  const found = api.providers("music").find((p) => p.extensionId === id);
  if (!found) throw new HttpError(404, messages.t(locale, "notInstalled"));
  return found.implementation;
}
function registerMediaRoutes(api) {
  const route = (method, path, handler) => api.route(method, `/providers/:provider${path}`, async (ctx) => {
    try {
      return await handler(providerOf(api, ctx.params.provider, ctx.locale), ctx);
    } catch (err) {
      throw localizeError(err, ctx.locale);
    }
  });
  route("GET", "/playback", (provider) => provider.getPlayback());
  route("GET", "/queue", async (provider) => ({ tracks: await provider.getQueue() }));
  route("GET", "/playlists", async (provider, { locale }) => ({ playlists: await provider.getPlaylists(locale) }));
  route("GET", "/playlists/:id/tracks", async (provider, { params }) => ({
    tracks: await provider.getPlaylistTracks(params.id)
  }));
  route("GET", "/suggestions", async (provider, { locale }) => {
    const playback = await provider.getPlayback().catch(() => null);
    return { groups: await provider.getSuggestions(playback?.track ?? null, locale) };
  });
  route("GET", "/lyrics", (_provider, { query }) => {
    const { title, artist, album, durationMs } = query;
    if (!title || !artist) throw new HttpError(400, "title and artist are required");
    const duration = Number(durationMs);
    return findLyrics({
      title: title.slice(0, 200),
      artist: artist.slice(0, 200),
      album: album ? album.slice(0, 200) : null,
      durationMs: Number.isFinite(duration) && duration > 0 ? duration : null
    });
  });
  route("GET", "/devices", async (provider) => ({ devices: await provider.getDevices() }));
  route("POST", "/transfer", async (provider, { body }) => {
    const deviceId = body?.deviceId;
    if (typeof deviceId !== "string" || !/^[A-Za-z0-9_.:-]{1,200}$/.test(deviceId))
      throw new HttpError(400, "deviceId is required");
    await provider.transfer(deviceId);
    return { ok: true };
  });
  route("POST", "/queue/skip", async (provider, { body }) => {
    const { index, trackUri } = body ?? {};
    if (typeof trackUri !== "string") throw new HttpError(400, "trackUri is required");
    await skipToQueueItem(provider, Number(index), trackUri);
    return { ok: true };
  });
  route("POST", "/seek", async (provider, { body }) => {
    const positionMs = Number(body?.positionMs);
    if (!Number.isFinite(positionMs) || positionMs < 0 || positionMs > 12 * 60 * 60 * 1e3)
      throw new HttpError(400, "invalid positionMs");
    await provider.seek(Math.round(positionMs));
    return { ok: true };
  });
  route("POST", "/control", async (provider, { body }) => {
    const { action, state } = body ?? {};
    if (!action || !MEDIA_ACTIONS.includes(action)) throw new HttpError(400, "unknown action");
    await provider.control(action, state);
    return { ok: true };
  });
  route("POST", "/play", async (provider, { body }) => {
    await provider.play(body ?? {});
    return { ok: true };
  });
  route("POST", "/queue", async (provider, { body }) => {
    const trackUri = body?.trackUri;
    if (!trackUri) throw new HttpError(400, "trackUri is required");
    await provider.addToQueue(trackUri);
    return { ok: true };
  });
}

// extensions/media/src/voice.ts
function findProvider(providers, app) {
  const wanted = app.trim().toLowerCase();
  const found = providers.find((p) => p.extensionId === wanted || p.name.toLowerCase() === wanted);
  if (!found) throw new HttpError(404, `\u300C${app}\u300D\u3068\u3044\u3046\u97F3\u697D\u30A2\u30D7\u30EA\u306F\u5165\u3063\u3066\u3044\u307E\u305B\u3093\uFF08${names(providers)}\uFF09`);
  return found;
}
var names = (providers) => providers.map((p) => p.name).join("\u30FB") || "\u306A\u3057";
async function playbackOf(provider) {
  return provider.implementation.getPlayback().catch(() => null);
}
async function pickProvider(providers, app) {
  if (app) return findProvider(providers, app);
  if (providers.length === 0) throw new HttpError(409, "\u97F3\u697D\u30A2\u30D7\u30EA\u304C\u5165\u3063\u3066\u3044\u307E\u305B\u3093");
  const playbacks = await Promise.all(providers.map(playbackOf));
  const index = playbacks.findIndex((p) => p?.isPlaying) >= 0 ? playbacks.findIndex((p) => p?.isPlaying) : Math.max(0, playbacks.findIndex((p) => p?.configured));
  return providers[index];
}
async function nowPlaying(providers, app) {
  const targets = app ? [findProvider(providers, app)] : providers;
  return Promise.all(
    targets.map(async (provider) => {
      const playback = await playbackOf(provider);
      const track = playback?.track && { name: playback.track.title, artist: playback.track.artist };
      return {
        app: provider.name,
        configured: playback?.configured ?? false,
        isPlaying: playback?.isPlaying ?? false,
        track: track ?? null,
        device: playback?.deviceName ?? null
      };
    })
  );
}

// extensions/media/src/server.ts
var VOICE_ACTIONS = ["play", "pause", "next", "previous"];
var server_default = defineServerExtension({
  register(api) {
    const providers = () => api.providers("music");
    registerMediaRoutes(api);
    api.tool({
      name: "get_now_playing",
      description: async () => `\u97F3\u697D\u30A2\u30D7\u30EA\u3067\u518D\u751F\u4E2D\u306E\u66F2\uFF08\u66F2\u540D\u30FB\u30A2\u30FC\u30C6\u30A3\u30B9\u30C8\u30FB\u518D\u751F\u4E2D\u304B\u30FB\u9CF4\u3063\u3066\u3044\u308B\u7AEF\u672B\uFF09\u3092\u8FD4\u3059\u3002app \u3092\u7701\u304F\u3068\u5165\u3063\u3066\u3044\u308B\u97F3\u697D\u30A2\u30D7\u30EA\u3059\u3079\u3066\u3002\u97F3\u697D\u30A2\u30D7\u30EA: ${names(providers())}`,
      inputSchema: (z) => ({ app: z.string().optional().describe("\u97F3\u697D\u30A2\u30D7\u30EA\u306E\u540D\u524D\uFF08\u7701\u304F\u3068\u3059\u3079\u3066\uFF09") }),
      readOnly: true,
      handler: ({ app }) => nowPlaying(providers(), app)
    });
    api.tool({
      name: "control_music",
      description: async () => `\u97F3\u697D\u30A2\u30D7\u30EA\u306E\u518D\u751F\u3092\u64CD\u4F5C\u3059\u308B\uFF08\u518D\u751F\u30FB\u4E00\u6642\u505C\u6B62\u30FB\u6B21\u306E\u66F2\u30FB\u524D\u306E\u66F2\uFF09\u3002app \u3092\u7701\u304F\u3068\u3001\u3044\u307E\u9CF4\u3063\u3066\u3044\u308B\u97F3\u697D\u30A2\u30D7\u30EA\u3092\u64CD\u4F5C\u3059\u308B\u3002\u97F3\u697D\u30A2\u30D7\u30EA: ${names(providers())}`,
      inputSchema: (z) => ({
        action: z.enum(VOICE_ACTIONS),
        app: z.string().optional().describe("\u97F3\u697D\u30A2\u30D7\u30EA\u306E\u540D\u524D\uFF08\u7701\u304F\u3068\u3001\u3044\u307E\u9CF4\u3063\u3066\u3044\u308B\u3082\u306E\uFF09")
      }),
      handler: async ({ action, app }) => {
        const provider = await pickProvider(providers(), app);
        await provider.implementation.control(action);
        return { ok: true, app: provider.name };
      }
    });
  }
});
export {
  server_default as default
};
