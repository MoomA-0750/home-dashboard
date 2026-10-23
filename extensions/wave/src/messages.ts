import { defineServerMessages, HttpError, type MessageParams } from "@home-dashboard/extension-sdk";
import type { LocalizedReason } from "@home-dashboard/ext-media/types";

/** 画面に返す文（エラーの理由・プレイリストやおすすめの名前・接続の確かめの結果） */
export const messages = defineServerMessages({
  ja: {
    token_required: "wave のトークンが通りません（接続設定の「wave」のトークンを確かめてください）",
    login_required: "wave にログインが渡されていません（家の端末の「端末の連携」で「wave API」に「ログインを渡す」）",
    not_sent: "鳴っている wave の端末がありません（スマホや PC の wave を開いてください）",
    no_device: "鳴らす wave の端末が見つかりません（スマホや PC の wave を開いてください）",
    unsupported: "wave ではこの操作はできません",
    not_found: "見つかりません",
    notConfigured: "wave が未接続です。設定画面の「接続設定 → wave」で URL とトークンを入れてください",
    unreachable: "wave に届きません（{url}）",
    httpError: "wave が {status} を返しました（{name}）",
    queueMoved: "キューが変わったので飛べませんでした。もう一度選んでください",
    liked: "高く評価した曲",
    suggestionNote: "YouTube Music のおすすめ",
    notJoined: "つながりましたが、wave-api がまだ家に加わっていません",
    noLogin: "つながりました（ログインが無いので、プレイリストとおすすめは読めません）",
    connected: "つながりました",
  },
  en: {
    token_required: "wave didn't accept the token (check the token in the \"wave\" connection settings)",
    login_required: "wave hasn't been given a login (on a home device, open Device linking and choose \"Share login\" for \"wave API\")",
    not_sent: "No wave device is playing (open wave on your phone or PC)",
    no_device: "Couldn't find a wave device to play on (open wave on your phone or PC)",
    unsupported: "wave can't do this",
    not_found: "Not found",
    notConfigured: "wave isn't connected. Enter the URL and token in Settings under Connection settings → wave",
    unreachable: "Can't reach wave ({url})",
    httpError: "wave returned {status} ({name})",
    queueMoved: "The queue changed, so it couldn't skip. Please choose again",
    liked: "Liked songs",
    suggestionNote: "YouTube Music suggestions",
    notJoined: "Connected, but wave-api hasn't joined the home yet",
    noLogin: "Connected (no login, so playlists and suggestions can't be read)",
    connected: "Connected",
  },
});

export type MessageKey = Parameters<typeof messages.t>[1];

/**
 * 言語ごとの理由を付けた HttpError。message は日本語（音声アシスタント向け）で、
 * Media の道は localized から画面の言語の文を選ぶ
 */
export function localizedError(statusCode: number, key: MessageKey, params?: MessageParams): HttpError {
  const localized: LocalizedReason = { ja: messages.t("ja", key, params), en: messages.t("en", key, params) };
  return Object.assign(new HttpError(statusCode, localized.ja), { localized });
}
