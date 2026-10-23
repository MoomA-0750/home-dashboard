import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeObservations, parseStatusLineLimits } from "./limits";

const NOW = Date.parse("2026-10-19T01:00:00Z");
const RESET_5H = Math.floor(Date.parse("2026-10-19T04:00:00Z") / 1000);
const RESET_7D = Math.floor(Date.parse("2026-10-23T00:00:00Z") / 1000);

test("statusLine の rate_limits から5時間と週の枠を取り出す", () => {
  const observations = parseStatusLineLimits(
    {
      model: { id: "claude-opus-5-5" },
      rate_limits: {
        five_hour: { used_percentage: 42.5, resets_at: RESET_5H },
        seven_day: { used_percentage: 12, resets_at: RESET_7D },
      },
    },
    NOW,
  );
  assert.deepEqual(observations, [
    { kind: "five_hour", usedPercent: 42.5, resetsAt: "2026-10-19T04:00:00.000Z" },
    { kind: "seven_day", usedPercent: 12, resetsAt: "2026-10-23T00:00:00.000Z" },
  ]);
});

test("値の欠けた窓・範囲外の値・怪しい名前は捨てる", () => {
  const observations = parseStatusLineLimits(
    {
      rate_limits: {
        spend_limit: {},
        five_hour: { used_percentage: 140, resets_at: RESET_5H },
        "../etc": { used_percentage: 10 },
        seven_day: { used_percentage: 3, resets_at: 99999999999 },
      },
    },
    NOW,
  );
  assert.deepEqual(observations, [{ kind: "seven_day", usedPercent: 3, resetsAt: null }]);
});

test("rate_limits が無い入力は何も記録しない", () => {
  assert.deepEqual(parseStatusLineLimits({ model: {} }, NOW), []);
  assert.deepEqual(parseStatusLineLimits("not json", NOW), []);
  assert.deepEqual(parseStatusLineLimits(null, NOW), []);
});

test("同じ窓のあいだは一番高い値を残し、窓が変わったら数え直す", () => {
  const first = mergeObservations(
    {},
    [{ kind: "five_hour", usedPercent: 60, resetsAt: "2026-10-19T04:00:00.000Z" }],
    "2026-10-19T01:00:00.000Z",
  );
  const lower = mergeObservations(
    first,
    [{ kind: "five_hour", usedPercent: 55, resetsAt: "2026-10-19T04:00:00.000Z" }],
    "2026-10-19T01:10:00.000Z",
  );
  assert.equal(lower.five_hour.usedPercent, 55);
  assert.equal(lower.five_hour.peakPercent, 60);
  assert.equal(lower.five_hour.observedAt, "2026-10-19T01:10:00.000Z");

  const nextWindow = mergeObservations(
    lower,
    [{ kind: "five_hour", usedPercent: 2, resetsAt: "2026-10-19T09:00:00.000Z" }],
    "2026-10-19T04:05:00.000Z",
  );
  assert.equal(nextWindow.five_hour.peakPercent, 2);
});
