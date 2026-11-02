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
function cachedLoader(ttlMs) {
  const values = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  function load(key, task) {
    const hit = values.get(key);
    if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value);
    const running = pending.get(key);
    if (running) return running;
    const promise = task().then((value) => {
      values.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  load.clear = () => values.clear();
  return load;
}

// extensions/home-assistant/src/homeassistant.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
var messages = defineServerMessages({
  ja: {
    unreachable: "Home Assistant \u306B\u3064\u306A\u304C\u308A\u307E\u305B\u3093",
    enterUrlAndToken: "URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    tokenRejected: "\u30C8\u30FC\u30AF\u30F3\u304C\u901A\u308A\u307E\u305B\u3093",
    haStatus: "Home Assistant \u304C {status} \u3092\u8FD4\u3057\u307E\u3057\u305F",
    connected: "\u3064\u306A\u304C\u308A\u307E\u3057\u305F",
    cannotConnect: "{url} \u306B\u3064\u306A\u304C\u308A\u307E\u305B\u3093"
  },
  en: {
    unreachable: "Can't connect to Home Assistant",
    enterUrlAndToken: "Enter the URL and token",
    tokenRejected: "Token rejected",
    haStatus: "Home Assistant returned {status}",
    connected: "Connected",
    cannotConnect: "Can't connect to {url}"
  }
});
var HaUnreachableError = class extends HttpError {
  constructor() {
    super(502, messages.t("ja", "unreachable"));
  }
};
async function localizeErrors(locale, run) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof HaUnreachableError && locale !== "ja")
      throw new HttpError(502, messages.t(locale, "unreachable"));
    throw err;
  }
}
var haSettings = {
  current: {},
  configDir: "",
  dataDir: ""
};
var baseUrl = () => String(haSettings.current.baseUrl ?? "");
var token = () => String(haSettings.current.token ?? "");
var ALLOWED_SERVICES = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off", "toggle"],
  fan: ["turn_on", "turn_off", "toggle"],
  lock: ["lock", "unlock"],
  climate: ["turn_on", "turn_off", "set_temperature", "set_hvac_mode"]
};
var ALLOWED_DATA = {
  "light.turn_on": {
    brightness_pct: (v) => typeof v === "number" && v >= 0 && v <= 100,
    // 色（色相 0〜360・彩度 0〜100）と、白の色温度（ケルビン）
    hs_color: (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number" && v[0] >= 0 && v[0] <= 360 && v[1] >= 0 && v[1] <= 100,
    color_temp_kelvin: (v) => typeof v === "number" && Number.isInteger(v) && v >= 1e3 && v <= 12e3
  },
  "climate.set_temperature": { temperature: (v) => typeof v === "number" && v >= 5 && v <= 40 },
  "climate.set_hvac_mode": {
    hvac_mode: (v) => typeof v === "string" && ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"].includes(v)
  }
};
var CONTROL_DOMAINS = ["light", "switch", "lock", "climate"];
var SCREEN_DOMAINS = ["light", "switch", "fan", "lock", "climate"];
var SENSOR_CLASSES = ["temperature", "humidity", "carbon_dioxide", "pm25", "illuminance"];
var ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;
var haConfigPath = () => join(haSettings.configDir, "homeassistant.json");
var sensorPrefsPath = () => join(haSettings.dataDir, "sensors.json");
async function readSensorPrefs() {
  try {
    const parsed = JSON.parse(await readFile(sensorPrefsPath(), "utf-8"));
    return { disabled: Array.isArray(parsed.disabled) ? parsed.disabled.filter((id) => typeof id === "string") : [] };
  } catch (err) {
    if (err.code === "ENOENT") return { disabled: [] };
    throw err;
  }
}
function isMeasuringSensor(s) {
  return s.entity_id.startsWith("sensor.") && SENSOR_CLASSES.includes(s.attributes.device_class);
}
function isConfigured() {
  return Boolean(baseUrl() && token());
}
async function readHaConfig() {
  try {
    const raw = await readFile(haConfigPath(), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}
async function haFetch(path, init) {
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(1e4)
    });
  } catch {
    throw new HaUnreachableError();
  }
}
var statesCache = cachedLoader(2e3);
var areasCache = cachedLoader(10 * 6e4);
function fetchStates() {
  return statesCache("all", async () => {
    const res = await haFetch("/api/states");
    if (!res.ok) throw new Error(`home assistant states error: ${res.status}`);
    return res.json();
  });
}
function toEntity(s) {
  return {
    entityId: s.entity_id,
    domain: s.entity_id.split(".")[0],
    name: s.attributes.friendly_name ?? s.entity_id,
    state: s.state,
    unit: s.attributes.unit_of_measurement ?? null,
    deviceClass: s.attributes.device_class ?? null
  };
}
function selectEntities(states, explicit, fallback) {
  if (explicit && explicit.length > 0) {
    const byId = new Map(states.map((s) => [s.entity_id, s]));
    return explicit.flatMap((id) => {
      const s = byId.get(id);
      return s ? [toEntity(s)] : [];
    });
  }
  return states.filter(fallback).map(toEntity);
}
function averageReadings(sensors) {
  const groups = /* @__PURE__ */ new Map();
  for (const s of sensors) {
    const value = Number(s.state);
    if (!Number.isFinite(value)) continue;
    const deviceClass = s.attributes.device_class;
    const group = groups.get(deviceClass) ?? {
      unit: s.attributes.unit_of_measurement ?? null,
      values: []
    };
    group.values.push(value);
    groups.set(deviceClass, group);
  }
  return SENSOR_CLASSES.flatMap((deviceClass) => {
    const group = groups.get(deviceClass);
    if (!group) return [];
    const value = group.values.reduce((sum, v) => sum + v, 0) / group.values.length;
    return [{ deviceClass, unit: group.unit, value, count: group.values.length }];
  });
}
async function getControls() {
  if (!isConfigured()) return { configured: false, entities: [], readings: [] };
  const [states, haConfig, prefs] = await Promise.all([fetchStates(), readHaConfig(), readSensorPrefs()]);
  const entities = selectEntities(
    states,
    haConfig.controls,
    (s) => CONTROL_DOMAINS.includes(s.entity_id.split(".")[0])
  );
  const disabled = new Set(prefs.disabled);
  const readings = averageReadings(states.filter((s) => isMeasuringSensor(s) && !disabled.has(s.entity_id)));
  return { configured: true, entities, readings };
}
async function listSensors() {
  if (!isConfigured()) return { configured: false, sensors: [] };
  const [states, prefs] = await Promise.all([fetchStates(), readSensorPrefs()]);
  const disabled = new Set(prefs.disabled);
  const picked = states.filter(isMeasuringSensor).sort(
    (a, b) => SENSOR_CLASSES.indexOf(a.attributes.device_class) - SENSOR_CLASSES.indexOf(b.attributes.device_class) || a.entity_id.localeCompare(b.entity_id)
  );
  const areas = await fetchAreas(picked.map((s) => s.entity_id));
  return {
    configured: true,
    sensors: picked.map((s) => ({
      ...toEntity(s),
      area: areas[s.entity_id] ?? null,
      enabled: !disabled.has(s.entity_id)
    }))
  };
}
async function setSensorEnabled(entityId, enabled) {
  if (typeof entityId !== "string" || !ENTITY_ID_PATTERN.test(entityId) || !entityId.startsWith("sensor."))
    throw new HttpError(400, "invalid entity id");
  if (typeof enabled !== "boolean") throw new HttpError(400, "enabled must be a boolean");
  const prefs = await readSensorPrefs();
  const disabled = new Set(prefs.disabled);
  if (enabled) disabled.delete(entityId);
  else disabled.add(entityId);
  await mkdir(haSettings.dataDir, { recursive: true });
  await writeFile(sensorPrefsPath(), `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}
`);
}
async function getClimate() {
  if (!isConfigured()) return { configured: false, sensors: [], thermostats: [] };
  const [states, haConfig, prefs] = await Promise.all([fetchStates(), readHaConfig(), readSensorPrefs()]);
  const disabled = new Set(prefs.disabled);
  const sensors = selectEntities(
    states,
    haConfig.climate,
    (s) => s.entity_id.startsWith("sensor.") && ["temperature", "humidity"].includes(s.attributes.device_class)
  ).filter((s) => !disabled.has(s.entityId));
  const thermostats = states.filter((s) => s.entity_id.startsWith("climate.")).map((s) => ({
    ...toEntity(s),
    currentTemperature: s.attributes.current_temperature ?? null,
    targetTemperature: s.attributes.temperature ?? null
  }));
  return { configured: true, sensors, thermostats };
}
function canUnlock(loggedIn) {
  return loggedIn;
}
function sanitizeServiceData(key, data) {
  const allowed = ALLOWED_DATA[key] ?? {};
  const sanitized = {};
  for (const [name, value] of Object.entries(data ?? {})) {
    const check = allowed[name];
    if (!check || !check(value)) throw new HttpError(400, `data not allowed: ${key} ${name}`);
    sanitized[name] = value;
  }
  return sanitized;
}
async function callHomeAssistantService(entityId, service, data, options = {}) {
  if (!isConfigured()) throw new HttpError(409, "home assistant not configured");
  if (typeof entityId !== "string" || !ENTITY_ID_PATTERN.test(entityId)) {
    throw new HttpError(400, "invalid entity id");
  }
  const domain = entityId.split(".")[0];
  if (!ALLOWED_SERVICES[domain]?.includes(service)) {
    throw new HttpError(403, `service not allowed: ${domain}.${service}`);
  }
  if (domain === "lock" && service === "unlock" && !canUnlock(options.loggedIn ?? false)) {
    throw new HttpError(403, "unlock needs a signed-in account (or approval on a screen for the voice assistant)");
  }
  const body = { ...sanitizeServiceData(`${domain}.${service}`, data), entity_id: entityId };
  const res = await haFetch(`/api/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(body) });
  statesCache.clear();
  if (!res.ok) throw new HttpError(502, `home assistant service error: ${res.status}`);
}
async function fetchAreas(entityIds) {
  const ids = entityIds.filter((id) => ENTITY_ID_PATTERN.test(id));
  if (ids.length === 0) return {};
  return areasCache(ids.join(","), () => fetchAreasNow(ids)).catch(() => ({}));
}
async function fetchAreasNow(ids) {
  const template = `{% set ids = ${JSON.stringify(ids)} %}{% set ns = namespace(out=[]) %}{% for id in ids %}{% set ns.out = ns.out + [[id, area_name(id)]] %}{% endfor %}{{ ns.out | tojson }}`;
  const res = await haFetch("/api/template", { method: "POST", body: JSON.stringify({ template }) });
  if (!res.ok) throw new Error(`home assistant template error: ${res.status}`);
  const pairs = JSON.parse(await res.text());
  return Object.fromEntries(pairs);
}
function numberAttr(s, name) {
  const value = s.attributes[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
async function getOverview(loggedIn) {
  const unlock = { canUnlock: canUnlock(loggedIn) };
  if (!isConfigured()) return { configured: false, ...unlock, sensors: [], locks: [], climates: [], toggles: [] };
  const [states, haConfig, prefs] = await Promise.all([
    fetchStates(),
    readHaConfig(),
    readSensorPrefs()
  ]);
  const disabled = new Set(prefs.disabled);
  const explicit = haConfig.screen && haConfig.screen.length > 0 ? new Set(haConfig.screen) : null;
  const order = (id) => explicit ? [...explicit].indexOf(id) : 0;
  const picked = states.filter((s) => {
    if (disabled.has(s.entity_id)) return false;
    if (explicit) return explicit.has(s.entity_id);
    const domain = s.entity_id.split(".")[0];
    if (SCREEN_DOMAINS.includes(domain)) return true;
    return domain === "sensor" && SENSOR_CLASSES.includes(s.attributes.device_class);
  });
  picked.sort((a, b) => order(a.entity_id) - order(b.entity_id));
  const areas = await fetchAreas(picked.map((s) => s.entity_id));
  const withArea = (s) => ({ ...toEntity(s), area: areas[s.entity_id] ?? null });
  const byDomain = (domain) => picked.filter((s) => s.entity_id.startsWith(`${domain}.`));
  const sensors = byDomain("sensor").filter((s) => SENSOR_CLASSES.includes(s.attributes.device_class)).sort(
    (a, b) => SENSOR_CLASSES.indexOf(a.attributes.device_class) - SENSOR_CLASSES.indexOf(b.attributes.device_class)
  ).map(withArea);
  const locks = byDomain("lock").map(withArea);
  const climates = byDomain("climate").map((s) => ({
    ...withArea(s),
    currentTemperature: numberAttr(s, "current_temperature"),
    targetTemperature: numberAttr(s, "temperature"),
    minTemperature: numberAttr(s, "min_temp"),
    maxTemperature: numberAttr(s, "max_temp"),
    step: numberAttr(s, "target_temp_step"),
    hvacModes: Array.isArray(s.attributes.hvac_modes) ? s.attributes.hvac_modes : []
  }));
  const toggles = [...byDomain("light"), ...byDomain("switch"), ...byDomain("fan")].map((s) => {
    const brightness = numberAttr(s, "brightness");
    const modes = s.attributes.supported_color_modes;
    const isLight = s.entity_id.startsWith("light.");
    const colorModes = isLight && Array.isArray(modes) ? modes : [];
    const hs = s.attributes.hs_color;
    return {
      ...withArea(s),
      // HA の brightness は 0〜255。画面では % で扱う
      brightnessPct: brightness === null ? null : Math.round(brightness / 255 * 100),
      dimmable: colorModes.some((mode) => mode !== "onoff"),
      // 色を変えられるか（hs・rgb など）と、白の色温度を変えられるか
      colorable: colorModes.some((mode) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode)),
      colorTemp: colorModes.includes("color_temp"),
      hsColor: Array.isArray(hs) && hs.length === 2 && hs.every((v) => typeof v === "number") ? [hs[0], hs[1]] : null,
      colorTempKelvin: numberAttr(s, "color_temp_kelvin"),
      minKelvin: numberAttr(s, "min_color_temp_kelvin"),
      maxKelvin: numberAttr(s, "max_color_temp_kelvin")
    };
  });
  return { configured: true, ...unlock, sensors, locks, climates, toggles };
}
var HISTORY_MAX_ENTITIES = 12;
var HISTORY_MAX_POINTS = 240;
var HISTORY_HOURS = [24, 24 * 7];
function downsample(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const start = points[0][0];
  const span = points[points.length - 1][0] - start || 1;
  const buckets = /* @__PURE__ */ new Map();
  for (const [t, v] of points) {
    const index = Math.min(maxPoints - 1, Math.floor((t - start) / span * maxPoints));
    const bucket = buckets.get(index) ?? { t: 0, sum: 0, n: 0 };
    bucket.t += t;
    bucket.sum += v;
    bucket.n += 1;
    buckets.set(index, bucket);
  }
  return [...buckets.values()].map((b) => [Math.round(b.t / b.n), b.sum / b.n]);
}
async function getSensorHistory(entityIds, hours) {
  if (!isConfigured()) throw new HttpError(409, "home assistant not configured");
  const ids = [...new Set(entityIds)];
  if (ids.length === 0 || ids.length > HISTORY_MAX_ENTITIES) throw new HttpError(400, "entity ids are required");
  if (ids.some((id) => !ENTITY_ID_PATTERN.test(id) || !id.startsWith("sensor.")))
    throw new HttpError(400, "invalid entity id");
  if (!HISTORY_HOURS.includes(hours)) throw new HttpError(400, "invalid hours");
  const end = Date.now();
  const start = new Date(end - hours * 60 * 60 * 1e3).toISOString();
  const query = new URLSearchParams({ filter_entity_id: ids.join(","), end_time: new Date(end).toISOString() });
  const res = await haFetch(`/api/history/period/${encodeURIComponent(start)}?${query}&minimal_response&no_attributes`);
  if (!res.ok) throw new HttpError(502, `home assistant history error: ${res.status}`);
  const raw = await res.json();
  const states = new Map((await fetchStates()).map((s) => [s.entity_id, s]));
  return raw.filter((series) => series.length > 0 && series[0].entity_id).map((series) => {
    const entityId = series[0].entity_id;
    const state = states.get(entityId);
    const points = series.map((item) => [Date.parse(item.last_changed ?? item.last_updated ?? ""), Number(item.state)]).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
    return {
      entityId,
      name: state?.attributes.friendly_name ?? entityId,
      unit: state?.attributes.unit_of_measurement ?? null,
      points: downsample(points, HISTORY_MAX_POINTS)
    };
  });
}
async function testConnection(locale = "ja") {
  if (!isConfigured()) return { ok: false, message: messages.t(locale, "enterUrlAndToken") };
  try {
    const res = await fetch(`${baseUrl()}/api/`, {
      headers: { Authorization: `Bearer ${token()}` },
      signal: AbortSignal.timeout(8e3)
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: messages.t(locale, "tokenRejected") };
    if (!res.ok) return { ok: false, message: messages.t(locale, "haStatus", { status: res.status }) };
    return { ok: true, message: messages.t(locale, "connected") };
  } catch {
    return { ok: false, message: messages.t(locale, "cannotConnect", { url: baseUrl() }) };
  }
}
var ONOFF_DOMAINS = ["light", "switch", "fan", "binary_sensor", "input_boolean", "media_player"];
function isOn(state) {
  if (state === "unavailable" || state === "unknown") return null;
  return ["on", "open", "playing", "home", "heat", "cool", "auto"].includes(state);
}
function toReading(s) {
  const domain = s.entity_id.split(".")[0];
  const name = s.attributes.friendly_name ?? s.entity_id;
  const unit = s.attributes.unit_of_measurement ?? null;
  if (domain === "sensor" && unit) {
    const value = Number(s.state);
    const rank = s.attributes.device_class === "illuminance" ? 0 : 3;
    return { id: s.entity_id, name, kind: "number", value: s.state.trim() !== "" && Number.isFinite(value) ? value : null, unit, rank };
  }
  if (ONOFF_DOMAINS.includes(domain)) {
    return { id: s.entity_id, name, kind: "onoff", value: isOn(s.state), rank: domain === "light" ? 1 : 2 };
  }
  return null;
}
async function listStateReadings() {
  if (!isConfigured()) return [];
  return (await fetchStates()).map(toReading).filter((r) => r !== null).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(({ rank: _rank, ...reading }) => reading);
}
async function readStateReadings(ids) {
  if (!isConfigured() || ids.length === 0) return [];
  const wanted = new Set(ids);
  return (await fetchStates()).filter((s) => wanted.has(s.entity_id)).map(toReading).filter((r) => r !== null).map(({ rank: _rank, ...reading }) => reading);
}

// extensions/home-assistant/src/layout.ts
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";
var TILE_SIZES = ["2x1", "2x2", "4x2", "4x4"];
var MAX_TILES = 500;
var ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
var COLOR = /^#[0-9a-f]{6}$/i;
var EMPTY_LAYOUT = { order: [], tiles: {} };
function normalizeLayout(raw) {
  const input = raw ?? {};
  const order = Array.isArray(input.order) ? [...new Set(input.order.filter((id) => typeof id === "string" && ENTITY_ID.test(id)))].slice(0, MAX_TILES) : [];
  const tiles = {};
  if (input.tiles && typeof input.tiles === "object") {
    for (const [id, value] of Object.entries(input.tiles).slice(0, MAX_TILES)) {
      if (!ENTITY_ID.test(id) || !value || typeof value !== "object") continue;
      const { size, color } = value;
      const tile = {};
      if (TILE_SIZES.includes(size)) tile.size = size;
      if (typeof color === "string" && COLOR.test(color)) tile.color = color.toLowerCase();
      if (tile.size || tile.color) tiles[id] = tile;
    }
  }
  return { order, tiles };
}
function registerLayout(api) {
  const layoutPath = () => join2(api.dataDir, "layout.json");
  api.route("GET", "/layout", async () => {
    try {
      return normalizeLayout(JSON.parse(await readFile2(layoutPath(), "utf-8")));
    } catch {
      return EMPTY_LAYOUT;
    }
  });
  api.route("PUT", "/layout", async ({ body }) => {
    const layout = normalizeLayout(body);
    await mkdir2(api.dataDir, { recursive: true });
    await writeFile2(layoutPath(), `${JSON.stringify(layout, null, 2)}
`);
    return layout;
  });
}

// extensions/home-assistant/src/server.ts
var HA_ACTIONS = ["turn_on", "turn_off", "toggle", "lock", "unlock", "set_temperature"];
var ACTION_LABELS = {
  turn_on: "\u3064\u3051\u308B",
  turn_off: "\u6D88\u3059",
  toggle: "\u5207\u308A\u66FF\u3048\u308B",
  lock: "\u65BD\u9320\u3059\u308B",
  unlock: "\u89E3\u9320\u3059\u308B",
  set_temperature: "\u306E\u6E29\u5EA6\u3092\u5909\u3048\u308B"
};
async function deviceName(entityId) {
  try {
    return (await getControls()).entities.find((e) => e.entityId === entityId)?.name ?? entityId;
  } catch {
    return entityId;
  }
}
async function describeKnownDevices() {
  try {
    const { configured, entities } = await getControls();
    if (!configured || entities.length === 0) return "";
    const lines = entities.map((e) => `${e.entityId}\uFF08${e.name}\uFF09`).join("\u3001");
    return `\u3053\u306E\u5BB6\u306E\u5BB6\u96FB: ${lines}\u3002`;
  } catch {
    return "";
  }
}
function describeLockActions() {
  return "lock \u306F lock\u30FBunlock\uFF08\u65BD\u9320\u30FB\u89E3\u9320\u3002\u89E3\u9320\u306F\u3001\u5BB6\u306E\u4EBA\u304C\u753B\u9762\u3067\u672C\u4EBA\u78BA\u8A8D\u3057\u3066\u8A31\u53EF\u3057\u305F\u3068\u304D\u3060\u3051\u5B9F\u884C\u3055\u308C\u308B\uFF09";
}
var server_default = defineServerExtension({
  register(api) {
    haSettings.current = api.settings;
    haSettings.configDir = api.configDir;
    haSettings.dataDir = api.dataDir;
    api.provideStates({ list: listStateReadings, read: readStateReadings });
    registerLayout(api);
    api.route(
      "GET",
      "/controls",
      ({ account, locale }) => localizeErrors(locale, async () => {
        const controls = await getControls();
        return { ...controls, allowUnlock: controls.configured && canUnlock(account !== null) };
      })
    );
    api.route("GET", "/overview", ({ account, locale }) => localizeErrors(locale, () => getOverview(account !== null)));
    api.route(
      "POST",
      "/call",
      ({ body, account, locale }) => localizeErrors(locale, async () => {
        const { entityId, service, data } = body ?? {};
        await callHomeAssistantService(entityId, service, data, { loggedIn: account !== null });
        return { ok: true };
      })
    );
    api.route(
      "GET",
      "/history",
      ({ query, locale }) => localizeErrors(
        locale,
        () => getSensorHistory(
          String(query.entityIds ?? "").split(",").filter(Boolean),
          Number(query.hours ?? 24)
        ).then((series) => ({ series }))
      )
    );
    api.route("POST", "/test", ({ locale }) => testConnection(locale), { adminOnly: true });
    api.route("GET", "/sensors", ({ locale }) => localizeErrors(locale, () => listSensors()));
    api.route(
      "PUT",
      "/sensors",
      ({ body, locale }) => localizeErrors(locale, async () => {
        const { entityId, enabled } = body ?? {};
        await setSensorEnabled(entityId, enabled);
        return { ok: true };
      }),
      { adminOnly: true }
    );
    api.tool({
      name: "list_home_devices",
      description: "Home Assistant \u306E\u64CD\u4F5C\u3067\u304D\u308B\u5BB6\u96FB\uFF08\u7167\u660E\u30FB\u30B9\u30A4\u30C3\u30C1\u30FB\u9375\u30FB\u30A8\u30A2\u30B3\u30F3\uFF09\u3068\u3001\u5BA4\u6E29\u30FB\u6E7F\u5EA6\u30BB\u30F3\u30B5\u30FC\u306E\u73FE\u5728\u306E\u72B6\u614B\u3092\u8FD4\u3059\u3002\u5BB6\u96FB\u3092\u64CD\u4F5C\u3059\u308B\u524D\u306B entity_id \u3092\u8ABF\u3079\u308B\u306E\u306B\u4F7F\u3046\u3002",
      readOnly: true,
      handler: async () => {
        const [controls, climate] = await Promise.all([getControls(), getClimate()]);
        return {
          configured: controls.configured,
          devices: controls.entities,
          sensors: climate.sensors,
          thermostats: climate.thermostats
        };
      }
    });
    api.tool({
      name: "control_home_device",
      description: async () => "Home Assistant \u306E\u5BB6\u96FB\u3092\u64CD\u4F5C\u3059\u308B\u3002" + (await describeKnownDevices() || "entity_id \u306F list_home_devices \u3067\u8ABF\u3079\u308B\u3002") + `light/switch \u306F turn_on\u30FBturn_off\u30FBtoggle\u3001${describeLockActions()}\u3001climate \u306F turn_on\u30FBturn_off\u30FBset_temperature\uFF08temperature \u3092\u6307\u5B9A\uFF09\u304C\u4F7F\u3048\u308B\u3002`,
      inputSchema: (z) => ({
        entity_id: z.string().describe("\u64CD\u4F5C\u3059\u308B\u5BB6\u96FB\u306E entity_id\uFF08\u4F8B: light.living\uFF09"),
        action: z.enum(HA_ACTIONS),
        temperature: z.number().optional().describe("set_temperature \u306E\u3068\u304D\u306E\u8A2D\u5B9A\u6E29\u5EA6\uFF08\u2103\uFF09")
      }),
      // 照明・スイッチ・空調はすぐ戻せるのでそのまま、施錠は了承を、解錠は画面での本人確認を求める
      // （Google のスマートホームの決まりでも、施錠は確認、解錠は暗証番号が要る）
      risk: ({ action }) => action === "unlock" ? "approve" : action === "lock" ? "confirm" : "low",
      describe: async ({ entity_id, action, temperature }) => {
        const name = await deviceName(entity_id);
        return action === "set_temperature" ? `${name}\u306E\u6E29\u5EA6\u3092${temperature}\u5EA6\u306B\u3059\u308B` : `${name}\u3092${ACTION_LABELS[action]}`;
      },
      handler: async ({ entity_id, action, temperature }, { approvedBy }) => {
        if (action === "set_temperature" && temperature === void 0) {
          throw new HttpError(400, "set_temperature requires temperature");
        }
        await callHomeAssistantService(entity_id, action, action === "set_temperature" ? { temperature } : void 0, {
          loggedIn: approvedBy !== null
        });
        return { ok: true };
      }
    });
  }
});
export {
  server_default as default
};
