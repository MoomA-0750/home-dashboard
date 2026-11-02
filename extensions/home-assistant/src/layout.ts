import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServerExtensionApi } from "@home-dashboard/extension-sdk";

/**
 * Home Control のます目の並び・大きさ・タイルの色。全部の端末で同じ（拡張機能のデータ置き場の layout.json）。
 * - GET /layout … 今の並び
 * - PUT /layout … 並びを変える（ログインしている人なら誰でも。家族それぞれが並べ替える）
 * 大きさは「横x縦」のます目の数。照明の四角（2x2）が基本
 */

export const TILE_SIZES = ["2x1", "2x2", "4x2", "4x4"] as const;
export type TileSize = (typeof TILE_SIZES)[number];

export interface TileLayout {
  size?: TileSize;
  /** タイルの色（#rrggbb）。つけたとき・施錠中などの「オン」の色に使う */
  color?: string;
}

export interface HomeLayout {
  /** 並び（entity_id）。載っていないものは後ろに、見つかった順で並ぶ */
  order: string[];
  tiles: Record<string, TileLayout>;
}

const MAX_TILES = 500;
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export const EMPTY_LAYOUT: HomeLayout = { order: [], tiles: {} };

export function normalizeLayout(raw: unknown): HomeLayout {
  const input = (raw ?? {}) as Partial<Record<keyof HomeLayout, unknown>>;
  const order = Array.isArray(input.order)
    ? [...new Set(input.order.filter((id): id is string => typeof id === "string" && ENTITY_ID.test(id)))].slice(0, MAX_TILES)
    : [];
  const tiles: Record<string, TileLayout> = {};
  if (input.tiles && typeof input.tiles === "object") {
    for (const [id, value] of Object.entries(input.tiles as Record<string, unknown>).slice(0, MAX_TILES)) {
      if (!ENTITY_ID.test(id) || !value || typeof value !== "object") continue;
      const { size, color } = value as Record<string, unknown>;
      const tile: TileLayout = {};
      if (TILE_SIZES.includes(size as TileSize)) tile.size = size as TileSize;
      if (typeof color === "string" && COLOR.test(color)) tile.color = color.toLowerCase();
      if (tile.size || tile.color) tiles[id] = tile;
    }
  }
  return { order, tiles };
}

export function registerLayout(api: ServerExtensionApi): void {
  const layoutPath = () => join(api.dataDir, "layout.json");

  api.route("GET", "/layout", async () => {
    try {
      return normalizeLayout(JSON.parse(await readFile(layoutPath(), "utf-8")));
    } catch {
      return EMPTY_LAYOUT;
    }
  });

  api.route("PUT", "/layout", async ({ body }) => {
    const layout = normalizeLayout(body);
    await mkdir(api.dataDir, { recursive: true });
    await writeFile(layoutPath(), `${JSON.stringify(layout, null, 2)}\n`);
    return layout;
  });
}
