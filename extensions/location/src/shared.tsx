import { useEffect, useState } from "react";
import {
  Button,
  cx,
  ButtonLink,
  defineMessages,
  extensionApiUrl,
  usePolledResource,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import type { Home, Place } from "./places";

/**
 * ウィジェット・詳しい画面・位置の画面で使うもの（文言、位置の読み込み、距離や時刻の書き方、端末ごとのボタン）
 */

export interface MapTiles {
  tiles: string;
  attribution: string;
  /** OpenStreetMap の既定のタイル（暗い画面に合わせて色を沈める） */
  standard: boolean;
}

export interface PlacesResponse {
  configured: boolean;
  message?: string;
  home?: boolean;
  homeArea?: Home | null;
  map?: MapTiles;
  places: Place[];
}

export const messages = defineMessages({
  ja: {
    title: "位置",
    loadFailed: "位置を読めませんでした",
    atHome: "家",
    away: "家から {distance}",
    noHome: "家が未設定",
    noLocation: "位置なし",
    justNow: "今",
    minutesAgo: "{n}分前",
    hoursAgo: "{n}時間前",
    daysAgo: "{n}日前",
    accuracy: "±{m}m",
    battery: "電池 {n}%",
    old: "古い",
    locate: "今の位置を測る",
    locating: "測っています…",
    map: "地図",
    appleMaps: "マップで開く",
    setHome: "ここを家にする",
    homeSet: "{label} の今の位置を家にしました",
    noHomeNote: "家の場所が決まっていないので、家からの距離は出ません。端末の「ここを家にする」か、設定画面で決めます。",
    empty: "位置のある端末がありません",
    privacy: "位置は iCloud の「探す」から、icloud-locate を通して読みます。ダッシュボードは座標を保存しません。",
    mapPrivacy: "地図の絵は、見ている辺りの分だけ {provider} から読みます。",
    failed: "うまくいきませんでした（{status}）",
    devices: "端末",
    showAll: "全体を見る",
    home: "家",
  },
  en: {
    title: "Location",
    loadFailed: "Couldn't load locations",
    atHome: "Home",
    away: "{distance} from home",
    noHome: "Home not set",
    noLocation: "No location",
    justNow: "now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    accuracy: "±{m}m",
    battery: "Battery {n}%",
    old: "Old",
    locate: "Locate now",
    locating: "Locating…",
    map: "Map",
    appleMaps: "Open in Maps",
    setHome: "Set as home",
    homeSet: "Set {label}'s current location as home",
    noHomeNote: "Home isn't set, so distances aren't shown. Use “Set as home” on a device, or set it in Settings.",
    empty: "No devices with a location",
    privacy: "Locations come from iCloud Find My through icloud-locate. The dashboard doesn't store coordinates.",
    mapPrivacy: "Map imagery for the area you view is loaded from {provider}.",
    failed: "Something went wrong ({status})",
    devices: "Devices",
    showAll: "Show all",
    home: "Home",
  },
});

export type T = ReturnType<typeof messages.useT>;

/** 位置を読む。家に着いた・出たとき、サーバーから "ext:location:presence" が届くので読み直す */
export function usePlaces(ctx: WidgetRuntimeContext, intervalMs: number) {
  const resource = usePolledResource(
    async () => {
      const res = await fetch(extensionApiUrl(ctx, "location", "/places"));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body as PlacesResponse;
    },
    intervalMs,
    true,
    { cacheKey: "location:places" },
  );
  const { refresh } = resource;
  useEffect(() => {
    const socket = ctx.socket;
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      if (String(event.data).includes('"ext:location:presence"')) void refresh();
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, refresh]);
  return resource;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function formatAge(seconds: number | null, t: T): string {
  if (seconds === null) return "";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}

/** 家にいるか・家からの距離を一言で */
export function whereText(place: Place, t: T): string {
  if (!place.available) return t("noLocation");
  if (place.atHome) return t("atHome");
  if (place.distanceM !== null) return t("away", { distance: formatDistance(place.distanceM) });
  return t("noHome");
}

/** 一覧の行の説明（どこ・何分前・精度・電池） */
export function placeDetail(place: Place, t: T): string {
  return [
    whereText(place, t),
    formatAge(place.ageSeconds, t),
    place.accuracyM !== null ? t("accuracy", { m: Math.round(place.accuracyM) }) : "",
    place.battery !== null ? t("battery", { n: Math.round(place.battery * 100) }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function deviceIcon(place: Place) {
  return /ipad|mac|book/i.test(place.model) ? "desktop" : "phone";
}

/** 測位を頼む・家にするの操作。busy は動いている操作の名前、result は終わったときの知らせ */
export function usePlaceActions(ctx: WidgetRuntimeContext, refresh: () => Promise<unknown>) {
  const t = messages.useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(extensionApiUrl(ctx, "location", path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? t("failed", { status: res.status }));
    return json;
  };

  const run = async (key: string, action: () => Promise<string | null>) => {
    setBusy(key);
    setResult(null);
    try {
      const text = await action();
      if (text) setResult({ tone: "ok", text });
      await refresh();
    } catch (err) {
      setResult({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const locate = (place: Place) =>
    run(`locate:${place.name}`, async () => {
      await post(`/places/${encodeURIComponent(place.name)}/locate`);
      return null;
    });
  const setHome = (place: Place) =>
    run(`home:${place.name}`, async () => {
      await post("/home", { device: place.name });
      return t("homeSet", { label: place.label });
    });

  return { busy, result, locate, setHome };
}

/** 端末ごとのボタン（今の位置を測る・マップで開く・ここを家にする） */
export function PlaceActions({
  place,
  actions,
  mapLabel,
  start,
}: {
  place: Place;
  actions: ReturnType<typeof usePlaceActions>;
  /** マップへのリンクの文言（既定は「地図」） */
  mapLabel?: string;
  /** 左に寄せる（画面の左の欄。既定は一覧の行の右に置くので右寄せ） */
  start?: boolean;
}) {
  const t = messages.useT();
  const { busy, locate, setHome } = actions;
  return (
    <span className={cx("flex flex-wrap gap-1.5", start ? "justify-start" : "justify-end phone:shrink-0 phone:grow phone:basis-full phone:justify-start")}>
      <Button disabled={busy !== null} onClick={() => void locate(place)}>
        {busy === `locate:${place.name}` ? t("locating") : t("locate")}
      </Button>
      {place.available && (
        <ButtonLink
          href={`https://maps.apple.com/?ll=${place.lat},${place.lon}&q=${encodeURIComponent(place.label)}`}
          target="_blank"
          rel="noreferrer"
        >
          {mapLabel ?? t("map")}
        </ButtonLink>
      )}
      {place.available && !place.atHome && (
        <Button disabled={busy !== null} onClick={() => void setHome(place)}>
          {t("setHome")}
        </Button>
      )}
    </span>
  );
}
