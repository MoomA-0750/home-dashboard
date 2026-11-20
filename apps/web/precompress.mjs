// @ts-check
// 組み立てた画面の文字のファイル（1KB 以上）の横に、縮めた .br と .gz を置く Vite のプラグイン。
// サーバー（apps/server/src/staticFiles.ts）は、端末が受け取れればそれを返す。その場で縮めないので、非力なホストでも重くならない。
// 縮める種類と大きさの下限は staticFiles.ts の COMPRESSIBLE・COMPRESS_MIN_BYTES と合わせる。
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".txt", ".xml"]);
const MIN_BYTES = 1024;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** @returns {import("vite").Plugin} */
export function precompress() {
  /** @type {string} */
  let outDir = "dist";
  return {
    name: "home-dashboard-precompress",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      let count = 0;
      for (const path of files(outDir)) {
        if (!COMPRESSIBLE.has(extname(path).toLowerCase())) continue;
        const raw = readFileSync(path);
        if (raw.length < MIN_BYTES) continue;
        writeFileSync(
          `${path}.br`,
          brotliCompressSync(raw, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
              [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
              [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
            },
          }),
        );
        writeFileSync(`${path}.gz`, gzipSync(raw, { level: 9 }));
        count++;
      }
      this.info?.(`${count} 個のファイルに .br・.gz を作った`);
    },
  };
}
