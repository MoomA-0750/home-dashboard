/* kasane 1.1.0  source 0c3da3202ebd0a06  写したもの。直すのは kasane（scripts/kasane-sync.mjs） */
/**
 * dashboard テーマの壁紙の仕組み（フェーズ8。home-dashboard の wallpaperTheme.ts・useWallpaper.ts から移した）。
 * まだ約束の外: 関数の名前・引数・戻り値・中の数・このファイルの場所は、ダッシュボードのアプリの移行が終わるまで変わりうる。
 *
 * 壁紙を読み込んだときに1回測り、次の3つを dashboard テーマの要素に書く（中の名前 --_*。アプリは書かない・読まない）。
 *   - 暗さ: 画面の横の位置ごとに、明るい所が目安の明るさに収まるだけの暗さ（--_wallpaper-dim-1〜4）と、主の色の光の濃さ（--_wallpaper-glow）
 *   - 字の影の濃さ（--_text-halo-strength）
 *   - 色: 壁紙の色相とあざやかさから、主の色などの5色（--_accent・--_link・--_tint・--_ink・--_shade）。計算済みの色を書く
 *
 * 使い方（フレームワークに依らない）:
 *   import { applyWallpaper } from "kasane/dashboard/wallpaper.js";
 *   const stop = applyWallpaper(document.documentElement, { image: "/background.jpg", strength: 1 });
 *   stop(); // 読み込み・測り直しの待ちと、画面の大きさの見張りをやめる（書いた値はそのまま）
 * 重ねの CSS は dashboard/wallpaper.css（.k-wallpaper）。
 */

// ---- 暗さ ----

// 足した後の、明るい所（上位1割）の明るさの目安（相対輝度）
export const TARGET_LUMINANCE = 0.12;
// 列ごとの暗さを決めるときの余裕（小さく縮めて測るので、画面の細かさで描くと上位1割が少し明るく出る）
const COVER_MARGIN = 0.005;
// 足す暗さの上限（壁紙が見えなくならないように）
export const MAX_DIM = 0.55;
// 測る位置（画面の幅に対する割合）。左（時計・サイドバー）から右端まで4つ
export const ZONES = [
  [0, 0.3],
  [0.3, 0.55],
  [0.55, 0.8],
  [0.8, 1],
];
// 暗さを置く位置（wallpaper.css の横のグラデーションの点。ZONES と同じ並び）
export const DIM_STOPS = [0.12, 0.42, 0.67, 0.9];
// 測る前・壁紙が無いときの暗さ（wallpaper.css の既定と同じ）
export const DEFAULT_DIMS = [0.4, 0, 0, 0];
// 主の色の光（wallpaper.css の radial-gradient）。中心と、濃さの上限
export const GLOW_AT = [0.74, 0.42];
export const GLOW_ALPHA = 0.13;
// 上から下への暗さ（shade の 0.18 → 0.55）
export const TOP_SHADE = [0.18, 0.55];

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB（0〜255）の相対輝度 */
export function luminance(r, g, b) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 上から下への暗さ（y は 0〜1） */
function topShade(y) {
  return TOP_SHADE[0] + (TOP_SHADE[1] - TOP_SHADE[0]) * y;
}

const blend = (v, alpha, to) => v * (1 - alpha) + to * alpha;

function context(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d", { willReadFrequently: true });
}

/**
 * 壁紙を、今の画面の縦横比で cover にしたときの、位置ごとの明るさと、足す暗さ（強さ 1 のとき）。
 *   bright・needed: 区画ごとの、上から下への暗さを足した後の上位1割の明るさと、それを目安に収める暗さ
 *     （home-dashboard と同じ値。設定の画面に出す）
 *   cover: 実際に置く暗さ（点ごと。下の2つの穴を塞いだもの）/ glow: 主の色の光の濃さ（全部の区画で同じ値）
 * home-dashboard の測りには穴が2つあった（docs/phase8.md の F5）。ここでは両方を塞ぐ:
 *   (a) 暗さは4つの点（DIM_STOPS）の間をなめらかにつなぐので、区画ごとに測ると点と点の間の明るい所に暗さが足りない。
 *       細い列ごとに測り、列の位置でつないだ暗さが、どの列でもその列に要る暗さ以上になるように点の値を選ぶ
 *   (b) 主の色の光（GLOW_AT・GLOW_ALPHA）を測りに入れていなかった。光も重ねた後の明るさで測る。
 *       光を入れると暗さの上限（MAX_DIM）を超える壁紙（白など）では、光を弱める（上限の中に収まるところまで）
 * colors: 重ねに使う色（colorsFor の shade と accent）。省くと既定の青
 * @returns {{ from: number, to: number, bright: number, needed: number, cover: number, glow: number }[]}
 */
export function measureDims(image, width, height, colors = colorsFor(DEFAULT_HUE, 1)) {
  // 小さく描いて測る（細かさは要らない）
  const w = 160;
  const h = Math.max(40, Math.round((w * height) / Math.max(1, width)));
  const g = context(w, h);
  if (!g) return ZONES.map(([from, to]) => ({ from, to, bright: 0, needed: 0, cover: 0, glow: GLOW_ALPHA }));
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  g.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const data = g.getImageData(0, 0, w, h).data;

  const zones = ZONES.map(([from, to]) => {
    const values = [];
    for (let y = 0; y < h; y++) {
      const ty = topShade(y / (h - 1));
      for (let x = Math.floor(from * w); x < Math.min(w, Math.ceil(to * w)); x++) {
        const i = (y * w + x) * 4;
        const shade = (v, c) => blend(v, ty, c);
        values.push(luminance(shade(data[i], 4), shade(data[i + 1], 11), shade(data[i + 2], 26)));
      }
    }
    values.sort((a, b) => a - b);
    const bright = values[Math.floor(values.length * 0.9)] ?? 0;
    // 暗さを a 足すと、色の値はおよそ (1 - a) 倍になり、明るさは (1 - a)^2.2 倍になる
    const needed = bright <= TARGET_LUMINANCE ? 0 : 1 - (TARGET_LUMINANCE / bright) ** (1 / 2.2);
    return { from, to, bright, needed: Math.max(0, needed) };
  });

  // 光を弱める段（上限に当たらない、いちばん濃い光を選ぶ）
  let stops = null;
  let glow = 0;
  for (const alpha of [GLOW_ALPHA, 0.1, 0.07, 0.04, 0]) {
    stops = coverStops(data, w, h, width, height, colors, alpha);
    glow = alpha;
    if (Math.max(...stops) <= MAX_DIM) break;
  }
  return zones.map((zone, i) => ({ ...zone, cover: stops[i], glow }));
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** 列ごとに要る暗さ（光も重ねた後の上位1割を目安に収める）から、4つの点の暗さ（小数2桁に切り上げ） */
function coverStops(data, w, h, width, height, colors, glowAlpha) {
  const shade = rgbOf(colors.shade);
  const accent = rgbOf(colors.accent);
  // 光は radial-gradient(circle at 74% 42%, … , transparent 34%)。半径の 100% は、中心からいちばん遠い角まで
  const cx = GLOW_AT[0] * width;
  const cy = GLOW_AT[1] * height;
  const far = Math.max(...[0, width].flatMap((x) => [0, height].map((y) => Math.hypot(x - cx, y - cy))));
  const reach = 0.34 * far;
  const lum = (p) => luminance(p[0], p[1], p[2]);
  const needs = [];
  for (let x = 0; x < w; x++) {
    const column = [];
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const ty = topShade(y / (h - 1));
      let p = [0, 1, 2].map((c) => blend(data[i + c], ty, shade[c]));
      const ga = glowAlpha * Math.max(0, 1 - Math.hypot(((x + 0.5) / w) * width - cx, ((y + 0.5) / h) * height - cy) / reach);
      if (ga > 0) p = p.map((v, c) => blend(v, ga, accent[c]));
      column.push(p);
    }
    column.sort((a, b) => lum(a) - lum(b));
    const top = column[Math.floor(column.length * 0.9)];
    const target = TARGET_LUMINANCE - COVER_MARGIN;
    if (lum(top) <= target) {
      needs.push(0);
      continue;
    }
    // 暗さ a を重ねた後（shade へ a だけ寄せる）の明るさが目安に収まる、いちばん小さい a
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2;
      if (lum(top.map((v, c) => blend(v, mid, shade[c]))) <= target) hi = mid;
      else lo = mid;
    }
    needs.push(hi);
  }
  // 点の間はなめらかにつなぐ（点の外は端の点の値）。列の左右の端の両方で、つないだ暗さが足りるようにする:
  // まず各点に、いちばん近い列たちの要る暗さの最大を置き、足りない列があれば、要る暗さより低い側の点だけを上げる
  // （片側が足りていれば、もう片側は要る暗さ以下で足りる。どの点も、どこかの列が要る暗さより大きくはしない）
  const at = (p) => {
    if (p <= DIM_STOPS[0]) return [[0, 1]];
    if (p >= DIM_STOPS[DIM_STOPS.length - 1]) return [[DIM_STOPS.length - 1, 1]];
    const i = DIM_STOPS.findIndex((s, k) => p >= s && p <= DIM_STOPS[k + 1]);
    const t = (p - DIM_STOPS[i]) / (DIM_STOPS[i + 1] - DIM_STOPS[i]);
    return [
      [i, 1 - t],
      [i + 1, t],
    ];
  };
  const nearest = (p) => DIM_STOPS.reduce((best, s, i) => (Math.abs(p - s) < Math.abs(p - DIM_STOPS[best]) ? i : best), 0);
  const d = DIM_STOPS.map(() => 0);
  needs.forEach((need, x) => {
    const i = nearest((x + 0.5) / w);
    d[i] = Math.max(d[i], need);
  });
  for (let round = 0; round < 8; round++) {
    let changed = false;
    needs.forEach((need, x) => {
      if (need <= 0) return;
      for (const p of [x / w, (x + 1) / w]) {
        const parts = at(p);
        const got = parts.reduce((sum, [i, wt]) => sum + d[i] * wt, 0);
        if (got + 1e-9 >= need) continue;
        changed = true;
        if (parts.length === 1) {
          d[parts[0][0]] = need;
          continue;
        }
        const [[i, wi], [j, wj]] = parts;
        if (d[i] >= need) d[j] = Math.min(need, (need - wi * d[i]) / wj);
        else if (d[j] >= need) d[i] = Math.min(need, (need - wj * d[j]) / wi);
        else {
          d[i] = need;
          d[j] = need;
        }
      }
    });
    if (!changed) break;
  }
  return d.map((v) => Math.ceil(v * 100 - 1e-6) / 100);
}

/** 強さを掛けて、位置ごとに実際に足す暗さ（0〜MAX_DIM。小数2桁）。cover が無ければ（home-dashboard の測り）needed */
export function dimsFor(zones, strength) {
  return zones.map((zone) => Math.round(Math.min(MAX_DIM, (zone.cover ?? zone.needed) * strength) * 100) / 100);
}

/** 足した後の明るさ（その位置の明るい所） */
export function dimmedBrightness(bright, dim) {
  return bright * (1 - dim) ** 2.2;
}

// ---- 字の影 ----
// 壁紙にじかに置く字の影の濃さ（0.2〜1）。足した後にいちばん明るい位置の明るさで決める

// この明るさ以下なら影はほぼ要らない（暗い壁紙）
const HALO_FROM = 0.04;
// この明るさで影がいちばん濃くなる
const HALO_FULL = 0.2;
// 影を消し切らない（写真の中の小さな明るい所は、上位1割の明るさでは拾えない）
const HALO_MIN = 0.2;

export function haloFor(zones, dims) {
  const brightest = Math.max(0, ...zones.map((zone, index) => dimmedBrightness(zone.bright, dims[index] ?? 0)));
  const t = Math.min(1, Math.max(0, (brightest - HALO_FROM) / (HALO_FULL - HALO_FROM)));
  return Math.round((HALO_MIN + (1 - HALO_MIN) * t) * 100) / 100;
}

// ---- 色 ----

export const DEFAULT_HUE = 199;

/** 壁紙のあざやかな所の色相（HSL の 0〜360）と、壁紙全体のあざやかさ（0〜1）。色がほとんど無ければ null */
export function measureHue(image) {
  const w = 96;
  const h = Math.max(1, Math.round((w * image.naturalHeight) / Math.max(1, image.naturalWidth)));
  const g = context(w, h);
  if (!g) return null;
  g.drawImage(image, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  const bins = new Array(36).fill(0);
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

/** 測った色から、色を決める2つの数（色相とあざやかさ 0.55〜1）。null なら既定の青 */
export function seedOf(measured) {
  return {
    hue: measured?.hue ?? DEFAULT_HUE,
    // 落ち着いた壁紙では色も少し落ち着かせる
    vivid: measured ? Math.min(1, Math.max(0.55, measured.saturation * 2.2)) : 1,
  };
}

// HSL → sRGB（0〜255。home-dashboard と同じく整数に丸める）
function hslRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

const toLinear = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB（0〜255）→ oklch [L, C, H] */
export function rgbToOklch([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/** oklch → sRGB（0〜255。範囲の外は切り詰めない） */
export function oklchToRgb([L, C, H]) {
  const A = C * Math.cos((H * Math.PI) / 180);
  const B = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear);
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.5 && v <= 255.5);

/** 明るさと色相を保ったまま、sRGB に入るところまで鮮やかさを下げる */
function fit(L, C, H) {
  if (inGamut(oklchToRgb([L, C, H]))) return oklchToRgb([L, C, H]);
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb([L, mid, H]))) lo = mid;
    else hi = mid;
  }
  return oklchToRgb([L, lo, H]);
}

const hex = (rgb) => "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/**
 * 役割ごとの色の決まり。明るさ L と鮮やかさ C（あざやかさ 1 のとき）はテーマが決め、壁紙からは色相とあざやかさだけを取る。
 * 色相は home-dashboard と同じ「壁紙の色相 + ずれ」の HSL の色の、oklch での色相（hsl は HSL の s・l。色相を決めるためだけに使う）。
 * vivid: あざやかさを掛けるか。L・C は既定の青（色相 199）で home-dashboard の色と同じになる値（link の L だけ明るくした）
 */
export const ROLES = {
  accent: { offset: 0, hsl: [1, 0.64], L: 0.780752, C: 0.135756, vivid: true },
  // link は壁紙にじかに置いても 4.5 に届くよう、home-dashboard（0.852）より明るい（フェーズ8の段3）
  link: { offset: -3, hsl: [0.88, 0.76], L: 0.91, C: 0.088889, vivid: true },
  tint: { offset: -3, hsl: [1, 0.94], L: 0.961729, C: 0.026418, vivid: true },
  ink: { offset: 12, hsl: [0.82, 0.13], L: 0.240506, C: 0.060667, vivid: false },
  shade: { offset: 20, hsl: [0.89, 0.04], L: 0.126413, C: 0.030276, vivid: false },
};

/**
 * 色相（HSL の 0〜360）とあざやかさ（0.55〜1）から、dashboard の5色（#rrggbb）。
 * accent: 主の色 / link: リンク・フォーカス・主の色の字 / tint: 明るい塗り・ガラスの縁 / ink: 明るい塗りと主の色の上の字 / shade: 暗さ・下敷き
 */
export function colorsFor(hue, vivid = 1) {
  const out = {};
  for (const [name, role] of Object.entries(ROLES)) {
    const H = rgbToOklch(hslRgb(hue + role.offset, role.hsl[0], role.hsl[1]))[2];
    out[name] = hex(fit(role.L, role.C * (role.vivid ? vivid : 1), H));
  }
  return out;
}

// ---- 当てる ----

const COLOR_VARS = { accent: "--_accent", link: "--_link", tint: "--_tint", ink: "--_ink", shade: "--_shade" };

/** 位置ごとの暗さ・光・字の影を要素に書く */
export function writeShading(root, dims, { glow = GLOW_ALPHA, halo = 0.6 } = {}) {
  dims.forEach((dim, index) => root.style.setProperty(`--_wallpaper-dim-${index + 1}`, String(dim)));
  root.style.setProperty("--_wallpaper-glow", String(glow));
  root.style.setProperty("--_text-halo-strength", String(halo));
}

/** 5色を要素に書く（消さずに、既定の色も書く。種を消すと計算し直さないブラウザがある） */
export function writeColors(root, colors) {
  for (const [name, value] of Object.entries(colors)) root.style.setProperty(COLOR_VARS[name], value);
}

/**
 * 壁紙を当てる。root は data-theme="dashboard" を付けた要素（ふつうは <html>）。
 *   image: 壁紙の URL（null なら壁紙なし。暗さ・色・影を既定に戻す）
 *   strength: 暗さの強さ（0〜1.5、既定 1）
 *   night: 夜の表示（true か 0〜1 の暗さ。壁紙を沈める）/ lite: 軽い表示（ガラスのぼかしを切って面を濃くする）
 *   onMeasure: 測ったとき（設定の画面に位置ごとの明るさと足す暗さを出す）
 * 壁紙の画像は読み込み終えてから、色・暗さと同じときに書く（読み込みの間は前の壁紙のまま。先に書くと、読み込みの間は
 * 下地のグラデーションが見え、読み込んだ後も前の壁紙の色と暗さが数コマ残る）。読めなかったときは、画像を書いて（下地が見える）
 * 色・暗さを既定に戻す。
 * 戻り値: 後始末の関数（読み込み・測り直しの待ちと、画面の大きさの見張りをやめる。書いた値は残す。
 *         次の applyWallpaper がすぐ上書きするので、壁紙を替えるときに既定の色へ一瞬戻らない）
 */
export function applyWallpaper(root, { image = null, strength = 1, night = false, lite = false, onMeasure } = {}) {
  setMode(root, { night, lite });
  if (!image) {
    root.style.setProperty("--_wallpaper-image", "none");
    writeShading(root, DEFAULT_DIMS);
    writeColors(root, colorsFor(DEFAULT_HUE, 1));
    return () => {};
  }
  const url = `url("${String(image).replace(/["\\]/g, "\\$&")}")`;
  let cancelled = false;
  let timer;
  const img = new Image();
  let colors = colorsFor(DEFAULT_HUE, 1);
  const measure = () => {
    if (cancelled || img.naturalWidth === 0) return;
    const zones = measureDims(img, window.innerWidth, window.innerHeight, colors);
    const dims = dimsFor(zones, strength);
    writeShading(root, dims, { glow: zones[0].glow, halo: haloFor(zones, dims) });
    onMeasure?.(zones, dims);
  };
  img.onload = () => {
    if (cancelled) return;
    // 色を先に決める（光の色が測りに入るので）。画像・色・暗さを同じときに書く
    const { hue, vivid } = seedOf(measureHue(img));
    colors = colorsFor(hue, vivid);
    root.style.setProperty("--_wallpaper-image", url);
    writeColors(root, colors);
    measure();
  };
  img.onerror = () => {
    if (cancelled) return;
    root.style.setProperty("--_wallpaper-image", url);
    writeShading(root, DEFAULT_DIMS);
    writeColors(root, colors);
  };
  img.src = image;
  // 画面の縦横比で見える範囲が変わるので、大きさが変わったら測り直す
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(measure, 300);
  };
  window.addEventListener("resize", onResize);
  return () => {
    cancelled = true;
    clearTimeout(timer);
    window.removeEventListener("resize", onResize);
  };
}

/** 夜・軽い表示を切り替える（applyWallpaper も呼ぶ。片方だけ変えるとき） */
export function setMode(root, { night = false, lite = false } = {}) {
  if (night) {
    root.dataset.night = "";
    root.style.setProperty("--_night-darkness", String(night === true ? 0.85 : night));
  } else {
    delete root.dataset.night;
    root.style.removeProperty("--_night-darkness");
  }
  if (lite) root.dataset.lite = "";
  else delete root.dataset.lite;
}
