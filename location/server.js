import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// extensions/location/src/server.ts
import { timingSafeEqual } from "node:crypto";

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

// extensions/location/src/places.ts
var PRESENCE_MAX_AGE_S = 30 * 60;
var PRESENCE_MAX_ACCURACY_M = 500;
var ACCURACY_SLACK_M = 100;
function parseWatched(text) {
  const out = [];
  for (const part of text.split(/[,\n、]/)) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName.trim();
    if (!name || out.some((d) => d.name === name)) continue;
    const label = rest.join("=").trim();
    out.push({ name, label: label || name });
  }
  return out;
}
function parseHome(lat, lon, radius) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la === 0 && lo === 0) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  const r = Number(radius);
  return { lat: la, lon: lo, radiusM: Number.isFinite(r) && r > 0 ? r : 200 };
}
function distanceM(lat1, lon1, lat2, lon2) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function toPlace(raw, label, home) {
  const hasCoords = raw.location_available && typeof raw.latitude === "number" && typeof raw.longitude === "number";
  const distance = hasCoords && home ? distanceM(home.lat, home.lon, raw.latitude, raw.longitude) : null;
  const slack = Math.min(raw.horizontal_accuracy_m ?? 0, ACCURACY_SLACK_M);
  return {
    name: raw.name,
    label,
    model: raw.model,
    battery: raw.battery,
    available: hasCoords,
    lat: hasCoords ? raw.latitude : null,
    lon: hasCoords ? raw.longitude : null,
    accuracyM: hasCoords ? raw.horizontal_accuracy_m : null,
    at: raw.timestamp,
    ageSeconds: raw.age_seconds,
    fresh: raw.fresh,
    distanceM: distance === null ? null : Math.round(distance),
    atHome: distance === null || !home ? null : distance <= home.radiusM + slack
  };
}
function selectPlaces(raw, watched, home) {
  if (watched.length === 0) {
    return raw.filter((d) => d.location_available).map((d) => toPlace(d, d.name, home));
  }
  return watched.map((w) => {
    const found = raw.find((d) => d.name === w.name);
    return found ? toPlace(found, w.label, home) : missingPlace(w);
  });
}
function missingPlace(w) {
  return {
    name: w.name,
    label: w.label,
    model: "",
    battery: null,
    available: false,
    lat: null,
    lon: null,
    accuracyM: null,
    at: null,
    ageSeconds: null,
    fresh: false,
    distanceM: null,
    atHome: null
  };
}
function trustworthy(place) {
  return place.atHome !== null && place.ageSeconds !== null && place.ageSeconds <= PRESENCE_MAX_AGE_S && (place.accuracyM ?? Infinity) <= PRESENCE_MAX_ACCURACY_M;
}
function updatePresence(state, places, now) {
  const events = [];
  for (const place of places) {
    if (!trustworthy(place)) continue;
    const atHome = place.atHome;
    const previous = state.get(place.name);
    if (previous && previous.atHome === atHome) continue;
    state.set(place.name, { atHome, since: now.toISOString() });
    if (previous) {
      events.push({
        type: atHome ? "arrived" : "left",
        device: place.name,
        label: place.label,
        at: now.toISOString(),
        distanceM: place.distanceM
      });
    }
  }
  return events;
}

// extensions/location/src/server.ts
var messages = defineServerMessages({
  ja: {
    notConfigured: "icloud-locate \u306E URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u3001\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 \u4F4D\u7F6E\u300D\u3067\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    authRequired: "iCloud \u306E\u518D\u8A8D\u8A3C\u304C\u8981\u308A\u307E\u3059\u3002icloud-locate \u306E\u6A5F\u68B0\u3067 locate.sh \u3092\u5BFE\u8A71\u3067\u52D5\u304B\u3057\u30012FA \u3092\u901A\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u6E08\u3081\u30701\u5206\u307B\u3069\u3067\u623B\u308A\u307E\u3059\uFF09",
    unauthorized: "icloud-locate \u306E\u30C8\u30FC\u30AF\u30F3\u304C\u9055\u3044\u307E\u3059",
    notFound: "\u305D\u306E\u7AEF\u672B\u306F iCloud \u306B\u3042\u308A\u307E\u305B\u3093: {name}",
    upstream: "icloud-locate \u304B\u3089\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F: {error}",
    unreachable: "icloud-locate \u306B\u5C4A\u304D\u307E\u305B\u3093: {error}",
    noHome: "\u5BB6\u306E\u5834\u6240\u304C\u307E\u3060\u6C7A\u307E\u3063\u3066\u3044\u307E\u305B\u3093",
    noLocation: "{name} \u306E\u4F4D\u7F6E\u304C\u3042\u308A\u307E\u305B\u3093\uFF08\u96FB\u6E90\u304C\u5207\u308C\u3066\u3044\u308B\u30FB\u570F\u5916\u30FB\u300C\u63A2\u3059\u300D\u304C\u30AA\u30D5\uFF09",
    tested: "\u3064\u306A\u304C\u308A\u307E\u3057\u305F\uFF08iCloud: {status}\uFF09",
    noPresenceToken: "\u5728\u5B85\u306E\u69D8\u5B50\u3092\u5916\u3078\u51FA\u3059\u5408\u8A00\u8449\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093"
  },
  en: {
    notConfigured: "Enter the icloud-locate URL and token under Settings \u2192 Extensions \u2192 Location",
    authRequired: "iCloud needs signing in again. Run locate.sh interactively on the icloud-locate machine and complete 2FA (it recovers about a minute later)",
    unauthorized: "The icloud-locate token is wrong",
    notFound: "No such device in iCloud: {name}",
    upstream: "Couldn't read from icloud-locate: {error}",
    unreachable: "Can't reach icloud-locate: {error}",
    noHome: "The home location isn't set yet",
    noLocation: "No location for {name} (powered off, out of range, or Find My is off)",
    tested: "Connected (iCloud: {status})",
    noPresenceToken: "No passphrase is set for sharing presence with other programs"
  }
});
var LOCATE_TIMEOUT_S = 45;
var LOCATE_HTTP_TIMEOUT_MS = 6e4;
var QUICK_HTTP_TIMEOUT_MS = 15e3;
var OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
var OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
var server_default = defineServerExtension({
  register(api) {
    const t = (locale, key, params) => messages.t(locale, key, params);
    const baseUrl = () => String(api.settings.url ?? "").replace(/\/+$/, "");
    const configured = () => Boolean(baseUrl() && String(api.settings.token ?? ""));
    const home = () => parseHome(api.settings.homeLat, api.settings.homeLon, api.settings.homeRadius);
    const watched = () => parseWatched(String(api.settings.devices ?? ""));
    async function upstream(path, locale, timeoutMs = QUICK_HTTP_TIMEOUT_MS) {
      if (!configured()) throw new HttpError(409, t(locale, "notConfigured"));
      let res;
      try {
        res = await fetch(`${baseUrl()}${path}`, {
          headers: { Authorization: `Bearer ${String(api.settings.token)}` },
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (err) {
        throw new HttpError(502, t(locale, "unreachable", { error: err.message }));
      }
      const body = await res.json().catch(() => null);
      if (res.ok) return body;
      if (res.status === 503) throw new HttpError(503, t(locale, "authRequired"));
      if (res.status === 401) throw new HttpError(502, t(locale, "unauthorized"));
      throw new HttpError(502, t(locale, "upstream", { error: body?.message ?? `HTTP ${res.status}` }));
    }
    async function readPlaces(locale) {
      const raw = await upstream("/devices", locale);
      return selectPlaces(raw, watched(), home());
    }
    async function locate(name, locale) {
      const query = new URLSearchParams({ device: name, refresh: "auto", timeout: String(LOCATE_TIMEOUT_S) });
      const raw = await upstream(`/location?${query}`, locale, LOCATE_HTTP_TIMEOUT_MS);
      const found = raw.find((d) => d.name === name);
      if (!found) throw new HttpError(404, t(locale, "notFound", { name }));
      const label = watched().find((w) => w.name === name)?.label ?? name;
      return selectPlaces([found], [{ name, label }], home())[0];
    }
    const presence = /* @__PURE__ */ new Map();
    let lastCheck = null;
    let timer = null;
    async function notify(event) {
      api.broadcast("presence", event);
      const hook = String(api.settings.webhookUrl ?? "");
      if (!hook) return;
      try {
        const res = await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "home-dashboard/location", ...event }),
          signal: AbortSignal.timeout(QUICK_HTTP_TIMEOUT_MS)
        });
        if (!res.ok) api.log.warn(`Webhook \u304C ${res.status} \u3092\u8FD4\u3057\u307E\u3057\u305F\uFF08${event.type}\uFF09`);
      } catch (err) {
        api.log.warn(`Webhook \u3092\u547C\u3079\u307E\u305B\u3093\u3067\u3057\u305F\uFF08${event.type}\uFF09: ${err.message}`);
      }
    }
    async function check() {
      if (!configured() || !home()) return;
      try {
        const places = await readPlaces("ja");
        const now = /* @__PURE__ */ new Date();
        lastCheck = now.toISOString();
        for (const event of updatePresence(presence, places, now)) {
          api.log.info(`${event.label}: ${event.type === "arrived" ? "\u5BB6\u306B\u7740\u3044\u305F" : "\u5BB6\u3092\u51FA\u305F"}`);
          await notify(event);
        }
      } catch (err) {
        api.log.warn(`\u5728\u5B85\u306E\u898B\u5F35\u308A: ${err.message}`);
      }
    }
    function schedule() {
      if (timer) clearInterval(timer);
      timer = null;
      const minutes = Number(api.settings.watchMinutes ?? 0);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      timer = setInterval(() => void check(), Math.max(1, minutes) * 6e4);
      void check();
    }
    api.onSettingsChange(() => {
      presence.clear();
      schedule();
    });
    api.onDispose(() => {
      if (timer) clearInterval(timer);
    });
    schedule();
    const presenceReadings = () => {
      const known = watched().map((w) => ({ id: `home:${w.name}`, name: `${w.label}\u304C\u5BB6\u306B\u3044\u308B`, state: presence.get(w.name) }));
      const states = known.map((k) => k.state).filter((state) => state !== void 0);
      return [
        {
          id: "anyone-home",
          name: "\u3060\u308C\u304B\u306E\u7AEF\u672B\u304C\u5BB6\u306B\u3042\u308B",
          kind: "onoff",
          value: states.length === 0 ? null : states.some((state) => state.atHome)
        },
        ...known.map(({ id, name, state }) => ({ id, name, kind: "onoff", value: state ? state.atHome : null }))
      ];
    };
    api.provideStates({
      list: async () => presenceReadings(),
      read: async (ids) => presenceReadings().filter((reading) => ids.includes(reading.id))
    });
    const presenceView = () => {
      const labels = new Map(watched().map((w) => [w.name, w.label]));
      const devices = [...presence.entries()].map(([name, state]) => ({
        device: name,
        label: labels.get(name) ?? name,
        atHome: state.atHome,
        since: state.since
      }));
      return { checkedAt: lastCheck, anyoneHome: devices.some((d) => d.atHome), devices };
    };
    const mapView = () => {
      const tiles = String(api.settings.mapTiles ?? "").trim();
      return tiles ? { tiles, attribution: String(api.settings.mapAttribution ?? ""), standard: false } : { tiles: OSM_TILES, attribution: OSM_ATTRIBUTION, standard: true };
    };
    api.route("GET", "/places", async ({ locale }) => {
      if (!configured()) return { configured: false, message: t(locale, "notConfigured"), places: [] };
      const area = home();
      return {
        configured: true,
        home: area !== null,
        // 家の円を地図に描くため（画面の中だけで使い、残さない）
        homeArea: area,
        map: mapView(),
        places: await readPlaces(locale),
        presence: presenceView()
      };
    });
    api.route("POST", "/places/:name/locate", async ({ params, locale }) => ({ place: await locate(params.name, locale) }));
    api.route(
      "POST",
      "/home",
      async ({ body, locale }) => {
        const name = String(body?.device ?? "");
        const place = (await readPlaces(locale)).find((p) => p.name === name);
        if (!place?.available) throw new HttpError(409, t(locale, "noLocation", { name }));
        await api.updateSettings({ homeLat: Number(place.lat.toFixed(6)), homeLon: Number(place.lon.toFixed(6)) });
        return { ok: true };
      },
      { adminOnly: true }
    );
    api.route("POST", "/test", async ({ locale }) => {
      try {
        const health = await upstream("/health", locale);
        return { ok: true, message: t(locale, "tested", { status: health.status }) };
      } catch (err) {
        return { ok: false, message: err.message };
      }
    });
    api.route(
      "GET",
      "/presence",
      ({ bearer, locale }) => {
        const secret = String(api.settings.presenceToken ?? "");
        if (!secret) throw new HttpError(404, t(locale, "noPresenceToken"));
        if (!bearer || !sameSecret(bearer, secret)) throw new HttpError(401, "unauthorized");
        return presenceView();
      },
      { public: true }
    );
    registerTools(api, { readPlaces, locate, watched });
  }
});
function sameSecret(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function registerTools(api, deps) {
  const describePlace = (p) => ({
    device: p.name,
    label: p.label,
    available: p.available,
    atHome: p.atHome,
    distanceFromHomeKm: p.distanceM === null ? null : Math.round(p.distanceM / 100) / 10,
    latitude: p.lat,
    longitude: p.lon,
    accuracyM: p.accuracyM === null ? null : Math.round(p.accuracyM),
    minutesAgo: p.ageSeconds === null ? null : Math.round(p.ageSeconds / 60),
    battery: p.battery === null ? null : Math.round(p.battery * 100)
  });
  api.tool({
    name: "get_location",
    description: async () => {
      const names = deps.watched().map((w) => w.label === w.name ? w.name : `${w.label}\uFF08${w.name}\uFF09`);
      return [
        "\u5BB6\u306E\u4EBA\u306E Apple \u7AEF\u672B\u306E\u4F4D\u7F6E\uFF08iCloud \u306E\u300C\u63A2\u3059\u300D\uFF09\u3092\u8FD4\u3059\u3002\u5BB6\u306B\u3044\u308B\u304B\u30FB\u5BB6\u304B\u3089\u306E\u8DDD\u96E2\u30FB\u4F55\u5206\u524D\u306E\u6E2C\u4F4D\u304B\u30FB\u96FB\u6C60\u3002",
        "\u5EA7\u6A19\u306F\u5730\u540D\u3084\u6700\u5BC4\u308A\u306E\u5834\u6240\u3092\u7B54\u3048\u308B\u306E\u306B\u4F7F\u3044\u3001\u6570\u5B57\u306E\u307E\u307E\u8AAD\u307F\u4E0A\u3052\u306A\u3044\u3002",
        names.length ? `\u898B\u3066\u3044\u308B\u7AEF\u672B: ${names.join("\u3001")}\u3002\u6700\u521D\u306E\u3082\u306E\u304C\u672C\u4EBA\u306E\u6301\u3061\u6B69\u304F\u7AEF\u672B\u3002` : "",
        "refresh \u3092 true \u306B\u3059\u308B\u3068\u3001\u305D\u306E\u7AEF\u672B\u306B\u6E2C\u4F4D\u3092\u983C\u3093\u3067\u65B0\u3057\u3044\u4F4D\u7F6E\u3092\u5F85\u3064\uFF08\u6700\u592745\u79D2\u30FB\u7AEF\u672B\u306E\u96FB\u6C60\u3092\u4F7F\u3046\uFF09\u3002\u53E4\u3044\u4F4D\u7F6E\u3067\u8DB3\u308A\u308B\u306A\u3089 false\u3002"
      ].join("");
    },
    inputSchema: (z) => ({
      device: z.string().optional().describe("\u7AEF\u672B\u306E\u547C\u3073\u540D\u304B\u767B\u9332\u540D\u3002\u7701\u304F\u3068\u898B\u3066\u3044\u308B\u7AEF\u672B\u3059\u3079\u3066\uFF08refresh \u306E\u3068\u304D\u306F\u6700\u521D\u306E\u7AEF\u672B\uFF09"),
      refresh: z.boolean().optional().describe("\u6E2C\u4F4D\u3092\u983C\u3093\u3067\u65B0\u3057\u3044\u4F4D\u7F6E\u306B\u3059\u308B")
    }),
    risk: "read",
    personal: true,
    handler: async ({ device, refresh }) => {
      const watched = deps.watched();
      const wanted = device ? watched.find((w) => w.label === device || w.name === device)?.name ?? device : null;
      if (refresh) {
        const name = wanted ?? watched[0]?.name;
        if (name) return { places: [describePlace(await deps.locate(name, "ja"))] };
      }
      const places = await deps.readPlaces("ja");
      const picked = wanted ? places.filter((p) => p.name === wanted) : places;
      return { places: (picked.length ? picked : places).map(describePlace) };
    }
  });
}
export {
  server_default as default
};
