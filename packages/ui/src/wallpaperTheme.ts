/**
 * 壁紙に合わせて、画面に足す暗さと、テーマの色を決める（壁紙を読み込んだときに1回測る）。
 *
 * ■ 暗さ
 *
 * 画面の文字は白（説明は薄い水色）なので、壁紙の明るい所（窓・空）に重なると読めない。全体を暗くすると、暗い壁紙まで
 * 沈んでしまうので、壁紙を読み込んだときに、画面の横の位置ごと（左・中ほど・右寄り・右端）に明るさを測り、明るい所が
 * 目安の明るさに収まるだけの暗さを、その位置にだけ足す（.app-shell::after の --wallpaper-dim-*）。暗い壁紙なら何も足さない。
 *
 * 測るのは、画面の枠（Shell）で壁紙に重ねている上から下への暗さを足した後の明るさ。文字の影の濃さも、足した後の明るさで決める（下の「文字の影」）。
 */

// 足した後の、明るい所（上位1割）の明るさの目安（相対輝度）。白い文字で明暗比 およそ 6、薄い文字で 4 になる
export const TARGET_LUMINANCE = 0.12;
// 足す暗さの上限（壁紙が見えなくならないように）
export const MAX_DIM = 0.55;
// 測る位置（画面の幅に対する割合）。左（時計・サイドバー）から右端まで、4つに分けて測る
export const ZONES: [number, number][] = [
  [0, 0.3],
  [0.3, 0.55],
  [0.55, 0.8],
  [0.8, 1],
];

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** .app-shell::after の上からの暗さ（0.18 から 0.55） */
function topShade(y: number): number {
  return 0.18 + (0.55 - 0.18) * y;
}

const blend = (v: number, alpha: number, to: number) => v * (1 - alpha) + to * alpha;

/** 位置ごとの測った結果。bright は今の重ねた暗さの上での明るい所の明るさ、needed は目安に収めるのに足す暗さ（強さ 1 のとき） */
export interface ZoneAnalysis {
  from: number;
  to: number;
  bright: number;
  needed: number;
}

/** 壁紙を、今の画面の縦横比で cover にしたときの、位置ごとの明るさと、足す暗さ（強さ 1 のとき） */
export function measureDims(image: HTMLImageElement, width: number, height: number): ZoneAnalysis[] {
  // 小さく描いて測る（細かさは要らない）
  const w = 160;
  const h = Math.max(40, Math.round((w * height) / Math.max(1, width)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return ZONES.map(([from, to]) => ({ from, to, bright: 0, needed: 0 }));
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  g.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const data = g.getImageData(0, 0, w, h).data;

  return ZONES.map(([from, to]) => {
    const values: number[] = [];
    for (let y = 0; y < h; y++) {
      const ty = topShade(y / (h - 1));
      for (let x = Math.floor(from * w); x < Math.min(w, Math.ceil(to * w)); x++) {
        const i = (y * w + x) * 4;
        const shade = (v: number, c: number) => blend(v, ty, c);
        values.push(luminance(shade(data[i], 4), shade(data[i + 1], 11), shade(data[i + 2], 26)));
      }
    }
    values.sort((a, b) => a - b);
    const bright = values[Math.floor(values.length * 0.9)] ?? 0;
    // 暗さを a 足すと、色の値はおよそ (1 - a) 倍になり、明るさは (1 - a)^2.2 倍になる
    const needed = bright <= TARGET_LUMINANCE ? 0 : 1 - (TARGET_LUMINANCE / bright) ** (1 / 2.2);
    return { from, to, bright, needed: Math.max(0, needed) };
  });
}

/** 強さを掛けて、位置ごとに実際に足す暗さ（0〜MAX_DIM） */
export function dimsFor(zones: ZoneAnalysis[], strength: number): number[] {
  return zones.map((zone) => Math.round(Math.min(MAX_DIM, zone.needed * strength) * 100) / 100);
}

/** 暗さを画面に当てる（--wallpaper-dim-1〜4） */
export function applyDims(dims: number[]): void {
  const root = document.documentElement;
  dims.forEach((dim, index) => root.style.setProperty(`--wallpaper-dim-${index + 1}`, String(dim)));
}

/** 足した後の明るさ（その位置の明るい所） */
export function dimmedBrightness(bright: number, dim: number): number {
  return bright * (1 - dim) ** 2.2;
}

/*
 * ■ 文字の影
 * 壁紙にじかに置く文字には淡い影（tokens.css の --text-halo）を付ける。足した暗さで後ろが十分暗くなっていれば影は要らず、
 * 暗さを弱めた（強さを下げた）ときや、暗さの上限まで足しても明るい所が残るときは、影で補う。そこで、足した後に
 * いちばん明るい位置の明るさから、影の濃さ（0〜1）を決める（--text-halo-strength）
 */

// この明るさ以下なら影はほぼ要らない（暗い壁紙）
const HALO_FROM = 0.04;
// この明るさで影がいちばん濃くなる
const HALO_FULL = 0.2;
// 影を消し切らない（写真の中の小さな明るい所は、上位1割の明るさでは拾えない）
const HALO_MIN = 0.2;

/** 足した後の明るさから、文字の影の濃さ（HALO_MIN〜1） */
export function haloFor(zones: ZoneAnalysis[], dims: number[]): number {
  const brightest = Math.max(0, ...zones.map((zone, index) => dimmedBrightness(zone.bright, dims[index] ?? 0)));
  const t = Math.min(1, Math.max(0, (brightest - HALO_FROM) / (HALO_FULL - HALO_FROM)));
  return Math.round((HALO_MIN + (1 - HALO_MIN) * t) * 100) / 100;
}

/** 強さに合わせて、位置ごとの暗さと文字の影の濃さを画面に当てる */
export function applyShading(zones: ZoneAnalysis[], strength: number): void {
  const dims = dimsFor(zones, strength);
  applyDims(dims);
  document.documentElement.style.setProperty("--text-halo-strength", String(haloFor(zones, dims)));
}

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

/*
 * ■ テーマの色
 * 壁紙のあざやかな所の色合い（色相）を取り、選んでいる所・自分の吹き出し・明るいボタンなどの色をその色合いにする。
 * 明るさ・あざやかさは決めた値に固定するので、どの壁紙でも文字の読みやすさは変わらない。色の無い壁紙（白黒・灰色）なら既定の青
 */

const DEFAULT_HUE = 199;

/** 壁紙のあざやかな所の色相（0〜360）と、壁紙全体のあざやかさ（0〜1）。色がほとんど無ければ null */
export function measureHue(image: HTMLImageElement): { hue: number; saturation: number } | null {
  const w = 96;
  const h = Math.max(1, Math.round((w * image.naturalHeight) / Math.max(1, image.naturalWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(image, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  const bins = new Array<number>(36).fill(0);
  let total = 0;
  let satSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const gg = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, gg, b);
    const min = Math.min(r, gg, b);
    const s = max === 0 ? 0 : (max - min) / max;
    if (s < 0.2 || max < 0.15) continue;
    let hue = max === r ? ((gg - b) / (max - min)) % 6 : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4;
    hue = (hue * 60 + 360) % 360;
    // あざやかで明るい所ほど、その壁紙の「色」として効く
    const weight = s * max;
    bins[Math.floor(hue / 10) % 36] += weight;
    total += weight;
    satSum += s;
  }
  const pixels = data.length / 4;
  if (total / pixels < 0.03) return null;
  // となりの区間も足して、いちばん多い色合いを選び、その中で重みの平均をとる
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < 36; i++) {
    const score = bins[(i + 35) % 36] * 0.5 + bins[i] + bins[(i + 1) % 36] * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  let x = 0;
  let y = 0;
  for (const offset of [-1, 0, 1]) {
    const index = (best + offset + 36) % 36;
    const angle = ((index * 10 + 5) * Math.PI) / 180;
    x += Math.cos(angle) * bins[index];
    y += Math.sin(angle) * bins[index];
  }
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { hue: Math.round(hue), saturation: Math.min(1, satSum / pixels) };
}

function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)}, ${f(8)}, ${f(4)}`;
}

/** テーマの色を当てる（tokens.css の --accent-rgb など）。null なら既定の青 */
export function applyTheme(measured: { hue: number; saturation: number } | null): void {
  const root = document.documentElement;
  const hue = measured?.hue ?? DEFAULT_HUE;
  // 落ち着いた壁紙では色も少し落ち着かせる（あざやかさは 0.55〜1 倍）
  const vivid = measured ? Math.min(1, Math.max(0.55, measured.saturation * 2.2)) : 1;
  // 既定の青のときの、役割ごとの色合いのずれ（青: 199 / 196 / 196 / 211 / 219）を保つ
  const colors: Record<string, string> = {
    "--accent-rgb": hsl(hue, 1 * vivid, 0.64),
    "--accent-soft-rgb": hsl(hue - 3, 0.88 * vivid, 0.76),
    "--tint-rgb": hsl(hue - 3, 1 * vivid, 0.94),
    "--ink-rgb": hsl(hue + 12, 0.82, 0.13),
    "--shade-rgb": hsl(hue + 20, 0.89, 0.04),
  };
  for (const [name, value] of Object.entries(colors)) {
    if (measured) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}
