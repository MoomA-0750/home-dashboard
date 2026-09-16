import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface WeatherConfig {
  /** ポーリング間隔(ms)。サーバー側の位置情報設定(config/weather.json)に対する天気を表示する */
  pollIntervalMs: number;
}

interface WeatherResponse {
  location: { name: string };
  current: { temperatureC: number; condition: string; icon: string; isDay: boolean };
  hourly: { time: string; precipitationProbability: number }[];
}

async function fetchWeather(apiBaseUrl: string): Promise<WeatherResponse> {
  const res = await fetch(`${apiBaseUrl}/api/weather`);
  if (!res.ok) throw new Error(`weather API error: ${res.status}`);
  return res.json();
}

function WeatherView({ ctx, config, openDetail }: WidgetProps<WeatherConfig>) {
  const { data, error, loading } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);

  return (
    <button type="button" className="widget-card widget-weather" onClick={openDetail}>
      {loading && !data && <span className="widget-weather__status">読み込み中…</span>}
      {Boolean(error) && <span className="widget-weather__status widget-weather__status--error">取得失敗</span>}
      {data && (
        <>
          <span className="widget-weather__icon">{data.current.icon}</span>
          <span className="widget-weather__temp">{Math.round(data.current.temperatureC)}°C</span>
          <span className="widget-weather__condition">{data.current.condition}</span>
        </>
      )}
    </button>
  );
}

function WeatherDetail({ ctx, config }: WidgetDetailProps<WeatherConfig>) {
  const { data } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data) return <div className="widget-detail">読み込み中…</div>;

  const maxProb = Math.max(1, ...data.hourly.map((h) => h.precipitationProbability));

  return (
    <div className="widget-detail widget-weather-detail">
      <h2>{data.location.name}の天気</h2>
      <div className="widget-weather-detail__current">
        <span className="widget-weather__icon">{data.current.icon}</span>
        <span className="widget-weather__temp">{Math.round(data.current.temperatureC)}°C</span>
        <span>{data.current.condition}</span>
      </div>
      <h3>降水確率（今後{data.hourly.length}時間）</h3>
      <div className="widget-weather-detail__chart">
        {data.hourly.map((h) => (
          <div key={h.time} className="widget-weather-detail__bar-wrap" title={`${h.time}: ${h.precipitationProbability}%`}>
            <div
              className="widget-weather-detail__bar"
              style={{ height: `${(h.precipitationProbability / maxProb) * 100}%` }}
            />
            <span className="widget-weather-detail__bar-label">
              {new Date(h.time).getHours()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default defineWidget<WeatherConfig>({
  id: "weather",
  name: "天気",
  description: "サーバー側に設定した地点の現在の天気と降水確率を表示します",
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 10 * 60 * 1000 },
  Component: WeatherView,
  DetailComponent: WeatherDetail,
});
