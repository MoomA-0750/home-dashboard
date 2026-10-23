import { HttpError, type FeatureProvider } from "@home-dashboard/extension-sdk";
import type { MusicPlayback, MusicProvider } from "./types";

/**
 * 音声アシスタントの音楽の操作。音楽アプリごとにツールを持たず、入っている音楽アプリ（機能の口「music」）をまとめて扱う。
 * 音楽アプリを言われなければ、いま鳴っているものを操作する
 */

type Providers = FeatureProvider<MusicProvider>[];

/** 名前か拡張機能の id で、音楽アプリを探す（大文字小文字は見ない） */
export function findProvider(providers: Providers, app: string): FeatureProvider<MusicProvider> {
  const wanted = app.trim().toLowerCase();
  const found = providers.find((p) => p.extensionId === wanted || p.name.toLowerCase() === wanted);
  if (!found) throw new HttpError(404, `「${app}」という音楽アプリは入っていません（${names(providers)}）`);
  return found;
}

export const names = (providers: Providers) => providers.map((p) => p.name).join("・") || "なし";

async function playbackOf(provider: FeatureProvider<MusicProvider>): Promise<MusicPlayback | null> {
  return provider.implementation.getPlayback().catch(() => null);
}

/** 操作する音楽アプリ。言われたものか、いま鳴っているもの。どれも鳴っていなければ、設定してある最初のもの */
export async function pickProvider(providers: Providers, app?: string): Promise<FeatureProvider<MusicProvider>> {
  if (app) return findProvider(providers, app);
  if (providers.length === 0) throw new HttpError(409, "音楽アプリが入っていません");
  const playbacks = await Promise.all(providers.map(playbackOf));
  const index =
    playbacks.findIndex((p) => p?.isPlaying) >= 0
      ? playbacks.findIndex((p) => p?.isPlaying)
      : Math.max(0, playbacks.findIndex((p) => p?.configured));
  return providers[index];
}

/** 再生中の曲。音楽アプリを言われなければ、入っているものすべて */
export async function nowPlaying(providers: Providers, app?: string) {
  const targets = app ? [findProvider(providers, app)] : providers;
  return Promise.all(
    targets.map(async (provider) => {
      const playback = await playbackOf(provider);
      const track = playback?.track && { name: playback.track.title, artist: playback.track.artist };
      return {
        app: provider.name,
        configured: playback?.configured ?? false,
        isPlaying: playback?.isPlaying ?? false,
        track: track ?? null,
        device: playback?.deviceName ?? null,
      };
    }),
  );
}
