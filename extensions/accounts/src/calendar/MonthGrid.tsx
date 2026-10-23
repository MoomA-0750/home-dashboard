import { defineMessages, formatDate, Icon, startOfWeek, useDisplay, useLocale, type DisplaySettings } from "@home-dashboard/widget-sdk";
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
    <div className={`month-grid${compact ? " month-grid--compact" : ""}`}>
      <div className="month-grid__header">
        <span className="month-grid__title">{formatDate(month, "monthYear", locale, display)}</span>
        {onMonth && (
          <span className="month-grid__nav">
            <button type="button" className="month-grid__arrow" aria-label={t("previousMonth")} onClick={() => shift(-1)}>
              <Icon name="chevron-left" />
            </button>
            <button type="button" className="month-grid__arrow" aria-label={t("nextMonth")} onClick={() => shift(1)}>
              <Icon name="chevron-right" />
            </button>
          </span>
        )}
      </div>
      <div className="month-grid__days" role="grid" aria-label={formatDate(month, "monthYear", locale, display)}>
        {weekdays.map((name, i) => (
          <span key={`w${i}`} className="month-grid__weekday" role="columnheader">
            {name}
          </span>
        ))}
        {days.map((day) => {
          const outside = day.getMonth() !== month.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = selected ? sameDay(day, selected) : false;
          const hasEvents = marked?.(day) ?? false;
          const className = [
            "month-grid__day",
            outside && "month-grid__day--outside",
            isToday && "month-grid__day--today",
            isSelected && "month-grid__day--selected",
            day.getDay() === 0 && "month-grid__day--sunday",
            day.getDay() === 6 && "month-grid__day--saturday",
          ]
            .filter(Boolean)
            .join(" ");
          const label = `${formatDate(day, "monthDayWeekday", locale, display)}${hasEvents ? ` · ${t("hasEvents")}` : ""}`;
          const content = (
            <>
              <span className="month-grid__number">{day.getDate()}</span>
              {hasEvents && <span className="month-grid__mark" aria-hidden="true" />}
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
