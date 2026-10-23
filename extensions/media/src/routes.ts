import {
  defineServerMessages,
  HttpError,
  type Locale,
  type RouteHandler,
  type ServerExtensionApi,
} from "@home-dashboard/extension-sdk";
import { findLyrics } from "./lyrics";
import type { LocalizedReason, MusicAction, MusicProvider } from "./types";

/**
 * Media 画面の道。画面（./MediaScreen）はこの道だけを見る。歌詞は提供元に依らず LRCLIB から引く
 */

const MEDIA_ACTIONS: MusicAction[] = ["play", "pause", "next", "previous", "shuffle", "repeat"];
/** 「次に再生」で飛べるのは、画面に出している先頭の数曲まで */
const MAX_SKIP_INDEX = 19;
/** 「次の曲」を続けて送るときの間。続けて送ると、鳴らしている端末が取りこぼすことがある */
export const SKIP_INTERVAL_MS = 300;

const messages = defineServerMessages({
  ja: { notInstalled: "その音楽アプリは入っていません" },
  en: { notInstalled: "That music app isn't installed" },
});

/** 提供元が言語ごとの理由（localized）を付けて投げたエラーなら、画面の言語の文にする */
function localizeError(err: unknown, locale: Locale): unknown {
  const localized = (err as { localized?: Partial<LocalizedReason> } | null)?.localized;
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  const text = localized?.[locale];
  return typeof status === "number" && typeof text === "string" ? new HttpError(status, text) : err;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 「次に再生」の index 番目の曲へ飛ぶ。提供元が飛ぶための口（skipTo）を持っていればそれを使い、
 * 無ければ「次の曲」を index+1 回送る（どの提供元にも「キューのこの曲へ」の口が無いため）
 */
export async function skipToQueueItem(
  provider: MusicProvider,
  index: number,
  trackUri: string,
  intervalMs = SKIP_INTERVAL_MS,
) {
  if (!Number.isInteger(index) || index < 0 || index > MAX_SKIP_INDEX) throw new HttpError(400, "invalid index");
  if (provider.skipTo) return provider.skipTo(index, trackUri);
  for (let i = 0; i <= index; i += 1) {
    if (i > 0) await wait(intervalMs);
    await provider.control("next");
  }
}

/** 入っている音楽アプリの中から、道の :provider（拡張機能の id）のものを探す */
function providerOf(api: ServerExtensionApi, id: string, locale: Locale): MusicProvider {
  const found = api.providers<MusicProvider>("music").find((p) => p.extensionId === id);
  if (!found) throw new HttpError(404, messages.t(locale, "notInstalled"));
  return found.implementation;
}

/**
 * Media 画面の道（/api/ext/media/providers/<音楽アプリの拡張機能の id>/*）。音楽アプリの拡張機能（wave・Spotify）は
 * 機能の口「music」に MusicProvider を渡すだけで、道はここが持つ
 */
export function registerMediaRoutes(api: ServerExtensionApi): void {
  const route = (
    method: "GET" | "POST",
    path: string,
    handler: (provider: MusicProvider, ctx: Parameters<RouteHandler>[0]) => unknown,
  ) =>
    api.route(method, `/providers/:provider${path}`, async (ctx) => {
      try {
        return await handler(providerOf(api, ctx.params.provider, ctx.locale), ctx);
      } catch (err) {
        throw localizeError(err, ctx.locale);
      }
    });

  route("GET", "/playback", (provider) => provider.getPlayback());
  route("GET", "/queue", async (provider) => ({ tracks: await provider.getQueue() }));
  route("GET", "/playlists", async (provider, { locale }) => ({ playlists: await provider.getPlaylists(locale) }));
  route("GET", "/playlists/:id/tracks", async (provider, { params }) => ({
    tracks: await provider.getPlaylistTracks(params.id),
  }));
  // おすすめは今の曲を手がかりにする（無ければ「よく聴く曲」などだけ）
  route("GET", "/suggestions", async (provider, { locale }) => {
    const playback = await provider.getPlayback().catch(() => null);
    return { groups: await provider.getSuggestions(playback?.track ?? null, locale) };
  });
  route("GET", "/lyrics", (_provider, { query }) => {
    const { title, artist, album, durationMs } = query;
    if (!title || !artist) throw new HttpError(400, "title and artist are required");
    const duration = Number(durationMs);
    return findLyrics({
      title: title.slice(0, 200),
      artist: artist.slice(0, 200),
      album: album ? album.slice(0, 200) : null,
      durationMs: Number.isFinite(duration) && duration > 0 ? duration : null,
    });
  });
  route("GET", "/devices", async (provider) => ({ devices: await provider.getDevices() }));
  route("POST", "/transfer", async (provider, { body }) => {
    const deviceId = (body as { deviceId?: unknown } | null)?.deviceId;
    if (typeof deviceId !== "string" || !/^[A-Za-z0-9_.:-]{1,200}$/.test(deviceId))
      throw new HttpError(400, "deviceId is required");
    await provider.transfer(deviceId);
    return { ok: true };
  });
  route("POST", "/queue/skip", async (provider, { body }) => {
    const { index, trackUri } = (body ?? {}) as { index?: unknown; trackUri?: unknown };
    if (typeof trackUri !== "string") throw new HttpError(400, "trackUri is required");
    await skipToQueueItem(provider, Number(index), trackUri);
    return { ok: true };
  });
  route("POST", "/seek", async (provider, { body }) => {
    const positionMs = Number((body as { positionMs?: unknown } | null)?.positionMs);
    // 曲の長さは提供元しか知らないので、ここでは負でない整数で、半日より短いことだけを確かめる
    if (!Number.isFinite(positionMs) || positionMs < 0 || positionMs > 12 * 60 * 60 * 1000)
      throw new HttpError(400, "invalid positionMs");
    await provider.seek(Math.round(positionMs));
    return { ok: true };
  });
  route("POST", "/control", async (provider, { body }) => {
    const { action, state } = (body ?? {}) as { action?: MusicAction; state?: boolean | "off" | "track" | "context" };
    if (!action || !MEDIA_ACTIONS.includes(action)) throw new HttpError(400, "unknown action");
    await provider.control(action, state);
    return { ok: true };
  });
  route("POST", "/play", async (provider, { body }) => {
    await provider.play((body ?? {}) as { contextUri?: string; trackUri?: string; offsetUri?: string });
    return { ok: true };
  });
  route("POST", "/queue", async (provider, { body }) => {
    const trackUri = (body as { trackUri?: string } | null)?.trackUri;
    if (!trackUri) throw new HttpError(400, "trackUri is required");
    await provider.addToQueue(trackUri);
    return { ok: true };
  });
}
