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
    <button type="button" className="widget-card widget-weather" onClick={openDetail}>
      {loading && !data && <span className="widget-status">{t("loading")}</span>}
      {Boolean(error) && <span className="widget-status widget-status--error">{t("fetchFailed")}</span>}
      {data && (
        <>
          <Icon name={weatherIcon(data.current.code, data.current.isDay)} className="widget-weather__icon" />
          <span className="widget-weather__temp">{temperature(data.current.temperatureC, { unit: true })}</span>
          <span className="widget-weather__condition">{conditionText(data.current.code, data.current.condition, locale)}</span>
        </>
      )}
    </button>
  );
}

function WeatherDetail({ ctx, config }: WidgetDetailProps<WeatherConfig>) {
  const { data } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);
  const t = messages.useT();
  const locale = useLocale();
  const temperature = useTemperature();
  if (!data) return <div className="widget-detail">{t("loading")}</div>;

  const maxProb = Math.max(1, ...data.hourly.map((h) => h.precipitationProbability));

  return (
    <div className="widget-detail widget-weather-detail">
      <h2>{t("weatherIn", { place: data.location.name })}</h2>
      <div className="widget-weather-detail__current">
        <Icon name={weatherIcon(data.current.code, data.current.isDay)} className="widget-weather__icon" />
        <span className="widget-weather__temp">{temperature(data.current.temperatureC, { unit: true })}</span>
        <span>{conditionText(data.current.code, data.current.condition, locale)}</span>
      </div>
      <h3>{t("rainNextHours", { n: data.hourly.length })}</h3>
      <div className="widget-weather-detail__chart">
        {data.hourly.map((h) => (
          <div
            key={h.time}
            className="widget-weather-detail__bar-wrap"
            title={`${h.time}: ${h.precipitationProbability}%`}
          >
            <div
              className="widget-weather-detail__bar"
              style={{ height: `${(h.precipitationProbability / maxProb) * 100}%` }}
            />
            <span className="widget-weather-detail__bar-label">{new Date(h.time).getHours()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default defineWidget<WeatherConfig>({
  id: "weather",
  name: { ja: "天気", en: "Weather" },
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
