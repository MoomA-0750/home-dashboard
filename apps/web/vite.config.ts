import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 開発時にAPIをプロキシする先。8787でDocker版が動いているホストでは別ポートの開発サーバーに向ける
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2018",
    outDir: "dist",
    // 音声アシスタントのVRMアバター（three.js を含む。約770KB）は React.lazy で別チャンクにしてあり、
    // アバターを出すときにだけ読み込むので、この大きさは許容する
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": apiTarget,
      "/ws": {
        target: apiTarget.replace(/^http/, "ws"),
        ws: true,
      },
    },
  },
});
