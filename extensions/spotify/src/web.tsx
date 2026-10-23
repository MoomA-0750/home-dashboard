import { defineWebExtension } from "@home-dashboard/widget-sdk";

// Media の機能の口「music」（音楽アプリ）に入る。画面とウィジェットは Media の拡張機能が持ち、右上でこれを選ぶ（サーバー側は server.ts の api.provide）
export default defineWebExtension({ provides: { music: { name: "Spotify", order: 20 } } });
