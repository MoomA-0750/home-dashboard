import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLrc, pickClosest, toResult } from "./lyrics";

test("LRC の時刻と歌詞を行に分け、時刻順に並べる", () => {
  const lines = parseLrc("[00:12.50] 一行目\n[ar:artist]\n[01:02.003]二行目\n[00:05.00]\n");
  assert.deepEqual(lines, [
    { timeMs: 5000, text: "" },
    { timeMs: 12500, text: "一行目" },
    { timeMs: 62003, text: "二行目" },
  ]);
});

test("1行に時刻が複数ある繰り返しは、それぞれの時刻に展開する", () => {
  assert.deepEqual(parseLrc("[00:10.00][00:40.00]サビ"), [
    { timeMs: 10000, text: "サビ" },
    { timeMs: 40000, text: "サビ" },
  ]);
});

test("時刻付きが無ければ時刻なしの歌詞、インストは歌詞なしとして返す", () => {
  assert.deepEqual(toResult({ plainLyrics: "あ\nい" }).lines, [
    { timeMs: null, text: "あ" },
    { timeMs: null, text: "い" },
  ]);
  assert.equal(toResult({ plainLyrics: "あ" }).synced, false);
  assert.equal(toResult({ instrumental: true }).instrumental, true);
  assert.equal(toResult({}).found, false);
});

test("検索結果からは長さの近いもの（±2秒、次に±5秒）を、時刻付きを優先して選ぶ", () => {
  const records = [
    { duration: 200, plainLyrics: "far" },
    { duration: 184, plainLyrics: "near-plain" },
    { duration: 183, syncedLyrics: "[00:01.00]near-synced" },
  ];
  assert.equal(pickClosest(records, 182_000)?.syncedLyrics, "[00:01.00]near-synced");
  assert.equal(pickClosest(records, 196_000)?.plainLyrics, "far");
  assert.equal(pickClosest(records, 120_000), null);
});

test("同じ長さの候補が並んだら、訳の混じっていない短い歌詞を選ぶ", () => {
  const records = [
    { duration: 255, syncedLyrics: "[00:01.00]雨が降り止むまでは\n[00:01.00]Khi mưa chưa dứt" },
    { duration: 255, syncedLyrics: "[00:01.00]雨が降り止むまでは" },
  ];
  assert.equal(pickClosest(records, 255_000)?.syncedLyrics, "[00:01.00]雨が降り止むまでは");
});
