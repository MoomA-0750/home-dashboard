import { defineServerMessages, HttpError, type MessageParams } from "@home-dashboard/extension-sdk";
import type { LocalizedReason } from "@home-dashboard/ext-media/types";

/** 画面に返す文（エラーの理由・おすすめの見出し・認可の結果） */
export const messages = defineServerMessages({
  ja: {
    reauthorize: "Spotify で認可し直してください（/auth/spotify/login）: {detail}",
    refused: "Spotify が断りました: {detail}",
    noDevice: "再生中の Spotify の端末がありません。どこかで Spotify を開いてください",
    similarTo: "「{title}」に似た曲",
    topTitle: "最近よく聴く曲",
    topNote: "ここ4週間ほどでよく聴いた曲",
    recentTitle: "最近聴いた曲",
    needClient: "先に接続設定で Client ID と Client Secret を入れてください",
    authorized: "認可に成功しました。トークンを保存したので、このページは閉じてかまいません。",
    badState: "この認可は、この画面から始めたものではないか、期限が切れています。設定からもう一度始めてください。",
  },
  en: {
    reauthorize: "Authorize with Spotify again (/auth/spotify/login): {detail}",
    refused: "Spotify refused: {detail}",
    noDevice: "No Spotify device is playing. Open Spotify somewhere",
    similarTo: "Similar to \"{title}\"",
    topTitle: "Your top tracks lately",
    topNote: "Songs you've played most in about the last 4 weeks",
    recentTitle: "Recently played",
    needClient: "Enter the Client ID and Client Secret in the connection settings first",
    authorized: "Authorization succeeded. The token has been saved, so you can close this page.",
    badState: "This authorization wasn't started here or has expired. Start it again from the settings.",
  },
});

type Key = Parameters<typeof messages.t>[1];

/**
 * 言語ごとの理由を付けた HttpError。message は日本語（音声アシスタント向け）で、
 * Media の道は localized から画面の言語の文を選ぶ
 */
export function localizedError(statusCode: number, key: Key, params?: MessageParams): HttpError {
  const localized: LocalizedReason = { ja: messages.t("ja", key, params), en: messages.t("en", key, params) };
  return Object.assign(new HttpError(statusCode, localized.ja), { localized });
}
