import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// .env の読み込みはこのモジュールの先頭で行う。
// ESモジュールのimportは呼び出し側の本体より先に評価されるため、index.ts側で読み込むと
// この config が先に process.env を参照してしまい .env が反映されない
// （Docker運用では env_file で実環境変数として渡るため露呈しなかった）。
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? new URL("../../../data", import.meta.url).pathname,
  configDir: process.env.CONFIG_DIR ?? new URL("../../../config", import.meta.url).pathname,
  webDistDir: process.env.WEB_DIST_DIR ?? new URL("../../web/dist", import.meta.url).pathname,

  weather: {
    lat: Number(process.env.WEATHER_LAT ?? 35.6895),
    lon: Number(process.env.WEATHER_LON ?? 139.6917),
    name: process.env.WEATHER_LOCATION_NAME ?? "Tokyo",
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? "http://localhost:8787/auth/spotify/callback",
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN ?? "",
  },

  homeAssistant: {
    baseUrl: (process.env.HOMEASSISTANT_URL ?? "").replace(/\/$/, ""),
    token: process.env.HOMEASSISTANT_TOKEN ?? "",
    /**
     * 玄関の物理錠の「解錠」を許可するか。
     * このダッシュボードはLAN上に認証なしで公開される前提なので、既定では解錠できない
     * （状態表示と施錠のみ）。有効にするとLANに入れる誰でも解錠できてしまう点に注意。
     */
    allowUnlock: process.env.HOMEASSISTANT_ALLOW_UNLOCK === "true",
  },
};
