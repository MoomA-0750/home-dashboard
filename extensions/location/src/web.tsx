import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { locationWidget } from "./widget";
import { LocationScreen } from "./LocationScreen";
import "./web.css";

// 画面側。React と @home-dashboard/widget-sdk は本体のものを使う（ビルドの道具が同梱しないようにつなぐ）
export default defineWebExtension({
  widgets: [locationWidget],
  screens: [{ id: "location", label: { ja: "位置", en: "Location" }, icon: "location", order: 35, Component: LocationScreen }],
});
