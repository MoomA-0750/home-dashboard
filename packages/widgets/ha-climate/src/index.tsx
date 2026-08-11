import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface HaClimateConfig {
  pollIntervalMs: number;
  /** コンパクト表示で代表値に使うセンサーのentity_id。未指定なら最初の温度/湿度センサー */
  primaryTemperatureEntityId?: string;
  primaryHumidityEntityId?: string;
}

interface HaSensor {
  entityId: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
}

interface HaThermostat extends HaSensor {
  currentTemperature: number | null;
  targetTemperature: number | null;
}

interface ClimateResponse {
  configured: boolean;
  sensors: HaSensor[];
  thermostats: HaThermostat[];
}

async function fetchClimate(apiBaseUrl: string): Promise<ClimateResponse> {
  const res = await fetch(`${apiBaseUrl}/api/homeassistant/climate`);
  if (!res.ok) throw new Error(`home assistant API error: ${res.status}`);
  return res.json();
}

/** センサー値は文字列で来るので、表示用に桁を丸める */
function formatValue(sensor: HaSensor): string {
  const n = Number(sensor.state);
  if (Number.isNaN(n)) return sensor.state;
  return `${n.toFixed(1)}${sensor.unit ?? ""}`;
}

function pick(sensors: HaSensor[], deviceClass: string, preferredId?: string): HaSensor | undefined {
  if (preferredId) {
    const found = sensors.find((s) => s.entityId === preferredId);
    if (found) return found;
  }
  return sensors.find((s) => s.deviceClass === deviceClass);
}

function HaClimateView({ ctx, config, openDetail }: WidgetProps<HaClimateConfig>) {
  const { data, loading } = usePolling(() => fetchClimate(ctx.apiBaseUrl), config.pollIntervalMs);

  if (!loading && data && !data.configured) {
    return <div className="widget-card ha-climate ha-climate--unconfigured">Home Assistant未接続</div>;
  }

  const temperature = data ? pick(data.sensors, "temperature", config.primaryTemperatureEntityId) : undefined;
  const humidity = data ? pick(data.sensors, "humidity", config.primaryHumidityEntityId) : undefined;

  return (
    <button type="button" className="widget-card ha-climate" onClick={openDetail}>
      {loading && !data && <span className="widget-weather__status">読み込み中…</span>}
      {temperature && (
        <span className="ha-climate__reading">
          <span className="ha-climate__icon">🌡️</span>
          <span className="ha-climate__value">{formatValue(temperature)}</span>
        </span>
      )}
      {humidity && (
        <span className="ha-climate__reading">
          <span className="ha-climate__icon">💧</span>
          <span className="ha-climate__value">{formatValue(humidity)}</span>
        </span>
      )}
    </button>
  );
}

function HaClimateDetail({ ctx, config }: WidgetDetailProps<HaClimateConfig>) {
  const { data } = usePolling(() => fetchClimate(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data) return <div className="widget-detail">読み込み中…</div>;

  const temperatures = data.sensors.filter((s) => s.deviceClass === "temperature");
  const humidities = data.sensors.filter((s) => s.deviceClass === "humidity");

  return (
    <div className="widget-detail ha-climate-detail">
      <h2>室温・湿度</h2>

      {data.thermostats.length > 0 && (
        <>
          <h3>エアコン</h3>
          <ul className="ha-climate-detail__list">
            {data.thermostats.map((t) => (
              <li key={t.entityId} className="ha-climate-detail__item">
                <span className="ha-climate-detail__name">{t.name}</span>
                <span className="ha-climate-detail__state">{t.state}</span>
                <span className="ha-climate-detail__value">
                  {t.currentTemperature != null && `室温 ${t.currentTemperature}°C`}
                  {t.targetTemperature != null && ` / 設定 ${t.targetTemperature}°C`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>温度</h3>
      <ul className="ha-climate-detail__list">
        {temperatures.map((s) => (
          <li key={s.entityId} className="ha-climate-detail__item">
            <span className="ha-climate-detail__name">{s.name}</span>
            <span className="ha-climate-detail__value">{formatValue(s)}</span>
          </li>
        ))}
      </ul>

      <h3>湿度</h3>
      <ul className="ha-climate-detail__list">
        {humidities.map((s) => (
          <li key={s.entityId} className="ha-climate-detail__item">
            <span className="ha-climate-detail__name">{s.name}</span>
            <span className="ha-climate-detail__value">{formatValue(s)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default defineWidget<HaClimateConfig>({
  id: "ha-climate",
  name: "室温・湿度",
  description: "Home Assistantの温湿度センサーとエアコンの状態を表示します",
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 60 * 1000 },
  Component: HaClimateView,
  DetailComponent: HaClimateDetail,
});
