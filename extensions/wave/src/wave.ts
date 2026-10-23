import { HttpError, type SettingValue } from "@home-dashboard/extension-sdk";
import type {
  MusicAction,
  MusicDevice,
  MusicPlayback,
  MusicPlaylist,
  MusicProvider,
  MusicSuggestionGroup,
  MusicTrack,
} from "@home-dashboard/ext-media/types";
import { localizedError, messages, type MessageKey } from "./messages";

/**
 * wave（自作の YouTube Music クライアント）を Media 画面の音楽アプリとして使う提供元。
 * wave-api（wave の中継と同じ機械で常駐する、ほかのアプリ向けの HTTP の口。wave の docs/wave-api.md）を呼ぶ。
 * - 曲の識別子は YouTube の videoId、プレイリストは playlistId（高く評価した曲は "LM"）
 * - シャッフル・繰り返しは wave の連携の取り決めに無い（画面にボタンを出さない）
 * - 鳴らす・操作は、家の端末（スマホ・PC の wave）が中継につながっているときだけ効く
 */

/** 接続設定の今の値（server.ts の register で api.settings を入れる） */
export const waveSettings: { current: Record<string, SettingValue> } = { current: {} };

const TIMEOUT_MS = 10_000;
const LIKED_PLAYLIST_ID = "LM";
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

interface WaveTrack {
  videoId: string;
  title: string;
  artist: string;
  album: string | null;
  artUrl: string | null;
  durationMs: number | null;
  isLive: boolean;
}

interface WavePlayback {
  joined: boolean;
  loggedIn: boolean;
  isPlaying: boolean;
  repeat: "off" | "track" | "context";
  track: WaveTrack | null;
  progressMs: number | null;
  observedAt: string;
  device: { id: string; name: string } | null;
  volumePercent: number | null;
}

interface WavePlaylist {
  id: string;
  name: string;
  subtitle: string | null;
  artUrl: string | null;
}

/** wave-api の失敗の名前のうち、画面に出す文がある（./messages）もの */
const ERRORS = new Set<string>(["token_required", "login_required", "not_sent", "no_device", "unsupported", "not_found"]);

export function isConfigured(): boolean {
  return Boolean(waveSettings.current.url && waveSettings.current.token);
}

export async function waveFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = String(waveSettings.current.url ?? "").replace(/\/+$/, "");
  if (!isConfigured())
    throw localizedError(409, "notConfigured");
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${String(waveSettings.current.token)}`,
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw localizedError(502, "unreachable", { url });
  }
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    const name = body?.error ?? "";
    // 状態コードはそのまま返す（ただし 401 は「ログインが要る」と紛れないよう、ダッシュボードでは 409 にする）
    const status = res.status === 401 ? 409 : res.status;
    throw ERRORS.has(name)
      ? localizedError(status, name as MessageKey)
      : localizedError(status, "httpError", { status: res.status, name });
  }
  return body as T;
}

// 再生中の曲のアートワークは、wave-api が大きい絵で返す（一覧の絵は小さいまま）
function toTrack(track: WaveTrack): MusicTrack {
  return {
    uri: track.videoId,
    title: track.title,
    artist: track.artist,
    album: track.album ?? null,
    artUrl: track.artUrl ?? null,
    durationMs: track.durationMs ?? null,
  };
}

function toPlaylist(playlist: WavePlaylist): MusicPlaylist {
  return {
    id: playlist.id,
    uri: playlist.id,
    name: playlist.name,
    owner: playlist.subtitle ?? null,
    artUrl: playlist.artUrl ?? null,
    trackCount: null,
    browsable: true,
  };
}

function checkId(id: string | undefined, what: string): string {
  if (!id || !ID_PATTERN.test(id)) throw new HttpError(400, `invalid ${what}`);
  return id;
}

export const waveProvider: MusicProvider = {
  id: "wave",
  name: "wave",

  async getPlayback(): Promise<MusicPlayback> {
    const idle = (configured: boolean): MusicPlayback => ({
      configured,
      provider: "wave",
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      track: null,
      progressMs: null,
      observedAt: new Date().toISOString(),
      deviceName: null,
      volumePercent: null,
      capabilities: { shuffle: false, repeat: false },
    });
    if (!isConfigured()) return idle(false);
    const data = await waveFetch<WavePlayback>("/v1/playback");
    if (!data.track) return { ...idle(true), deviceName: data.device?.name ?? null };
    return {
      configured: true,
      provider: "wave",
      isPlaying: data.isPlaying,
      shuffle: false,
      repeat: data.repeat ?? "off",
      track: toTrack(data.track),
      progressMs: data.progressMs ?? null,
      observedAt: data.observedAt ?? new Date().toISOString(),
      deviceName: data.device?.name ?? null,
      volumePercent: data.volumePercent ?? null,
      capabilities: { shuffle: false, repeat: false },
    };
  },

  async getQueue() {
    return (await waveFetch<WaveTrack[]>("/v1/queue")).slice(0, 20).map(toTrack);
  },

  async getPlaylists(locale = "ja") {
    const playlists = (await waveFetch<WavePlaylist[]>("/v1/playlists")).map(toPlaylist);
    // 高く評価した曲は、ライブラリの一覧に無くても読める
    if (!playlists.some((playlist) => playlist.id === LIKED_PLAYLIST_ID)) {
      playlists.unshift({
        id: LIKED_PLAYLIST_ID,
        uri: LIKED_PLAYLIST_ID,
        name: messages.t(locale, "liked"),
        owner: null,
        artUrl: null,
        trackCount: null,
        browsable: true,
      });
    }
    return playlists;
  },

  async getPlaylistTracks(id) {
    checkId(id, "playlist id");
    return (await waveFetch<WaveTrack[]>(`/v1/playlists/${encodeURIComponent(id)}/tracks`)).map(toTrack);
  },

  // wave のホームの棚（YouTube Music のおすすめ）。棚の中のプレイリストは出さず、曲だけを並べる
  async getSuggestions(_seed, locale = "ja") {
    const shelves = await waveFetch<Array<{ title: string; tracks: WaveTrack[] }>>("/v1/suggestions");
    return shelves
      .filter((shelf) => shelf.tracks.length > 0)
      .map((shelf, index): MusicSuggestionGroup => ({
        id: `shelf-${index}`,
        title: shelf.title,
        note: messages.t(locale, "suggestionNote"),
        tracks: shelf.tracks.map(toTrack),
      }));
  },

  async control(action: MusicAction) {
    if (action === "shuffle" || action === "repeat") throw localizedError(400, "unsupported");
    await waveFetch("/v1/control", { method: "POST", body: { action } });
  },

  // 画面は Spotify と同じ形で頼む: contextUri = プレイリスト、offsetUri = その中の始める曲、trackUri = 曲（その曲からのラジオ）
  async play(target) {
    if (target.contextUri) {
      const body: Record<string, string> = { playlistId: checkId(target.contextUri, "playlist id") };
      if (target.offsetUri) body.startVideoId = checkId(target.offsetUri, "video id");
      await waveFetch("/v1/play", { method: "POST", body });
    } else if (target.trackUri) {
      await waveFetch("/v1/play", { method: "POST", body: { videoId: checkId(target.trackUri, "video id") } });
    } else {
      throw new HttpError(400, "nothing to play");
    }
  },

  // wave-api 自身（音を出さない「wave API」）は除く
  async getDevices() {
    const devices =
      await waveFetch<
        Array<{ id: string; name: string; kind: string | null; online: boolean; active: boolean; self: boolean }>
      >("/v1/devices");
    return devices
      .filter((device) => !device.self)
      .map((device): MusicDevice => ({
        id: device.id,
        name: device.name,
        kind: device.kind ?? null,
        active: device.active,
        online: device.online,
      }));
  },

  async transfer(deviceId) {
    await waveFetch("/v1/transfer", { method: "POST", body: { deviceId: checkId(deviceId, "device id") } });
  },

  // 「次に再生」の index 番目へ1回で飛ぶ。videoId も添え、読んだ後にキューが動いていたら違う曲へは飛ばない
  async skipTo(index, trackUri) {
    try {
      await waveFetch("/v1/queue/jump", { method: "POST", body: { index, videoId: checkId(trackUri, "video id") } });
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404)
        throw localizedError(409, "queueMoved");
      throw err;
    }
  },

  async seek(positionMs) {
    await waveFetch("/v1/control", { method: "POST", body: { action: "seek", positionMs } });
  },

  async addToQueue(trackUri) {
    await waveFetch("/v1/queue", { method: "POST", body: { videoIds: [checkId(trackUri, "video id")], next: false } });
  },
};
