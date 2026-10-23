import { defineServerExtension, HttpError } from "@home-dashboard/extension-sdk";
import { messages } from "./messages";
import { spotifyProvider } from "./provider";
import { authorizeUrl, exchangeCode, resetSpotifyTokens, spotifySettings, takeAuthorizeState } from "./spotify";
import type { MusicProvider } from "@home-dashboard/ext-media/types";

/**
 * Spotify の拡張機能のサーバー側。
 * - Media の機能の口「music」に入る。Spotify の Web API を MusicProvider の形に直して渡す
 *   （Media 画面・メディアのウィジェット・音声アシスタントの音楽の操作は Media の拡張機能が持つ）
 * - /auth/login・/auth/callback … 認可（/auth/spotify/... でも受ける。Spotify の Redirect URI はこちら）
 */

const provider: MusicProvider = spotifyProvider;

export default defineServerExtension({
  register(api) {
    spotifySettings.current = api.settings;
    resetSpotifyTokens();
    api.onSettingsChange(resetSpotifyTokens);

    api.provide("music", provider);

    // 認可コードフロー。初めての設定と、権限（scope）を足したときの認可し直しに使う。
    // Spotify は Redirect URI に https か 127.0.0.1 しか許さないので、別の機械からはポートを転送して開く（README）
    // 家で1つの連携を差し替えるので、管理者だけ。戻り先は、同じ人が始めた認可（state）のときだけ受け取る
    api.route(
      "GET",
      "/auth/login",
      ({ locale, account }) => {
        if (!api.settings.clientId) throw new HttpError(409, messages.t(locale, "needClient"));
        return api.redirect(authorizeUrl(account!.id));
      },
      { adminOnly: true },
    );
    api.route(
      "GET",
      "/auth/callback",
      async ({ query, locale, account }) => {
        if (!query.code) return api.text("missing code", 400);
        if (!takeAuthorizeState(query.state, account!.id)) return api.text(messages.t(locale, "badState"), 400);
        // 届いたトークンは接続設定に保存して、すぐ使い始める（.env へ書き写したり再起動したりしなくてよい）
        await api.updateSettings({ refreshToken: await exchangeCode(query.code) });
        return api.text(messages.t(locale, "authorized"));
      },
      { adminOnly: true },
    );
  },
});
