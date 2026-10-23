import { HttpError } from "@home-dashboard/extension-sdk";

/**
 * 歌詞は LRCLIB（https://lrclib.net、キーもログインも要らない）から引く。wave と同じ引き方:
 * まず曲名・アーティスト・アルバム・長さでぴったり引き、外れたら検索して長さの近いもの（±2秒、次に±5秒）を選ぶ。
 * 音楽アプリ（Spotify・wave）に依らず、曲の情報だけで引けるので、提供元を差し替えてもそのまま使える。
 */

const LRCLIB = "https://lrclib.net/api";
// LRCLIB は User-Agent で誰が使っているかを名乗るよう求めている
const USER_AGENT = "home-dashboard (https://github.com/MoomA-0750/home-dashboard)";
const CACHE_LIMIT = 200;
const TIMEOUT_MS = 8000;

export interface LyricsQuery {
  title: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
}

export interface LyricLine {
  /** 歌い出しの時刻。時刻の無い歌詞では null */
  timeMs: number | null;
  text: string;
}

export interface LyricsResult {
  found: boolean;
  synced: boolean;
  instrumental: boolean;
  lines: LyricLine[];
  source: "lrclib" | null;
}

interface LrclibRecord {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const cache = new Map<string, LyricsResult>();

const NOT_FOUND: LyricsResult = { found: false, synced: false, instrumental: false, lines: [], source: null };

/** LRC の「[mm:ss.xx] 歌詞」を行に分ける。1行に時刻が複数付いた形（繰り返し）も展開する */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const stamp of stamps) {
      const seconds = Number(stamp[2].replace(":", "."));
      lines.push({ timeMs: Math.round((Number(stamp[1]) * 60 + seconds) * 1000), text });
    }
  }
  return lines.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
}

export function toResult(record: LrclibRecord): LyricsResult {
  if (record.instrumental) return { found: true, synced: false, instrumental: true, lines: [], source: "lrclib" };
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    if (lines.length > 0) return { found: true, synced: true, instrumental: false, lines, source: "lrclib" };
  }
  if (record.plainLyrics) {
    const lines = record.plainLyrics.split(/\r?\n/).map((text) => ({ timeMs: null, text: text.trim() }));
    return { found: true, synced: false, instrumental: false, lines, source: "lrclib" };
  }
  return NOT_FOUND;
}

async function lrclib<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(`${LRCLIB}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `lrclib error: ${res.status}`);
  return (await res.json()) as T;
}

function lyricLength(record: LrclibRecord): number {
  return (record.syncedLyrics ?? record.plainLyrics ?? "").length;
}

/** 検索の結果から、長さの近いもの（±2秒、次に±5秒）を選ぶ。長さが分からなければ時刻付きのものを優先する */
export function pickClosest(records: LrclibRecord[], durationMs: number | null): LrclibRecord | null {
  const usable = records.filter((record) => record.syncedLyrics || record.plainLyrics || record.instrumental);
  if (durationMs === null) return usable.find((record) => record.syncedLyrics) ?? usable[0] ?? null;
  const seconds = durationMs / 1000;
  for (const tolerance of [2, 5]) {
    // 時刻付きを優先し、その中では短いものを選ぶ。訳を1行おきに足した投稿が混じっていて、元の歌詞はたいてい一番短いため
    const near = usable
      .filter((record) => record.duration !== undefined && Math.abs(record.duration - seconds) <= tolerance)
      .sort(
        (a, b) => Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)) || lyricLength(a) - lyricLength(b),
      );
    if (near.length > 0) return near[0];
  }
  return null;
}

export async function findLyrics(query: LyricsQuery): Promise<LyricsResult> {
  const key = JSON.stringify([query.title, query.artist, query.album, query.durationMs]);
  const cached = cache.get(key);
  if (cached) return cached;

  const params: Record<string, string> = { track_name: query.title, artist_name: query.artist };
  if (query.album) params.album_name = query.album;
  if (query.durationMs) params.duration = String(Math.round(query.durationMs / 1000));

  // ぴったり引いた結果も、訳を混ぜた投稿のことがある（例: 米津玄師「Lemon」）。
  // 検索の結果と合わせて、長さの合うものの中から選び直す。
  // ぴったり引く方は LRCLIB 側で外部へ問い合わせることがあり、混んでいると 5xx を返すので、失敗しても検索だけで続ける
  const [exact, searched] = await Promise.all([
    lrclib<LrclibRecord>("get", params).catch(() => null),
    lrclib<LrclibRecord[]>("search", { track_name: query.title, artist_name: query.artist }),
  ]);
  const candidates = [...(exact ? [exact] : []), ...(searched ?? [])];
  const closest = pickClosest(candidates, query.durationMs) ?? exact;
  const result = closest ? toResult(closest) : NOT_FOUND;

  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return result;
}
