import { test } from "node:test";
import assert from "node:assert/strict";
import type { StateReading } from "@home-dashboard/extension-sdk";
import { evaluateRules, migrateHomeAssistantRules, nextNight, normalizeRules, readingKey, withinHours } from "./nightRules.js";

const readings = (list: [string, string, number | boolean | null, string?][]) =>
  new Map<string, StateReading>(
    list.map(([source, id, value, unit]) => [
      readingKey(source, id),
      { id, name: id, kind: typeof value === "boolean" ? "onoff" : "number", value, unit: unit ?? null },
    ]),
  );

const at = (hh: number, mm = 0) => new Date(2026, 10, 2, hh, mm);

test("条件の形を確かめ、おかしなものは捨てる", () => {
  const rules = normalizeRules({
    match: "any",
    holdMinutes: 3.4,
    conditions: [
      { kind: "below", source: "home-assistant", id: "sensor.lux", value: 5 },
      { kind: "below", source: "home-assistant", id: "sensor.lux" },
      { kind: "off", source: "switchbot", id: "Living Light" },
      { kind: "off", source: "Bad Source", id: "x" },
      { kind: "time", from: "22:00", to: "06:00" },
      { kind: "time", from: "25:00", to: "06:00" },
    ],
  });
  assert.equal(rules.match, "any");
  assert.equal(rules.holdMinutes, 3);
  assert.deepEqual(rules.conditions.map((c) => c.kind), ["below", "off", "time"]);
  assert.deepEqual(normalizeRules(null), { match: "all", conditions: [], holdMinutes: 1 });
});

test("時間帯は日をまたいでもよい", () => {
  assert.equal(withinHours("22:00", "06:00", at(23, 30)), true);
  assert.equal(withinHours("22:00", "06:00", at(5, 59)), true);
  assert.equal(withinHours("22:00", "06:00", at(6, 0)), false);
  assert.equal(withinHours("08:00", "17:00", at(12)), true);
  assert.equal(withinHours("08:00", "17:00", at(18)), false);
});

test("すべて: 連携先の違う値を組み合わせてよく、読めない値は満たさない", () => {
  const rules = normalizeRules({
    conditions: [
      { kind: "below", source: "home-assistant", id: "sensor.lux", value: 5 },
      { kind: "off", source: "switchbot", id: "light-1" },
      { kind: "time", from: "21:00", to: "07:00" },
    ],
  });
  const dark = evaluateRules(rules, readings([["home-assistant", "sensor.lux", 2, "lx"], ["switchbot", "light-1", false]]), at(23));
  assert.equal(dark.met, true);
  assert.equal(dark.reason, "sensor.luxが 5 lx 未満・light-1が消えている・21:00〜07:00");
  assert.equal(evaluateRules(rules, readings([["home-assistant", "sensor.lux", 2], ["switchbot", "light-1", true]]), at(23)).met, false);
  assert.equal(evaluateRules(rules, readings([["home-assistant", "sensor.lux", null], ["switchbot", "light-1", false]]), at(23)).met, false);
  // 差し出している拡張機能が止まっている（値が無い）
  assert.equal(evaluateRules(rules, readings([["home-assistant", "sensor.lux", 2]]), at(23)).met, false);
  assert.equal(evaluateRules({ ...rules, conditions: [] }, readings([]), at(23)).met, false);
});

test("どれか: ひとつ満たせばよい", () => {
  const rules = normalizeRules({
    match: "any",
    conditions: [
      { kind: "off", source: "home-assistant", id: "light.living" },
      { kind: "off", source: "home-assistant", id: "light.bedroom" },
    ],
  });
  const result = evaluateRules(
    rules,
    readings([["home-assistant", "light.living", true], ["home-assistant", "light.bedroom", false]]),
    at(23),
  );
  assert.equal(result.met, true);
  assert.equal(result.reason, "light.bedroomが消えている");
});

test("満たしてから hold 分続いたら夜、満たさなくなったらすぐ戻す", () => {
  const met = { met: true, results: [], reason: "x" };
  const unmet = { met: false, results: [], reason: null };
  let s = nextNight(met, null, 2, 0);
  assert.deepEqual(s, { active: false, metSince: 0 });
  s = nextNight(met, s.metSince, 2, 119_000);
  assert.equal(s.active, false);
  s = nextNight(met, s.metSince, 2, 120_000);
  assert.equal(s.active, true);
  assert.deepEqual(nextNight(unmet, s.metSince, 2, 121_000), { active: false, metSince: null });
  assert.equal(nextNight(met, null, 0, 5).active, true);
});

test("Home Assistant の拡張機能が持っていた条件は、入れてあったものだけ引き継ぐ", () => {
  const old = {
    enabled: true,
    match: "all",
    holdMinutes: 2,
    conditions: [
      { kind: "below", entityId: "sensor.lux", value: 10 },
      { kind: "off", entityId: "light.living" },
      { kind: "time", from: "22:00", to: "06:00" },
    ],
  };
  assert.deepEqual(migrateHomeAssistantRules(old), {
    match: "all",
    holdMinutes: 2,
    conditions: [
      { kind: "below", source: "home-assistant", id: "sensor.lux", value: 10 },
      { kind: "off", source: "home-assistant", id: "light.living" },
      { kind: "time", from: "22:00", to: "06:00" },
    ],
  });
  assert.deepEqual(migrateHomeAssistantRules({ ...old, enabled: false }).conditions, []);
});
