import {
  defineMessages,
  defineWidget,
  formatClock,
  formatDate,
  textFor,
  useLocale,
  usePolling,
  type Locale,
  type LocalizedText,
  type WidgetProps,
  Badge,
  cx,
  ProgressBar,
  WidgetCard,
} from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    apiError: "claude limits API error: {status}",
    daysHours: "{d}日{h}時間",
    hoursMinutes: "{h}時間{m}分",
    minutes: "{m}分",
    minutesAgo: "{n}分前",
    hoursAgo: "{n}時間前",
    daysAgo: "{n}日前",
    usageOf: "{label}の使用率",
    resetDone: "リセット済み（次の値はまだ届いていません）",
    remaining: "あと{remaining} · {reset}に戻る",
    resetUnknown: "戻る時刻は不明",
    loading: "読み込み中…",
    title: "Claude の利用制限",
    unreachable: "サーバーに届きません",
    noValues: "まだ値が届いていません。statusline.sh から scripts/claude-limits-report.sh を呼ぶと出ます",
    staleValue: "{ago}の値",
  },
  en: {
    apiError: "claude limits API error: {status}",
    daysHours: "{d}d {h}h",
    hoursMinutes: "{h}h {m}m",
    minutes: "{m}m",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    usageOf: "{label} usage",
    resetDone: "Reset (no new value yet)",
    remaining: "{remaining} left · resets {reset}",
    resetUnknown: "Reset time unknown",
    loading: "Loading…",
    title: "Claude usage limits",
    unreachable: "Can't reach the server",
    noValues: "No values yet. Call scripts/claude-limits-report.sh from statusline.sh to show them",
    staleValue: "As of {ago}",
  },
});

type T = ReturnType<typeof messages.useT>;

interface ClaudeLimitsConfig {
  pollIntervalMs: number;
}

interface LimitWindow {
  kind: string;
  usedPercent: number;
  peakPercent: number;
  resetsAt: string | null;
  observedAt: string;
}

interface LimitsResponse {
  windows: LimitWindow[];
  serverNow: string;
}

/** 出す順と名前。知らない種類（今後増えたもの）は後ろに kind のまま出す */
const KIND_LABELS: Record<string, LocalizedText> = {
  five_hour: { ja: "5時間", en: "5-hour" },
  seven_day: { ja: "週", en: "Weekly" },
  seven_day_opus: { ja: "週（Opus）", en: "Weekly (Opus)" },
  seven_day_sonnet: { ja: "週（Sonnet）", en: "Weekly (Sonnet)" },
};
const KIND_ORDER = Object.keys(KIND_LABELS);
/** これより古い観測には「何分前の値か」を添える（Claude Code を開いていないと更新されないため） */
const STALE_AFTER_MS = 15 * 60 * 1000;

async function fetchLimits(apiBaseUrl: string): Promise<LimitsResponse> {
  const res = await fetch(`${apiBaseUrl}/api/ext/claude/limits`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}

function formatRemaining(ms: number, t: T): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t("daysHours", { d: days, h: hours });
  if (hours > 0) return t("hoursMinutes", { h: hours, m: minutes });
  return t("minutes", { m: minutes });
}

function formatResetTime(date: Date, now: Date, locale: Locale): string {
  const time = formatClock(date, locale);
  if (date.toDateString() === now.toDateString()) return time;
  return `${formatDate(date, "monthDayWeekday", locale)} ${time}`;
}

function formatAgo(ms: number, t: T): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.round(hours / 24) });
}

/** 使った割合の色（数値とバーに使う） */
const LEVEL_COLOR = {
  ok: "[--limit-color:var(--accent-ok)]",
  warm: "[--limit-color:var(--accent-warn)]",
  hot: "[--limit-color:var(--danger-strong)]",
} as const;

function level(percent: number): "ok" | "warm" | "hot" {
  if (percent >= 90) return "hot";
  if (percent >= 75) return "warm";
  return "ok";
}

function LimitRow({ window, now }: { window: LimitWindow; now: Date }) {
  const t = messages.useT();
  const locale = useLocale();
  const resetsAt = window.resetsAt ? new Date(window.resetsAt) : null;
  // 戻る時刻を過ぎた窓は、新しい値をまだ観測していないだけなので、古い%は出さない
  const reset = resetsAt !== null && resetsAt.getTime() <= now.getTime();
  const percent = reset ? 0 : Math.round(window.usedPercent);
  const known = KIND_LABELS[window.kind];
  const label = known ? textFor(known, locale) : window.kind;
  const tone = reset ? "ok" : level(window.usedPercent);

  return (
    <div className={cx("flex min-w-0 flex-col justify-end gap-1.5", LEVEL_COLOR[tone])}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-small font-semibold">{label}</span>
        <span className="text-stat leading-none font-semibold text-(--limit-color)">
          {reset ? "—" : percent}
          {!reset && <small className="ml-0.5 text-small font-normal">%</small>}
        </span>
      </div>
      <ProgressBar value={percent / 100} label={t("usageOf", { label })} className="[--progress-color:var(--limit-color)]" />
      <span className="ellipsis text-micro text-muted">
        {reset
          ? t("resetDone")
          : resetsAt
            ? t("remaining", {
                remaining: formatRemaining(resetsAt.getTime() - now.getTime(), t),
                reset: formatResetTime(resetsAt, now, locale),
              })
            : t("resetUnknown")}
      </span>
    </div>
  );
}

function ClaudeLimitsView({ ctx, config }: WidgetProps<ClaudeLimitsConfig>) {
  const t = messages.useT();
  const { data, loading, error } = usePolling(() => fetchLimits(ctx.apiBaseUrl), config.pollIntervalMs);
  const now = ctx.now;

  if (loading && !data) {
    return <WidgetCard>{t("loading")}</WidgetCard>;
  }
  if (!data || data.windows.length === 0) {
    return (
      <WidgetCard className="items-stretch gap-2.5">
        <span className="text-note font-medium text-muted">{t("title")}</span>
        <span className="text-micro leading-normal text-muted untrim">{error ? t("unreachable") : t("noValues")}</span>
      </WidgetCard>
    );
  }

  const windows = [...data.windows].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a.kind);
    const bi = KIND_ORDER.indexOf(b.kind);
    return (ai < 0 ? KIND_ORDER.length : ai) - (bi < 0 ? KIND_ORDER.length : bi);
  });
  const latest = Math.max(...windows.map((w) => Date.parse(w.observedAt)));
  const staleMs = now.getTime() - latest;

  return (
    <WidgetCard className="items-stretch justify-start gap-2.5 tabular-nums">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-note font-medium text-muted">{t("title")}</span>
        {staleMs > STALE_AFTER_MS && <Badge tone="warn">{t("staleValue", { ago: formatAgo(staleMs, t) })}</Badge>}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-6">
        {windows.slice(0, 2).map((window) => (
          <LimitRow key={window.kind} window={window} now={now} />
        ))}
      </div>
    </WidgetCard>
  );
}

export default defineWidget<ClaudeLimitsConfig>({
  id: "claude-limits",
  name: { ja: "Claude 利用制限", en: "Claude usage limits" },
  description: {
    ja: "Claude の5時間の枠と週の枠をどれだけ使ったか、いつ戻るかを表示します（Claude Code の statusLine から受け取ります）",
    en: "Shows how much of Claude's 5-hour and weekly limits you've used and when they reset (received from Claude Code's statusLine)",
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1000 },
  Component: ClaudeLimitsView,
});
