/**
 * 壁紙に合わせて、画面に足す暗さと、テーマの色を決める。測る・暗さ・色の決まりは kasane の dashboard の壁紙の仕組み
 * （kasane/dashboard/wallpaper.js。kasane-sync で写したもの。直すのは kasane）にあり、ここはそれを出し直す。
 *
 * - 画面の本体（apps/web）と Yorine は startWallpaper を呼ぶ。壁紙を読み込んだときに1回測り、<html> に暗さ・色・字の影を書く。
 *   画面の大きさが変わったら測り直す。戻り値の関数で、読み込み・測り直しの待ちをやめる
 * - 重ねの CSS は kasane/dashboard/wallpaper.css（.k-wallpaper。画面全体の枠 AppShell が付ける）
 * - 設定の「壁紙」は、測った結果（getAnalysis・onAnalysis）と、強さを変えたときの当て直し（applyShading）を使う
 *
 * ■ 互換の層（公開している拡張機能のため。消す時期は決めていない。docs/extensions.md）
 * 前の home-dashboard は、色を「r, g, b」の形の変数（--accent-rgb など5つ）で、暗さと字の影を --wallpaper-dim-*・
 * --text-halo-strength で書いていた。外で組まれた拡張機能の CSS はこれらを読むので、kasane の値から同じ名前にも書き続ける。
 * kasane の約束には入れない（home-dashboard の中の互換）
 */
import {
  DEFAULT_DIMS,
  DEFAULT_HUE,
  GLOW_ALPHA,
  applyWallpaper,
  colorsFor,
  dimsFor,
  haloFor,
  seedOf,
  writeColors,
  writeShading,
  type DashboardColors,
  type ZoneMeasure,
} from "./kasane/dashboard/wallpaper.js";

export {
  MAX_DIM,
  TARGET_LUMINANCE,
  ZONES,
  colorsFor,
  dimmedBrightness,
  dimsFor,
  haloFor,
  measureDims,
  measureHue,
} from "./kasane/dashboard/wallpaper.js";
export type { DashboardColors } from "./kasane/dashboard/wallpaper.js";

/** 位置ごとの測った結果。bright は上から下への暗さを足した後の明るい所の明るさ、needed は目安に収めるのに足す暗さ（強さ 1 のとき） */
export type ZoneAnalysis = ZoneMeasure;

// ---- 互換の層 ----

const COMPAT_RGB: Record<keyof DashboardColors, string> = {
  accent: "--accent-rgb",
  link: "--accent-soft-rgb",
  tint: "--tint-rgb",
  ink: "--ink-rgb",
  shade: "--shade-rgb",
};

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

function writeCompatColors(root: HTMLElement, colors: DashboardColors): void {
  for (const [name, value] of Object.entries(colors) as [keyof DashboardColors, string][]) {
    root.style.setProperty(COMPAT_RGB[name], rgbOf(value));
  }
}

function writeCompatShading(root: HTMLElement, dims: number[], halo: number): void {
  dims.forEach((dim, index) => root.style.setProperty(`--wallpaper-dim-${index + 1}`, String(dim)));
  root.style.setProperty("--home-dashboard-text-halo-strength", String(halo));
  root.style.setProperty("--text-halo-strength", String(halo));
}

/** kasane が書いた5色を読み、互換の名前にも書く（壁紙を測ったとき） */
function copyCompatColors(root: HTMLElement): void {
  const read = (name: keyof DashboardColors) => root.style.getPropertyValue(`--_${name}`).trim();
  const colors = { accent: read("accent"), link: read("link"), tint: read("tint"), ink: read("ink"), shade: read("shade") };
  if (Object.values(colors).every((value) => /^#[0-9a-f]{6}$/i.test(value))) writeCompatColors(root, colors);
}

// ---- 測った結果 ----

// 最後に測った結果。設定の「壁紙」で、位置ごとの明るさと足す暗さを見せるのに使う
let lastAnalysis: ZoneAnalysis[] | null = null;
const listeners = new Set<(zones: ZoneAnalysis[]) => void>();

export function setAnalysis(zones: ZoneAnalysis[]): void {
  lastAnalysis = zones;
  for (const listener of listeners) listener(zones);
}

export function getAnalysis(): ZoneAnalysis[] | null {
  return lastAnalysis;
}

export function onAnalysis(listener: (zones: ZoneAnalysis[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- 当てる ----

/**
 * 壁紙を当てる（<html> に）。image は壁紙の URL（null なら壁紙なし。暗さ・色・影を既定に戻す）、strength は暗さの強さ（0〜1.5）。
 * strength に関数を渡すと、測り終えたときの強さで当てる（測っている間に設定の値が届いたとき）。
 * 夜の表示（data-night）と軽い表示（data-lite）は、それぞれの仕組みが付けたものをそのまま保つ。
 * 戻り値: 読み込み・測り直しの待ちと、画面の大きさの見張りをやめる関数（書いた値は残す）
 */
export function startWallpaper(image: string | null, strength: number | (() => number)): () => void {
  const root = document.documentElement;
  const current = () => (typeof strength === "function" ? strength() : strength);
  const stop = applyWallpaper(root, {
    image,
    strength: current(),
    night: root.hasAttribute("data-night"),
    lite: root.hasAttribute("data-lite"),
    onMeasure: (zones) => {
      copyCompatColors(root);
      applyShading(zones, current());
      setAnalysis(zones);
    },
  });
  if (!image) {
    writeCompatColors(root, colorsFor(DEFAULT_HUE, 1));
    writeCompatShading(root, DEFAULT_DIMS, 0.6);
  }
  return stop;
}

/** 強さに合わせて、位置ごとの暗さと文字の影の濃さを画面に当て直す（測り直さない） */
export function applyShading(zones: ZoneAnalysis[], strength: number): void {
  const root = document.documentElement;
  const dims = dimsFor(zones, strength);
  const halo = haloFor(zones, dims);
  writeShading(root, dims, { glow: zones[0]?.glow ?? GLOW_ALPHA, halo });
  writeCompatShading(root, dims, halo);
}

/** テーマの色を当てる（測った色。null なら既定の青）。startWallpaper が使うので、ふつうは呼ばない */
export function applyTheme(measured: { hue: number; saturation: number } | null): void {
  const root = document.documentElement;
  const { hue, vivid } = seedOf(measured);
  const colors = colorsFor(hue, vivid);
  writeColors(root, colors);
  writeCompatColors(root, colors);
}
