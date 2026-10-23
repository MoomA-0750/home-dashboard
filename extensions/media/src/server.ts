import { defineServerExtension } from "@home-dashboard/extension-sdk";
import { registerMediaRoutes } from "./routes";
import type { MusicProvider } from "./types";
import { names, nowPlaying, pickProvider } from "./voice";

/**
 * Media の拡張機能のサーバー側。機能の口「music」（音楽アプリ）を持ち、入っている音楽アプリ（wave・Spotify など）を束ねる。
 * - /providers/<音楽アプリの id>/* … Media 画面とメディアのウィジェット（./routes）
 * - 音声アシスタントの get_now_playing・control_music（音楽アプリをまとめて扱う。./voice）
 */

const VOICE_ACTIONS = ["play", "pause", "next", "previous"] as const;

export default defineServerExtension({
  register(api) {
    const providers = () => api.providers<MusicProvider>("music");

    registerMediaRoutes(api);

    api.tool({
      name: "get_now_playing",
      description: async () =>
        `音楽アプリで再生中の曲（曲名・アーティスト・再生中か・鳴っている端末）を返す。app を省くと入っている音楽アプリすべて。音楽アプリ: ${names(providers())}`,
      inputSchema: (z) => ({ app: z.string().optional().describe("音楽アプリの名前（省くとすべて）") }),
      readOnly: true,
      handler: ({ app }) => nowPlaying(providers(), app),
    });
    api.tool({
      name: "control_music",
      description: async () =>
        `音楽アプリの再生を操作する（再生・一時停止・次の曲・前の曲）。app を省くと、いま鳴っている音楽アプリを操作する。音楽アプリ: ${names(providers())}`,
      inputSchema: (z) => ({
        action: z.enum(VOICE_ACTIONS),
        app: z.string().optional().describe("音楽アプリの名前（省くと、いま鳴っているもの）"),
      }),
      risk: "low",
      describe: ({ action, app }) =>
        `${app ? `${app}で` : ""}音楽を${{ play: "再生する", pause: "止める", next: "次の曲にする", previous: "前の曲にする" }[action]}`,
      handler: async ({ action, app }) => {
        const provider = await pickProvider(providers(), app);
        await provider.implementation.control(action);
        return { ok: true, app: provider.name };
      },
    });
  },
});
