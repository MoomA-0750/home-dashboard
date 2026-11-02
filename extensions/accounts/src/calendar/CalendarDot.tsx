/** カレンダーの色の点（予定・カレンダーの一覧の行の頭）。色はカレンダーごとの色で、無ければ控えめな文字の色 */
export function CalendarDot({ color }: { color: string | null | undefined }) {
  return <span className="size-2.5 shrink-0 rounded-full bg-muted" style={{ background: color ?? undefined }} />;
}
