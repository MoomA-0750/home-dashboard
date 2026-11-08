import { cx, defineMessages, formatDate, IconButton, startOfWeek, useDisplay, useLocale, type DisplaySettings } from "@home-dashboard/widget-sdk";
import { addDays, startOfDay } from "./client";

/**
 * 月のカレンダー（日付の表）。今日を強めに、選んでいる日を塗り、予定のある日に点を付ける。
 * 週の始まりは設定の「週の始まり」に合わせ、表は6週（42日）で高さを変えない（月を移っても下の欄が跳ねない）
 */

const messages = defineMessages({
  ja: { previousMonth: "前の月", nextMonth: "次の月", hasEvents: "予定あり" },
  en: { previousMonth: "Previous month", nextMonth: "Next month", hasEvents: "has events" },
});

export const GRID_DAYS = 42;

/** その月の表の最初の日（月の1日を含む週の始まり） */
export function gridStart(month: Date, display: DisplaySettings): Date {
  return startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1), display);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MonthGrid({
  month,
  selected,
  marked,
  onSelect,
  onMonth,
  compact = false,
}: {
  /** 表に出す月（その月のどの日でもよい） */
  month: Date;
  /** 選んでいる日（無ければ塗らない） */
  selected?: Date | null;
  /** 予定のある日か */
  marked?: (day: Date) => boolean;
  /** 日を押したとき（無ければ押せない） */
  onSelect?: (day: Date) => void;
  /** 前後の月へ（無ければ矢印を出さない） */
  onMonth?: (month: Date) => void;
  /** ウィジェット向けの小さな表 */
  compact?: boolean;
}) {
  const t = messages.useT();
  const locale = useLocale();
  const display = useDisplay();
  const today = startOfDay(new Date());
  const start = gridStart(month, display);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => addDays(start, i));
  const weekdays = days.slice(0, 7).map((day) => formatDate(day, "weekday", locale, display));
  const shift = (delta: number) => onMonth?.(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className={cx("flex w-full min-w-0 flex-col", compact ? "gap-1" : "gap-2")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cx("font-semibold", compact ? "text-label" : "text-title")}>
          {formatDate(month, "monthYear", locale, display)}
        </span>
        {onMonth && (
          <span className="flex gap-1">
            <IconButton icon="chevron-left" label={t("previousMonth")} onClick={() => shift(-1)} />
            <IconButton icon="chevron-right" label={t("nextMonth")} onClick={() => shift(1)} />
          </span>
        )}
      </div>
      {/* 小さな表では行の高さを揃え、今日の丸で行が伸びないようにする */}
      <div
        className={cx("grid grid-cols-7", compact ? "auto-rows-fr gap-x-0.5 gap-y-0.5" : "gap-0.5")}
        role="grid"
        aria-label={formatDate(month, "monthYear", locale, display)}
      >
        {weekdays.map((name, i) => (
          <span
            key={`w${i}`}
            className={cx("text-center text-muted", compact ? "text-micro" : "pb-1 text-caption font-medium")}
            role="columnheader"
          >
            {name}
          </span>
        ))}
        {days.map((day) => {
          const outside = day.getMonth() !== month.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = selected ? sameDay(day, selected) : false;
          const hasEvents = marked?.(day) ?? false;
          // 選んだ日は明るい塗り（本体の「選んでいる項目」と同じ）。前後の月の日は薄く
          const className = cx(
            "relative flex flex-col items-center justify-center gap-0.5 rounded-inner tabular-nums",
            compact ? "py-0.5 text-note" : "tap-lg",
            onSelect && "press cursor-pointer",
            onSelect && !isSelected && "hover:bg-tint/8",
            outside && "text-muted opacity-55",
            isSelected && "fill-bright text-on-fill",
          );
          // 日曜は赤・土曜は青の数字（選んだ日は塗りの上の文字の色のまま）。今日は数字を丸で囲む
          const numberClass = cx(
            !isSelected && day.getDay() === 0 && "text-danger",
            !isSelected && day.getDay() === 6 && "text-accent-soft",
            isToday && "inline-flex items-center justify-center rounded-full font-bold ring-2 ring-accent ring-inset",
            isToday && (compact ? "size-5" : "size-7.5"),
          );
          const label = `${formatDate(day, "monthDayWeekday", locale, display)}${hasEvents ? ` · ${t("hasEvents")}` : ""}`;
          const content = (
            <>
              <span className={numberClass}>{day.getDate()}</span>
              {hasEvents && <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />}
            </>
          );
          return onSelect ? (
            <button
              key={day.getTime()}
              type="button"
              role="gridcell"
              className={className}
              aria-label={label}
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelect(day)}
            >
              {content}
            </button>
          ) : (
            <span key={day.getTime()} role="gridcell" className={className} aria-label={label} aria-current={isToday ? "date" : undefined}>
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}
