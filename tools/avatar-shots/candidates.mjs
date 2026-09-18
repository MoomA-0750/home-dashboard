/**
 * ポーズの候補を並べて描き比べる。
 *
 * 角度を手で書いて画面を開き直す、を繰り返すと時間がかかるので、候補をまとめて当てて撮る。
 * 身振りのデータ（apps/web/src/avatar/motions.ts）を開発サーバー上で一時的に差し替えるだけなので、
 * ファイルは書き換わらない（採用した数値だけ手で motions.ts に書く）。
 *
 *   node tools/avatar-shots/candidates.mjs <出力先> <キャラクター名> <候補のJSON> [見る向き,...]
 *
 * 候補のJSONは配列で、1件が { label, target, bones } :
 *   label  ログに出す名前
 *   target 差し替える身振りの名前（例 "proud"）
 *   bones  骨の名前 → [x, y, z]（度）
 *
 *   [{"label":"ねじり60","target":"proud","bones":{"leftUpperArm":[60,5,-50],"leftLowerArm":[0,-110,0]}}]
 *
 * 環境変数は preview.mjs を参照（DASHBOARD_URL / CHROME_PATH）。
 */
import { readFileSync } from "node:fs";
import { GROUPS, launch, openPreview } from "./preview.mjs";

const [, , dir, personaName, candidatesFile, views = "正面"] = process.argv;
if (!dir || !personaName || !candidatesFile) {
  console.error("usage: node tools/avatar-shots/candidates.mjs <出力先> <キャラクター名> <候補のJSON> [見る向き,...]");
  process.exit(1);
}
const candidates = JSON.parse(readFileSync(candidatesFile, "utf-8"));

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
await openPreview(page, personaName);

const viewButtons = page.locator(".persona-preview__buttons").nth(GROUPS.view);
const motionButtons = page.locator(".persona-preview__buttons").nth(GROUPS.motion);
const stage = page.locator(".persona-preview__stage");

for (const [index, candidate] of candidates.entries()) {
  await page.evaluate(async (c) => {
    const { MOTIONS, REST_POSE } = await import("/src/avatar/motions.ts");
    // 撮る前に戻されないよう、保持の時間を長くしておく
    MOTIONS[c.target] = { ...MOTIONS[c.target], bones: { ...REST_POSE.bones, ...c.bones }, holdS: 30 };
  }, candidate);
  // 一度別の身振りにしてから戻すことで、差し替えた数値で身振りをやり直させる
  await motionButtons.getByRole("button", { name: "relaxed", exact: true }).click();
  await page.clock.runFor(600);
  await motionButtons.getByRole("button", { name: candidate.target, exact: true }).click();
  await page.clock.runFor(1500);
  for (const [view, name] of views.split(",").entries()) {
    await viewButtons.getByRole("button", { name, exact: true }).click();
    await page.clock.runFor(200);
    await stage.screenshot({ path: `${dir}/c${String(index).padStart(2, "0")}-${view}.png` });
  }
  console.log(index, candidate.label);
}
await browser.close();
