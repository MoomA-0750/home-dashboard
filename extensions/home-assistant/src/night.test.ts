import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRules, nextNight, normalizeRules, withinHours, type EntityState } from "./night";

const states = (list: [string, string, string?][]) =>
  new Map<string, EntityState>(
    list.map(([entityId, state, unit]) => [entityId, { entityId, name: entityId, state, unit: unit ?? null }]),
  );

const at = (hh: number, mm = 0) => new Date(2026, 10, 2, hh, mm);

test("条件の形を確かめ、おかしなものは捨てる", () => {
  const rules = normalizeRules({
    enabled: true,
    match: "any",
    holdMinutes: 3.4,
    conditions: [
      { kind: "below", entityId: "sensor.lux", value: 5 },
      { kind: "below", entityId: "sensor.lux" },
      { kind: "off", entityId: "light.living" },
      { kind: "off", entityId: "rm -rf" },
      { kind: "time", from: "22:00", to: "06:00" },
      { kind: "time", from: "25:00", to: "06:00" },
    ],
  });
  assert.equal(rules.match, "any");
  assert.equal(rules.holdMinutes, 3);
  assert.deepEqual(rules.conditions.map((c) => c.kind), ["below", "off", "time"]);
  assert.deepEqual(normalizeRules(null), { enabled: false, match: "all", conditions: [], holdMinutes: 1 });
});

test("時間帯は日をまたいでもよい", () => {
  assert.equal(withinHours("22:00", "06:00", at(23, 30)), true);
  assert.equal(withinHours("22:00", "06:00", at(5, 59)), true);
  assert.equal(withinHours("22:00", "06:00", at(6, 0)), false);
  assert.equal(withinHours("08:00", "17:00", at(12)), true);
  assert.equal(withinHours("08:00", "17:00", at(18)), false);
});

test("すべて: 照度が低く、電気が消えていて、夜の時間帯なら満たす。読めないセンサーは満たさない", () => {
  const rules = normalizeRules({
    enabled: true,
    conditions: [
      { kind: "below", entityId: "sensor.lux", value: 5 },
      { kind: "off", entityId: "light.living" },
      { kind: "time", from: "21:00", to: "07:00" },
    ],
  });
  const dark = evaluateRules(rules, states([["sensor.lux", "2", "lx"], ["light.living", "off"]]), at(23));
  assert.equal(dark.met, true);
  assert.match(dark.reason ?? "", /sensor.luxが 5 lx 未満・light.livingが消えている・21:00〜07:00/);
  assert.equal(evaluateRules(rules, states([["sensor.lux", "2", "lx"], ["light.living", "on"]]), at(23)).met, false);
  assert.equal(evaluateRules(rules, states([["sensor.lux", "unavailable", "lx"], ["light.living", "off"]]), at(23)).met, false);
  assert.equal(evaluateRules(rules, states([["sensor.lux", "2", "lx"], ["light.living", "unavailable"]]), at(23)).met, false);
  assert.equal(evaluateRules({ ...rules, enabled: false }, states([["sensor.lux", "2"], ["light.living", "off"]]), at(23)).met, false);
});

test("どれか: ひとつ満たせばよい", () => {
  const rules = normalizeRules({
    enabled: true,
    match: "any",
    conditions: [
      { kind: "off", entityId: "light.living" },
      { kind: "off", entityId: "light.bedroom" },
    ],
  });
  const result = evaluateRules(rules, states([["light.living", "on"], ["light.bedroom", "off"]]), at(23));
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
