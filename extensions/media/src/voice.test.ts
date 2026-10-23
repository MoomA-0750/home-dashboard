import { test } from "node:test";
import assert from "node:assert/strict";
import type { FeatureProvider } from "@home-dashboard/extension-sdk";
import type { MusicPlayback, MusicProvider } from "./types";
import { nowPlaying, pickProvider } from "./voice";

function provider(extensionId: string, name: string, playback: Partial<MusicPlayback> | Error) {
  const implementation = {
    getPlayback: async () => {
      if (playback instanceof Error) throw playback;
      return { configured: true, isPlaying: false, track: null, deviceName: null, ...playback } as MusicPlayback;
    },
  } as unknown as MusicProvider;
  return { extensionId, name, implementation } satisfies FeatureProvider<MusicProvider>;
}

const track = { uri: "u", title: "曲", artist: "歌手", album: null, artUrl: null, durationMs: null };

test("音楽アプリを言われなければ、いま鳴っているものを操作する", async () => {
  const providers = [provider("wave", "wave", {}), provider("spotify", "Spotify", { isPlaying: true })];
  assert.equal((await pickProvider(providers)).extensionId, "spotify");
});

test("どれも鳴っていなければ、設定してある最初のもの。読めないものは飛ばす", async () => {
  const providers = [
    provider("wave", "wave", new Error("つながりません")),
    provider("spotify", "Spotify", { configured: true }),
  ];
  assert.equal((await pickProvider(providers)).extensionId, "spotify");
});

test("名前か id で選べ（大文字小文字は見ない）、無い名前は理由を返す", async () => {
  const providers = [provider("wave", "wave", {}), provider("spotify", "Spotify", {})];
  assert.equal((await pickProvider(providers, "spotify")).name, "Spotify");
  assert.equal((await pickProvider(providers, "WAVE")).extensionId, "wave");
  await assert.rejects(pickProvider(providers, "apple music"), /入っていません（wave・Spotify）/);
  await assert.rejects(pickProvider([]), /音楽アプリが入っていません/);
});

test("再生中の曲は、言われなければすべての音楽アプリの分を返す", async () => {
  const providers = [
    provider("wave", "wave", { isPlaying: true, track, deviceName: "スマホ" }),
    provider("spotify", "Spotify", new Error("x")),
  ];
  assert.deepEqual(await nowPlaying(providers), [
    { app: "wave", configured: true, isPlaying: true, track: { name: "曲", artist: "歌手" }, device: "スマホ" },
    { app: "Spotify", configured: false, isPlaying: false, track: null, device: null },
  ]);
  assert.equal((await nowPlaying(providers, "Spotify")).length, 1);
});
