import { defineWebExtension } from "@home-dashboard/widget-sdk";
import weatherWidget from "./widget";
import { WeatherScreen } from "./WeatherScreen";

export default defineWebExtension({
  widgets: [weatherWidget],
  screens: [{ id: "weather", label: { ja: "天気", en: "Weather" }, icon: "weather-partly-cloudy-day", order: 30, Component: WeatherScreen }],
});
