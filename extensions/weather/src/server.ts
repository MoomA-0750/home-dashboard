import { defineServerExtension } from "@home-dashboard/extension-sdk";
import { getForecast } from "./forecast";
import { messages, PlaceStore, parsePlace, placeName, searchPlaces } from "./places";

/**
 * 天気の拡張機能のサーバー側。Open-Meteo（https://open-meteo.com、キー不要）から引く。
 * - /current … ホームの時刻の横の天気・天気ウィジェット・音声アシスタントの get_weather
 * - /forecast?place=<id> … Weather 画面の詳しい天気（./forecast）。place を省くと家の地点
 * - /places … Weather 画面で選べる場所（家の地点と、足した場所。./places）。/places/search・/places/name で地名を探す
 */

interface Place {
  name: string;
  lat: number;
  lon: number;
}

interface OpenMeteoResponse {
  current: { temperature_2m: number; weather_code: number; is_day: number };
  hourly: { time: string[]; precipitation_probability: number[] };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

// WMO weather interpretation codes (open-meteo.com) をざっくり日本語＋絵文字にマッピング
const WEATHER_CODE_MAP: Record<number, { condition: string; icon: string }> = {
  0: { condition: "快晴", icon: "☀️" },
  1: { condition: "晴れ", icon: "🌤️" },
  2: { condition: "薄曇り", icon: "⛅" },
  3: { condition: "曇り", icon: "☁️" },
  45: { condition: "霧", icon: "🌫️" },
  48: { condition: "霧氷", icon: "🌫️" },
  51: { condition: "小雨", icon: "🌦️" },
  53: { condition: "小雨", icon: "🌦️" },
  55: { condition: "雨", icon: "🌧️" },
  61: { condition: "雨", icon: "🌧️" },
  63: { condition: "雨", icon: "🌧️" },
  65: { condition: "大雨", icon: "🌧️" },
  71: { condition: "雪", icon: "🌨️" },
  73: { condition: "雪", icon: "🌨️" },
  75: { condition: "大雪", icon: "❄️" },
  80: { condition: "にわか雨", icon: "🌦️" },
  81: { condition: "にわか雨", icon: "🌦️" },
  82: { condition: "激しいにわか雨", icon: "⛈️" },
  95: { condition: "雷雨", icon: "⛈️" },
  96: { condition: "雷雨(雹)", icon: "⛈️" },
  99: { condition: "雷雨(雹)", icon: "⛈️" },
};

function describeWeatherCode(code: number) {
  return WEATHER_CODE_MAP[code] ?? { condition: "不明", icon: "❔" };
}

async function fetchOpenMeteo(place: Place): Promise<OpenMeteoResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.lat));
  url.searchParams.set("longitude", String(place.lon));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("hourly", "precipitation_probability");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  // 今日・明日・明後日（音声アシスタントの「明日の天気は？」に答えるため）
  url.searchParams.set("forecast_days", "3");

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`open-meteo error: ${res.status}`);
  return res.json() as Promise<OpenMeteoResponse>;
}

export async function getWeather(place: Place) {
  const data = await fetchOpenMeteo(place);
  const { condition, icon } = describeWeatherCode(data.current.weather_code);

  const now = Date.now();
  const startIndex = data.hourly.time.findIndex((t) => new Date(t).getTime() >= now);
  const from = startIndex === -1 ? 0 : startIndex;
  const hourly = data.hourly.time.slice(from, from + 12).map((time, i) => ({
    time,
    precipitationProbability: data.hourly.precipitation_probability[from + i] ?? 0,
  }));

  const daily = data.daily.time.map((date, i) => ({
    date,
    condition: describeWeatherCode(data.daily.weather_code[i]).condition,
    maxTemperatureC: data.daily.temperature_2m_max[i],
    minTemperatureC: data.daily.temperature_2m_min[i],
    precipitationProbabilityMax: data.daily.precipitation_probability_max[i],
  }));

  return {
    location: { name: place.name, lat: place.lat, lon: place.lon },
    current: {
      temperatureC: data.current.temperature_2m,
      condition,
      icon,
      // WMO weather code。フロント側で天気に応じたアイコンを選ぶのに使う
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
    },
    hourly,
    daily,
  };
}

export default defineServerExtension({
  register(api) {
    const place = (): Place => ({
      name: String(api.settings.name),
      lat: Number(api.settings.lat),
      lon: Number(api.settings.lon),
    });

    api.route("GET", "/current", () => getWeather(place()));
    const places = new PlaceStore(api.dataDir);
    const HOME = "home";

    // Weather 画面の詳しい天気（今・1時間ごと・10日間・大気質）。場所は家の地点か、足した場所
    api.route("GET", "/forecast", async ({ query, locale }) => {
      if (!query.place || query.place === HOME) return getForecast(place());
      const saved = (await places.list()).find((p) => p.id === query.place);
      if (!saved) throw api.error(404, messages.t(locale, "notFound"));
      return getForecast(saved);
    });

    api.route("GET", "/places", async () => ({
      places: [{ id: HOME, home: true, ...place() }, ...(await places.list()).map((p) => ({ ...p, home: false }))],
    }));
    api.route("POST", "/places", async ({ body, locale }) => ({ place: await places.add(body, locale) }));
    api.route("DELETE", "/places/:id", async ({ params, locale }) => {
      if (params.id === HOME) throw api.error(400, messages.t(locale, "homeFixed"));
      await places.remove(params.id, locale);
      return { ok: true };
    });
    api.route("GET", "/places/search", async ({ query, locale }) => ({ places: await searchPlaces(query.q ?? "", locale) }));
    // 現在地の地名（画面が位置情報で得た緯度・経度から）
    api.route("GET", "/places/name", async ({ query, locale }) => {
      const { lat, lon } = parsePlace({ name: "-", lat: query.lat, lon: query.lon }, locale);
      return { name: await placeName(lat, lon, locale) };
    });

    api.tool({
      name: "get_weather",
      description:
        "家の地点の天気。現在の気温と天気、今後12時間の降水確率（1時間ごと）、今日・明日・明後日の天気・最高/最低気温・最大降水確率を返す。",
      readOnly: true,
      handler: () => getWeather(place()),
    });
  },
});
