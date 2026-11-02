#!/usr/bin/env node
/**
 * 拡張機能をビルドする道具。本体の拡張機能（extensions/*）も、外で作る拡張機能も、これでビルドする。
 *
 *   node --import tsx scripts/build-extension.mjs <拡張機能のフォルダ> [--zip] [--watch]
 *   node --import tsx scripts/build-extension.mjs --all [--watch]   # extensions/* をすべて
 *
 * 拡張機能のフォルダの形:
 *   manifest.json        名前・版・設定の項目（packages/extension-sdk の ExtensionManifest）
 *   src/server.ts        サーバー側（無くてもよい）。npm の依存も1つのファイルにまとめる
 *   src/web.tsx          画面側（無くてもよい）。import した .css は web.css にまとまる
 *   assets/              画面に配るファイル（アイコンなど。無くてもよい）
 * 出来上がり: <フォルダ>/dist/{manifest.json,server.js,web.js,web.css,assets/}、--zip なら <id>-<version>.zip も
 *
 * 画面側の react・react-dom・@home-dashboard/widget-sdk は同梱せず、本体が globalThis.__homeDashboard に置いたものを使う
 * （React が2つあると hooks が動かないため）。
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { zipSync } from "fflate";
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(join(ROOT, "apps/web/package.json"));

// 本体と共有するモジュール。名前付きの export を本体の実物から数え、本体のものを指す小さなモジュールに置き換える
const HOST_MODULES = ["react", "react/jsx-runtime", "react-dom", "@home-dashboard/widget-sdk"];

async function hostModuleExports(name) {
  const module =
    name === "@home-dashboard/widget-sdk"
      ? await import(pathToFileURL(join(ROOT, "packages/widget-sdk/src/index.ts")).href)
      : await import(pathToFileURL(requireFromWeb.resolve(name)).href);
  return Object.keys(module).filter((key) => key !== "default" && /^[A-Za-z_$][\w$]*$/.test(key));
}

function hostModulesPlugin(exportsByName) {
  return {
    name: "home-dashboard-host-modules",
    setup(build) {
      const filter = new RegExp(`^(${HOST_MODULES.map((n) => n.replace(/[/.-]/g, "\\$&")).join("|")})$`);
      build.onResolve({ filter }, (args) => ({ path: args.path, namespace: "host-module" }));
      build.onLoad({ filter: /.*/, namespace: "host-module" }, (args) => {
        const names = exportsByName.get(args.path);
        const lines = [
          `const m = globalThis.__homeDashboard?.modules?.[${JSON.stringify(args.path)}];`,
          `if (!m) throw new Error(${JSON.stringify(`本体の ${args.path} が見つかりません（ダッシュボードの中で読み込んでください）`)});`,
          "export default (m.default ?? m);",
        ];
        if (names.length > 0) lines.push(`export const { ${names.join(", ")} } = m;`);
        return { contents: lines.join("\n"), loader: "js" };
      });
    },
  };
}

/** 拡張機能の Tailwind の入り口（テーマは本体が出すので参照だけにし、使ったクラスだけを出す） */
const TAILWIND_EXT_ENTRY = join(ROOT, "packages/ui/src/tailwind-ext.css");

/**
 * 拡張機能の画面側（src/）で使っている Tailwind のクラスを集めて CSS にする。
 * 本体と同じテーマ（packages/ui/src/tailwind-theme.css）なので、決まりに無い値のクラスは何も出ない
 */
export async function tailwindForExtension(srcDir) {
  const compiler = await compile(`@import ${JSON.stringify(TAILWIND_EXT_ENTRY)};`, {
    base: dirname(TAILWIND_EXT_ENTRY),
    onDependency: () => {},
  });
  const scanner = new Scanner({ sources: [{ base: srcDir, pattern: "**/*", negated: false }] });
  return optimize(compiler.build(scanner.scan()), { minify: false }).code;
}

/**
 * 組み立てた web.css を仕上げる。Tailwind のクラスを前に置き、拡張機能が自分で書いた CSS は legacy の層に入れる
 * （層に入れないと、Tailwind のクラスより強くなってしまう）
 */
async function finishWebCss(dir, out) {
  const cssPath = join(out, "web.css");
  const own = existsSync(cssPath) ? (await readFile(cssPath, "utf-8")).trim() : "";
  const utilities = await tailwindForExtension(join(dir, "src"));
  const css = [utilities.trim(), own && `@layer legacy {\n${own}\n}`].filter(Boolean).join("\n\n");
  if (css) await writeFile(cssPath, `${css}\n`);
}

async function readManifest(dir) {
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf-8"));
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(manifest.id ?? ""))
    throw new Error(`${dir}: manifest.json の id が正しくありません`);
  return manifest;
}

async function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(path, base)));
    else out.push(relative(base, path).split("\\").join("/"));
  }
  return out;
}

async function buildOne(dir, { zip, watch, exportsByName }) {
  const manifest = await readManifest(dir);
  const out = join(dir, "dist");
  if (!watch) await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  if (existsSync(join(dir, "assets"))) await cp(join(dir, "assets"), join(out, "assets"), { recursive: true });

  const contexts = [];
  const serverEntry = join(dir, "src/server.ts");
  if (existsSync(serverEntry)) {
    contexts.push(
      await esbuild.context({
        entryPoints: [serverEntry],
        outfile: join(out, "server.js"),
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node20",
        // 任意で使うネイティブの部品（ssh2 の cpu-features・.node）は同梱できないので外す。
        // 読み込みは try で囲まれていて、無ければ JavaScript だけで動く
        external: ["*.node", "cpu-features"],
        // CommonJS の依存（imapflow など）が node の組み込みを require でき、__dirname・__filename（ssh2 など）を使えるように。
        // 名前がぶつからないよう、別の名前で用意して置き換える
        banner: {
          js: [
            "import { createRequire as __hdCreateRequire } from 'node:module';",
            "import { fileURLToPath as __hdFileURLToPath } from 'node:url';",
            "import { dirname as __hdDirnameOf } from 'node:path';",
            "const require = __hdCreateRequire(import.meta.url);",
            "const __hdFilename = __hdFileURLToPath(import.meta.url);",
            "const __hdDirname = __hdDirnameOf(__hdFilename);",
          ].join(" "),
        },
        define: { __dirname: "__hdDirname", __filename: "__hdFilename" },
        logLevel: "warning",
      }),
    );
  }
  const webEntry = join(dir, "src/web.tsx");
  if (existsSync(webEntry)) {
    contexts.push(
      await esbuild.context({
        entryPoints: { web: webEntry },
        outdir: out,
        bundle: true,
        platform: "browser",
        format: "esm",
        target: "es2020",
        jsx: "automatic",
        loader: { ".svg": "file", ".png": "file" },
        plugins: [
          hostModulesPlugin(exportsByName),
          {
            name: "home-dashboard-tailwind",
            setup(build) {
              build.onEnd(async (result) => {
                if (result.errors.length === 0) await finishWebCss(dir, out);
              });
            },
          },
        ],
        logLevel: "warning",
      }),
    );
  }

  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log(`見張っています: ${manifest.id}`);
    return;
  }
  try {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  } finally {
    // 失敗しても閉じる（閉じないと esbuild が残り、道具が終わらない）
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
  }

  if (zip) {
    const files = {};
    for (const name of await listFiles(out)) files[name] = new Uint8Array(await readFile(join(out, name)));
    const zipPath = join(dir, `${manifest.id}-${manifest.version}.zip`);
    await writeFile(zipPath, zipSync(files, { level: 9 }));
    console.log(`ZIP を作りました: ${relative(process.cwd(), zipPath)}`);
  }
  const size = (
    await Promise.all((await listFiles(out)).map((name) => stat(join(out, name)).then((s) => s.size)))
  ).reduce((a, b) => a + b, 0);
  console.log(`ビルドしました: ${manifest.id} ${manifest.version}（${Math.round(size / 1024)}KB）`);
}

const args = process.argv.slice(2);
const zip = args.includes("--zip");
const watch = args.includes("--watch");
const targets = args.includes("--all")
  ? (await readdir(join(ROOT, "extensions"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, "extensions", entry.name, "manifest.json")))
      .map((entry) => join(ROOT, "extensions", entry.name))
  : args.filter((arg) => !arg.startsWith("--")).map((arg) => resolve(arg));
if (targets.length === 0) {
  console.error("使い方: node --import tsx scripts/build-extension.mjs <拡張機能のフォルダ> [--zip] [--watch] | --all");
  process.exit(1);
}

const exportsByName = new Map();
for (const name of HOST_MODULES) exportsByName.set(name, await hostModuleExports(name));

for (const dir of targets) {
  try {
    await buildOne(dir, { zip, watch, exportsByName });
  } catch (err) {
    console.error(`${basename(dir)} をビルドできませんでした:`, err.message ?? err);
    process.exitCode = 1;
  }
}
