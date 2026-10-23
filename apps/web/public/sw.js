// Home Dashboard の service worker。PWA としてインストールできるようにするためのもので、中身は覚えない
// （画面も API もいつも最新を読む。ログインの cookie や家電の状態を古いまま見せないため）。
// サーバーにつながらないときだけ、ページの代わりに「つながりません」を出す。
const OFFLINE_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Home Dashboard</title>
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#071226;color:#e0f7ff;
font-family:system-ui,sans-serif}p{opacity:.8}</style></head><body><div><h1>つながりません</h1>
<p>ダッシュボードのサーバーに届きません。少し待ってから開き直してください。</p></div>
<script>setTimeout(() => location.reload(), 15000)</script></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // ページを開くときだけ受け持つ。ほかは何もしない（ブラウザがそのまま読む）
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
