import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlaceStore, parsePlace } from "./places";

test("場所は名前と範囲内の緯度・経度だけを受け取り、細かすぎる桁は丸める", () => {
  assert.deepEqual(parsePlace({ name: " 札幌市 ", lat: "43.066666", lon: 141.35 }), { name: "札幌市", lat: 43.0667, lon: 141.35 });
  assert.throws(() => parsePlace({ name: "", lat: 0, lon: 0 }), /地名/);
  assert.throws(() => parsePlace({ name: "x", lat: 91, lon: 0 }), /緯度/);
  assert.throws(() => parsePlace({ name: "x", lat: 0, lon: "abc" }), /緯度/);
});

test("足した場所は書き残し、読み直しても残る。外すと消える", async () => {
  const dir = await mkdtemp(join(tmpdir(), "weather-places-"));
  try {
    const store = new PlaceStore(dir);
    const added = await store.add({ name: "那覇市", lat: 26.21, lon: 127.68 });
    assert.equal((await new PlaceStore(dir).list())[0].name, "那覇市");
    await store.remove(added.id);
    assert.deepEqual(await new PlaceStore(dir).list(), []);
    await assert.rejects(store.remove("nope"), /ありません/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
