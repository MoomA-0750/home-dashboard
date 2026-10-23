import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { defineServerMessages, HttpError, type Locale } from "@home-dashboard/extension-sdk";
import type { Place } from "./forecast";

/**
 * Weather 画面で選べる場所。家の地点（接続設定）のほかに、足した場所を data/extension-data/weather/places.json に置く（家で共有）。
 * 地名で探すのは Open-Meteo の地名検索（日本語の地名は「市」「区」などを付けないと見つからないので、付けた形も探す）。
 * 見つからなければ、また現在地の地名は OpenStreetMap（Nominatim）に聞く
 */

export interface SavedPlace extends Place {
  id: string;
}

export interface PlaceCandidate extends Place {
  /** 都道府県・国など（同じ名前の場所を見分ける） */
  detail: string;
}

const MAX_PLACES = 30;

/** 画面に返す文（エラーの理由） */
export const messages = defineServerMessages({
  ja: {
    tooMany: "場所は{max}か所までです",
    notFound: "その場所はありません",
    noName: "地名を入れてください",
    badCoords: "緯度・経度が読めません",
    homeFixed: "家の地点は、拡張機能の接続設定で変えます",
  },
  en: {
    tooMany: "You can add up to {max} places",
    notFound: "No such place",
    noName: "Enter a place name",
    badCoords: "Couldn't read the latitude and longitude",
    homeFixed: "Change the home location in the extension's connection settings",
  },
});
const USER_AGENT = "home-dashboard (weather extension)";

export class PlaceStore {
  private readonly path: string;
  private places: SavedPlace[] | null = null;

  constructor(private readonly dir: string) {
    this.path = join(dir, "places.json");
  }

  async list(): Promise<SavedPlace[]> {
    if (this.places) return this.places;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf-8")) as { places?: SavedPlace[] };
      this.places = Array.isArray(parsed.places) ? parsed.places : [];
    } catch {
      this.places = [];
    }
    return this.places;
  }

  async add(input: unknown, locale: Locale = "ja"): Promise<SavedPlace> {
    const place = parsePlace(input, locale);
    const places = await this.list();
    if (places.length >= MAX_PLACES) throw new HttpError(400, messages.t(locale, "tooMany", { max: MAX_PLACES }));
    const saved = { id: randomUUID(), ...place };
    await this.save([...places, saved]);
    return saved;
  }

  async remove(id: string, locale: Locale = "ja"): Promise<void> {
    const places = await this.list();
    if (!places.some((p) => p.id === id)) throw new HttpError(404, messages.t(locale, "notFound"));
    await this.save(places.filter((p) => p.id !== id));
  }

  private async save(next: SavedPlace[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify({ places: next }, null, 2), "utf-8");
    await rename(tmp, this.path);
    this.places = next;
  }
}

/** 画面から受け取った場所を確かめる */
export function parsePlace(input: unknown, locale: Locale = "ja"): Place {
  const raw = (input ?? {}) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "";
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!name) throw new HttpError(400, messages.t(locale, "noName"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new HttpError(400, messages.t(locale, "badCoords"));
  }
  return { name, lat: Math.round(lat * 10_000) / 10_000, lon: Math.round(lon * 10_000) / 10_000 };
}

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`地名を探せませんでした（${res.status}）`);
  return res.json() as Promise<T>;
}

interface OpenMeteoPlace {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  population?: number;
}

interface NominatimPlace {
  name: string;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

/** 日本語の地名で、行政区分の字が付いていないもの（「札幌」「渋谷」など） */
const needsSuffix = (q: string) => /[぀-ヿ一-鿿]$/.test(q) && !/[市区町村都道府県]$/.test(q);

/** 地名で探す。人口の多い順（同じくらいなら名前がそのまま合うもの） */
export async function searchPlaces(query: string, locale: Locale = "ja"): Promise<PlaceCandidate[]> {
  const sep = locale === "ja" ? "・" : ", ";
  const q = query.trim().slice(0, 60);
  if (!q) return [];
  const names = needsSuffix(q) ? [q, `${q}市`, `${q}区`, `${q}町`, `${q}村`, `${q}都`, `${q}府`, `${q}県`] : [q];
  const lists = await Promise.all(
    names.map(async (name) => {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.search = new URLSearchParams({ name, count: "5", language: locale, format: "json" }).toString();
      return (await getJson<{ results?: OpenMeteoPlace[] }>(url).catch(() => ({ results: [] }))).results ?? [];
    }),
  );
  const seen = new Set<number>();
  const found = lists
    .flat()
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, 8)
    .map((p) => ({
      name: p.name,
      lat: p.latitude,
      lon: p.longitude,
      detail: [p.admin1, p.country].filter((s) => s && s !== p.name).join(sep),
    }));
  if (found.length > 0) return found;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "6", "accept-language": locale, addressdetails: "1" }).toString();
  const osm = await getJson<NominatimPlace[]>(url);
  return osm.map((p) => ({
    name: p.name || p.display_name.split(",")[0],
    lat: Number(p.lat),
    lon: Number(p.lon),
    detail: [p.address?.state ?? p.address?.province, p.address?.country].filter(Boolean).join(sep),
  }));
}

/** 緯度・経度の地名（市区町村くらいの細かさ）。分からなければ null */
export async function placeName(lat: number, lon: number, locale: Locale = "ja"): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "10",
    "accept-language": locale,
  }).toString();
  try {
    const p = await getJson<NominatimPlace>(url);
    const a = p.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? a.state ?? (p.name || null);
  } catch {
    return null;
  }
}
