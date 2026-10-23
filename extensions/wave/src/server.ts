import { defineServerExtension } from "@home-dashboard/extension-sdk";
import { messages } from "./messages";
import { waveFetch, waveProvider, waveSettings } from "./wave";

/**
 * wave の拡張機能のサーバー側。
 * - Media の機能の口「music」に入る。wave-api を MusicProvider の形に直して渡す
 *   （Media 画面・メディアのウィジェット・音声アシスタントの音楽の操作は Media の拡張機能が持つ）
 * - /test … 設定画面の「接続を確かめる」
 */

export default defineServerExtension({
  register(api) {
    waveSettings.current = api.settings;

    api.provide("music", waveProvider);

    api.route(
      "POST",
      "/test",
      async ({ locale }) => {
        try {
          const playback = await waveFetch<{ joined: boolean; loggedIn: boolean }>("/v1/playback");
          if (!playback.joined) return { ok: false, message: messages.t(locale, "notJoined") };
          if (!playback.loggedIn)
            return { ok: true, message: messages.t(locale, "noLogin") };
          return { ok: true, message: messages.t(locale, "connected") };
        } catch (err) {
          const localized = (err as { localized?: Record<string, string> } | null)?.localized;
          return { ok: false, message: localized?.[locale] ?? (err instanceof Error ? err.message : String(err)) };
        }
      },
      { adminOnly: true },
    );
  },
});
