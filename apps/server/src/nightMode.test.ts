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

test("条件は、家の状態を差し出す拡張機能の値で確かめ、満たしたら夜にする", async () => {
  night.resetNightForTest();
  await night.loadNightSettings();
  await night.setNightSettings({ mode: "auto" });
  let lux = 3;
  night.startNightWatch(() => [
    {
      extensionId: "other-hub",
      name: "Other Hub",
      source: {
        list: async () => [{ id: "lux", name: "照度", kind: "number", value: lux, unit: "lx" }],
        read: async (ids) => ids.map((id) => ({ id, name: "照度", kind: "number" as const, value: lux, unit: "lx" })),
      },
    },
  ]);
  const state = await night.setNightSettings({
    rules: { match: "all", holdMinutes: 0, conditions: [{ kind: "below", source: "other-hub", id: "lux", value: 10 }] },
  });
  assert.equal(state.active, true);
  assert.equal(state.evaluation?.reason, "照度が 10 lx 未満");
  assert.deepEqual((await night.listStateReadings()).map((s) => [s.source, s.readings.length]), [["other-hub", 1]]);

  lux = 200;
  await night.checkConditions();
  assert.equal(night.nightState().active, false);
  night.resetNightForTest();
});
