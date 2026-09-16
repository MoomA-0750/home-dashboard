import { defineWidget, type WidgetProps } from "@home-dashboard/widget-sdk";

interface ClockConfig {
  locale: string;
}

function formatTime(now: Date, locale: string) {
  const hh = now.toLocaleTimeString(locale, { hour: "2-digit", hour12: false }).padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  return { hh, mm };
}

function formatDate(now: Date, locale: string) {
  return now.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}

function ClockView({ ctx, config }: WidgetProps<ClockConfig>) {
  const { hh, mm } = formatTime(ctx.now, config.locale);
  return (
    <div className="widget-card widget-clock">
      <div className="widget-clock__time">
        <span className="widget-clock__hh">{hh}</span>
        <span className="widget-clock__mm">{mm}</span>
      </div>
      <div className="widget-clock__date">{formatDate(ctx.now, config.locale)}</div>
    </div>
  );
}

export default defineWidget<ClockConfig>({
  id: "clock",
  name: "時計",
  description: "現在時刻と日付を表示します",
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { locale: "ja-JP" },
  Component: ClockView,
});
