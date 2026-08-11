import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

interface OpenMeteoResponse {
  current: { temperature_2m: number; weather_code: number; is_day: number };
  hourly: { time: string[]; precipitation_probability: number[] };
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

async function fetchOpenMeteo(): Promise<OpenMeteoResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(config.weather.lat));
  url.searchParams.set("longitude", String(config.weather.lon));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("hourly", "precipitation_probability");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "2");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`open-meteo error: ${res.status}`);
  return res.json() as Promise<OpenMeteoResponse>;
}

export async function registerWeatherRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/weather", async () => {
    const data = await fetchOpenMeteo();
    const { condition, icon } = describeWeatherCode(data.current.weather_code);

    const now = Date.now();
    const startIndex = data.hourly.time.findIndex((t) => new Date(t).getTime() >= now);
    const from = startIndex === -1 ? 0 : startIndex;
    const hourly = data.hourly.time.slice(from, from + 12).map((time, i) => ({
      time,
      precipitationProbability: data.hourly.precipitation_probability[from + i] ?? 0,
    }));

    return {
      location: { name: config.weather.name, lat: config.weather.lat, lon: config.weather.lon },
      current: {
        temperatureC: data.current.temperature_2m,
        condition,
        icon,
        isDay: data.current.is_day === 1,
      },
      hourly,
    };
  });
}
