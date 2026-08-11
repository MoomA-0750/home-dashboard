import { widgetRegistry } from "@home-dashboard/widget-sdk";
import clock from "@home-dashboard/widget-clock";
import weather from "@home-dashboard/widget-weather";
import spotifyMedia from "@home-dashboard/widget-spotify-media";
import homelabStatus from "@home-dashboard/widget-homelab-status";
import haControls from "@home-dashboard/widget-ha-controls";
import haClimate from "@home-dashboard/widget-ha-climate";

/**
 * 利用可能な全ウィジェットをここで登録する。
 * 新しいウィジェットパッケージを追加したら、この1行を足すだけでキャンバスに追加できるようになる。
 * (packages/widgets/<name> を参照。詳細は README のウィジェット開発ガイドを参照)
 */
widgetRegistry.register(clock);
widgetRegistry.register(weather);
widgetRegistry.register(spotifyMedia);
widgetRegistry.register(homelabStatus);
widgetRegistry.register(haControls);
widgetRegistry.register(haClimate);

export { widgetRegistry };
