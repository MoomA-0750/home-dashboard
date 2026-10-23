import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { MediaScreen } from "./MediaScreen";
import { mediaWidget } from "./MediaWidget";

// Media 画面とホームのメディアのウィジェット。音楽アプリは、機能の口「music」に入っている拡張機能から右上で選ぶ
export default defineWebExtension({
  widgets: [mediaWidget],
  screens: [{ id: "media", label: { ja: "メディア", en: "Media" }, icon: "play", order: 10, Component: MediaScreen }],
});
