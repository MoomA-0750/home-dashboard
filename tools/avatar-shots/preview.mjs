/**
 * 「動きを確認」画面をブラウザで開く。撮影の道具（capture.mjs / candidates.mjs）が共通で使う。
 *
 * 環境変数:
 *   DASHBOARD_URL  画面のURL（既定 http://localhost:5173/）
 *   CHROME_PATH    ブラウザの実行ファイル。未指定ならインストール済みの Google Chrome を使う
 */
import { chromium } from "playwright-core";

const url = process.env.DASHBOARD_URL ?? "http://localhost:5173/";

/** 「動きを確認」の中のボタンの並び順 */
export const GROUPS = { state: 0, view: 1, expression: 2, motion: 3 };

export function launch() {
  return chromium.launch({
    executablePath: process.env.CHROME_PATH,
    channel: process.env.CHROME_PATH ? undefined : "chrome",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
}

/**
 * 画面を開き、キャラクターの「動きを確認」を出す。
 *
 * 描画が遅い環境（GPUの無いサーバーではソフトウェア描画で数fps）だと、スクリーンショット1枚に数秒かかり、
 * 身振りの「保持」が終わったあとの姿しか撮れない。そこでブラウザの時計を止め、こちらで時間を進めては撮る
 */
export async function openPreview(page, name) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00") });
  await page.goto(url);
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01"));
  for (let i = 0; i < 20; i++) {
    await page.clock.runFor(100);
    await page.waitForTimeout(100);
  }
  await page.click('button[aria-label="設定"]');
  await page.locator(".persona-manager__item", { hasText: name }).locator("text=動きを確認").click();
  // モデルは数十MBあるので、読み込めるまで待つ
  for (let i = 0; i < 300; i++) {
    if (await page.locator(".persona-preview__rig").count()) break;
    await page.clock.runFor(50);
    await page.waitForTimeout(200);
  }
  await page.clock.runFor(2000);
}
