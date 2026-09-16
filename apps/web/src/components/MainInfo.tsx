import { usePolling, type WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { Icon, type IconName } from "./Icon";

/**
 * 設計図でメイン画面の左側に固定表示されている「時刻・天気・日付」のブロック。
 * ウィジェットレールに並ぶカードではなく画面そのものの構成要素なので、
 * ウィジェットではなくコンポーネントとして直接描画している。
 */

/** 設計図の表記（"Sun Nov 24"）に合わせる */
const DATE_LOCALE = "en-US";

const WEATHER_POLL_INTERVAL_MS = 10 * 60 * 1000;

interface WeatherResponse {
  current: { temperatureC: number; condition: string; code: number; isDay: boolean };
}

/** WMO weather code を Fluent のアイコンに割り当てる（夜は昼夜別のアイコンに差し替える） */
function weatherIcon(code: number, isDay: boolean): IconName {
  if (code === 0) return isDay ? "weather-sunny" : "weather-moon";
  if (code === 1 || code === 2) return isDay ? "weather-partly-cloudy-day" : "weather-partly-cloudy-night";
  if (code === 3) return "weather-cloudy";
  if (code === 45 || code === 48) return "weather-fog";
  if (code >= 51 && code <= 67) return "weather-rain";
  if (code === 77) return "weather-snowflake";
  if ((code >= 71 && code <= 75) || code === 85 || code === 86) return "weather-snow";
  if (code >= 80 && code <= 82) return "weather-rain-showers-day";
  if (code >= 95) return "weather-thunderstorm";
  return "unknown";
}

async function fetchWeather(apiBaseUrl: string): Promise<WeatherResponse> {
  const res = await fetch(`${apiBaseUrl}/api/weather`);
  if (!res.ok) throw new Error(`weather API error: ${res.status}`);
  return res.json();
}

interface MainInfoProps {
  ctx: WidgetRuntimeContext;
}

export function MainInfo({ ctx }: MainInfoProps) {
  const { data } = usePolling(() => fetchWeather(ctx.apiBaseUrl), WEATHER_POLL_INTERVAL_MS);

  const hh = ctx.now.getHours().toString().padStart(2, "0");
  const mm = ctx.now.getMinutes().toString().padStart(2, "0");
  // 設計図の表記は "Sun Nov 24"。まとめて指定すると "Sun, Nov 24" とカンマが入るので分けて組む。
  const weekday = ctx.now.toLocaleDateString(DATE_LOCALE, { weekday: "short" });
  const monthDay = ctx.now.toLocaleDateString(DATE_LOCALE, { month: "short", day: "numeric" });

  return (
    <div className="main-info">
      <div className="time-grid" aria-label="現在時刻">
        <span className="time-part time-part--hour">
          <b>{hh}</b>
        </span>
        <span className="time-part time-part--minute">
          <b>{mm}</b>
        </span>
      </div>
      <div className="meta-grid">
        <div className="meta-weather">
          {data && (
            <>
              <Icon name={weatherIcon(data.current.code, data.current.isDay)} label={data.current.condition} />
              <strong>{Math.round(data.current.temperatureC)}℃</strong>
            </>
          )}
        </div>
        <p className="meta-date">{`${weekday} ${monthDay}`}</p>
      </div>
    </div>
  );
}
