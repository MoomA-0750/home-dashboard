import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { waveProvider, waveSettings } from "./wave";

// 偽の wave-api。受けた頼みを覚えておき、決まった答えを返す
const requests: Array<{ method: string; url: string; auth: string | undefined; body: unknown }> = [];
const track = {
  videoId: "abc_DEF-123",
  title: "群青",
  artist: "YOASOBI",
  album: "THE BOOK",
  artUrl: "https://example.com/a.jpg",
  durationMs: 248000,
  isLive: false,
};
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    requests.push({
      method: req.method!,
      url: req.url!,
      auth: req.headers.authorization,
      body: raw ? JSON.parse(raw) : null,
    });
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== "Bearer secret") return send(401, { error: "token_required" });
    switch (`${req.method} ${req.url}`) {
      case "GET /v1/playback":
        return send(200, {
          joined: true,
          loggedIn: true,
          isPlaying: true,
          repeat: "off",
          track,
          progressMs: 1000,
          observedAt: "2026-10-19T00:00:00.000Z",
          device: { id: "d1", name: "Pixel 3", kind: "android", online: true, active: true },
          volumePercent: 40,
        });
      case "GET /v1/playlists":
        return send(200, [{ id: "PL1", name: "通勤", subtitle: "プレイリスト", artUrl: null }]);
      case "GET /v1/suggestions":
        return send(200, [
          { title: "おすすめ", tracks: [track], playlists: [] },
          { title: "空の棚", tracks: [], playlists: [{ id: "PL2", name: "x", subtitle: null, artUrl: null }] },
        ]);
      case "POST /v1/control":
        return send(409, { error: "not_sent" });
      case "POST /v1/queue/jump":
        return JSON.parse(raw).videoId === "moved" ? send(404, { error: "not_found" }) : send(200, { ok: true });
      default:
        return send(200, { ok: true });
    }
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => server.close());

test("トークンが無ければ未接続として返し、wave-api を呼ばない", async () => {
  waveSettings.current = { url, token: "" };
  const playback = await waveProvider.getPlayback();
  assert.equal(playback.configured, false);
  assert.equal(requests.length, 0);
});

test("再生中の曲を Media 画面の形に直す（videoId を uri に、シャッフル・繰り返しはできない）", async () => {
  waveSettings.current = { url, token: "secret" };
  const playback = await waveProvider.getPlayback();
  assert.equal(playback.provider, "wave");
  assert.equal(playback.track?.uri, "abc_DEF-123");
  assert.equal(playback.deviceName, "Pixel 3");
  assert.deepEqual(playback.capabilities, { shuffle: false, repeat: false });
  assert.equal(requests.at(-1)?.auth, "Bearer secret");
});

test("プレイリストの頭に「高く評価した曲」を足し、空の棚はおすすめに出さない", async () => {
  waveSettings.current = { url, token: "secret" };
  const playlists = await waveProvider.getPlaylists();
  assert.deepEqual(
    playlists.map((p) => p.id),
    ["LM", "PL1"],
  );
  const groups = await waveProvider.getSuggestions(null);
  assert.deepEqual(
    groups.map((g) => g.title),
    ["おすすめ"],
  );
});

test("鳴らす・キューに足すは wave-api の形で頼む", async () => {
  waveSettings.current = { url, token: "secret" };
  await waveProvider.play({ contextUri: "PL1", offsetUri: "abc_DEF-123" });
  assert.deepEqual(requests.at(-1)?.body, { playlistId: "PL1", startVideoId: "abc_DEF-123" });
  await waveProvider.play({ trackUri: "abc_DEF-123" });
  assert.deepEqual(requests.at(-1)?.body, { videoId: "abc_DEF-123" });
  await waveProvider.addToQueue("abc_DEF-123");
  assert.deepEqual(requests.at(-1)?.body, { videoIds: ["abc_DEF-123"], next: false });
  await assert.rejects(waveProvider.play({ trackUri: "../admin/pair" }), /invalid video id/);
});

test("wave-api の失敗は、理由の分かる文と状態コードにする", async () => {
  waveSettings.current = { url, token: "secret" };
  await assert.rejects(waveProvider.control("next"), (err: Error & { statusCode?: number }) => {
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /鳴っている wave の端末がありません/);
    return true;
  });
  await assert.rejects(waveProvider.control("shuffle"), /wave ではこの操作はできません/);
  waveSettings.current = { url, token: "wrong" };
  await assert.rejects(waveProvider.getQueue(), /トークンが通りません/);
});

test("「次に再生」の曲へは、何番目かと曲の id を添えて1回で飛ぶ。キューが動いていたら理由を返す", async () => {
  waveSettings.current = { url, token: "secret" };
  await waveProvider.skipTo!(2, "abc_DEF-123");
  assert.equal(requests.at(-1)?.url, "/v1/queue/jump");
  assert.deepEqual(requests.at(-1)?.body, { index: 2, videoId: "abc_DEF-123" });
  await assert.rejects(waveProvider.skipTo!(3, "moved"), /キューが変わったので飛べませんでした/);
});
