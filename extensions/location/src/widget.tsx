import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  DetailFrame,
  Icon,
  List,
  ListItem,
  Message,
  Note,
  WidgetCard,
  WidgetHint,
  defineMessages,
  defineWidget,
  extensionApiUrl,
  usePolledResource,
  type WidgetDetailProps,
  type WidgetProps,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import type { Place } from "./places";

/**
 * 位置のウィジェット。いちばん上に「見る端末」の最初（本人の持ち歩く端末）の、家にいるか・家からの距離を出す。
 * 詳しい画面では端末ごとに、測位を頼む・地図で開く・ここを家にするができる。
 * 家に着いた・出たとき、サーバーから "ext:location:presence" が届くので読み直す
 */

interface Config {
  pollIntervalMs: number;
}

interface PlacesResponse {
  configured: boolean;
  message?: string;
  home?: boolean;
  places: Place[];
}

const messages = defineMessages({
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
    setHome: "ここを家にする",
    homeSet: "{label} の今の位置を家にしました",
    noHomeNote: "家の場所が決まっていないので、家からの距離は出ません。端末の「ここを家にする」か、設定画面で決めます。",
    empty: "位置のある端末がありません",
    privacy: "位置は iCloud の「探す」から、icloud-locate を通して読みます。ダッシュボードは座標を保存しません。",
    failed: "うまくいきませんでした（{status}）",
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
    setHome: "Set as home",
    homeSet: "Set {label}'s current location as home",
    noHomeNote: "Home isn't set, so distances aren't shown. Use “Set as home” on a device, or set it in Settings.",
    empty: "No devices with a location",
    privacy: "Locations come from iCloud Find My through icloud-locate. The dashboard doesn't store coordinates.",
    failed: "Something went wrong ({status})",
  },
});

type T = ReturnType<typeof messages.useT>;

function usePlaces(ctx: WidgetRuntimeContext, intervalMs: number) {
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

function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

function formatAge(seconds: number | null, t: T): string {
  if (seconds === null) return "";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}

/** 家にいるか・家からの距離を一言で */
function whereText(place: Place, t: T): string {
  if (!place.available) return t("noLocation");
  if (place.atHome) return t("atHome");
  if (place.distanceM !== null) return t("away", { distance: formatDistance(place.distanceM) });
  return t("noHome");
}

function LocationView({ ctx, config, size, openDetail }: WidgetProps<Config>) {
  const t = messages.useT();
  const { data, error } = usePlaces(ctx, config.pollIntervalMs);
  const [first, ...rest] = data?.places ?? [];
  const others = size.h >= 2 ? rest.slice(0, size.h * 2 - 2) : [];

  return (
    <WidgetCard className="location-widget" onClick={openDetail} label={t("title")}>
      <span className="location-widget__title">
        <Icon name="location" />
        {first?.label ?? t("title")}
      </span>
      {error && !data ? (
        <WidgetHint tone="error">{t("loadFailed")}</WidgetHint>
      ) : data && !data.configured ? (
        <WidgetHint>{data.message}</WidgetHint>
      ) : first ? (
        <>
          <span className={first.atHome ? "location-widget__where location-widget__where--home" : "location-widget__where"}>
            {whereText(first, t)}
          </span>
          <WidgetHint>{formatAge(first.ageSeconds, t)}</WidgetHint>
          {others.length > 0 && (
            <ul className="location-widget__others">
              {others.map((place) => (
                <li key={place.name}>
                  <span>{place.label}</span>
                  <span>{whereText(place, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        data && <WidgetHint>{t("empty")}</WidgetHint>
      )}
    </WidgetCard>
  );
}

function LocationDetail({ ctx, config }: WidgetDetailProps<Config>) {
  const t = messages.useT();
  const { data, error, refresh } = usePlaces(ctx, config.pollIntervalMs);
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

  const places = data?.places ?? [];

  return (
    <DetailFrame title={t("title")} className="location-detail">
      {Boolean(error) && !data && <Message tone="error">{(error as Error).message || t("loadFailed")}</Message>}
      {data && !data.configured && <Note>{data.message}</Note>}
      {data?.configured && !data.home && <Note>{t("noHomeNote")}</Note>}
      {result && <Message tone={result.tone}>{result.text}</Message>}
      {data?.configured && places.length === 0 && <Note>{t("empty")}</Note>}
      {places.length > 0 && (
        <List boxed>
          {places.map((place) => (
            <ListItem
              key={place.name}
              leading={<Icon name={/ipad|mac|book/i.test(place.model) ? "desktop" : "phone"} />}
              title={place.label}
              badge={place.atHome ? <Badge tone="on">{t("atHome")}</Badge> : place.available && !place.fresh ? <Badge tone="dim">{t("old")}</Badge> : undefined}
              detail={[
                whereText(place, t),
                formatAge(place.ageSeconds, t),
                place.accuracyM !== null ? t("accuracy", { m: Math.round(place.accuracyM) }) : "",
                place.battery !== null ? t("battery", { n: Math.round(place.battery * 100) }) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              trailing={
                <span className="location-detail__actions">
                  <Button
                    disabled={busy !== null}
                    onClick={() => void run(`locate:${place.name}`, async () => {
                      await post(`/places/${encodeURIComponent(place.name)}/locate`);
                      return null;
                    })}
                  >
                    {busy === `locate:${place.name}` ? t("locating") : t("locate")}
                  </Button>
                  {place.available && (
                    <ButtonLink
                      href={`https://maps.apple.com/?ll=${place.lat},${place.lon}&q=${encodeURIComponent(place.label)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("map")}
                    </ButtonLink>
                  )}
                  {place.available && !place.atHome && (
                    <Button
                      disabled={busy !== null}
                      onClick={() => void run(`home:${place.name}`, async () => {
                        await post("/home", { device: place.name });
                        return t("homeSet", { label: place.label });
                      })}
                    >
                      {t("setHome")}
                    </Button>
                  )}
                </span>
              }
            />
          ))}
        </List>
      )}
      <Note>{t("privacy")}</Note>
    </DetailFrame>
  );
}

export const locationWidget = defineWidget<Config>({
  id: "location",
  name: { ja: "位置", en: "Location" },
  description: {
    ja: "自分の Apple 端末が家にいるか・家からどれくらいかを出します（iCloud の「探す」から）",
    en: "Shows whether your Apple devices are home and how far away they are (from iCloud Find My)",
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 2 * 60 * 1000 },
  Component: LocationView,
  DetailComponent: LocationDetail,
});
