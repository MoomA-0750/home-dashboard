import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
const root = await mkdtemp(join(tmpdir(), "wallpaper-"));
process.env.DATA_DIR = join(root, "data");
const wallpaper = await import("./wallpaper.js");

const png = (seed: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, seed]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);

test("置いていなければ既定の写真", async () => {
  assert.deepEqual(await wallpaper.getWallpaper(), { custom: false, version: null, dimStrength: wallpaper.DEFAULT_DIM_STRENGTH });
  assert.equal(await wallpaper.wallpaperFile(), null);
});

test("入れ替えると1枚だけ残り、版が変わる", async () => {
  const first = await wallpaper.setWallpaper(png(1));
  const second = await wallpaper.setWallpaper(webp);
  assert.ok(first.version && second.version && first.version !== second.version);
  assert.deepEqual(await wallpaper.getWallpaper(), second);
  assert.equal((await wallpaper.wallpaperFile())?.type, "image/webp");
  const images = (await readdir(join(root, "data", "wallpaper"))).filter((n) => n.startsWith("wallpaper-"));
  assert.equal(images.length, 1);
});

test("画像でないものは受けない", async () => {
  await assert.rejects(wallpaper.setWallpaper(new TextEncoder().encode("<svg></svg>")), /PNG・JPEG・WebP/);
  await assert.rejects(wallpaper.setWallpaper(new Uint8Array()), /空/);
});

test("既定に戻すと画像も消える", async () => {
  await wallpaper.resetWallpaper();
  assert.deepEqual(await wallpaper.getWallpaper(), { custom: false, version: null, dimStrength: wallpaper.DEFAULT_DIM_STRENGTH });
  const images = (await readdir(join(root, "data", "wallpaper"))).filter((n) => n.startsWith("wallpaper-"));
  assert.equal(images.length, 0);
});

test("足す暗さの強さは 0〜1.5 で保存し、壁紙を替えても残る", async () => {
  await assert.rejects(wallpaper.setDimStrength(2));
  await assert.rejects(wallpaper.setDimStrength("0.5"));
  assert.equal((await wallpaper.setDimStrength(0.35)).dimStrength, 0.35);
  await wallpaper.resetWallpaper();
  assert.equal((await wallpaper.getWallpaper()).dimStrength, 0.35);
});
