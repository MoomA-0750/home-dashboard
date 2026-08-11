import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

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
  const res = await fetch(`${apiBaseUrl}/api/claude-usage`);
  if (!res.ok) throw new Error(`claude usage API error: ${res.status}`);
  return res.json();
}

/** 1.2M / 340k のように桁を落として表示する */
function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "終了";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ClaudeUsageView({ ctx, config, openDetail }: WidgetProps<ClaudeUsageConfig>) {
  const { data, loading } = usePolling(() => fetchUsage(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) {
    return <div className="widget-card widget-usage">集計中…</div>;
  }
  if (data && !data.configured) {
    return (
      <div className="widget-card widget-usage widget-usage--unconfigured">
        Claude Code未検出
        <span className="widget-spotify__hint">{data.reason}</span>
      </div>
    );
  }

  const today = data?.today;
  const block = data?.block;
  // 5時間ブロックの経過割合。レート制限の枠をどれだけ「時間として」使ったかの目安
  const blockProgress = block
    ? Math.min(1, 1 - block.remainingMs / (5 * 60 * 60 * 1000))
    : 0;

  return (
    <button type="button" className="widget-card widget-usage" onClick={openDetail}>
      <span className="widget-usage__label">Claude Code 今日</span>
      <span className="widget-usage__value">{formatTokens(today?.tokens.total ?? 0)}</span>
      <span className="widget-usage__sub">
        {today?.messages ?? 0} msg / {today?.sessions ?? 0} session
      </span>
      {block ? (
        <div className="widget-usage__block">
          <div className="widget-usage__bar">
            <div className="widget-usage__bar-fill" style={{ width: `${blockProgress * 100}%` }} />
          </div>
          <span className="widget-usage__sub">
            5hブロック 残り{formatDuration(block.remainingMs)} · {formatTokens(block.tokens.total)}
          </span>
        </div>
      ) : (
        <span className="widget-usage__sub">アクティブなブロックなし</span>
      )}
    </button>
  );
}

function TokenBreakdown({ tokens }: { tokens: TokenTotals }) {
  return (
    <ul className="widget-usage-detail__breakdown">
      <li><span>入力</span><span>{tokens.input.toLocaleString()}</span></li>
      <li><span>出力</span><span>{tokens.output.toLocaleString()}</span></li>
      <li><span>キャッシュ書き込み</span><span>{tokens.cacheCreate.toLocaleString()}</span></li>
      <li><span>キャッシュ読み出し</span><span>{tokens.cacheRead.toLocaleString()}</span></li>
      <li className="widget-usage-detail__breakdown-total"><span>合計</span><span>{tokens.total.toLocaleString()}</span></li>
    </ul>
  );
}

function ClaudeUsageDetail({ ctx, config }: WidgetDetailProps<ClaudeUsageConfig>) {
  const { data } = usePolling(() => fetchUsage(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <div className="widget-detail">読み込み中…</div>;

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.total));

  return (
    <div className="widget-detail widget-usage-detail">
      <h2>Claude Code 使用量</h2>

      <section>
        <h3>今日（{data.today.date}）</h3>
        <TokenBreakdown tokens={data.today.tokens} />
        <ul className="widget-usage-detail__models">
          {data.today.byModel.map((m) => (
            <li key={m.model}>
              <span className="widget-usage-detail__model">{m.model}</span>
              <span>{formatTokens(m.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.block && (
        <section>
          <h3>
            現在の5時間ブロック（{formatTime(data.block.startsAt)}〜{formatTime(data.block.endsAt)}）
          </h3>
          <p className="widget-usage-detail__note">
            残り {formatDuration(data.block.remainingMs)} · {data.block.messages} メッセージ ·{" "}
            {formatTokens(data.block.tokens.total)} トークン
          </p>
        </section>
      )}

      {data.projects.length > 0 && (
        <section>
          <h3>今日のプロジェクト別</h3>
          <ul className="widget-usage-detail__models">
            {data.projects.map((p) => (
              <li key={p.name}>
                <span className="widget-usage-detail__model">{p.name}</span>
                <span>{formatTokens(p.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>日別推移</h3>
        <ul className="widget-usage-detail__daily">
          {data.daily.map((d) => (
            <li key={d.date}>
              <span className="widget-usage-detail__date">{d.date.slice(5)}</span>
              <span className="widget-usage-detail__daily-bar">
                <span style={{ width: `${(d.total / maxDaily) * 100}%` }} />
              </span>
              <span className="widget-usage-detail__daily-value">{formatTokens(d.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="widget-usage-detail__note">
        料金は表示していません。モデル単価をこちらで持つと実際の請求と乖離した数字を出すことになるためです。
      </p>
    </div>
  );
}

export default defineWidget<ClaudeUsageConfig>({
  id: "claude-usage",
  name: "Claude Code使用量",
  description: "今日のトークン使用量と、レート制限の単位である5時間ブロックの消費状況を表示します",
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  defaultConfig: { pollIntervalMs: 60 * 1000 },
  Component: ClaudeUsageView,
  DetailComponent: ClaudeUsageDetail,
});
