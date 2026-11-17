// 型（home-dashboard が書いたもの。kasane-sync は .js・.css だけを写すので、ここは手で kasane の wallpaper.js に合わせる）
export interface ZoneMeasure {
  from: number;
  to: number;
  /** 上から下への暗さを足した後の、区画の上位1割の明るさ */
  bright: number;
  /** それを目安に収める暗さ（強さ 1 のとき） */
  needed: number;
  /** 実際に置く暗さ（点ごと。光も重ねて列ごとに測ったもの） */
  cover?: number;
  /** 主の色の光の濃さ */
  glow?: number;
}
export interface DashboardColors {
  accent: string;
  link: string;
  tint: string;
  ink: string;
  shade: string;
}
export const TARGET_LUMINANCE: number;
export const MAX_DIM: number;
export const ZONES: [number, number][];
export const DIM_STOPS: number[];
export const DEFAULT_DIMS: number[];
export const GLOW_AT: [number, number];
export const GLOW_ALPHA: number;
export const TOP_SHADE: [number, number];
export const DEFAULT_HUE: number;
export function luminance(r: number, g: number, b: number): number;
export function measureDims(image: HTMLImageElement, width: number, height: number, colors?: DashboardColors): Required<ZoneMeasure>[];
export function dimsFor(zones: ZoneMeasure[], strength: number): number[];
export function dimmedBrightness(bright: number, dim: number): number;
export function haloFor(zones: ZoneMeasure[], dims: number[]): number;
export function measureHue(image: HTMLImageElement): { hue: number; saturation: number } | null;
export function seedOf(measured: { hue: number; saturation: number } | null): { hue: number; vivid: number };
export function colorsFor(hue: number, vivid?: number): DashboardColors;
export function writeShading(root: HTMLElement, dims: number[], options?: { glow?: number; halo?: number }): void;
export function writeColors(root: HTMLElement, colors: DashboardColors): void;
export function applyWallpaper(
  root: HTMLElement,
  options?: {
    image?: string | null;
    strength?: number;
    night?: boolean | number;
    lite?: boolean;
    onMeasure?: (zones: Required<ZoneMeasure>[], dims: number[]) => void;
  },
): () => void;
export function setMode(root: HTMLElement, mode?: { night?: boolean | number; lite?: boolean }): void;
