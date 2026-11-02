import {
  extensionApiUrl,
  Icon,
  useLocale,
  usePolling,
  useTemperature,
  weatherConditionText,
  weatherIcon,
  type HeaderWeatherProps,
} from "@home-dashboard/widget-sdk";

/**
 * ホームの時刻の横に出す今の天気（本体の口「header-weather」に入る画面）。アイコンと気温だけ。
 * 字の大きさ・色は本体（MainInfo）が決めるので、ここでは並べるだけにする
 */

const POLL_INTERVAL_MS = 10 * 60 * 1000;

interface CurrentWeather {
  current: { temperatureC: number; condition: string; code: number; isDay: boolean };
}

export function HeaderWeather({ ctx }: HeaderWeatherProps) {
  const locale = useLocale();
  const temperature = useTemperature();
  const { data } = usePolling(async (): Promise<CurrentWeather> => {
    const res = await fetch(extensionApiUrl(ctx, "weather", "/current"));
    if (!res.ok) throw new Error(`weather API error: ${res.status}`);
    return res.json();
  }, POLL_INTERVAL_MS);
  if (!data) return null;
  return (
    <>
      <Icon
        name={weatherIcon(data.current.code, data.current.isDay)}
        label={weatherConditionText(data.current.code, data.current.condition, locale)}
        className="block size-cap overflow-visible"
      />
      <span>{temperature(data.current.temperatureC, { unit: true })}</span>
    </>
  );
}
