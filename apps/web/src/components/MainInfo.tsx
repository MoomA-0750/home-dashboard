import {
  defineMessages,
  formatClock,
  useDateFormat,
  useDisplay,
  useLocale,
  useTemperature,
  usePolling,
  weatherConditionText,
  weatherIcon,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import { Icon } from "./Icon";

/**
 * 設計図でメイン画面の左側に固定表示されている「時刻・天気・日付」のブロック。
 * ウィジェットレールに並ぶカードではなく画面そのものの構成要素なので、
 * ウィジェットではなくコンポーネントとして直接描画している。
 */

const messages = defineMessages({
  ja: { currentTime: "現在時刻" },
  en: { currentTime: "Current time" },
});

const WEATHER_POLL_INTERVAL_MS = 10 * 60 * 1000;

interface WeatherResponse {
  current: { temperatureC: number; condition: string; code: number; isDay: boolean };
}

// 天気は拡張機能（extensions/weather）。切ってあると 404 になり、天気だけ出さない
async function fetchWeather(apiBaseUrl: string): Promise<WeatherResponse> {
  const res = await fetch(`${apiBaseUrl}/api/ext/weather/current`);
  if (!res.ok) throw new Error(`weather API error: ${res.status}`);
  return res.json();
}

interface MainInfoProps {
  ctx: WidgetRuntimeContext;
}

export function MainInfo({ ctx }: MainInfoProps) {
  const t = messages.useT();
  const locale = useLocale();
  const date = useDateFormat();
  const display = useDisplay();
  const temperature = useTemperature();
  const { data } = usePolling(() => fetchWeather(ctx.apiBaseUrl), WEATHER_POLL_INTERVAL_MS);

  // 時刻の設定が12時間なら、時は1〜12（大きな時計なので午前・午後は付けず、時刻の読み上げ名に入れる）
  const hours = ctx.now.getHours();
  const hh = display.clock === "12" ? String(hours % 12 || 12) : String(hours).padStart(2, "0");
  const mm = ctx.now.getMinutes().toString().padStart(2, "0");
  // 短い形（10月21日(水) / Wed Oct 21）。略さない英語の日付は、スマホの幅に入りきらない
  const dateText = date(ctx.now, "monthDayWeekday");

  return (
    <div className="main-info">
      <div className="time-grid" aria-label={`${t("currentTime")} ${formatClock(ctx.now, locale)}`}>
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
              <Icon name={weatherIcon(data.current.code, data.current.isDay)} label={weatherConditionText(data.current.code, data.current.condition, locale)} />
              <strong>{temperature(data.current.temperatureC, { unit: true })}</strong>
            </>
          )}
        </div>
        <p className="meta-date">{dateText}</p>
      </div>
    </div>
  );
}
