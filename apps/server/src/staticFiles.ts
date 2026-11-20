import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, relative, sep } from "node:path";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";

/**
 * 画面の静的ファイル（apps/web/dist）の配り方。
 *
 * - /assets/ の下は Vite が名前に中身の印（hash）を付けたものだけなので、1年覚えてよい（中身が変われば名前が変わる）
 * - それ以外（index.html・sw.js・manifest・アイコン・壁紙など）は no-cache。ETag と Last-Modified で、変わっていなければ 304
 * - 文字のファイルは、組み立てのときに作った .br・.gz（apps/web/vite.config.ts の precompress）を、受け取れる端末に返す
 *   （tailscale serve は圧縮しないので、アプリの側で縮める）
 */
export const IMMUTABLE = "public, max-age=31536000, immutable";
export const REVALIDATE = "no-cache";

/** 縮める文字のファイル。apps/web/precompress.mjs の一覧と合わせる */
export const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".txt", ".xml"]);
/** これより小さいものは縮めない（縮めても速くならない） */
export const COMPRESS_MIN_BYTES = 1024;

const PRECOMPRESSED_SUFFIX = /\.(br|gz)$/;

/** 配る道（dist からの相対、/ 区切り）ごとの Cache-Control */
export function cacheControlFor(path: string): string {
  return path.startsWith("assets/") ? IMMUTABLE : REVALIDATE;
}

export async function registerStaticFiles(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, {
    root,
    // .br・.gz があればそれを返す（Accept-Encoding で選ぶ）。無ければ元のファイル
    preCompressed: true,
    // Cache-Control は下の setHeaders で道ごとに決める（既定の public, max-age=0 は使わない）
    cacheControl: false,
    setHeaders(res, path) {
      const original = path.replace(PRECOMPRESSED_SUFFIX, "");
      const rel = relative(root, original).split(sep).join("/");
      res.setHeader("Cache-Control", cacheControlFor(rel));
      // 同じ URL でも Accept-Encoding で中身が変わるので、手前のキャッシュに知らせる
      if (COMPRESSIBLE.has(extname(original).toLowerCase())) res.setHeader("Vary", "Accept-Encoding");
    },
  });
}

/** 受け取れる圧縮のうち、いちばん縮むもの（br → gzip）。どれも受け取れなければ null */
export function pickEncoding(acceptEncoding: string | string[] | undefined): "br" | "gzip" | null {
  const header = [acceptEncoding ?? ""].flat().join(",").toLowerCase();
  const accepted = new Map<string, number>();
  for (const part of header.split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (!name) continue;
    const q = params.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1]).find((v) => v !== undefined);
    accepted.set(name.trim(), q === undefined ? 1 : Number(q));
  }
  const ok = (name: string) => (accepted.get(name) ?? accepted.get("*") ?? 0) > 0;
  if (ok("br")) return "br";
  if (ok("gzip")) return "gzip";
  return null;
}

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** 縮めた中身の覚え。ファイルの大きさと更新時刻が変われば作り直す（拡張機能の入れ替えで変わる） */
const compressedCache = new Map<string, { key: string; body: Buffer }>();
const COMPRESSED_CACHE_MAX = 200;

async function compressedBody(path: string, key: string, encoding: "br" | "gzip"): Promise<Buffer> {
  const cacheKey = `${encoding}:${path}`;
  const hit = compressedCache.get(cacheKey);
  if (hit?.key === key) return hit.body;
  const raw = await readFile(path);
  const body =
    encoding === "br"
      ? await brotli(raw, {
          params: {
            // その場で縮めるので、いちばん強い 11 ではなく速い 9 にする（縮み方はほとんど変わらない）
            [zlibConstants.BROTLI_PARAM_QUALITY]: 9,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
          },
        })
      : await gzipAsync(raw, { level: 9 });
  if (compressedCache.size >= COMPRESSED_CACHE_MAX) compressedCache.delete(compressedCache.keys().next().value!);
  compressedCache.set(cacheKey, { key, body });
  return body;
}

/**
 * 手元のファイルを1つ返す（拡張機能の web.js など、dist の外にあって @fastify/static を通さないもの）。
 * ETag・Last-Modified を付けて 304 で返せるようにし、1KB 以上の文字のファイルは縮めて返す。Cache-Control は呼ぶ側が決める
 */
export async function sendLocalFile(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
  contentType: string,
): Promise<FastifyReply> {
  const info = await stat(path);
  const key = `${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}`;
  const compressible = COMPRESSIBLE.has(extname(path).toLowerCase()) && info.size >= COMPRESS_MIN_BYTES;
  const encoding = compressible ? pickEncoding(request.headers["accept-encoding"]) : null;
  // 縮め方ごとに別の ETag にする（中身のバイト列が違うため）
  const etag = `W/"${key}${encoding ? `-${encoding}` : ""}"`;
  reply.header("ETag", etag).header("Last-Modified", info.mtime.toUTCString());
  if (compressible) reply.header("Vary", "Accept-Encoding");
  if (isFresh(request, etag, info.mtime)) return reply.code(304).send();
  reply.type(contentType);
  if (!encoding) return reply.send(createReadStream(path));
  const body = await compressedBody(path, key, encoding);
  return reply.header("Content-Encoding", encoding).send(body);
}

function isFresh(request: FastifyRequest, etag: string, mtime: Date): boolean {
  const ifNoneMatch = request.headers["if-none-match"];
  if (ifNoneMatch) return ifNoneMatch.split(",").some((tag) => tag.trim() === etag || tag.trim() === "*");
  const ifModifiedSince = request.headers["if-modified-since"];
  if (!ifModifiedSince) return false;
  const since = Date.parse(ifModifiedSince);
  return !Number.isNaN(since) && Math.floor(mtime.getTime() / 1000) * 1000 <= since;
}
