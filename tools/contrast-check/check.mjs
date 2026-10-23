/**
 * 画面の文字の明暗比（コントラスト比）を測る道具。ガラスの入れ物や壁紙の上の文字は、後ろの色が場所ごとに違うので、
 * CSS の色だけでは分からない。そこで、文字だけを消した画面を撮り、文字の場所の後ろの色（明るい方の9割の値）と
 * 文字の色から比を出す。目安（WCAG）は 4.5（大きな文字は 3）。
 *
 *   node tools/contrast-check/check.mjs                  # 足りない所だけ
 *   node tools/contrast-check/check.mjs --all            # 全部
 *   node tools/contrast-check/check.mjs --json out.json  # 結果を JSON にも書く
 *   node tools/contrast-check/check.mjs --css a.css      # この CSS を足した見た目で測る（直す前・直した後を比べる）
 *
 * 環境変数:
 *   DASHBOARD_URL      画面の URL（既定 http://localhost:8819/）。本番のデータに触らないよう、試験用のサーバーを指す
 *   DASHBOARD_USER     ログインする名前（既定 tester）。アカウントが無ければ、この名前で最初のアカウントを作る
 *   DASHBOARD_PASSWORD パスワード（既定 correct horse）
 *   VIEWPORT           画面の大きさ（既定 1500x1100）
 *   CHROME_PATH        ブラウザ（未指定ならインストール済みの Google Chrome）
 */
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const url = process.env.DASHBOARD_URL ?? "http://localhost:8819/";
const user = process.env.DASHBOARD_USER ?? "tester";
const password = process.env.DASHBOARD_PASSWORD ?? "correct horse";
const [width, height] = (process.env.VIEWPORT ?? "1500x1100").split("x").map(Number);
const showAll = process.argv.includes("--all");
const jsonIndex = process.argv.indexOf("--json");
const jsonPath = jsonIndex >= 0 ? process.argv[jsonIndex + 1] : null;
const cssIndex = process.argv.indexOf("--css");
const extraCss = cssIndex >= 0 ? await readFile(process.argv[cssIndex + 1], "utf-8") : null;

// 文字と、文字のように色で描くアイコン（mask に currentColor）を消す。画像・アバターは残す。
// 文字の影は残す（影は文字の後ろの色の一部なので、影で読みやすくしている所はその分も測る）
const HIDE_TEXT = `
  *, *::before, *::after { color: transparent !important; caret-color: transparent !important; }
  .fluent-icon { visibility: hidden !important; }
  input::placeholder, textarea::placeholder { color: transparent !important; }
`;

/** 画面の中の、見えている文字の塊（文字を直接持つ要素）と、その色・大きさ・場所 */
function collectTexts() {
  const out = [];
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
    return [Number(r), Number(g), Number(b), Number(a)];
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (!(el instanceof HTMLElement)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    const placeholder = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.value && el.placeholder;
    if (!own && !placeholder) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    // 箱ではなく、文字が実際に並んでいる所（行ごとの四角）を測る（説明文の右の余白など、文字の無い所の明るさを混ぜない）
    const range = document.createRange();
    const lines = [];
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        // 画面の外にはみ出した分は測らない（画面の外は黒として読めてしまう）
        const left = Math.max(0, r.left);
        const top = Math.max(0, r.top);
        const right = Math.min(innerWidth, r.right);
        const bottom = Math.min(innerHeight, r.bottom);
        if (right - left > 1 && bottom - top > 1) lines.push(new DOMRect(left, top, right - left, bottom - top));
      }
    }
    if (!lines.length && !placeholder) continue;
    const rect = lines.length
      ? {
          left: Math.min(...lines.map((r) => r.left)),
          top: Math.min(...lines.map((r) => r.top)),
          right: Math.max(...lines.map((r) => r.right)),
          bottom: Math.max(...lines.map((r) => r.bottom)),
          width: 0,
          height: 0,
        }
      : el.getBoundingClientRect();
    if (lines.length) {
      rect.width = rect.right - rect.left;
      rect.height = rect.bottom - rect.top;
    }
    if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth)
      continue;
    // 親の opacity も文字の濃さに効く
    let opacity = 1;
    for (let p = el; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity);
    const color = parse(placeholder ? getComputedStyle(el, "::placeholder").color : style.color);
    if (!color || opacity < 0.05) continue;
    const size = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const text = (placeholder ? el.placeholder : [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""))
      .trim()
      .slice(0, 40);
    out.push({
      text,
      selector: `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""}`,
      color: [color[0], color[1], color[2]],
      alpha: color[3] * opacity,
      size,
      large: size >= 24 || (bold && size >= 18.66),
      lines: lines.map((r) => ({ x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)), w: Math.round(r.width), h: Math.round(r.height) })),
      rect: {
        x: Math.max(0, Math.round(rect.left)),
        y: Math.max(0, Math.round(rect.top)),
        w: Math.round(Math.min(rect.right, innerWidth) - Math.max(0, rect.left)),
        h: Math.round(Math.min(rect.bottom, innerHeight) - Math.max(0, rect.top)),
      },
    });
  }
  return out;
}

/** 文字を消した画面の画像から、各文字の後ろの明るさを読み、比を出す（ブラウザの中で画像を読む） */
async function measure({ dataUrl, texts }) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const scale = img.naturalWidth / innerWidth;
  const channel = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, gg, b]) => 0.2126 * channel(r) + 0.7152 * channel(gg) + 0.0722 * channel(b);
  return texts.map((t) => {
    const pixels = [];
    for (const { x, y, w, h } of t.lines.length ? t.lines : [t.rect]) {
      if (w < 1 || h < 1) continue;
      const data = g.getImageData(Math.round(x * scale), Math.round(y * scale), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))).data;
      for (let i = 0; i < data.length; i += 4 * 3) pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (pixels.length === 0) return { ...t, background: [0, 0, 0], ratio: 21, needed: t.large ? 3 : 4.5 };
    pixels.sort((a, b) => lum(a) - lum(b));
    const textLum = lum(t.color);
    // 明るい文字なら後ろの明るい所、暗い文字なら暗い所が読みにくさを決める
    const bg = textLum > 0.18 ? pixels[Math.floor(pixels.length * 0.9)] : pixels[Math.floor(pixels.length * 0.1)];
    // 半透明の文字は、後ろの色と混ぜた色で測る
    const shown = t.color.map((c, i) => c * t.alpha + bg[i] * (1 - t.alpha));
    const [a, b] = [lum(shown), lum(bg)];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return { ...t, background: bg, ratio: Math.round(ratio * 100) / 100, needed: t.large ? 3 : 4.5 };
  });
}

/** 測る画面（サイドバーの名前か、設定の項目） */
const SCREENS = [
  { name: "ホーム", open: async (p) => p.click('button[aria-label="ホーム"]') },
  ...["メディア", "ホームコントロール", "カレンダー", "メール", "天気", "チャット"].map((label) => ({
    name: label,
    open: async (p) => p.click(`button[aria-label="${label}"]`),
  })),
  ...["一般", "ウィジェット", "壁紙", "アカウント", "拡張機能", "音声アシスタント", "コネクター・MCP"].map((label) => ({
    name: `設定 › ${label}`,
    open: async (p) => {
      await p.click('button[aria-label="設定"]');
      await p.locator(".settings-nav").getByText(label, { exact: true }).first().click();
    },
  })),
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  channel: process.env.CHROME_PATH ? undefined : "chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width, height }, locale: "ja-JP" });
// 音楽を勝手に操作しない（確かめの間に再生中の曲を変えない）
await page.route("**/api/ext/media/**", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
await page.goto(url);
await page.evaluate(
  async ({ user, password }) => {
    const body = JSON.stringify({ username: user, password, deviceName: "contrast-check" });
    const headers = { "Content-Type": "application/json" };
    const status = await (await fetch("/api/auth/status")).json();
    await fetch(status.setupRequired ? "/api/auth/setup" : "/api/auth/login", { method: "POST", headers, body });
    await fetch("/api/auth/locale", { method: "PUT", headers, body: JSON.stringify({ locale: "ja" }) });
  },
  { user, password },
);
await page.reload();
await page.waitForTimeout(2500);
// 足した CSS は、画面を開き直しても消えないよう、読み込みのたびに入れる
if (extraCss) await page.addStyleTag({ content: extraCss });

const results = [];
for (const screen of SCREENS) {
  try {
    await screen.open(page);
  } catch {
    continue; // その画面が無い（拡張機能を切ってある）
  }
  await page.waitForTimeout(2000);
  const texts = await page.evaluate(collectTexts);
  const style = await page.addStyleTag({ content: HIDE_TEXT });
  await page.waitForTimeout(150);
  const shot = await page.screenshot({ type: "png" });
  await style.evaluate((node) => node.remove());
  const measured = await page.evaluate(measure, { dataUrl: `data:image/png;base64,${shot.toString("base64")}`, texts });
  for (const m of measured) results.push({ screen: screen.name, ...m });
}
await browser.close();

const failing = results.filter((r) => r.ratio < r.needed);
const rows = (showAll ? results : failing).sort((a, b) => a.ratio - b.ratio);
for (const r of rows) {
  console.log(`${r.ratio.toFixed(2).padStart(5)} / ${r.needed}  ${r.screen}  ${r.selector}  「${r.text}」`);
}
const bySelector = new Map();
for (const r of failing) bySelector.set(r.selector, (bySelector.get(r.selector) ?? 0) + 1);
console.log(`\n文字 ${results.length} か所のうち、目安に届かないもの ${failing.length} か所`);
console.log("多いもの:", [...bySelector].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, n]) => `${s} ×${n}`).join(", "));
if (jsonPath) await writeFile(jsonPath, JSON.stringify(results, null, 2));
