import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";

/**
 * 壁紙（ダッシュボードの背景の写真）。設定画面で選んだ画像を data/wallpaper/ に1枚だけ置き、全部の端末で同じものを出す。
 * 置いていなければ、画面に入っている既定の写真（/background.jpg）を使う。
 */

export const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024;

const wallpaperDir = () => join(config.dataDir, "wallpaper");
const metaPath = () => join(wallpaperDir(), "wallpaper.json");

const TYPES = [
  { type: "image/png", ext: "png", matches: (b: Uint8Array) => hasBytes(b, 0, [0x89, 0x50, 0x4e, 0x47]) },
  { type: "image/jpeg", ext: "jpg", matches: (b: Uint8Array) => hasBytes(b, 0, [0xff, 0xd8, 0xff]) },
  {
    type: "image/webp",
    ext: "webp",
    matches: (b: Uint8Array) => hasBytes(b, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(b, 8, [0x57, 0x45, 0x42, 0x50]),
  },
] as const;

function hasBytes(data: Uint8Array, offset: number, bytes: number[]): boolean {
  return bytes.every((byte, i) => data[offset + i] === byte);
}

export interface WallpaperInfo {
  /** 選んだ壁紙があるか（無ければ既定の写真） */
  custom: boolean;
  /** 画像が変わるたびに変わる値（画像の URL に添えて、端末に古い画像を使わせない） */
  version: string | null;
  /**
   * 壁紙の明るい所に足す暗さの強さ（0〜1.5）。画面が壁紙を測って「文字が読めるだけの暗さ」を出し、それにこの値を掛けて足す。
   * 0 なら足さない、1 で目安どおり。壁紙を替えても残る
   */
  dimStrength: number;
}

export const DEFAULT_DIM_STRENGTH = 1;
const settingsPath = () => join(wallpaperDir(), "display.json");

async function readDimStrength(): Promise<number> {
  try {
    const value = JSON.parse(await readFile(settingsPath(), "utf-8")).dimStrength;
    return typeof value === "number" && Number.isFinite(value) ? Math.min(1.5, Math.max(0, value)) : DEFAULT_DIM_STRENGTH;
  } catch {
    return DEFAULT_DIM_STRENGTH;
  }
}

/** 足す暗さの強さを変える */
export async function setDimStrength(value: unknown): Promise<WallpaperInfo> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1.5)
    throw new ServiceError(400, "暗さの強さは 0〜1.5 にしてください", "Dim strength must be between 0 and 1.5");
  await mkdir(wallpaperDir(), { recursive: true });
  await writeFile(settingsPath(), `${JSON.stringify({ dimStrength: Math.round(value * 100) / 100 }, null, 2)}\n`);
  return getWallpaper();
}

interface WallpaperMeta {
  file: string;
  type: string;
  version: string;
}

async function readMeta(): Promise<WallpaperMeta | null> {
  try {
    return JSON.parse(await readFile(metaPath(), "utf-8")) as WallpaperMeta;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function getWallpaper(): Promise<WallpaperInfo> {
  const meta = await readMeta();
  return { custom: meta !== null, version: meta?.version ?? null, dimStrength: await readDimStrength() };
}

/** 置いてある壁紙の画像の場所と種類。無ければ null */
export async function wallpaperFile(): Promise<{ path: string; type: string } | null> {
  const meta = await readMeta();
  return meta ? { path: join(wallpaperDir(), meta.file), type: meta.type } : null;
}

/** 壁紙を入れ替える。中身を見て PNG・JPEG・WebP だけを受ける（送られた種類の名乗りは信じない） */
export async function setWallpaper(data: Uint8Array): Promise<WallpaperInfo> {
  if (data.byteLength === 0) throw new ServiceError(400, "画像が空です", "The image is empty");
  if (data.byteLength > MAX_WALLPAPER_BYTES) throw new ServiceError(413, "画像が大きすぎます（20MB まで）", "The image is too large (up to 20 MB)");
  const kind = TYPES.find((t) => t.matches(data));
  if (!kind) throw new ServiceError(415, "PNG・JPEG・WebP の画像を選んでください", "Choose a PNG, JPEG or WebP image");

  const version = createHash("sha256").update(data).digest("hex").slice(0, 16);
  const file = `wallpaper-${version}.${kind.ext}`;
  await mkdir(wallpaperDir(), { recursive: true });
  await writeFile(join(wallpaperDir(), file), data);
  await writeFile(metaPath(), `${JSON.stringify({ file, type: kind.type, version }, null, 2)}\n`);
  await removeOtherImages(file);
  return { custom: true, version, dimStrength: await readDimStrength() };
}

/** 既定の写真に戻す */
export async function resetWallpaper(): Promise<WallpaperInfo> {
  await rm(metaPath(), { force: true });
  await removeOtherImages(null);
  return { custom: false, version: null, dimStrength: await readDimStrength() };
}

async function removeOtherImages(keep: string | null): Promise<void> {
  const names = await readdir(wallpaperDir()).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((name) => name.startsWith("wallpaper-") && name !== keep)
      .map((name) => rm(join(wallpaperDir(), name), { force: true })),
  );
}
