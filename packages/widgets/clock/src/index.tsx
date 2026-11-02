import { defineWidget, intlLocale, useLocale, WidgetCard, type WidgetProps } from "@home-dashboard/widget-sdk";

interface ClockConfig {
  /** 以前の版の設定（いまは画面の言語に合わせるので使わない） */
  locale?: string;
}

function formatTime(now: Date, locale: string) {
  const hh = now.toLocaleTimeString(locale, { hour: "2-digit", hour12: false }).padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  return { hh, mm };
}

function formatDate(now: Date, locale: string) {
  return now.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}

function ClockView({ ctx }: WidgetProps<ClockConfig>) {
  // 日付の書き方は画面の言語に合わせる（日本語なら「10月21日(火)」、英語なら "Tue, Oct 21"）
  const locale = intlLocale(useLocale());
  const { hh, mm } = formatTime(ctx.now, locale);
  return (
    <WidgetCard>
      <div className="text-stat leading-none tabular-nums">
        <span className="font-semibold">{hh}</span>
        <span className="font-normal text-muted">{mm}</span>
      </div>
      <div className="text-small text-muted">{formatDate(ctx.now, locale)}</div>
    </WidgetCard>
  );
}

export default defineWidget<ClockConfig>({
  id: "clock",
  name: { ja: "時計", en: "Clock" },
  // ホームの時刻（本体の MainInfo）と同じものなので、レールには置かない
  inHeader: true,
  description: { ja: "現在時刻と日付を表示します", en: "Shows the current time and date" },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: {},
  Component: ClockView,
});
