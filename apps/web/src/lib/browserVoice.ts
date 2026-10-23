/**
 * 音声アシスタントとのやり取りで使う、このタブの名札。
 *
 * 画面（Chat）からは文字で話しかけ、返答も文字だけで受け取る（声は鳴らさない）。
 */

/**
 * このタブのID。WebSocket につなぐときに名乗り、返答の声をこのタブにだけ届けてもらうのに使う。
 * crypto.randomUUID は HTTPS でないと使えないので、Math.random で作る（見分けられれば十分）
 */
export const CLIENT_ID = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join("");

/** 返答の声をどこで鳴らすか。browser: この画面 / host: ダッシュボードのホストのスピーカー / none: 鳴らさず文字だけ */
export type ReplySpeech = "browser" | "host" | "none";
