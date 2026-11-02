import {
  defineWidget,
  extensionApiUrl,
  Icon,
  useLocale,
  usePolling,
  useTemperature,
  weatherIcon,
  type WidgetDetailProps,
  type WidgetProps,
  DetailFrame,
  SectionTitle,
  WidgetCard,
  WidgetHint,
} from "@home-dashboard/widget-sdk";
import { conditionText, messages } from "./i18n";

interface WeatherConfig {
  /** 読み直す間隔(ms)。地点は設定画面の「接続設定 → 天気」で決める */
  pollIntervalMs: number;
}

interface WeatherResponse {
  location: { name: string };
  current: { temperatureC: number; condition: string; code: number; isDay: boolean };
  hourly: { time: string; precipitationProbability: number }[];
}

async function fetchWeather(apiBaseUrl: string): Promise<WeatherResponse> {
  const res = await fetch(extensionApiUrl({ apiBaseUrl }, "weather", "/current"));
  if (!res.ok) throw new Error(`weather API error: ${res.status}`);
  return res.json();
}

function WeatherView({ ctx, config, openDetail }: WidgetProps<WeatherConfig>) {
  const { data, error, loading } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);
  const t = messages.useT();
  const locale = useLocale();
  const temperature = useTemperature();

  return (
    <WidgetCard className="flex-row items-center justify-start gap-3" onClick={openDetail}>
      {loading && !data && <WidgetHint>{t("loading")}</WidgetHint>}
      {Boolean(error) && <WidgetHint tone="error">{t("fetchFailed")}</WidgetHint>}
      {data && (
        <>
          <Icon name={weatherIcon(data.current.code, data.current.isDay)} className="size-8" />
          <span className="text-heading font-semibold">{temperature(data.current.temperatureC, { unit: true })}</span>
          <span className="text-muted">{conditionText(data.current.code, data.current.condition, locale)}</span>
        </>
      )}
    </WidgetCard>
  );
}

function WeatherDetail({ ctx, config }: WidgetDetailProps<WeatherConfig>) {
  const { data } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);
  const t = messages.useT();
  const locale = useLocale();
  const temperature = useTemperature();
  if (!data) return <DetailFrame>{t("loading")}</DetailFrame>;

  const maxProb = Math.max(1, ...data.hourly.map((h) => h.precipitationProbability));

  return (
    <DetailFrame title={t("weatherIn", { place: data.location.name })}>
      <div className="mb-4 flex items-center gap-3">
        <Icon name={weatherIcon(data.current.code, data.current.isDay)} className="size-8" />
        <span className="text-heading font-semibold">{temperature(data.current.temperatureC, { unit: true })}</span>
        <span>{conditionText(data.current.code, data.current.condition, locale)}</span>
      </div>
      <SectionTitle>{t("rainNextHours", { n: data.hourly.length })}</SectionTitle>
      <div className="flex h-32 items-end gap-1.5">
        {data.hourly.map((h) => (
          <div
            key={h.time}
            className="flex h-full flex-col items-center justify-end gap-1"
            title={`${h.time}: ${h.precipitationProbability}%`}
          >
            <div
              className="weather-rain-bar min-h-0.5 w-3 rounded-t-full"
              style={{ height: `${(h.precipitationProbability / maxProb) * 100}%` }}
            />
            <span className="text-micro text-muted">{new Date(h.time).getHours()}</span>
          </div>
        ))}
      </div>
    </DetailFrame>
  );
}

export default defineWidget<WeatherConfig>({
  id: "weather",
  name: { ja: "天気", en: "Weather" },
  // ホームの時刻の横の今の天気（header-weather）と同じものなので、レールには置かない
  inHeader: true,
  description: {
    ja: "接続設定の地点の、今の天気と降水確率を表示します",
    en: "Shows the current weather and chance of rain for the location in the connection settings",
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 10 * 60 * 1000 },
  Component: WeatherView,
  DetailComponent: WeatherDetail,
});
