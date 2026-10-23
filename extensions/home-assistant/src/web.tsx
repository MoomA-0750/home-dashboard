import { defineWebExtension } from "@home-dashboard/widget-sdk";
import controlsWidget from "./controls-widget";
import { HomeControlScreen } from "./HomeControlScreen";
import { SensorSettings } from "./SensorSettings";
import "./web.css";

export default defineWebExtension({
  widgets: [controlsWidget],
  SettingsPanel: SensorSettings,
  screens: [
    {
      id: "home-control",
      label: { ja: "ホームコントロール", en: "Home Control" },
      icon: "lightbulb",
      order: 20,
      Component: HomeControlScreen,
    },
  ],
});
