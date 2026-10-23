import { HttpError } from "@home-dashboard/extension-sdk";
import { localizedError, messages } from "./messages";
import { controlSpotify, spotifyFetch, spotifySettings } from "./spotify";
import type {
  MusicPlayback,
  MusicPlaylist,
  MusicProvider,
  MusicSuggestionGroup,
  MusicTrack,
} from "@home-dashboard/ext-media/types";

/**
 * Spotify を Media 画面の「仮の音楽アプリ」として使う提供元。
 *
 * 2026年2〜3月の Spotify の変更で、開発モードのアプリは
 * - プレイリストの中身を読めるのが、自分のか共同編集のプレイリストだけになり、パスも /tracks → /items に変わった
 * - おすすめ（/recommendations）は、2024年11月以降に作ったアプリでは使えない
 * ので、おすすめは試して駄目なら「よく聴く曲」「最近聴いた曲」で代わりに並べる。
 */

interface SpotifyImage {
  url: string;
  width?: number | null;
}

interface SpotifyTrack {
  uri: string;
  name: string;
  type?: string;
  duration_ms?: number;
  artists?: { name: string }[];
  album?: { name: string; images?: SpotifyImage[] };
  /** ポッドキャストのエピソード */
  show?: { name: string; images?: SpotifyImage[] };
  images?: SpotifyImage[];
}

/** 一覧ではちょうどよい大きさ（300px 前後）の画像を選ぶ。無ければ最初のもの */
function pickImage(images: SpotifyImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const sized = images.filter((image) => image.width);
  const near = sized.sort((a, b) => Math.abs((a.width ?? 0) - 300) - Math.abs((b.width ?? 0) - 300))[0];
  return (near ?? images[0]).url;
}

export function toTrack(item: SpotifyTrack): MusicTrack {
  return {
    uri: item.uri,
    title: item.name,
    artist: item.artists?.map((artist) => artist.name).join(", ") || item.show?.name || "",
    album: item.album?.name ?? null,
    artUrl: pickImage(item.album?.images ?? item.images ?? item.show?.images),
    durationMs: item.duration_ms ?? null,
  };
}

async function readJson<T>(path: string): Promise<T | null> {
  const res = await spotifyFetch(path);
  if (!res) return null;
  if (res.status === 204) return null;
  if (!res.ok) throw new HttpError(502, `spotify error: ${res.status} (${path.split("?")[0]})`);
  return (await res.json()) as T;
}

function idFromUri(uri: string): string | null {
  const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri);
  return match ? match[1] : null;
}

const URI_PATTERN = /^spotify:(track|episode|playlist|album|artist):[A-Za-z0-9]+$/;

export const spotifyProvider: MusicProvider = {
  id: "spotify",
  name: "Spotify",

  async getPlayback(): Promise<MusicPlayback> {
    const observedAt = new Date().toISOString();
    const idle = (configured: boolean): MusicPlayback => ({
      configured,
      provider: "spotify",
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      track: null,
      progressMs: null,
      observedAt,
      deviceName: null,
      volumePercent: null,
    });
    if (!spotifySettings.current.refreshToken) return idle(false);

    const data = await readJson<{
      is_playing: boolean;
      shuffle_state: boolean;
      repeat_state: "off" | "track" | "context";
      progress_ms: number | null;
      item: SpotifyTrack | null;
      device?: { name?: string; volume_percent?: number | null };
    }>("me/player?additional_types=episode");
    if (!data || !data.item) return idle(true);

    return {
      configured: true,
      provider: "spotify",
      isPlaying: data.is_playing,
      shuffle: data.shuffle_state,
      repeat: data.repeat_state,
      track: { ...toTrack(data.item), artUrl: data.item.album?.images?.[0]?.url ?? toTrack(data.item).artUrl },
      progressMs: data.progress_ms,
      observedAt,
      deviceName: data.device?.name ?? null,
      volumePercent: data.device?.volume_percent ?? null,
    };
  },

  async getQueue() {
    const data = await readJson<{ queue: SpotifyTrack[] }>("me/player/queue");
    return (data?.queue ?? []).slice(0, 20).map(toTrack);
  },

  async getPlaylists() {
    const data = await readJson<{
      items: Array<{
        id: string;
        uri: string;
        name: string;
        owner?: { id?: string; display_name?: string };
        collaborative?: boolean;
        images?: SpotifyImage[] | null;
        // 2026年の変更で tracks → items に名前が変わった。両方を見る
        tracks?: { total?: number };
        items?: { total?: number };
      } | null>;
    }>("me/playlists?limit=50");
    const me = await readJson<{ id: string }>("me").catch(() => null);
    return (data?.items ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item): MusicPlaylist => ({
        id: item.id,
        uri: item.uri,
        name: item.name,
        owner: item.owner?.display_name ?? null,
        artUrl: pickImage(item.images ?? undefined),
        trackCount: item.items?.total ?? item.tracks?.total ?? null,
        browsable: Boolean(item.collaborative) || (me !== null && item.owner?.id === me.id),
      }));
  },

  async getPlaylistTracks(id: string) {
    if (!/^[A-Za-z0-9]+$/.test(id)) throw new HttpError(400, "invalid playlist id");
    const data = await readJson<{
      items: Array<{ item?: SpotifyTrack | null; track?: SpotifyTrack | null }>;
    }>(`playlists/${id}/items?limit=100&additional_types=episode`);
    return (data?.items ?? [])
      .map((entry) => entry.item ?? entry.track)
      .filter((track): track is SpotifyTrack => Boolean(track?.uri))
      .map(toTrack);
  },

  async getSuggestions(seed, locale = "ja") {
    const groups: MusicSuggestionGroup[] = [];
    const seedId = seed ? idFromUri(seed.uri) : null;

    if (seedId) {
      try {
        const data = await readJson<{ tracks: SpotifyTrack[] }>(`recommendations?limit=20&seed_tracks=${seedId}`);
        if (data?.tracks?.length) {
          groups.push({
            id: "recommendations",
            title: messages.t(locale, "similarTo", { title: seed!.title }),
            note: null,
            tracks: data.tracks.map(toTrack),
          });
        }
      } catch {
        // 新しいアプリでは使えない。下の代わりの並びだけにする
      }
    }

    const [top, recent] = await Promise.allSettled([
      readJson<{ items: SpotifyTrack[] }>("me/top/tracks?limit=20&time_range=short_term"),
      readJson<{ items: Array<{ track: SpotifyTrack }> }>("me/player/recently-played?limit=30"),
    ]);
    if (top.status === "fulfilled" && top.value?.items?.length) {
      groups.push({
        id: "top",
        title: messages.t(locale, "topTitle"),
        note: messages.t(locale, "topNote"),
        tracks: top.value.items.map(toTrack),
      });
    }
    if (recent.status === "fulfilled" && recent.value?.items?.length) {
      // 同じ曲を何度も聴いていると並びが埋まるので、1曲1回にする
      const seen = new Set<string>();
      const tracks = recent.value.items
        .map((entry) => toTrack(entry.track))
        .filter((track) => (seen.has(track.uri) ? false : (seen.add(track.uri), true)));
      groups.push({ id: "recent", title: messages.t(locale, "recentTitle"), note: null, tracks });
    }
    if (groups.length === 0) {
      const reason = [top, recent].find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
      if (reason instanceof HttpError) throw reason;
    }
    return groups;
  },

  control: (action, state) => controlSpotify(action, state),

  async play(target) {
    const body: Record<string, unknown> = {};
    if (target.contextUri) {
      if (!URI_PATTERN.test(target.contextUri)) throw new HttpError(400, "invalid uri");
      body.context_uri = target.contextUri;
      if (target.offsetUri) {
        if (!URI_PATTERN.test(target.offsetUri)) throw new HttpError(400, "invalid uri");
        body.offset = { uri: target.offsetUri };
      }
    } else if (target.trackUri) {
      if (!URI_PATTERN.test(target.trackUri)) throw new HttpError(400, "invalid uri");
      body.uris = [target.trackUri];
    } else {
      throw new HttpError(400, "nothing to play");
    }
    const res = await spotifyFetch("me/player/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (res.status === 404)
      throw localizedError(409, "noDevice");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify play error: ${res.status}`);
  },

  async seek(positionMs) {
    const res = await spotifyFetch(`me/player/seek?position_ms=${positionMs}`, { method: "PUT" });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (res.status === 404)
      throw localizedError(409, "noDevice");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify seek error: ${res.status}`);
  },

  async getDevices() {
    const data = await readJson<{
      devices: Array<{ id: string | null; name: string; type?: string; is_active: boolean; is_restricted?: boolean }>;
    }>("me/player/devices");
    return (data?.devices ?? [])
      .filter((device) => device.id && !device.is_restricted)
      .map((device) => ({
        id: device.id!,
        name: device.name,
        kind: device.type?.toLowerCase() ?? null,
        active: device.is_active,
        // Spotify が返すのは、いま Spotify を開いている端末だけ
        online: true,
      }));
  },

  async transfer(deviceId) {
    if (!/^[A-Za-z0-9]+$/.test(deviceId)) throw new HttpError(400, "invalid device id");
    const res = await spotifyFetch("me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [deviceId] }),
    });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify transfer error: ${res.status}`);
  },

  async addToQueue(trackUri) {
    if (!URI_PATTERN.test(trackUri)) throw new HttpError(400, "invalid uri");
    const res = await spotifyFetch(`me/player/queue?uri=${encodeURIComponent(trackUri)}`, { method: "POST" });
    if (!res) throw new HttpError(409, "spotify not configured");
    if (res.status === 404)
      throw localizedError(409, "noDevice");
    if (!res.ok && res.status !== 204) throw new HttpError(502, `spotify queue error: ${res.status}`);
  },
};
