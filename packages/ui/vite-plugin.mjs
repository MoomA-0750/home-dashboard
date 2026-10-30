// @ts-check
// 包みの public/（アイコンと字体）を、使う画面の /icons/・/fonts/ に出す Vite のプラグイン。
// 開発中はそのまま返し、組み立てでは出来上がりに同じ名前で入れる（theme.css と Icon が /icons/・/fonts/ を指すため）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
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
    generateBundle() {
      for (const path of files(PUBLIC)) {
        this.emitFile({ type: "asset", fileName: relative(PUBLIC, path).split(sep).join("/"), source: readFileSync(path) });
      }
    },
  };
}
