import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib";
import Fastify from "fastify";
import { IMMUTABLE, pickEncoding, registerStaticFiles, sendLocalFile } from "./staticFiles.js";

const root = await mkdtemp(join(tmpdir(), "static-"));
after(() => rm(root, { recursive: true, force: true }));
const js = "console.log('hello');\n".repeat(200);
const html = `<!doctype html><title>t</title>${"<p>x</p>".repeat(300)}`;
await mkdir(join(root, "dist", "assets"), { recursive: true });
await writeFile(join(root, "dist", "assets", "index-abc123.js"), js);
await writeFile(join(root, "dist", "assets", "index-abc123.js.br"), brotliCompressSync(js));
await writeFile(join(root, "dist", "assets", "index-abc123.js.gz"), gzipSync(js));
await writeFile(join(root, "dist", "index.html"), html);
await writeFile(join(root, "dist", "index.html.br"), brotliCompressSync(html));
await writeFile(join(root, "dist", "index.html.gz"), gzipSync(html));
await writeFile(join(root, "dist", "background.jpg"), Buffer.alloc(4096, 1));
await writeFile(join(root, "web.js"), js);
await writeFile(join(root, "small.css"), "a{}");

async function makeApp() {
  const app = Fastify();
  await registerStaticFiles(app, join(root, "dist"));
  app.setNotFoundHandler((request, reply) => reply.sendFile("index.html"));
  app.get("/ext/web.js", (request, reply) => sendLocalFile(request, reply, join(root, "web.js"), "text/javascript"));
  app.get("/ext/small.css", (request, reply) => sendLocalFile(request, reply, join(root, "small.css"), "text/css"));
  return app;
}

test("印の付いた /assets/ は1年覚えさせ、br を受け取れる端末には br を返す", async () => {
  const app = await makeApp();
  const res = await app.inject({ url: "/assets/index-abc123.js", headers: { "accept-encoding": "gzip, deflate, br" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], IMMUTABLE);
  assert.equal(res.headers["content-encoding"], "br");
  assert.equal(res.headers["vary"], "Accept-Encoding");
  assert.match(String(res.headers["content-type"]), /javascript/);
  assert.equal(brotliDecompressSync(res.rawPayload).toString(), js);
});

test("gzip だけの端末には gzip、どれも受け取れなければ元のまま", async () => {
  const app = await makeApp();
  const gz = await app.inject({ url: "/assets/index-abc123.js", headers: { "accept-encoding": "gzip" } });
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.equal(gunzipSync(gz.rawPayload).toString(), js);
  const plain = await app.inject({ url: "/assets/index-abc123.js", headers: { "accept-encoding": "identity" } });
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.body, js);
});

test("HTML は no-cache で、ETag を返せば 304", async () => {
  const app = await makeApp();
  const first = await app.inject({ url: "/", headers: { "accept-encoding": "br" } });
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["cache-control"], "no-cache");
  assert.equal(first.headers["content-encoding"], "br");
  assert.ok(first.headers["etag"]);
  assert.ok(first.headers["last-modified"]);
  const again = await app.inject({
    url: "/",
    headers: { "accept-encoding": "br", "if-none-match": String(first.headers["etag"]) },
  });
  assert.equal(again.statusCode, 304);
  assert.equal(again.body, "");
});

test("画面の道（SPA の行き先）にも index.html を no-cache で返す", async () => {
  const app = await makeApp();
  const res = await app.inject({ url: "/settings", headers: { "accept-encoding": "gzip" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], "no-cache");
  assert.equal(gunzipSync(res.rawPayload).toString(), html);
});

test("印の無い画像は no-cache＋ETag で、縮めない", async () => {
  const app = await makeApp();
  const res = await app.inject({ url: "/background.jpg", headers: { "accept-encoding": "br" } });
  assert.equal(res.headers["cache-control"], "no-cache");
  assert.equal(res.headers["content-encoding"], undefined);
  assert.equal(res.headers["vary"], undefined);
  assert.ok(res.headers["etag"]);
});

test("dist の外のファイル（拡張機能の web.js）も、縮めて ETag で 304 を返す", async () => {
  const app = await makeApp();
  const br = await app.inject({ url: "/ext/web.js", headers: { "accept-encoding": "gzip, br" } });
  assert.equal(br.statusCode, 200);
  assert.equal(br.headers["content-encoding"], "br");
  assert.equal(br.headers["vary"], "Accept-Encoding");
  assert.equal(brotliDecompressSync(br.rawPayload).toString(), js);
  const gz = await app.inject({ url: "/ext/web.js", headers: { "accept-encoding": "gzip" } });
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.notEqual(gz.headers["etag"], br.headers["etag"]);
  const again = await app.inject({
    url: "/ext/web.js",
    headers: { "accept-encoding": "gzip, br", "if-none-match": String(br.headers["etag"]) },
  });
  assert.equal(again.statusCode, 304);
  const plain = await app.inject({ url: "/ext/web.js" });
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.body, js);
});

test("1KB より小さいものは縮めない", async () => {
  const app = await makeApp();
  const res = await app.inject({ url: "/ext/small.css", headers: { "accept-encoding": "br" } });
  assert.equal(res.headers["content-encoding"], undefined);
  assert.equal(res.body, "a{}");
});

test("Accept-Encoding の読み方（q=0 は断り、* は何でも）", () => {
  assert.equal(pickEncoding("gzip, deflate, br, zstd"), "br");
  assert.equal(pickEncoding("br;q=0, gzip"), "gzip");
  assert.equal(pickEncoding("*"), "br");
  assert.equal(pickEncoding("identity"), null);
  assert.equal(pickEncoding(undefined), null);
});
