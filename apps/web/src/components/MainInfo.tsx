import {
  defineMessages,
  formatClock,
  useDateFormat,
  useDisplay,
  useFeatureProviders,
  useLocale,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";

/**
 * 設計図でメイン画面の左側に固定表示されている「時刻・天気・日付」のブロック。
 * ウィジェットレールに並ぶカードではなく画面そのものの構成要素なので、
 * ウィジェットではなくコンポーネントとして直接描画している。
 */

const messages = defineMessages({
  ja: { currentTime: "現在時刻" },
  en: { currentTime: "Current time" },
});

// 今の天気は、本体の口「header-weather」に入っている拡張機能（天気の拡張機能など）が出す。入っていなければ天気だけ出さない
const HEADER_WEATHER = "header-weather";

interface MainInfoProps {
  ctx: WidgetRuntimeContext;
}

export function MainInfo({ ctx }: MainInfoProps) {
  const t = messages.useT();
  const locale = useLocale();
  const date = useDateFormat();
  const display = useDisplay();
  const HeaderWeather = useFeatureProviders(HEADER_WEATHER).find((p) => p.Component)?.Component;

  // 時刻の設定が12時間なら、時は1〜12（大きな時計なので午前・午後は付けず、時刻の読み上げ名に入れる）
  const hours = ctx.now.getHours();
  const hh = display.clock === "12" ? String(hours % 12 || 12) : String(hours).padStart(2, "0");
  const mm = ctx.now.getMinutes().toString().padStart(2, "0");
  // 短い形（10月21日(水) / Wed Oct 21）。略さない英語の日付は、スマホの幅に入りきらない
  const dateText = date(ctx.now, "monthDayWeekday");

  return (
    <div className="clock-size halo col-start-2 grid min-w-0 grid-cols-(--clock-columns) items-center tablet:col-start-1 tablet:self-center tablet:justify-self-center">
      <div
        className="grid grid-cols-(--clock-time-columns) items-center text-(length:--clock-size) leading-none drop-shadow-(--clock-shadow)"
        aria-label={`${t("currentTime")} ${formatClock(ctx.now, locale)}`}
      >
        <span className="flex min-w-0 justify-end font-semibold whitespace-nowrap text-white">
          <span className="inline-block w-min">{hh}</span>
        </span>
        <span className="flex min-w-0 justify-start font-(--clock-thin) whitespace-nowrap text-white/70">
          <span className="inline-block w-min">{mm}</span>
        </span>
      </div>
      <div className="flex flex-col items-start gap-2.5 self-center text-(length:--meta-size) leading-none font-(--clock-thin) whitespace-nowrap">
        {/* 天気の取得前でも行の高さを取っておき、日付が上にずれないようにする */}
        <div className="flex min-h-lh items-center text-white/70">
          {HeaderWeather && <HeaderWeather ctx={ctx} />}
        </div>
        <p className="text-white">{dateText}</p>
      </div>
    </div>
  );
}
