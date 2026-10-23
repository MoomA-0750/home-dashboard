import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeForecast } from "./forecast";

const hours = Array.from({ length: 48 }, (_, i) => `2026-10-20T${String(i % 24).padStart(2, "0")}:00`).map((t, i) =>
  i < 24 ? t : t.replace("2026-10-20", "2026-10-21"),
);
const raw = {
  utc_offset_seconds: 32400,
  timezone: "Asia/Tokyo",
  current: {
    time: "2026-10-20T19:15",
    temperature_2m: 20.7,
    apparent_temperature: 23.2,
    relative_humidity_2m: 84,
    dew_point_2m: 17.9,
    weather_code: 1,
    is_day: 0,
    wind_speed_10m: 0.7,
    wind_direction_10m: 326,
    wind_gusts_10m: 5.3,
    pressure_msl: 1018.2,
    precipitation: 0,
    cloud_cover: 44,
    uv_index: 0,
    visibility: 32660,
  },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, i) => 15 + (i % 24) / 2),
    weather_code: hours.map(() => 3),
    is_day: hours.map((t) => (Number(t.slice(11, 13)) >= 6 && Number(t.slice(11, 13)) < 17 ? 1 : 0)),
    precipitation_probability: hours.map((_, i) => i),
  },
  daily: {
    time: ["2026-10-20", "2026-10-21"],
    weather_code: [51, 61],
    temperature_2m_max: [25, 28.1],
    temperature_2m_min: [16.4, 18.7],
    precipitation_probability_max: [31, 22],
    precipitation_sum: [0, 0.1],
    sunrise: ["2026-10-20T05:51", "2026-10-21T05:52"],
    sunset: ["2026-10-20T16:59", "2026-10-21T16:58"],
    uv_index_max: [4.85, 5.1],
  },
};

test("今の時刻を含む1時間から24時間分を出し、時刻に地点の UTC からのずれを付ける", () => {
  // 日本時間の 10/20 19:15
  const forecast = shapeForecast({ name: "東京", lat: 35.7, lon: 139.7 }, raw, { current: { us_aqi: 42, pm2_5: 8.1 } }, Date.parse("2026-10-20T10:15:00Z"));
  assert.equal(forecast.hourly.length, 24);
  assert.equal(forecast.hourly[0].time, "2026-10-20T19:00:00+09:00");
  assert.equal(forecast.hourly[0].precipitationProbability, 19);
  assert.equal(forecast.hourly[23].time, "2026-10-21T18:00:00+09:00");
  assert.equal(forecast.current.time, "2026-10-20T19:15:00+09:00");
  assert.equal(forecast.current.condition, "晴れ");
  assert.equal(forecast.daily[1].condition, "小雨");
  assert.equal(forecast.daily[0].sunset, "2026-10-20T16:59:00+09:00");
  assert.deepEqual(forecast.airQuality, { usAqi: 42, pm25: 8.1, pm10: null });
});

test("大気質が読めなければ null", () => {
  const forecast = shapeForecast({ name: "東京", lat: 35.7, lon: 139.7 }, raw, null, Date.parse("2026-10-20T10:15:00Z"));
  assert.equal(forecast.airQuality, null);
});
