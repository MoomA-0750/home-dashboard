# 引き継ぎ（今の状態）

更新: 2026-11-20

## 目的

Web UI のリロードを速くする（静的ファイルのキャッシュと圧縮を整える）。本人の依頼（2026-11-20、取りまとめ役のセッション経由）。

## どこまでできたか

- `apps/server/src/staticFiles.ts` に静的ファイルの配り方をまとめた（`index.ts` から呼ぶ）
  - `/assets/` の下（Vite が名前に中身の印を付けたものだけ）: `public, max-age=31536000, immutable`
  - それ以外（index.html・sw.js・manifest・アイコン・壁紙・`/fonts/` など）: `no-cache`＋ETag・Last-Modified（304 で返る）
  - 文字のファイルは組み立てのときに作った `.br`・`.gz` を `@fastify/static` の `preCompressed` で返す。`Vary: Accept-Encoding` を付ける
- `apps/web/precompress.mjs`（Vite のプラグイン）: 組み立ての最後に、1KB 以上の html・js・css・json・webmanifest・svg・txt・xml の横に `.br`（品質11）と `.gz`（9）を置く
- `packages/ui/vite-plugin.mjs`: 字体の CSS（`fonts/murecho.css`）と woff2 の、印付きの写しを `assets/` に入れ、HTML の `<link>` をそちらへ向ける（前の `/fonts/` も残す）
- 拡張機能の画面のファイル（`/api/extensions/:id/files/*`）も、ETag で 304、1KB 以上の文字のファイルはその場で br/gzip に縮める（覚えておく）。Cache-Control は前のまま（`?v=` 付きは immutable、無ければ no-cache）
- API・認証の返事は触っていない。もともとアプリはセキュリティのヘッダー（CSP など）を付けておらず、付いているのは拡張機能の返すファイルの `X-Content-Type-Options` だけで、そのまま
- 試験: `apps/server/src/staticFiles.test.ts`（8件）。全体の試験 202件・typecheck・lint:style・kasane の検査・kasane-sync --check は通った
- 測った値は `docs/decisions.md` の「静的ファイルのキャッシュと圧縮」

## 残り

- 本番への反映（push とコンテナの作り直し）。本人の確認待ち

## 次のセッションが最初にやること

- 本人が反映を了承したら: `git push`、それから `docker compose up -d --build home-dashboard`。反映の後に
  `curl -sI -H 'Accept-Encoding: br' http://127.0.0.1:8787/` などで `Cache-Control: no-cache`・`content-encoding: br` を確かめる

## 本人の判断待ち

- push と本番への反映をしてよいか（phase-board の確認一覧にも記録）

## 注意

- 反映の直後、すでに開いている端末は前の HTML を持っているので、一度だけ全部を読み直す（次からは JS・CSS・字体を問い合わせない）
- `/assets/` には印の無いファイルを置かない（1年覚えさせるため）。Vite の既定の名前（`[name]-[hash]`）のままにする
- アイコン（`/icons/*.svg`）は実行時に名前から URL を作るので印が付けられず、no-cache のまま（リロードで小さな 304 が出る）
- LAN の https の入口（Caddy）は `encode zstd gzip` を持つが、アプリがすでに縮めた返事はそのまま通す

## 詳しい資料

- `docs/decisions.md`（決めたことと測った値）
