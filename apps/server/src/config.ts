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
};
