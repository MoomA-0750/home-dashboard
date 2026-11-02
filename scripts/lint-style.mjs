#!/usr/bin/env node
/**
 * 見た目の決まり（docs/design-system.md）に沿っているかを確かめる。
 *
 *   pnpm lint:style                     # 全部
 *   pnpm lint:style extensions/weather  # 決めたフォルダ・ファイルだけ
 *
 * 確かめること:
 * - css-file      … CSS のファイルを足していない（スタイルは Tailwind のクラスで書く。土台の数ファイルだけ例外）
 * - unknown-class … className に書いたクラスが、Tailwind のテーマ（packages/ui/src/tailwind-theme.css）で出るものか
 *                   （決まりに無い値・打ち間違い・Tailwind に移す前の自前のクラスは、何も出ないので知らせる）
 * - arbitrary     … [#123] や [13px] のような、テーマを通さない値を書いていない（var の (--x) は使ってよい）
 * - inline-color  … style={{ }} に色を直書きしていない
 * - component     … 部品で書くものを自前で作っていない（<input type="range"> は Slider、createPortal は Dialog、
 *                   アイコンだけの <button> は IconButton）
 */
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = join(ROOT, "packages/ui/src/tailwind-ext.css");

/** 土台の CSS（テーマ・値・全体の決まり）。ほかに CSS のファイルは置かない */
const ALLOWED_CSS = new Set([
  "packages/ui/src/tailwind.css",
  "packages/ui/src/tailwind-ext.css",
  "packages/ui/src/tailwind-theme.css",
  "packages/ui/src/styles/tokens.css",
  "packages/ui/src/styles/base.css",
  "packages/ui/src/styles/components.css",
]);
/** Tailwind のクラスで書けないもの（@utility・@keyframes）を置く所 */
const ALLOWED_CSS_DIR = "packages/ui/src/theme/";

/** Tailwind のクラスではないが使ってよいもの（JS が付け外しする印・外の部品が決めた名前・styles/components.css の面のクラス） */
const ALLOWED_HOOKS = new Set(["is-closing", "is-scrolling", "fluent-icon", "glass", "raised"]);
const ALLOWED_PREFIXES = ["react-grid-", "react-resizable", "leaflet-"];

/** 調べるファイル（画面側のソース） */
const SOURCE_DIRS = ["packages/ui/src", "packages/widget-sdk/src", "apps/web/src", "extensions", "examples/extensions"];

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", ...SOURCE_DIRS], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((f) => !/(^|\/)(node_modules|dist|public)\//.test(f));
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** 括弧の対応を見ながら、式の終わり（深さ 0 の閉じ括弧・区切り）までを読む */
function readExpression(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(text, i);
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

function skipString(text, start) {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (quote === "`" && text[i] === "$" && text[i + 1] === "{") {
      i = readExpression(text, i + 1, "{", "}");
      continue;
    }
    if (text[i] === quote) return i;
  }
  return text.length;
}

/**
 * 式の中の文字列（"…"・'…'・`…`）から、クラスの候補を取り出す。`…${x}…` の差し込みに接する語は、
 * 実行時に決まる名前の切れ端なので見ない
 */
function classTokens(expression, offset) {
  const tokens = [];
  for (let i = 0; i < expression.length; i++) {
    const c = expression[i];
    if (c !== '"' && c !== "'" && c !== "`") continue;
    const end = skipString(expression, i);
    // 比べるための文字列（size === "lg" など）はクラスではない
    const before = expression.slice(0, i).trimEnd();
    const after = expression.slice(end + 1).trimStart();
    if (/[=!]=$/.test(before) || /^[=!]==?/.test(after)) {
      i = end;
      continue;
    }
    const body = expression.slice(i + 1, end);
    const parts = c === "`" ? body.split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/) : [body];
    parts.forEach((part, index) => {
      const words = part.split(/\s+/);
      words.forEach((word, w) => {
        if (!word) return;
        const touchesStart = c === "`" && index > 0 && w === 0 && !/^\s/.test(part);
        const touchesEnd = c === "`" && index < parts.length - 1 && w === words.length - 1 && !/\s$/.test(part);
        if (touchesStart || touchesEnd) return;
        tokens.push({ token: word, index: offset + i });
      });
    });
    i = end;
  }
  return tokens;
}

/** className=… ・className: … ・cx(…) に書いたクラス */
function collectClasses(text) {
  const found = [];
  const attr = /\bclassName\s*(=|:)\s*/g;
  for (let m; (m = attr.exec(text)); ) {
    const start = m.index + m[0].length;
    const c = text[start];
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(text, start);
      found.push(...classTokens(text.slice(start, end + 1), start));
    } else if (c === "{") {
      const end = readExpression(text, start, "{", "}");
      found.push(...classTokens(text.slice(start, end + 1), start));
    } else if (m[1] === ":") {
      // オブジェクトの値（Leaflet の divIcon など）。次の , か } まで
      const rest = text.slice(start);
      const stop = rest.search(/[,}\n]/);
      found.push(...classTokens(rest.slice(0, stop < 0 ? rest.length : stop), start));
    }
  }
  const call = /\b(cx|clsx)\(/g;
  for (let m; (m = call.exec(text)); ) {
    const start = m.index + m[0].length - 1;
    const end = readExpression(text, start, "(", ")");
    found.push(...classTokens(text.slice(start, end + 1), start));
  }
  return found;
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const scopes = args.map((a) => relative(ROOT, resolve(a)).split("\\").join("/"));
const inScope = (file) => scopes.length === 0 || scopes.some((s) => file === s || file.startsWith(`${s}/`));

const files = trackedFiles().filter(inScope);
const problems = [];
const report = (file, line, rule, message) => problems.push({ file, line, rule, message });

// クラスが Tailwind のテーマで出るかは、1つずつ足して、出る CSS が増えるかで見る
const compiler = await compile(`@import ${JSON.stringify(ENTRY)};`, { base: dirname(ENTRY), onDependency() {} });
const known = new Map();
let lastLength = compiler.build([]).length;
function isUtility(token) {
  if (known.has(token)) return known.get(token);
  const length = compiler.build([token]).length;
  const ok = length > lastLength;
  lastLength = length;
  known.set(token, ok);
  return ok;
}

for (const file of files) {
  if (file.endsWith(".css")) {
    if (!ALLOWED_CSS.has(file) && !file.startsWith(ALLOWED_CSS_DIR))
      report(file, 1, "css-file", "CSS のファイルは足さない（Tailwind のクラスで書く。値が要るならテーマに足す）");
    continue;
  }
  if (!/\.(tsx|ts)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
  const text = await readFile(join(ROOT, file), "utf-8");

  for (const { token, index } of collectClasses(text)) {
    if (ALLOWED_HOOKS.has(token) || ALLOWED_PREFIXES.some((p) => token.startsWith(p))) continue;
    // 値の部分（最後の : の後。[&_x]: のような選び方の部分は除く）に [ ] があれば、テーマを通さない値
    const value = token.replace(/^(?:[^:[\]]*(?:\[[^\]]*\])?[^:[\]]*:)*/, "");
    if (/\[[^\]]*\]/.test(value) && !/\[(--|var\()/.test(value)) {
      report(file, lineOf(text, index), "arbitrary", `${token}: テーマを通さない値は書かない（テーマに足すか、ある段を使う）`);
      continue;
    }
    if (!isUtility(token)) report(file, lineOf(text, index), "unknown-class", `${token}: Tailwind のテーマで出ないクラス`);
  }

  for (const m of text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
    if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(\s*\d/.test(m[1]))
      report(file, lineOf(text, m.index), "inline-color", "style に色を直書きしない（トークンかクラスで）");
  }
  for (const m of text.matchAll(/<input[^>]*type=["']range["']/g))
    report(file, lineOf(text, m.index), "component", "<input type=\"range\"> ではなく Slider を使う");
  if (!file.startsWith("packages/ui/"))
    for (const m of text.matchAll(/\bcreatePortal\(/g))
      report(file, lineOf(text, m.index), "component", "createPortal ではなく Dialog を使う");
  if (!file.startsWith("packages/ui/"))
    for (const m of text.matchAll(/<button\b[^>]*>\s*<Icon\b[^>]*\/>\s*<\/button>/g))
    report(file, lineOf(text, m.index), "component", "アイコンだけのボタンは IconButton を使う");
}

if (problems.length === 0) {
  console.log(`✓ 見た目の決まりに沿っています（${files.length} ファイル）`);
} else {
  const byRule = new Map();
  for (const p of problems) byRule.set(p.rule, (byRule.get(p.rule) ?? 0) + 1);
  for (const p of problems) console.log(`${p.file}:${p.line}  ${p.rule}  ${p.message}`);
  console.log(`\n${problems.length} 件（${[...byRule].map(([r, n]) => `${r} ${n}`).join("・")}）`);
  process.exitCode = 1;
}
