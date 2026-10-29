/**
 * 位置の拡張機能の、外を呼ばない計算（端末の選び方・家からの距離・在宅の判定と変わり目）。
 * 座標はここでもメモリの中だけで扱い、ファイルやログには書かない（icloud-locate の決まり）
 */

/** icloud-locate の /devices・/location が返す端末（README の「JSON 出力」） */
export interface RawDevice {
  name: string;
  model: string;
  battery: number | null;
  location_available: boolean;
  latitude: number | null;
  longitude: number | null;
  horizontal_accuracy_m: number | null;
  position_type: string | null;
  is_old: boolean | null;
  timestamp: string | null;
  age_seconds: number | null;
  fresh: boolean;
}

/** 接続設定「見る端末」の1つ。name は iCloud の登録名、label は呼び名（無ければ登録名） */
export interface WatchedDevice {
  name: string;
  label: string;
}

export interface Home {
  lat: number;
  lon: number;
  radiusM: number;
}

export interface Place {
  name: string;
  label: string;
  model: string;
  battery: number | null;
  available: boolean;
  lat: number | null;
  lon: number | null;
  accuracyM: number | null;
  at: string | null;
  ageSeconds: number | null;
  fresh: boolean;
  /** 家からの距離（家が決まっていて、座標があるとき） */
  distanceM: number | null;
  /** 家の中か。家が決まっていない・座標が無いときは null */
  atHome: boolean | null;
}

/** 在宅の見張りが使う測位の新しさと精度の上限。これより古い・粗い測位では、前の判定を変えない */
export const PRESENCE_MAX_AGE_S = 30 * 60;
export const PRESENCE_MAX_ACCURACY_M = 500;
/** 精度の分だけ家の円を広げるときの上限（Wi-Fi の測位の揺れを家の外と取らないため） */
const ACCURACY_SLACK_M = 100;

/** 「iPhone 15=自分, iPad」の形を読む。区切りは , か 改行。登録名には ’ や空白が入るので、= の前後だけを切る */
export function parseWatched(text: string): WatchedDevice[] {
  const out: WatchedDevice[] = [];
  for (const part of text.split(/[,\n、]/)) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName.trim();
    if (!name || out.some((d) => d.name === name)) continue;
    const label = rest.join("=").trim();
    out.push({ name, label: label || name });
  }
  return out;
}

/** 家の設定。緯度・経度が無い（0,0 を含む）ときは null */
export function parseHome(lat: unknown, lon: unknown, radius: unknown): Home | null {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || (la === 0 && lo === 0)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  const r = Number(radius);
  return { lat: la, lon: lo, radiusM: Number.isFinite(r) && r > 0 ? r : 200 };
}

/** 2点の間の距離（m、球として計算） */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function toPlace(raw: RawDevice, label: string, home: Home | null): Place {
  const hasCoords = raw.location_available && typeof raw.latitude === "number" && typeof raw.longitude === "number";
  const distance = hasCoords && home ? distanceM(home.lat, home.lon, raw.latitude!, raw.longitude!) : null;
  const slack = Math.min(raw.horizontal_accuracy_m ?? 0, ACCURACY_SLACK_M);
  return {
    name: raw.name,
    label,
    model: raw.model,
    battery: raw.battery,
    available: hasCoords,
    lat: hasCoords ? raw.latitude : null,
    lon: hasCoords ? raw.longitude : null,
    accuracyM: hasCoords ? raw.horizontal_accuracy_m : null,
    at: raw.timestamp,
    ageSeconds: raw.age_seconds,
    fresh: raw.fresh,
    distanceM: distance === null ? null : Math.round(distance),
    atHome: distance === null || !home ? null : distance <= home.radiusM + slack,
  };
}

/**
 * 見る端末を選んで Place にする。見る端末が空なら、位置を持つ端末を全部（iCloud には手放した端末も残るため、位置の無いものは出さない）。
 * 見る端末に書いた順に並べ、iCloud に無い名前は位置なしとして残す（名前の書き間違いに気づけるように）
 */
export function selectPlaces(raw: RawDevice[], watched: WatchedDevice[], home: Home | null): Place[] {
  if (watched.length === 0) {
    return raw.filter((d) => d.location_available).map((d) => toPlace(d, d.name, home));
  }
  return watched.map((w) => {
    const found = raw.find((d) => d.name === w.name);
    return found ? toPlace(found, w.label, home) : missingPlace(w);
  });
}

function missingPlace(w: WatchedDevice): Place {
  return {
    name: w.name,
    label: w.label,
    model: "",
    battery: null,
    available: false,
    lat: null,
    lon: null,
    accuracyM: null,
    at: null,
    ageSeconds: null,
    fresh: false,
    distanceM: null,
    atHome: null,
  };
}

/** 在宅の判定に使ってよい測位か（新しく、精度が十分） */
export function trustworthy(place: Place): boolean {
  return (
    place.atHome !== null &&
    place.ageSeconds !== null &&
    place.ageSeconds <= PRESENCE_MAX_AGE_S &&
    (place.accuracyM ?? Infinity) <= PRESENCE_MAX_ACCURACY_M
  );
}

export interface PresenceState {
  atHome: boolean;
  /** この状態になったと分かった時刻 */
  since: string;
}

export interface PresenceEvent {
  type: "arrived" | "left";
  device: string;
  label: string;
  at: string;
  distanceM: number | null;
}

/**
 * 見張りの1回分。今の状態（端末の登録名 → 在宅）を更新し、家に着いた・出た変わり目を返す。
 * 初めて分かった端末は変わり目にしない（起動したときに「着いた」が出ないように）。古い・粗い測位では前の状態を保つ
 */
export function updatePresence(
  state: Map<string, PresenceState>,
  places: Place[],
  now: Date,
): PresenceEvent[] {
  const events: PresenceEvent[] = [];
  for (const place of places) {
    if (!trustworthy(place)) continue;
    const atHome = place.atHome!;
    const previous = state.get(place.name);
    if (previous && previous.atHome === atHome) continue;
    state.set(place.name, { atHome, since: now.toISOString() });
    if (previous) {
      events.push({
        type: atHome ? "arrived" : "left",
        device: place.name,
        label: place.label,
        at: now.toISOString(),
        distanceM: place.distanceM,
      });
    }
  }
  return events;
}
