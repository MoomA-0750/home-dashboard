import { defineWebExtension, type ExtensionSettingsPanelProps } from "@home-dashboard/widget-sdk";
import controlsWidget from "./controls-widget";
import { HomeControlScreen } from "./HomeControlScreen";
import { SensorSettings } from "./SensorSettings";
import "./web.css";

// 設定画面で接続設定の下に出す欄: 計測に使うセンサー（夜の表示の条件は、本体の設定の「夜の表示」で決める）
function SettingsPanel(props: ExtensionSettingsPanelProps) {
  return <SensorSettings {...props} />;
}

export default defineWebExtension({
  widgets: [controlsWidget],
  SettingsPanel,
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
