import { test } from "node:test";
import assert from "node:assert/strict";
import { gridMetrics, packTiles } from "./homeTypes";

test("2x1 は横に並ぶ前に上下に重なる", () => {
  const placed = packTiles(["4x2", "2x1", "2x1", "2x1"], 8);
  assert.deepEqual(
    placed.map(({ col, row }) => [col, row]),
    [
      [0, 0],
      [4, 0],
      [4, 1],
      [6, 0],
    ],
  );
});

test("2x2 は帯の頭から置き、空いた下半分には後ろの 2x1 が入る", () => {
  const placed = packTiles(["2x1", "2x2", "2x1", "4x4"], 4);
  assert.deepEqual(
    placed.map(({ col, row }) => [col, row]),
    [
      [0, 0],
      [2, 0],
      [0, 1],
      [0, 2],
    ],
  );
});

test("列より広いタイルは列の数に縮める", () => {
  assert.deepEqual(packTiles(["4x2"], 4), [{ col: 0, row: 0, w: 4 }]);
  assert.equal(gridMetrics(390).cols, 4);
  assert.equal(gridMetrics(1300).cols, 12);
});
