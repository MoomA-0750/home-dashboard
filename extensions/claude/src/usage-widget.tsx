import {
  defineMessages,
  defineWidget,
  formatClock,
  useLocale,
  usePolling,
  type Locale,
  type WidgetDetailProps,
  type WidgetProps,
  ProgressBar,
  DetailFrame,
  Note,
  SectionTitle,
  WidgetCard,
  WidgetHint,
} from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    apiError: "claude usage API error: {status}",
    ended: "終了",
    hoursMinutes: "{h}時間{m}分",
    minutes: "{m}分",
    aggregating: "集計中…",
    notFound: "Claude Code未検出",
    todayLabel: "Claude Code 今日",
    blockRemaining: "5hブロック 残り{remaining} · {tokens}",
    noActiveBlock: "アクティブなブロックなし",
    input: "入力",
    output: "出力",
    cacheWrite: "キャッシュ書き込み",
    cacheRead: "キャッシュ読み出し",
    total: "合計",
    loading: "読み込み中…",
    title: "Claude Code 使用量",
    today: "今日（{date}）",
    currentBlock: "現在の5時間ブロック（{start}〜{end}）",
    blockSummary: "残り {remaining} · {messages} メッセージ · {tokens} トークン",
    byProject: "今日のプロジェクト別",
    daily: "日別推移",
    noCost: "料金は表示していません。モデル単価をこちらで持つと実際の請求と乖離した数字を出すことになるためです。",
  },
  en: {
    apiError: "claude usage API error: {status}",
    ended: "ended",
    hoursMinutes: "{h}h {m}m",
    minutes: "{m}m",
    aggregating: "Counting…",
    notFound: "Claude Code not found",
    todayLabel: "Claude Code today",
    blockRemaining: "5h block {remaining} left · {tokens}",
    noActiveBlock: "No active block",
    input: "Input",
    output: "Output",
    cacheWrite: "Cache writes",
    cacheRead: "Cache reads",
    total: "Total",
    loading: "Loading…",
    title: "Claude Code usage",
    today: "Today ({date})",
    currentBlock: "Current 5-hour block ({start}–{end})",
    blockSummary: (p) =>
      `${p.remaining} left · ${p.messages} ${p.messages === 1 ? "message" : "messages"} · ${p.tokens} tokens`,
    byProject: "Today by project",
    daily: "Daily trend",
    noCost: "Costs aren't shown: keeping model prices here would produce numbers that drift from your actual bill.",
  },
});

type T = ReturnType<typeof messages.useT>;

interface ClaudeUsageConfig {
  pollIntervalMs: number;
}

interface TokenTotals {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  total: number;
}

interface ModelTotals extends TokenTotals {
  model: string;
}

interface UsageResponse {
  configured: boolean;
  reason?: string;
  lastScanAt: string | null;
  today: {
    date: string;
    tokens: TokenTotals;
    messages: number;
    sessions: number;
    byModel: ModelTotals[];
  };
  block: {
    startsAt: string;
    endsAt: string;
    remainingMs: number;
    tokens: TokenTotals;
    messages: number;
    byModel: ModelTotals[];
  } | null;
  daily: Array<{ date: string } & TokenTotals>;
  projects: Array<{ name: string } & TokenTotals>;
}

async function fetchUsage(apiBaseUrl: string): Promise<UsageResponse> {
  const res = await fetch(`${apiBaseUrl}/api/ext/claude/usage`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}

/** 1.2M / 340k のように桁を落として表示する */
function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatDuration(ms: number, t: T): string {
  if (ms <= 0) return t("ended");
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? t("hoursMinutes", { h: hours, m: minutes }) : t("minutes", { m: minutes });
}

function formatTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (locale !== "ja") return formatClock(d, locale);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ClaudeUsageView({ ctx, config, openDetail }: WidgetProps<ClaudeUsageConfig>) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchUsage(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) {
    return <WidgetCard>{t("aggregating")}</WidgetCard>;
  }
  if (data && !data.configured) {
    return (
      <WidgetCard>
        {t("notFound")}
        <WidgetHint>{data.reason}</WidgetHint>
      </WidgetCard>
    );
  }

  const today = data?.today;
  const block = data?.block;
  // 5時間ブロックの経過割合。レート制限の枠をどれだけ「時間として」使ったかの目安
  const blockProgress = block ? Math.min(1, 1 - block.remainingMs / (5 * 60 * 60 * 1000)) : 0;

  return (
    <WidgetCard className="items-stretch justify-start gap-1 tabular-nums" onClick={openDetail}>
      <span className="text-caption font-medium text-muted">{t("todayLabel")}</span>
      <span className="text-stat font-semibold leading-none">{formatTokens(today?.tokens.total ?? 0)}</span>
      <span className="text-caption font-medium text-muted">
        {today?.messages ?? 0} msg / {today?.sessions ?? 0} session
      </span>
      {block ? (
        <div className="mt-auto flex flex-col gap-1">
          <ProgressBar value={blockProgress} />
          <span className="text-caption font-medium text-muted">
            {t("blockRemaining", {
              remaining: formatDuration(block.remainingMs, t),
              tokens: formatTokens(block.tokens.total),
            })}
          </span>
        </div>
      ) : (
        <span className="text-caption font-medium text-muted">{t("noActiveBlock")}</span>
      )}
    </WidgetCard>
  );
}

/** 名前と数値の行（左に名前・右に数値） */
const rowsClass = "flex flex-col gap-1 text-label tabular-nums [&>li]:flex [&>li]:justify-between [&>li]:gap-6";

function TokenBreakdown({ tokens }: { tokens: TokenTotals }) {
  const t = messages.useT();
  return (
    <ul className={rowsClass}>
      <li>
        <span>{t("input")}</span>
        <span>{tokens.input.toLocaleString()}</span>
      </li>
      <li>
        <span>{t("output")}</span>
        <span>{tokens.output.toLocaleString()}</span>
      </li>
      <li>
        <span>{t("cacheWrite")}</span>
        <span>{tokens.cacheCreate.toLocaleString()}</span>
      </li>
      <li>
        <span>{t("cacheRead")}</span>
        <span>{tokens.cacheRead.toLocaleString()}</span>
      </li>
      <li className="mt-1 border-t border-glass-border pt-1.5 font-semibold">
        <span>{t("total")}</span>
        <span>{tokens.total.toLocaleString()}</span>
      </li>
    </ul>
  );
}

function ClaudeUsageDetail({ ctx, config }: WidgetDetailProps<ClaudeUsageConfig>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data } = usePolling(() => fetchUsage(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <DetailFrame>{t("loading")}</DetailFrame>;

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.total));

  return (
    <DetailFrame title={t("title")} className="flex flex-col gap-5">
      <section>
        <SectionTitle>{t("today", { date: data.today.date })}</SectionTitle>
        <TokenBreakdown tokens={data.today.tokens} />
        <ul className={rowsClass}>
          {data.today.byModel.map((m) => (
            <li key={m.model}>
              <span className="text-muted">{m.model}</span>
              <span>{formatTokens(m.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.block && (
        <section>
          <SectionTitle>
            {t("currentBlock", {
              start: formatTime(data.block.startsAt, locale),
              end: formatTime(data.block.endsAt, locale),
            })}
          </SectionTitle>
          <Note>
            {t("blockSummary", {
              remaining: formatDuration(data.block.remainingMs, t),
              messages: data.block.messages,
              tokens: formatTokens(data.block.tokens.total),
            })}
          </Note>
        </section>
      )}

      {data.projects.length > 0 && (
        <section>
          <SectionTitle>{t("byProject")}</SectionTitle>
          <ul className={rowsClass}>
            {data.projects.map((p) => (
              <li key={p.name}>
                <span className="text-muted">{p.name}</span>
                <span>{formatTokens(p.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>{t("daily")}</SectionTitle>
        <ul className="flex flex-col gap-1 text-note tabular-nums">
          {data.daily.map((d) => (
            <li key={d.date} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-muted">{d.date.slice(5)}</span>
              <ProgressBar value={d.total / maxDaily} className="flex-1 [--progress-color:rgb(var(--accent-soft-rgb))]" />
              <span className="w-14 shrink-0 text-right text-muted">{formatTokens(d.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      <Note>{t("noCost")}</Note>
    </DetailFrame>
  );
}

export default defineWidget<ClaudeUsageConfig>({
  id: "claude-usage",
  name: { ja: "Claude Code使用量", en: "Claude Code usage" },
  description: {
    ja: "今日のトークン使用量と、レート制限の単位である5時間ブロックの消費状況を表示します",
    en: "Shows today's token usage and how much of the 5-hour block (the rate-limit unit) is used",
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 60 * 1000 },
  Component: ClaudeUsageView,
  DetailComponent: ClaudeUsageDetail,
});
