import { defineWebExtension } from "@home-dashboard/widget-sdk";
import weatherWidget from "./widget";
import { WeatherScreen } from "./WeatherScreen";
import { HeaderWeather } from "./HeaderWeather";

export default defineWebExtension({
  widgets: [weatherWidget],
  screens: [{ id: "weather", label: { ja: "天気", en: "Weather" }, icon: "weather-partly-cloudy-day", order: 30, Component: WeatherScreen }],
  // ホームの時刻の横の今の天気（本体の口。本体は入っているもののうち最初の1つを出す）
  provides: { "header-weather": { Component: HeaderWeather } },
});
