import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLayout } from "./layout";

test("並びと大きさと色の形を確かめ、おかしなものは捨てる", () => {
  const layout = normalizeLayout({
    order: ["light.a", "light.a", "rm -rf", 3, "lock.door"],
    tiles: {
      "light.a": { size: "4x2", color: "#FFAA00" },
      "lock.door": { size: "9x9", color: "red" },
      "climate.ac": { color: "#112233" },
      "bad id": { size: "2x2" },
    },
  });
  assert.deepEqual(layout.order, ["light.a", "lock.door"]);
  assert.deepEqual(layout.tiles, { "light.a": { size: "4x2", color: "#ffaa00" }, "climate.ac": { color: "#112233" } });
  assert.deepEqual(normalizeLayout(null), { order: [], tiles: {} });
});
