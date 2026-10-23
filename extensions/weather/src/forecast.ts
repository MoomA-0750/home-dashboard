/**
 * 詳しい天気（Weather 画面）。Open-Meteo の予報（今・1時間ごと・10日間）と大気質を読み、画面の形にする。
 * 時刻は地点のタイムゾーンの時刻に、UTC からのずれを付けた ISO 8601 にする（どの端末でも同じ時刻を指す）。
 * 何台もの端末が開くので、同じ地点のものは少しのあいだ覚えて使い回す
 */

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** WMO の天気コード（open-meteo.com）を日本語にする */
const CONDITIONS: Record<number, string> = {
  0: "快晴",
  1: "晴れ",
  2: "薄曇り",
  3: "曇り",
  45: "霧",
  48: "霧氷",
  51: "霧雨",
  53: "霧雨",
  55: "強い霧雨",
  56: "着氷性の霧雨",
  57: "着氷性の霧雨",
  61: "小雨",
  63: "雨",
  65: "大雨",
  66: "着氷性の雨",
  67: "着氷性の雨",
  71: "小雪",
  73: "雪",
  75: "大雪",
  77: "霧雪",
  80: "にわか雨",
  81: "にわか雨",
  82: "激しいにわか雨",
  85: "にわか雪",
  86: "激しいにわか雪",
  95: "雷雨",
  96: "雷雨（ひょう）",
  99: "雷雨（ひょう）",
};

export const conditionOf = (code: number) => CONDITIONS[code] ?? "不明";

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { value: Forecast; expiresAt: number }>();

interface RawForecast {
  utc_offset_seconds: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    dew_point_2m: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    pressure_msl: number;
    precipitation: number;
    cloud_cover: number;
    uv_index: number;
    visibility: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
}

interface RawAirQuality {
  current?: { us_aqi?: number; pm2_5?: number; pm10?: number };
}

export interface Forecast {
  location: Place & { timezone: string };
  fetchedAt: string;
  current: {
    time: string;
    temperatureC: number;
    apparentC: number;
    humidity: number;
    dewPointC: number;
    code: number;
    condition: string;
    isDay: boolean;
    /** m/s */
    windSpeed: number;
    windGust: number;
    /** 風の吹いてくる向き（度。北が 0） */
    windDirection: number;
    pressureHpa: number;
    precipitationMm: number;
    cloudCover: number;
    uvIndex: number;
    visibilityM: number;
  };
  /** これから24時間（今の時刻から） */
  hourly: { time: string; temperatureC: number; code: number; isDay: boolean; precipitationProbability: number }[];
  /** 今日から10日間 */
  daily: {
    date: string;
    code: number;
    condition: string;
    maxC: number;
    minC: number;
    precipitationProbability: number;
    precipitationSumMm: number;
    sunrise: string;
    sunset: string;
    uvIndexMax: number;
  }[];
  airQuality: { usAqi: number; pm25: number | null; pm10: number | null } | null;
}

/** 地点の時刻（"2026-10-20T19:15"）に、UTC からのずれを付ける */
function withOffset(local: string, offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(offsetSeconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `${local.length === 16 ? `${local}:00` : local}${sign}${hh}:${mm}`;
}

/** Open-Meteo の答えを画面の形にする */
export function shapeForecast(place: Place, raw: RawForecast, air: RawAirQuality | null, now = Date.now()): Forecast {
  const offset = raw.utc_offset_seconds;
  const c = raw.current;
  // 今の時刻を含む1時間から24時間分
  const times = raw.hourly.time.map((t) => withOffset(t, offset));
  const first = Math.max(0, times.findIndex((t) => Date.parse(t) + 3600_000 > now));
  const hourly = times.slice(first, first + 24).map((time, i) => ({
    time,
    temperatureC: raw.hourly.temperature_2m[first + i],
    code: raw.hourly.weather_code[first + i],
    isDay: raw.hourly.is_day[first + i] === 1,
    precipitationProbability: raw.hourly.precipitation_probability[first + i] ?? 0,
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
    uvIndexMax: d.uv_index_max[i] ?? 0,
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
      visibilityM: c.visibility,
    },
    hourly,
    daily,
    airQuality: typeof aq?.us_aqi === "number" ? { usAqi: aq.us_aqi, pm25: aq.pm2_5 ?? null, pm10: aq.pm10 ?? null } : null,
  };
}

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`open-meteo error: ${res.status}`);
  return res.json() as Promise<T>;
}

/** 詳しい天気。大気質が読めなくても、天気だけは返す */
export async function getForecast(place: Place): Promise<Forecast> {
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
      "visibility",
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
      "uv_index_max",
    ].join(","),
    timezone: "auto",
    forecast_days: "10",
    wind_speed_unit: "ms",
  }).toString();
  const air = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  air.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: "us_aqi,pm2_5,pm10",
    timezone: "auto",
  }).toString();

  const [raw, aq] = await Promise.all([
    getJson<RawForecast>(forecast),
    getJson<RawAirQuality>(air).catch(() => null),
  ]);
  const value = shapeForecast(place, raw, aq);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}
