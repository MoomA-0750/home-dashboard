/**
 * アバターの動きをコマ送りで撮る。
 *
 *   node tools/avatar-shots/capture.mjs <出力先> <キャラクター名> <手順...>
 *
 * 手順は「区分:名前:枚数:1枚あたりのミリ秒」。区分は state / view / motion / expression / button / wait。
 *
 *   node tools/avatar-shots/capture.mjs /tmp/shots プラム motion:proud:10:100 view:横:1:400 wait::3:1000
 *
 * 環境変数は preview.mjs を参照（DASHBOARD_URL / CHROME_PATH）。
 */
import { GROUPS, launch, openPreview } from "./preview.mjs";

const [, , dir, personaName, ...steps] = process.argv;
if (!dir || !personaName || steps.length === 0) {
  console.error("usage: node tools/avatar-shots/capture.mjs <出力先> <キャラクター名> <区分:名前:枚数:ミリ秒>...");
  process.exit(1);
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
await openPreview(page, personaName);

const stage = page.locator(".persona-preview__stage");
let frame = 0;
for (const step of steps) {
  const [group, name, count, intervalMs] = step.split(":");
  if (group === "button") {
    await page.getByRole("button", { name, exact: true }).click();
  } else if (group !== "wait") {
    await page.locator(".persona-preview__buttons").nth(GROUPS[group]).getByRole("button", { name, exact: true }).click();
  }
  for (let i = 0; i < Number(count); i++) {
    await page.clock.runFor(Number(intervalMs));
    await stage.screenshot({ path: `${dir}/f${String(frame++).padStart(3, "0")}.png` });
  }
}
console.log("frames", frame);
await browser.close();
