import { useEffect, useState } from "react";
import {
  cx,
  extensionApiUrl,
  formatClock,
  formatTemperature,
  getLocale,
  Group,
  Icon,
  List,
  ListItem,
  PillMenu,
  ScreenFrame,
  ScreenNotice,
  ScreenSection,
  StatGrid,
  StatTile,
  useDisplay,
  useLocale,
  usePolledResource,
  weatherIcon,
  type Locale,
  type ScreenProps,
  type Translate,
} from "@home-dashboard/widget-sdk";
import type { Forecast } from "./forecast";
import { fetchPlaces, PlacesPanel, type WeatherPlace } from "./PlacesPanel";
import { conditionText, directionName, messages, weekdayName } from "./i18n";

/**
 * Weather 画面。本体の部品（区画・一覧・値のタイル）で組む。上に今の天気、その下に1時間ごと、
 * 左に10日間、右に詳しい値（UV 指数・日の出と日の入り・風・降水量・体感温度・湿度・視程・気圧・大気質）。
 * 右上のピルで場所を選ぶ（どれを見ているかは端末ごとに覚える）。場所は「場所を追加・管理」で足す
 */

const PLACE_KEY = "weather.place";
const MANAGE = "__manage";

function storedPlace(): string {
  try {
    return localStorage.getItem(PLACE_KEY) ?? "home";
  } catch {
    return "home";
  }
}

function storePlace(id: string) {
  try {
    localStorage.setItem(PLACE_KEY, id);
  } catch {
    // 覚えられなくても、今の画面では選んだ場所を出す
  }
}

type T = Translate<Parameters<typeof messages.t>[0]>;

// 温度は設定の単位で（画面は useDisplay で設定の変化に合わせて描き直す）
const deg = (c: number) => formatTemperature(c);

function dayName(date: string, index: number, t: T, locale: Locale): string {
  if (index === 0) return t("today");
  if (index === 1) return t("tomorrow");
  const d = new Date(`${date}T00:00:00`);
  return t("weekday", { d: weekdayName(d.getDay(), locale) });
}

/** UV 指数の目安（気象庁の区分） */
function uvLevel(uv: number, t: T): string {
  if (uv < 3) return t("uvLow");
  if (uv < 6) return t("uvModerate");
  if (uv < 8) return t("uvHigh");
  if (uv < 11) return t("uvVeryHigh");
  return t("uvExtreme");
}

/** 米国の大気質指数（US AQI）の目安 */
function aqiLevel(aqi: number, t: T): string {
  if (aqi <= 50) return t("aqiGood");
  if (aqi <= 100) return t("aqiModerate");
  if (aqi <= 150) return t("aqiSensitive");
  if (aqi <= 200) return t("aqiUnhealthy");
  if (aqi <= 300) return t("aqiVeryUnhealthy");
  return t("aqiHazardous");
}

/** 気温を色にする（寒い青・涼しい緑・暖かい黄・暑い橙・とても暑い赤） */
const TEMP_HUES: [number, number][] = [
  [0, 220],
  [8, 195],
  [15, 150],
  [22, 50],
  [30, 25],
  [36, 0],
];
function tempColor(c: number): string {
  const [first] = TEMP_HUES;
  const last = TEMP_HUES[TEMP_HUES.length - 1];
  let hue = c <= first[0] ? first[1] : last[1];
  for (let i = 1; i < TEMP_HUES.length; i++) {
    const [t0, h0] = TEMP_HUES[i - 1];
    const [t1, h1] = TEMP_HUES[i];
    if (c > t0 && c <= t1) hue = h0 + ((c - t0) / (t1 - t0)) * (h1 - h0);
  }
  return `hsl(${Math.round(hue)} 85% 62%)`;
}

/** 目盛りの色（UV 指数・大気質の区分の色。theme/home-assistant.css） */
const SCALES = { uv: "weather-uv-scale", aqi: "weather-aqi-scale" } as const;

/** 帯の上の今の位置の印 */
function Dot({ left }: { left: number }) {
  return (
    <span
      className="absolute top-1/2 size-2.5 -translate-1/2 rounded-full border-2 border-black/45 bg-white"
      style={{ left: `${Math.min(100, Math.max(0, left))}%` }}
    />
  );
}

/** 0〜max の目盛りの上の、今の位置 */
function Meter({ value, max, scale }: { value: number; max: number; scale: keyof typeof SCALES }) {
  return (
    <span className={cx("relative block h-1.5 rounded-full", SCALES[scale])} aria-hidden="true">
      <Dot left={(value / max) * 100} />
    </span>
  );
}

export function WeatherScreen({ ctx }: ScreenProps) {
  useDisplay();
  const [placeId, setPlaceId] = useState(storedPlace);
  const [places, setPlaces] = useState<WeatherPlace[]>([]);
  const [managing, setManaging] = useState(false);
  const t = messages.useT();
  const locale = useLocale();
  const clock = (iso: string) => formatClock(new Date(iso), locale);

  useEffect(() => {
    fetchPlaces(ctx).then(setPlaces, () => undefined);
  // ctx は毎分（時刻）変わるので、宛先が変わったときだけ読み直す
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.apiBaseUrl]);
  // 覚えていた場所が外されていたら、家の地点に戻す
  const selected = places.find((p) => p.id === placeId) ?? places.find((p) => p.home);
  const shownId = selected?.id ?? "home";

  const { data, error, refresh } = usePolledResource(async (): Promise<{ placeId: string; forecast: Forecast }> => {
    const res = await fetch(extensionApiUrl(ctx, "weather", `/forecast?place=${encodeURIComponent(shownId)}`));
    if (!res.ok) throw new Error(messages.t("loadFailed", { status: res.status }, getLocale()));
    return { placeId: shownId, forecast: await res.json() };
  }, 10 * 60 * 1000, true, { cacheKey: "weather:screen" });
  useEffect(() => {
    void refresh();
  }, [shownId, refresh]);

  const choose = (id: string) => {
    if (id === MANAGE) {
      setManaging(true);
      return;
    }
    setPlaceId(id);
    storePlace(id);
  };

  const actions = (
    <PillMenu
      label={selected?.name ?? data?.forecast.location.name ?? t("place")}
      icon="location"
      ariaLabel={t("placeAria", { place: selected?.name ?? t("homeLocation") })}
      items={[
        ...places.map((p) => ({ id: p.id, label: p.name, detail: p.home ? t("home") : undefined, selected: p.id === shownId })),
        { id: MANAGE, label: t("manage") },
      ]}
      onSelect={choose}
      onOpen={() => void fetchPlaces(ctx).then(setPlaces, () => undefined)}
    />
  );

  const panel = managing && (
    <PlacesPanel
      ctx={ctx}
      places={places}
      onAdded={(place) => {
        setPlaces((list) => [...list, place]);
        choose(place.id);
        setManaging(false);
      }}
      onRemoved={(id) => setPlaces((list) => list.filter((p) => p.id !== id))}
      onClose={() => setManaging(false)}
    />
  );

  // 場所を変えた直後は、前の場所の天気を出さない
  const shown = data?.placeId === shownId ? data.forecast : null;

  if (!shown)
    return (
      <ScreenFrame title={{ ja: "天気", en: "Weather" }} actions={actions}>
        {panel}
        <ScreenNotice tone={error ? "error" : undefined}>{error ? String((error as Error).message ?? error) : t("loadingScreen")}</ScreenNotice>
      </ScreenFrame>
    );

  const { current, hourly, daily, airQuality } = shown;
  const today = daily[0];
  const low = Math.min(...daily.map((d) => d.minC));
  const high = Math.max(...daily.map((d) => d.maxC));
  const span = Math.max(1, high - low);
  const direction = directionName(current.windDirection, locale);
  const sunrise = today && Date.now() < Date.parse(today.sunrise);
  const sunset = today && !sunrise && Date.now() < Date.parse(today.sunset);
  const feels = current.apparentC - current.temperatureC;

  return (
    <ScreenFrame title={{ ja: "天気", en: "Weather" }} actions={actions}>
      {panel}
      {error ? <ScreenNotice tone="error">{t("staleError")}</ScreenNotice> : null}
      {/* 今の天気と1時間ごと。広い画面では横に並べ、高さをそろえる（中身の幅で枠が画面の外へ広がらないよう min-w-0） */}
      <div className="grid grid-cols-1 gap-x-8 wide:grid-cols-3">
      <ScreenSection className="mb-3.5 min-w-0 wide:flex wide:flex-col">
        <Group className="flex min-w-0 items-center gap-4 wide:flex-1">
          <Icon name={weatherIcon(current.code, current.isDay)} className="size-12" />
          <span className="text-stat leading-none font-semibold">{deg(current.temperatureC)}</span>
          <span className="flex min-w-0 flex-col gap-1.5 text-label leading-tight text-muted">
            <strong className="text-title leading-tight text-text">{conditionText(current.code, current.condition, locale)}</strong>
            {today && (
              <span>{t("highLow", { max: deg(today.maxC), min: deg(today.minC) })}</span>
            )}
            <span>{t("feelsLike", { t: deg(current.apparentC) })}</span>
          </span>
        </Group>
      </ScreenSection>

      <ScreenSection className="mb-3.5 min-w-0 wide:col-span-2 wide:flex wide:flex-col">
        <Group className="flex min-w-0 items-center wide:flex-1">
          {/* 1時間ごと（横に流す。上下もはみ出しを切るので、字の上下が欠けないだけ余白を取る） */}
          <ol className="weather-scroll-row m-0 flex w-full list-none snap-x snap-proximity gap-1 py-1.5">
            {hourly.map((hour, i) => (
              <li key={hour.time} className="flex shrink-0 grow basis-14 snap-start flex-col items-center gap-1 leading-tight tabular-nums">
                <span className="text-note text-muted">{i === 0 ? t("now") : t("hour", { h: new Date(hour.time).getHours() })}</span>
                <Icon name={weatherIcon(hour.code, hour.isDay)} className="my-0.5 size-6.5" />
                <span className="weather-rain h-4 text-caption">{hour.precipitationProbability >= 20 ? `${hour.precipitationProbability}%` : ""}</span>
                <span className="font-semibold">{deg(hour.temperatureC)}</span>
              </li>
            ))}
          </ol>
        </Group>
      </ScreenSection>
      </div>

      {/* 広い画面では10日間と詳しい値を2列に */}
      <div className="grid grid-cols-1 items-start gap-x-8 wide:grid-cols-2">
        <ScreenSection className="mb-3.5 min-w-0">
          <List boxed label={t("daysForecast", { n: daily.length })}>
            {daily.map((day, i) => (
              <ListItem
                key={day.date}
                leading={<Icon name={weatherIcon(day.code, true)} className="size-6" />}
                title={dayName(day.date, i, t, locale)}
                detail={[
                  conditionText(day.code, day.condition, locale),
                  day.precipitationProbability >= 20 ? t("rainChance", { p: day.precipitationProbability }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  // 最低〜最高の帯（スマホの幅では帯を短くして、天気の説明を切らない）
                  <span
                    className="flex flex-none items-center gap-2.5 tabular-nums phone:gap-1.5"
                    aria-label={t("rangeAria", { min: deg(day.minC), max: deg(day.maxC) })}
                  >
                    <span className="w-9 text-right text-muted phone:w-7">{deg(day.minC)}</span>
                    <span className="relative block h-1.5 w-36 rounded-full bg-line phone:w-14">
                      <span
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          left: `${((day.minC - low) / span) * 100}%`,
                          width: `${Math.max(4, ((day.maxC - day.minC) / span) * 100)}%`,
                          background: `linear-gradient(90deg, ${tempColor(day.minC)}, ${tempColor(day.maxC)})`,
                        }}
                      />
                      {i === 0 && <Dot left={((current.temperatureC - low) / span) * 100} />}
                    </span>
                    <span className="w-9 phone:w-7">{deg(day.maxC)}</span>
                  </span>
                }
              />
            ))}
          </List>
        </ScreenSection>

        <ScreenSection className="mb-3.5 min-w-0">
          <StatGrid>
            <StatTile icon="uv" label={t("uvIndex")} value={Math.round(current.uvIndex)} note={t("todayMax", { n: Math.round(today?.uvIndexMax ?? 0) })}>
              <span>{uvLevel(current.uvIndex, t)}</span>
              <Meter value={current.uvIndex} max={11} scale="uv" />
            </StatTile>
            {today && (
              <StatTile
                icon="sunrise"
                label={sunrise || !sunset ? t("sunrise") : t("sunset")}
                value={clock(sunrise || !sunset ? (sunrise ? today.sunrise : (daily[1]?.sunrise ?? today.sunrise)) : today.sunset)}
                note={sunrise || !sunset ? t("sunsetAt", { t: clock(today.sunset) }) : t("sunriseAt", { t: clock(today.sunrise) })}
              />
            )}
            <StatTile icon="wind" label={t("wind")} value={current.windSpeed.toFixed(1)} unit="m/s" note={t("gust", { n: current.windGust.toFixed(1) })}>
              <span className="flex items-center gap-1.5">
                {/* 風が吹いていく向き（吹いてくる向きの反対）へ矢印を回す */}
                <span className="inline-flex" style={{ transform: `rotate(${current.windDirection + 180}deg)` }}>
                  <Icon name="arrow-up" />
                </span>
                {t("windFrom", { dir: direction })}
              </span>
            </StatTile>
            <StatTile
              icon="drop"
              label={t("precipToday")}
              value={(today?.precipitationSumMm ?? 0).toFixed(1)}
              unit="mm"
              note={
                daily[1]
                  ? t("precipTomorrow", { mm: daily[1].precipitationSumMm.toFixed(1), p: daily[1].precipitationProbability })
                  : undefined
              }
            />
            <StatTile
              icon="temperature"
              label={t("feelsLikeTitle")}
              value={deg(current.apparentC)}
              note={
                Math.abs(feels) < 1.5
                  ? t("feelsSame")
                  : feels > 0
                    ? t("feelsWarmer")
                    : t("feelsColder")
              }
            />
            <StatTile icon="drop" label={t("humidity")} value={Math.round(current.humidity)} unit="%" note={t("dewPoint", { t: deg(current.dewPointC) })} />
            <StatTile
              icon="eye"
              label={t("visibility")}
              value={current.visibilityM >= 10_000 ? Math.round(current.visibilityM / 1000) : (current.visibilityM / 1000).toFixed(1)}
              unit="km"
              note={current.visibilityM >= 10_000 ? t("visClear") : t("visPoor")}
            />
            <StatTile icon="gauge" label={t("pressure")} value={Math.round(current.pressureHpa)} unit="hPa" note={t("cloudCover", { n: Math.round(current.cloudCover) })} />
            {airQuality && (
              <StatTile
                icon="leaf"
                label={t("airQuality")}
                value={airQuality.usAqi}
                note={airQuality.pm25 !== null ? `PM2.5 ${airQuality.pm25.toFixed(1)} µg/m³` : undefined}
              >
                <span>{aqiLevel(airQuality.usAqi, t)}</span>
                <Meter value={airQuality.usAqi} max={300} scale="aqi" />
              </StatTile>
            )}
          </StatGrid>
        </ScreenSection>
      </div>
    </ScreenFrame>
  );
}
