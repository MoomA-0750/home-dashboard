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

// extensions/weather/src/forecast.ts
var CONDITIONS = {
  0: "\u5FEB\u6674",
  1: "\u6674\u308C",
  2: "\u8584\u66C7\u308A",
  3: "\u66C7\u308A",
  45: "\u9727",
  48: "\u9727\u6C37",
  51: "\u9727\u96E8",
  53: "\u9727\u96E8",
  55: "\u5F37\u3044\u9727\u96E8",
  56: "\u7740\u6C37\u6027\u306E\u9727\u96E8",
  57: "\u7740\u6C37\u6027\u306E\u9727\u96E8",
  61: "\u5C0F\u96E8",
  63: "\u96E8",
  65: "\u5927\u96E8",
  66: "\u7740\u6C37\u6027\u306E\u96E8",
  67: "\u7740\u6C37\u6027\u306E\u96E8",
  71: "\u5C0F\u96EA",
  73: "\u96EA",
  75: "\u5927\u96EA",
  77: "\u9727\u96EA",
  80: "\u306B\u308F\u304B\u96E8",
  81: "\u306B\u308F\u304B\u96E8",
  82: "\u6FC0\u3057\u3044\u306B\u308F\u304B\u96E8",
  85: "\u306B\u308F\u304B\u96EA",
  86: "\u6FC0\u3057\u3044\u306B\u308F\u304B\u96EA",
  95: "\u96F7\u96E8",
  96: "\u96F7\u96E8\uFF08\u3072\u3087\u3046\uFF09",
  99: "\u96F7\u96E8\uFF08\u3072\u3087\u3046\uFF09"
};
var conditionOf = (code) => CONDITIONS[code] ?? "\u4E0D\u660E";
var CACHE_MS = 10 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
function withOffset(local, offsetSeconds) {
  const sign = offsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(offsetSeconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor(abs % 3600 / 60)).padStart(2, "0");
  return `${local.length === 16 ? `${local}:00` : local}${sign}${hh}:${mm}`;
}
function shapeForecast(place, raw, air, now = Date.now()) {
  const offset = raw.utc_offset_seconds;
  const c = raw.current;
  const times = raw.hourly.time.map((t) => withOffset(t, offset));
  const first = Math.max(0, times.findIndex((t) => Date.parse(t) + 36e5 > now));
  const hourly = times.slice(first, first + 24).map((time, i) => ({
    time,
    temperatureC: raw.hourly.temperature_2m[first + i],
    code: raw.hourly.weather_code[first + i],
    isDay: raw.hourly.is_day[first + i] === 1,
    precipitationProbability: raw.hourly.precipitation_probability[first + i] ?? 0
  }));
  const d = raw.daily;
  const daily = d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    condition: conditionOf(d.weather_code[i]),
    maxC: d.temperature_2m_max[i],
    minC: d.temperature_2m_min[i],
    precipitationProbability: d.precipitation_probability_max[i] ?? 0,
    precipitationSumMm: d.precipitation_sum[i] ?? 0,
    sunrise: withOffset(d.sunrise[i], offset),
    sunset: withOffset(d.sunset[i], offset),
    uvIndexMax: d.uv_index_max[i] ?? 0
  }));
  const aq = air?.current;
  return {
    location: { ...place, timezone: raw.timezone },
    fetchedAt: new Date(now).toISOString(),
    current: {
      time: withOffset(c.time, offset),
      temperatureC: c.temperature_2m,
      apparentC: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      dewPointC: c.dew_point_2m,
      code: c.weather_code,
      condition: conditionOf(c.weather_code),
      isDay: c.is_day === 1,
      windSpeed: c.wind_speed_10m,
      windGust: c.wind_gusts_10m,
      windDirection: c.wind_direction_10m,
      pressureHpa: c.pressure_msl,
      precipitationMm: c.precipitation,
      cloudCover: c.cloud_cover,
      uvIndex: c.uv_index,
      visibilityM: c.visibility
    },
    hourly,
    daily,
    airQuality: typeof aq?.us_aqi === "number" ? { usAqi: aq.us_aqi, pm25: aq.pm2_5 ?? null, pm10: aq.pm10 ?? null } : null
  };
}
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(1e4) });
  if (!res.ok) throw new Error(`open-meteo error: ${res.status}`);
  return res.json();
}
async function getForecast(place) {
  const key = `${place.lat},${place.lon},${place.name}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const forecast = new URL("https://api.open-meteo.com/v1/forecast");
  forecast.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "dew_point_2m",
      "weather_code",
      "is_day",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "pressure_msl",
      "precipitation",
      "cloud_cover",
      "uv_index",
      "visibility"
    ].join(","),
    hourly: "temperature_2m,weather_code,is_day,precipitation_probability",
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "sunrise",
      "sunset",
      "uv_index_max"
    ].join(","),
    timezone: "auto",
    forecast_days: "10",
    wind_speed_unit: "ms"
  }).toString();
  const air = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  air.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: "us_aqi,pm2_5,pm10",
    timezone: "auto"
  }).toString();
  const [raw, aq] = await Promise.all([
    getJson(forecast),
    getJson(air).catch(() => null)
  ]);
  const value = shapeForecast(place, raw, aq);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

// extensions/weather/src/places.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
var MAX_PLACES = 30;
var messages = defineServerMessages({
  ja: {
    tooMany: "\u5834\u6240\u306F{max}\u304B\u6240\u307E\u3067\u3067\u3059",
    notFound: "\u305D\u306E\u5834\u6240\u306F\u3042\u308A\u307E\u305B\u3093",
    noName: "\u5730\u540D\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    badCoords: "\u7DEF\u5EA6\u30FB\u7D4C\u5EA6\u304C\u8AAD\u3081\u307E\u305B\u3093",
    homeFixed: "\u5BB6\u306E\u5730\u70B9\u306F\u3001\u62E1\u5F35\u6A5F\u80FD\u306E\u63A5\u7D9A\u8A2D\u5B9A\u3067\u5909\u3048\u307E\u3059"
  },
  en: {
    tooMany: "You can add up to {max} places",
    notFound: "No such place",
    noName: "Enter a place name",
    badCoords: "Couldn't read the latitude and longitude",
    homeFixed: "Change the home location in the extension's connection settings"
  }
});
var USER_AGENT = "home-dashboard (weather extension)";
var PlaceStore = class {
  constructor(dir) {
    this.dir = dir;
    this.path = join(dir, "places.json");
  }
  path;
  places = null;
  async list() {
    if (this.places) return this.places;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf-8"));
      this.places = Array.isArray(parsed.places) ? parsed.places : [];
    } catch {
      this.places = [];
    }
    return this.places;
  }
  async add(input, locale = "ja") {
    const place = parsePlace(input, locale);
    const places = await this.list();
    if (places.length >= MAX_PLACES) throw new HttpError(400, messages.t(locale, "tooMany", { max: MAX_PLACES }));
    const saved = { id: randomUUID(), ...place };
    await this.save([...places, saved]);
    return saved;
  }
  async remove(id, locale = "ja") {
    const places = await this.list();
    if (!places.some((p) => p.id === id)) throw new HttpError(404, messages.t(locale, "notFound"));
    await this.save(places.filter((p) => p.id !== id));
  }
  async save(next) {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify({ places: next }, null, 2), "utf-8");
    await rename(tmp, this.path);
    this.places = next;
  }
};
function parsePlace(input, locale = "ja") {
  const raw = input ?? {};
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "";
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!name) throw new HttpError(400, messages.t(locale, "noName"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new HttpError(400, messages.t(locale, "badCoords"));
  }
  return { name, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4 };
}
async function getJson2(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(1e4) });
  if (!res.ok) throw new Error(`\u5730\u540D\u3092\u63A2\u305B\u307E\u305B\u3093\u3067\u3057\u305F\uFF08${res.status}\uFF09`);
  return res.json();
}
var needsSuffix = (q) => /[぀-ヿ一-鿿]$/.test(q) && !/[市区町村都道府県]$/.test(q);
async function searchPlaces(query, locale = "ja") {
  const sep = locale === "ja" ? "\u30FB" : ", ";
  const q = query.trim().slice(0, 60);
  if (!q) return [];
  const names = needsSuffix(q) ? [q, `${q}\u5E02`, `${q}\u533A`, `${q}\u753A`, `${q}\u6751`, `${q}\u90FD`, `${q}\u5E9C`, `${q}\u770C`] : [q];
  const lists = await Promise.all(
    names.map(async (name) => {
      const url2 = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url2.search = new URLSearchParams({ name, count: "5", language: locale, format: "json" }).toString();
      return (await getJson2(url2).catch(() => ({ results: [] }))).results ?? [];
    })
  );
  const seen = /* @__PURE__ */ new Set();
  const found = lists.flat().filter((p) => !seen.has(p.id) && seen.add(p.id)).sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, 8).map((p) => ({
    name: p.name,
    lat: p.latitude,
    lon: p.longitude,
    detail: [p.admin1, p.country].filter((s) => s && s !== p.name).join(sep)
  }));
  if (found.length > 0) return found;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "6", "accept-language": locale, addressdetails: "1" }).toString();
  const osm = await getJson2(url);
  return osm.map((p) => ({
    name: p.name || p.display_name.split(",")[0],
    lat: Number(p.lat),
    lon: Number(p.lon),
    detail: [p.address?.state ?? p.address?.province, p.address?.country].filter(Boolean).join(sep)
  }));
}
async function placeName(lat, lon, locale = "ja") {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "10",
    "accept-language": locale
  }).toString();
  try {
    const p = await getJson2(url);
    const a = p.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? a.state ?? (p.name || null);
  } catch {
    return null;
  }
}

// extensions/weather/src/server.ts
var WEATHER_CODE_MAP = {
  0: { condition: "\u5FEB\u6674", icon: "\u2600\uFE0F" },
  1: { condition: "\u6674\u308C", icon: "\u{1F324}\uFE0F" },
  2: { condition: "\u8584\u66C7\u308A", icon: "\u26C5" },
  3: { condition: "\u66C7\u308A", icon: "\u2601\uFE0F" },
  45: { condition: "\u9727", icon: "\u{1F32B}\uFE0F" },
  48: { condition: "\u9727\u6C37", icon: "\u{1F32B}\uFE0F" },
  51: { condition: "\u5C0F\u96E8", icon: "\u{1F326}\uFE0F" },
  53: { condition: "\u5C0F\u96E8", icon: "\u{1F326}\uFE0F" },
  55: { condition: "\u96E8", icon: "\u{1F327}\uFE0F" },
  61: { condition: "\u96E8", icon: "\u{1F327}\uFE0F" },
  63: { condition: "\u96E8", icon: "\u{1F327}\uFE0F" },
  65: { condition: "\u5927\u96E8", icon: "\u{1F327}\uFE0F" },
  71: { condition: "\u96EA", icon: "\u{1F328}\uFE0F" },
  73: { condition: "\u96EA", icon: "\u{1F328}\uFE0F" },
  75: { condition: "\u5927\u96EA", icon: "\u2744\uFE0F" },
  80: { condition: "\u306B\u308F\u304B\u96E8", icon: "\u{1F326}\uFE0F" },
  81: { condition: "\u306B\u308F\u304B\u96E8", icon: "\u{1F326}\uFE0F" },
  82: { condition: "\u6FC0\u3057\u3044\u306B\u308F\u304B\u96E8", icon: "\u26C8\uFE0F" },
  95: { condition: "\u96F7\u96E8", icon: "\u26C8\uFE0F" },
  96: { condition: "\u96F7\u96E8(\u96F9)", icon: "\u26C8\uFE0F" },
  99: { condition: "\u96F7\u96E8(\u96F9)", icon: "\u26C8\uFE0F" }
};
function describeWeatherCode(code) {
  return WEATHER_CODE_MAP[code] ?? { condition: "\u4E0D\u660E", icon: "\u2754" };
}
async function fetchOpenMeteo(place) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.lat));
  url.searchParams.set("longitude", String(place.lon));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("hourly", "precipitation_probability");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");
  const res = await fetch(url, { signal: AbortSignal.timeout(1e4) });
  if (!res.ok) throw new Error(`open-meteo error: ${res.status}`);
  return res.json();
}
async function getWeather(place) {
  const data = await fetchOpenMeteo(place);
  const { condition, icon } = describeWeatherCode(data.current.weather_code);
  const now = Date.now();
  const startIndex = data.hourly.time.findIndex((t) => new Date(t).getTime() >= now);
  const from = startIndex === -1 ? 0 : startIndex;
  const hourly = data.hourly.time.slice(from, from + 12).map((time, i) => ({
    time,
    precipitationProbability: data.hourly.precipitation_probability[from + i] ?? 0
  }));
  const daily = data.daily.time.map((date, i) => ({
    date,
    condition: describeWeatherCode(data.daily.weather_code[i]).condition,
    maxTemperatureC: data.daily.temperature_2m_max[i],
    minTemperatureC: data.daily.temperature_2m_min[i],
    precipitationProbabilityMax: data.daily.precipitation_probability_max[i]
  }));
  return {
    location: { name: place.name, lat: place.lat, lon: place.lon },
    current: {
      temperatureC: data.current.temperature_2m,
      condition,
      icon,
      // WMO weather code。フロント側で天気に応じたアイコンを選ぶのに使う
      code: data.current.weather_code,
      isDay: data.current.is_day === 1
    },
    hourly,
    daily
  };
}
var server_default = defineServerExtension({
  register(api) {
    const place = () => ({
      name: String(api.settings.name),
      lat: Number(api.settings.lat),
      lon: Number(api.settings.lon)
    });
    api.route("GET", "/current", () => getWeather(place()));
    const places = new PlaceStore(api.dataDir);
    const HOME = "home";
    api.route("GET", "/forecast", async ({ query, locale }) => {
      if (!query.place || query.place === HOME) return getForecast(place());
      const saved = (await places.list()).find((p) => p.id === query.place);
      if (!saved) throw api.error(404, messages.t(locale, "notFound"));
      return getForecast(saved);
    });
    api.route("GET", "/places", async () => ({
      places: [{ id: HOME, home: true, ...place() }, ...(await places.list()).map((p) => ({ ...p, home: false }))]
    }));
    api.route("POST", "/places", async ({ body, locale }) => ({ place: await places.add(body, locale) }));
    api.route("DELETE", "/places/:id", async ({ params, locale }) => {
      if (params.id === HOME) throw api.error(400, messages.t(locale, "homeFixed"));
      await places.remove(params.id, locale);
      return { ok: true };
    });
    api.route("GET", "/places/search", async ({ query, locale }) => ({ places: await searchPlaces(query.q ?? "", locale) }));
    api.route("GET", "/places/name", async ({ query, locale }) => {
      const { lat, lon } = parsePlace({ name: "-", lat: query.lat, lon: query.lon }, locale);
      return { name: await placeName(lat, lon, locale) };
    });
    api.tool({
      name: "get_weather",
      description: "\u5BB6\u306E\u5730\u70B9\u306E\u5929\u6C17\u3002\u73FE\u5728\u306E\u6C17\u6E29\u3068\u5929\u6C17\u3001\u4ECA\u5F8C12\u6642\u9593\u306E\u964D\u6C34\u78BA\u7387\uFF081\u6642\u9593\u3054\u3068\uFF09\u3001\u4ECA\u65E5\u30FB\u660E\u65E5\u30FB\u660E\u5F8C\u65E5\u306E\u5929\u6C17\u30FB\u6700\u9AD8/\u6700\u4F4E\u6C17\u6E29\u30FB\u6700\u5927\u964D\u6C34\u78BA\u7387\u3092\u8FD4\u3059\u3002",
      readOnly: true,
      handler: () => getWeather(place())
    });
  }
});
export {
  server_default as default,
  getWeather
};
