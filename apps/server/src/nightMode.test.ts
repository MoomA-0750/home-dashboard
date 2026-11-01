import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
const root = await mkdtemp(join(tmpdir(), "night-"));
process.env.DATA_DIR = join(root, "data");
const night = await import("./nightMode.js");

test("自動なら、拡張機能の知らせが立っている間だけ夜にし、変わり目だけ知らせる", async () => {
  night.resetNightForTest();
  await night.loadNightSettings();
  const seen: boolean[] = [];
  night.onNightChange((state) => seen.push(state.active));
  assert.equal(night.nightState().active, false);

  night.setNightSignal("home-assistant", true, "照度が 5 lx 未満");
  night.setNightSignal("home-assistant", true, "照度が 5 lx 未満");
  assert.deepEqual(night.nightState().signals.map((s) => s.reason), ["照度が 5 lx 未満"]);
  night.setNightSignal("home-assistant", false);
  night.setNightSignal("home-assistant", false);
  assert.deepEqual(seen, [true, false]);
});

test("いつも夜・使わないは知らせに関わらず決まり、設定は残る", async () => {
  night.resetNightForTest();
  await night.loadNightSettings();
  night.setNightSignal("home-assistant", true, null);
  assert.equal((await night.setNightSettings({ mode: "off" })).active, false);
  assert.equal((await night.setNightSettings({ mode: "on", darkness: 0.9 })).active, true);
  night.setNightSignal("home-assistant", false);
  assert.equal(night.nightState().active, true);

  night.resetNightForTest();
  await night.loadNightSettings();
  assert.deepEqual([night.nightState().mode, night.nightState().darkness], ["on", 0.9]);
  await assert.rejects(night.setNightSettings({ mode: "dark" }), { statusCode: 400 });
  await assert.rejects(night.setNightSettings({ darkness: 1.2 }), { statusCode: 400 });
});
