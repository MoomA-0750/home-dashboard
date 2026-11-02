/**
 * Home Control の画面で使う形と、サーバーとのやり取り（状態の一覧・操作・ます目の並び）
 */

export interface HaEntity {
  entityId: string;
  domain: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
  area: string | null;
}

export interface Climate extends HaEntity {
  currentTemperature: number | null;
  targetTemperature: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  step: number | null;
  hvacModes: string[];
}

export interface Toggle extends HaEntity {
  brightnessPct: number | null;
  dimmable: boolean;
  /** 色を変えられる照明か（hs・rgb など） */
  colorable?: boolean;
  /** 白の色温度を変えられる照明か */
  colorTemp?: boolean;
  hsColor?: [number, number] | null;
  colorTempKelvin?: number | null;
  minKelvin?: number | null;
  maxKelvin?: number | null;
}

export interface Overview {
  configured: boolean;
  canUnlock: boolean;
  sensors: HaEntity[];
  locks: HaEntity[];
  climates: Climate[];
  toggles: Toggle[];
}

/** ます目に並べるもの（鍵・空調・照明とスイッチ）。センサーはます目の外の帯に出す */
export type Tile =
  | { kind: "lock"; entity: HaEntity }
  | { kind: "climate"; entity: Climate }
  | { kind: "toggle"; entity: Toggle };

export const TILE_SIZES = ["2x1", "2x2", "4x2", "4x4"] as const;
export type TileSize = (typeof TILE_SIZES)[number];

export interface HomeLayout {
  order: string[];
  tiles: Record<string, { size?: TileSize; color?: string }>;
}

export const DEFAULT_SIZE: TileSize = "2x2";

/** タイルの色の候補（「オン」のときの地の色）。最初のものが照明の既定（いままでの明るい黄色） */
export const TILE_COLORS = ["#ffecb3", "#ffd6a5", "#ffc4c4", "#f5c2e7", "#d9c8ff", "#c6dcff", "#b8ecf5", "#c8f0d0", "#e9f5b5", "#f2f2f2"];
export const DEFAULT_COLORS: Record<Tile["kind"], string> = {
  toggle: "#ffecb3",
  climate: "#b8ecf5",
  lock: "#c8f0d0",
};

export async function fetchLayout(apiBaseUrl: string): Promise<HomeLayout> {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/layout`);
  if (!res.ok) throw new Error(`layout ${res.status}`);
  return (await res.json()) as HomeLayout;
}

export async function saveLayout(apiBaseUrl: string, layout: HomeLayout): Promise<HomeLayout> {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new Error(`layout ${res.status}`);
  return (await res.json()) as HomeLayout;
}

/** 保存した並びの順に並べる。並びに無いもの（新しく足した機器）は、もとの順で後ろに付ける */
export function orderTiles(tiles: Tile[], order: string[]): Tile[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((a, b) => {
      const ra = rank.get(a.tile.entity.entityId) ?? order.length + a.index;
      const rb = rank.get(b.tile.entity.entityId) ?? order.length + b.index;
      return ra - rb;
    })
    .map(({ tile }) => tile);
}

/** 1つを別のものの位置へ動かした並び（ids は今の並び全体） */
export function moveId(ids: string[], id: string, target: string): string[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** 地の色に載せる文字の色（明るい地には濃い文字、暗い地には白） */
export function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return luminance > 0.4 ? "#2b2200" : "#ffffff";
}

export function sizeOf(size: TileSize): { w: number; h: number } {
  const [w, h] = size.split("x").map(Number);
  return { w, h };
}

/** ます目の列の数と間の幅。入れ物の幅で決める（狭い画面は 4 列 ＝ 2x2 が 2 つ並ぶ） */
export function gridMetrics(width: number): { cols: number; gap: number } {
  const cols = width >= 1240 ? 12 : width >= 980 ? 10 : width >= 720 ? 8 : width >= 520 ? 6 : 4;
  return { cols, gap: width >= 980 ? 14 : width >= 520 ? 12 : 10 };
}

export interface Placement {
  col: number;
  row: number;
  w: number;
}

/**
 * タイルを並び順にます目へ置く。2行ずつの帯（照明の四角 2x2 の高さ）ごとに、左の列から、上・下の順に空きを探すので、
 * 2x1 は横に並ぶ前に上下に重なる（2x1 が2つで 2x2 の場所を埋める）。背が2以上のものは帯の頭（偶数行）からだけ置く
 */
export function packTiles(sizes: TileSize[], cols: number): Placement[] {
  const used = new Set<string>();
  const free = (col: number, row: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) if (used.has(`${c}:${r}`)) return false;
    return true;
  };
  return sizes.map((size) => {
    const { h } = sizeOf(size);
    const w = Math.min(sizeOf(size).w, cols);
    for (let band = 0; ; band++) {
      for (let col = 0; col + w <= cols; col++) {
        for (const row of h === 1 ? [band * 2, band * 2 + 1] : [band * 2]) {
          if (!free(col, row, w, h)) continue;
          for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) used.add(`${c}:${r}`);
          return { col, row, w };
        }
      }
    }
  });
}
