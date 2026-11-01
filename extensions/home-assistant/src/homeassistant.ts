import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cachedLoader, defineServerMessages, HttpError, type Locale, type SettingValue } from "@home-dashboard/extension-sdk";

/** 画面に返す文（音声アシスタントへの答えは日本語のまま） */
export const messages = defineServerMessages({
  ja: {
    unreachable: "Home Assistant につながりません",
    enterUrlAndToken: "URL とトークンを入れてください",
    tokenRejected: "トークンが通りません",
    haStatus: "Home Assistant が {status} を返しました",
    connected: "つながりました",
    cannotConnect: "{url} につながりません",
  },
  en: {
    unreachable: "Can't connect to Home Assistant",
    enterUrlAndToken: "Enter the URL and token",
    tokenRejected: "Token rejected",
    haStatus: "Home Assistant returned {status}",
    connected: "Connected",
    cannotConnect: "Can't connect to {url}",
  },
});

/** HA につながらないとき。理由は日本語で持ち、画面へ返す道では localizeErrors でその画面の言語に直す */
export class HaUnreachableError extends HttpError {
  constructor() {
    super(502, messages.t("ja", "unreachable"));
  }
}

/** 画面から呼ばれる道で、HA につながらないエラーを画面の言語の文に直す */
export async function localizeErrors<T>(locale: Locale, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof HaUnreachableError && locale !== "ja")
      throw new HttpError(502, messages.t(locale, "unreachable"));
    throw err;
  }
}

/** 接続設定の今の値（server.ts の register で api.settings を入れる） */
export const haSettings: { current: Record<string, SettingValue>; configDir: string; dataDir: string } = {
  current: {},
  configDir: "",
  dataDir: "",
};
const baseUrl = () => String(haSettings.current.baseUrl ?? "");
const token = () => String(haSettings.current.token ?? "");

interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

/** config/homeassistant.json で表示対象を明示できる。無ければドメインから自動検出する */
interface HomeAssistantConfig {
  controls?: string[];
  climate?: string[];
}

/**
 * 呼び出しを許可するサービスのホワイトリスト。
 * このサーバーはHAのトークンを持つため、無制限に中継すると事実上HAの全機能を
 * ログインした人（と音声アシスタント）に渡すことになる。操作系ウィジェットが必要とするものだけに絞る。
 */
const ALLOWED_SERVICES: Record<string, string[]> = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off", "toggle"],
  fan: ["turn_on", "turn_off", "toggle"],
  lock: ["lock", "unlock"],
  climate: ["turn_on", "turn_off", "set_temperature", "set_hvac_mode"],
};

/**
 * サービスに添えてよい値（ドメイン.サービス → キーと検査）。
 * 何でも通すと entity_id を上書きして別の機器を動かせてしまうので、要るものだけを通す。
 */
const ALLOWED_DATA: Record<string, Record<string, (value: unknown) => boolean>> = {
  "light.turn_on": { brightness_pct: (v) => typeof v === "number" && v >= 0 && v <= 100 },
  "climate.set_temperature": { temperature: (v) => typeof v === "number" && v >= 5 && v <= 40 },
  "climate.set_hvac_mode": {
    hvac_mode: (v) =>
      typeof v === "string" && ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"].includes(v),
  },
};

const CONTROL_DOMAINS = ["light", "switch", "lock", "climate"];
/** Home Control 画面で扱うドメイン（ウィジェットより少し広い） */
const SCREEN_DOMAINS = ["light", "switch", "fan", "lock", "climate"];
/** Home Control 画面に出すセンサーの種類。並びもこの順にする */
const SENSOR_CLASSES = ["temperature", "humidity", "carbon_dioxide", "pm25", "illuminance"];
const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;

const haConfigPath = () => join(haSettings.configDir, "homeassistant.json");
/** 設定画面で切ったセンサー（data/extension-data/home-assistant/sensors.json。拡張機能のデータ置き場） */
const sensorPrefsPath = () => join(haSettings.dataDir, "sensors.json");

interface SensorPrefs {
  disabled: string[];
}

async function readSensorPrefs(): Promise<SensorPrefs> {
  try {
    const parsed = JSON.parse(await readFile(sensorPrefsPath(), "utf-8")) as Partial<SensorPrefs>;
    return { disabled: Array.isArray(parsed.disabled) ? parsed.disabled.filter((id) => typeof id === "string") : [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { disabled: [] };
    throw err;
  }
}

/** 計測に使うセンサー（Home Control 画面・ウィジェット・音声アシスタントに出す種類）か */
function isMeasuringSensor(s: HaState): boolean {
  return s.entity_id.startsWith("sensor.") && SENSOR_CLASSES.includes(s.attributes.device_class as string);
}

function isConfigured(): boolean {
  return Boolean(baseUrl() && token());
}

async function readHaConfig(): Promise<HomeAssistantConfig> {
  try {
    const raw = await readFile(haConfigPath(), "utf-8");
    return JSON.parse(raw) as HomeAssistantConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function haFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(10_000),
    });
  } catch {
    // つながらない・応答が無いとき。中身の無い 500 にせず、画面に理由を出せるようにする
    throw new HaUnreachableError();
  }
}

// 全部の状態は、画面（5秒おき）・ウィジェット・音声アシスタントが何台分も読むので、少しの間覚えてまとめる
const statesCache = cachedLoader(2_000);
// 部屋（エリア）はめったに変わらない
const areasCache = cachedLoader(10 * 60_000);

function fetchStates(): Promise<HaState[]> {
  return statesCache("all", async () => {
    const res = await haFetch("/api/states");
    if (!res.ok) throw new Error(`home assistant states error: ${res.status}`);
    return res.json() as Promise<HaState[]>;
  });
}

function toEntity(s: HaState) {
  return {
    entityId: s.entity_id,
    domain: s.entity_id.split(".")[0],
    name: (s.attributes.friendly_name as string) ?? s.entity_id,
    state: s.state,
    unit: (s.attributes.unit_of_measurement as string) ?? null,
    deviceClass: (s.attributes.device_class as string) ?? null,
  };
}

/** 明示設定があればその順序で、無ければドメイン/device_classで自動検出する */
function selectEntities(states: HaState[], explicit: string[] | undefined, fallback: (s: HaState) => boolean) {
  if (explicit && explicit.length > 0) {
    const byId = new Map(states.map((s) => [s.entity_id, s]));
    return explicit.flatMap((id) => {
      const s = byId.get(id);
      return s ? [toEntity(s)] : [];
    });
  }
  return states.filter(fallback).map(toEntity);
}

export interface SensorReading {
  deviceClass: string;
  unit: string | null;
  /** 入っているセンサーのうち、読めたものの平均 */
  value: number;
  count: number;
}

/** 種類（温度・湿度など）ごとの、入っているセンサーの平均。読めないセンサー（unavailable など）は入れない */
function averageReadings(sensors: HaState[]): SensorReading[] {
  const groups = new Map<string, { unit: string | null; values: number[] }>();
  for (const s of sensors) {
    const value = Number(s.state);
    if (!Number.isFinite(value)) continue;
    const deviceClass = s.attributes.device_class as string;
    const group = groups.get(deviceClass) ?? {
      unit: (s.attributes.unit_of_measurement as string) ?? null,
      values: [],
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

export async function getControls() {
  if (!isConfigured()) return { configured: false, entities: [], readings: [] };
  const [states, haConfig, prefs] = await Promise.all([fetchStates(), readHaConfig(), readSensorPrefs()]);
  const entities = selectEntities(states, haConfig.controls, (s) =>
    CONTROL_DOMAINS.includes(s.entity_id.split(".")[0]),
  );
  const disabled = new Set(prefs.disabled);
  const readings = averageReadings(states.filter((s) => isMeasuringSensor(s) && !disabled.has(s.entity_id)));
  return { configured: true, entities, readings };
}

/** 設定画面のセンサーの一覧。計測に使える種類のセンサーすべてと、入っているか */
export async function listSensors() {
  if (!isConfigured()) return { configured: false, sensors: [] };
  const [states, prefs] = await Promise.all([fetchStates(), readSensorPrefs()]);
  const disabled = new Set(prefs.disabled);
  const picked = states
    .filter(isMeasuringSensor)
    .sort(
      (a, b) =>
        SENSOR_CLASSES.indexOf(a.attributes.device_class as string) -
          SENSOR_CLASSES.indexOf(b.attributes.device_class as string) || a.entity_id.localeCompare(b.entity_id),
    );
  const areas = await fetchAreas(picked.map((s) => s.entity_id));
  return {
    configured: true,
    sensors: picked.map((s) => ({
      ...toEntity(s),
      area: areas[s.entity_id] ?? null,
      enabled: !disabled.has(s.entity_id),
    })),
  };
}

/** センサーを入れる・切る。切ったセンサーは Home Control 画面・ウィジェット・音声アシスタントに出さない */
export async function setSensorEnabled(entityId: string, enabled: boolean): Promise<void> {
  if (typeof entityId !== "string" || !ENTITY_ID_PATTERN.test(entityId) || !entityId.startsWith("sensor."))
    throw new HttpError(400, "invalid entity id");
  if (typeof enabled !== "boolean") throw new HttpError(400, "enabled must be a boolean");
  const prefs = await readSensorPrefs();
  const disabled = new Set(prefs.disabled);
  if (enabled) disabled.delete(entityId);
  else disabled.add(entityId);
  await mkdir(haSettings.dataDir, { recursive: true });
  await writeFile(sensorPrefsPath(), `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`);
}

export async function getClimate() {
  if (!isConfigured()) return { configured: false, sensors: [], thermostats: [] };
  const [states, haConfig, prefs] = await Promise.all([fetchStates(), readHaConfig(), readSensorPrefs()]);
  const disabled = new Set(prefs.disabled);

  const sensors = selectEntities(
    states,
    haConfig.climate,
    (s) =>
      s.entity_id.startsWith("sensor.") && ["temperature", "humidity"].includes(s.attributes.device_class as string),
  ).filter((s) => !disabled.has(s.entityId));
  const thermostats = states
    .filter((s) => s.entity_id.startsWith("climate."))
    .map((s) => ({
      ...toEntity(s),
      currentTemperature: (s.attributes.current_temperature as number) ?? null,
      targetTemperature: (s.attributes.temperature as number) ?? null,
    }));

  return { configured: true, sensors, thermostats };
}

/**
 * 解錠してよいか。ログインしたアカウントなら誰でも（画面から押したとき）。
 * 音声アシスタント（/mcp）からは、ログインしている人が画面で本人確認して許可したときだけ（本体の確かめ。risk: approve）
 */
export function canUnlock(loggedIn: boolean): boolean {
  return loggedIn;
}

function sanitizeServiceData(key: string, data: Record<string, unknown> | undefined): Record<string, unknown> {
  const allowed = ALLOWED_DATA[key] ?? {};
  const sanitized: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(data ?? {})) {
    const check = allowed[name];
    if (!check || !check(value)) throw new HttpError(400, `data not allowed: ${key} ${name}`);
    sanitized[name] = value;
  }
  return sanitized;
}

/** ホワイトリスト（ALLOWED_SERVICES）と解錠の可否を確かめてから、HAのサービスを呼ぶ */
export async function callHomeAssistantService(
  entityId: string,
  service: string,
  data?: Record<string, unknown>,
  options: { loggedIn?: boolean } = {},
): Promise<void> {
  if (!isConfigured()) throw new HttpError(409, "home assistant not configured");

  if (typeof entityId !== "string" || !ENTITY_ID_PATTERN.test(entityId)) {
    throw new HttpError(400, "invalid entity id");
  }
  const domain = entityId.split(".")[0];
  if (!ALLOWED_SERVICES[domain]?.includes(service)) {
    throw new HttpError(403, `service not allowed: ${domain}.${service}`);
  }
  // 解錠はログインしたアカウントからだけ（canUnlock 参照）
  if (domain === "lock" && service === "unlock" && !canUnlock(options.loggedIn ?? false)) {
    throw new HttpError(403, "unlock needs a signed-in account (or approval on a screen for the voice assistant)");
  }
  const body = { ...sanitizeServiceData(`${domain}.${service}`, data), entity_id: entityId };

  const res = await haFetch(`/api/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(body) });
  statesCache.clear(); // 操作の直後に読む画面へ、変わった状態を返す
  if (!res.ok) throw new HttpError(502, `home assistant service error: ${res.status}`);
}

interface HomeAssistantOverviewConfig extends HomeAssistantConfig {
  /** Home Control 画面に出すエンティティ（省略時は自動検出） */
  screen?: string[];
}

/**
 * エンティティの部屋（エリア）を HA のテンプレート API で引く。
 * REST の /api/states にはエリアが入っていないため。引けなければ部屋分けせずに出す。
 */
async function fetchAreas(entityIds: string[]): Promise<Record<string, string | null>> {
  const ids = entityIds.filter((id) => ENTITY_ID_PATTERN.test(id));
  if (ids.length === 0) return {};
  // 引けなかったときは覚えない（次の問い合わせで引き直す）
  return areasCache(ids.join(","), () => fetchAreasNow(ids)).catch(() => ({}));
}

async function fetchAreasNow(ids: string[]): Promise<Record<string, string | null>> {
  const template =
    `{% set ids = ${JSON.stringify(ids)} %}` +
    "{% set ns = namespace(out=[]) %}{% for id in ids %}{% set ns.out = ns.out + [[id, area_name(id)]] %}{% endfor %}" +
    "{{ ns.out | tojson }}";
  const res = await haFetch("/api/template", { method: "POST", body: JSON.stringify({ template }) });
  if (!res.ok) throw new Error(`home assistant template error: ${res.status}`);
  const pairs = JSON.parse(await res.text()) as [string, string | null][];
  return Object.fromEntries(pairs);
}

function numberAttr(s: HaState, name: string): number | null {
  const value = s.attributes[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Home Control 画面向けに、センサー・鍵・空調・照明とスイッチをまとめて返す */
export async function getOverview(loggedIn: boolean) {
  const unlock = { canUnlock: canUnlock(loggedIn) };
  if (!isConfigured()) return { configured: false, ...unlock, sensors: [], locks: [], climates: [], toggles: [] };

  const [states, haConfig, prefs] = await Promise.all([
    fetchStates(),
    readHaConfig() as Promise<HomeAssistantOverviewConfig>,
    readSensorPrefs(),
  ]);
  const disabled = new Set(prefs.disabled);
  const explicit = haConfig.screen && haConfig.screen.length > 0 ? new Set(haConfig.screen) : null;
  const order = (id: string) => (explicit ? [...explicit].indexOf(id) : 0);

  const picked = states.filter((s) => {
    // 設定画面で切ったセンサーは出さない
    if (disabled.has(s.entity_id)) return false;
    if (explicit) return explicit.has(s.entity_id);
    const domain = s.entity_id.split(".")[0];
    if (SCREEN_DOMAINS.includes(domain)) return true;
    return domain === "sensor" && SENSOR_CLASSES.includes(s.attributes.device_class as string);
  });
  picked.sort((a, b) => order(a.entity_id) - order(b.entity_id));
  const areas = await fetchAreas(picked.map((s) => s.entity_id));
  const withArea = (s: HaState) => ({ ...toEntity(s), area: areas[s.entity_id] ?? null });

  const byDomain = (domain: string) => picked.filter((s) => s.entity_id.startsWith(`${domain}.`));

  const sensors = byDomain("sensor")
    .filter((s) => SENSOR_CLASSES.includes(s.attributes.device_class as string))
    .sort(
      (a, b) =>
        SENSOR_CLASSES.indexOf(a.attributes.device_class as string) -
        SENSOR_CLASSES.indexOf(b.attributes.device_class as string),
    )
    .map(withArea);

  const locks = byDomain("lock").map(withArea);

  const climates = byDomain("climate").map((s) => ({
    ...withArea(s),
    currentTemperature: numberAttr(s, "current_temperature"),
    targetTemperature: numberAttr(s, "temperature"),
    minTemperature: numberAttr(s, "min_temp"),
    maxTemperature: numberAttr(s, "max_temp"),
    step: numberAttr(s, "target_temp_step"),
    hvacModes: Array.isArray(s.attributes.hvac_modes) ? (s.attributes.hvac_modes as string[]) : [],
  }));

  const toggles = [...byDomain("light"), ...byDomain("switch"), ...byDomain("fan")].map((s) => {
    const brightness = numberAttr(s, "brightness");
    const modes = s.attributes.supported_color_modes;
    const dimmable = Array.isArray(modes) && modes.some((mode) => mode !== "onoff");
    return {
      ...withArea(s),
      // HA の brightness は 0〜255。画面では % で扱う
      brightnessPct: brightness === null ? null : Math.round((brightness / 255) * 100),
      dimmable: s.entity_id.startsWith("light.") && dimmable,
    };
  });

  return { configured: true, ...unlock, sensors, locks, climates, toggles };
}

const HISTORY_MAX_ENTITIES = 12;
const HISTORY_MAX_POINTS = 240;
const HISTORY_HOURS = [24, 24 * 7] as const;

export interface SensorHistory {
  entityId: string;
  name: string;
  unit: string | null;
  /** 時刻（ミリ秒）と値。数値でない状態（unavailable など）は抜く */
  points: [number, number][];
}

/** 点が多すぎると画面が重いので、時間で等分した区間ごとの平均にまとめる */
function downsample(points: [number, number][], maxPoints: number): [number, number][] {
  if (points.length <= maxPoints) return points;
  const start = points[0][0];
  const span = points[points.length - 1][0] - start || 1;
  const buckets = new Map<number, { t: number; sum: number; n: number }>();
  for (const [t, v] of points) {
    const index = Math.min(maxPoints - 1, Math.floor(((t - start) / span) * maxPoints));
    const bucket = buckets.get(index) ?? { t: 0, sum: 0, n: 0 };
    bucket.t += t;
    bucket.sum += v;
    bucket.n += 1;
    buckets.set(index, bucket);
  }
  return [...buckets.values()].map((b) => [Math.round(b.t / b.n), b.sum / b.n] as [number, number]);
}

/**
 * センサーの推移（Home Control の詳細画面のグラフ）。HA の記録（/api/history）を読む。
 * 読めるのはセンサー（sensor.*）だけで、一度に読む数と期間は決まった範囲に限る
 */
export async function getSensorHistory(entityIds: string[], hours: number): Promise<SensorHistory[]> {
  if (!isConfigured()) throw new HttpError(409, "home assistant not configured");
  const ids = [...new Set(entityIds)];
  if (ids.length === 0 || ids.length > HISTORY_MAX_ENTITIES) throw new HttpError(400, "entity ids are required");
  if (ids.some((id) => !ENTITY_ID_PATTERN.test(id) || !id.startsWith("sensor.")))
    throw new HttpError(400, "invalid entity id");
  if (!(HISTORY_HOURS as readonly number[]).includes(hours)) throw new HttpError(400, "invalid hours");

  const end = Date.now();
  const start = new Date(end - hours * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({ filter_entity_id: ids.join(","), end_time: new Date(end).toISOString() });
  const res = await haFetch(`/api/history/period/${encodeURIComponent(start)}?${query}&minimal_response&no_attributes`);
  if (!res.ok) throw new HttpError(502, `home assistant history error: ${res.status}`);
  const raw = (await res.json()) as Array<
    Array<{ entity_id?: string; state: string; last_changed?: string; last_updated?: string }>
  >;

  // 名前と単位は今の状態から取る（記録には no_attributes で入れていない）
  const states = new Map((await fetchStates()).map((s) => [s.entity_id, s]));
  return raw
    .filter((series) => series.length > 0 && series[0].entity_id)
    .map((series) => {
      const entityId = series[0].entity_id!;
      const state = states.get(entityId);
      const points = series
        .map((item): [number, number] => [Date.parse(item.last_changed ?? item.last_updated ?? ""), Number(item.state)])
        .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
      return {
        entityId,
        name: (state?.attributes.friendly_name as string) ?? entityId,
        unit: (state?.attributes.unit_of_measurement as string) ?? null,
        points: downsample(points, HISTORY_MAX_POINTS),
      };
    });
}

/** 保存してある URL とトークンで HA の /api/ を呼び、つながるかを確かめる（設定画面の「接続を確かめる」） */
export async function testConnection(locale: Locale = "ja"): Promise<{ ok: boolean; message: string }> {
  if (!isConfigured()) return { ok: false, message: messages.t(locale, "enterUrlAndToken") };
  try {
    const res = await fetch(`${baseUrl()}/api/`, {
      headers: { Authorization: `Bearer ${token()}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: messages.t(locale, "tokenRejected") };
    if (!res.ok) return { ok: false, message: messages.t(locale, "haStatus", { status: res.status }) };
    return { ok: true, message: messages.t(locale, "connected") };
  } catch {
    return { ok: false, message: messages.t(locale, "cannotConnect", { url: baseUrl() }) };
  }
}

// --- 夜の表示の条件（night.ts）に使う ---

/** 夜の条件に選べる機器の種類。数値で比べるもの（照度などのセンサー）と、ついている・消えているで見るもの */
const NIGHT_SWITCH_DOMAINS = ["light", "switch", "fan", "binary_sensor", "input_boolean", "media_player"];

export interface NightCandidate {
  entityId: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
  /** "number" は未満・より上で、"switch" はついている・消えているで比べる */
  type: "number" | "switch";
}

/** 夜の条件に選べる機器（照度のセンサーを先に、照明、ほかのスイッチの順） */
export async function nightCandidates(): Promise<{ configured: boolean; entities: NightCandidate[] }> {
  if (!isConfigured()) return { configured: false, entities: [] };
  const states = await fetchStates();
  const rank = (e: NightCandidate) =>
    e.deviceClass === "illuminance" ? 0 : e.entityId.startsWith("light.") ? 1 : e.type === "number" ? 3 : 2;
  const entities = states
    .flatMap((s): NightCandidate[] => {
      const domain = s.entity_id.split(".")[0];
      const base = toEntity(s);
      if (domain === "sensor" && Number.isFinite(Number(s.state)) && s.attributes.unit_of_measurement)
        return [{ ...base, type: "number" }];
      if (NIGHT_SWITCH_DOMAINS.includes(domain)) return [{ ...base, type: "switch" }];
      return [];
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return { configured: true, entities };
}

/** 決めた機器の今の状態 */
export async function readEntityStates(entityIds: string[]) {
  if (!isConfigured() || entityIds.length === 0) return new Map<string, ReturnType<typeof toEntity>>();
  const wanted = new Set(entityIds);
  return new Map((await fetchStates()).filter((s) => wanted.has(s.entity_id)).map((s) => [s.entity_id, toEntity(s)]));
}
