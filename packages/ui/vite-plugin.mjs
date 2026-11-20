// @ts-check
// 包みの public/（アイコンと字体）を、使う画面の /icons/・/fonts/ に出す Vite のプラグイン。
// 開発中はそのまま返し、組み立てでは出来上がりに同じ名前で入れる（Icon と styles/base.css が /icons/・/fonts/ を指すため）。
// 字体（fonts/*.css と、それが指す woff2）は、組み立てで名前に中身の印を付けた写しも assets/ に入れ、HTML の <link> をそちらへ向ける。
// サーバーは assets/ の下を1年覚えさせるので、リロードのたびに字体を問い合わせずに済む（同じ名前の /fonts/ も前のまま残す）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("./public/", import.meta.url));

const TYPES = { ".svg": "image/svg+xml", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** @returns {import("vite").Plugin} */
export function uiAssets() {
  return {
    name: "home-dashboard-ui-assets",
    // 画面の HTML が出来上がってから、その中の字体の <link> を書き換える
    enforce: "post",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0]);
        if (!url.startsWith("/icons/") && !url.startsWith("/fonts/")) return next();
        const path = join(PUBLIC, url);
        if (!path.startsWith(PUBLIC)) return next();
        try {
          const body = readFileSync(path);
          res.setHeader("Content-Type", TYPES[extname(path)] ?? "application/octet-stream");
          res.end(body);
        } catch {
          next();
        }
      });
    },
    generateBundle(_options, bundle) {
      for (const path of files(PUBLIC)) {
        this.emitFile({ type: "asset", fileName: relative(PUBLIC, path).split(sep).join("/"), source: readFileSync(path) });
      }
      // 字体の CSS ごとに、印付きの写し（assets/<名前>-<印>.css と、その中の woff2）を作る
      /** @type {Map<string, string>} */
      const hashedCss = new Map();
      const fontDir = join(PUBLIC, "fonts");
      for (const name of readdirSync(fontDir).filter((n) => n.endsWith(".css"))) {
        const css = readFileSync(join(fontDir, name), "utf8").replace(/url\((["']?)\/fonts\/([^"')]+)\1\)/g, (_m, q, rel) => {
          const ref = this.emitFile({ type: "asset", name: basename(rel), source: readFileSync(join(fontDir, rel)) });
          return `url(${q}/${this.getFileName(ref)}${q})`;
        });
        const ref = this.emitFile({ type: "asset", name, source: css });
        hashedCss.set(`/fonts/${name}`, `/${this.getFileName(ref)}`);
      }
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".html")) continue;
        let html = String(file.source);
        for (const [from, to] of hashedCss) html = html.replaceAll(`href="${from}"`, `href="${to}"`);
        file.source = html;
      }
    },
  };
}
