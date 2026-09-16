import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface MailInboxConfig {
  pollIntervalMs: number;
  /** キャンバス上のコンパクト表示に出す件数の上限 */
  compactLimit: number;
}

interface MailMessage {
  uid: number;
  from: string;
  subject: string;
  date: string | null;
}

interface MailResponse {
  configured: boolean;
  reason?: string;
  mailbox: string;
  unread: number;
  total: number;
  messages: MailMessage[];
  fetchedAt: string;
  error: string | null;
}

async function fetchMail(apiBaseUrl: string): Promise<MailResponse> {
  const res = await fetch(`${apiBaseUrl}/api/mail/unread`);
  if (!res.ok) throw new Error(`mail API error: ${res.status}`);
  return res.json();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function MailInboxView({ ctx, config, openDetail }: WidgetProps<MailInboxConfig>) {
  const { data, loading } = usePolling(() => fetchMail(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) return <div className="widget-card widget-mail">確認中…</div>;
  if (data && !data.configured) {
    return (
      <div className="widget-card widget-mail widget-mail--unconfigured">
        メール未接続
        <span className="widget-spotify__hint">{data.reason}</span>
      </div>
    );
  }

  const messages = (data?.messages ?? []).slice(0, config.compactLimit);

  return (
    <button type="button" className="widget-card widget-mail" onClick={openDetail}>
      <span className="widget-mail__header">
        <span className="widget-mail__icon">✉️</span>
        <span className="widget-mail__count">{data?.unread ?? 0}</span>
        <span className="widget-mail__label">未読</span>
      </span>
      {data?.error && <span className="widget-mail__error">取得エラー（前回値を表示中）</span>}
      <ul className="widget-mail__list">
        {messages.map((m) => (
          <li key={m.uid} className="widget-mail__item">
            <span className="widget-mail__from">{m.from}</span>
            <span className="widget-mail__subject">{m.subject}</span>
          </li>
        ))}
        {messages.length === 0 && !data?.error && <li className="widget-mail__empty">未読なし</li>}
      </ul>
    </button>
  );
}

function MailInboxDetail({ ctx, config }: WidgetDetailProps<MailInboxConfig>) {
  const { data } = usePolling(() => fetchMail(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <div className="widget-detail">読み込み中…</div>;

  return (
    <div className="widget-detail widget-mail-detail">
      <h2>メール（{data.mailbox}）</h2>
      <p className="widget-usage-detail__note">
        未読 {data.unread} 件 / 全 {data.total} 件
        {data.error && <> · 取得エラー: {data.error}</>}
      </p>

      <ul className="widget-mail-detail__list">
        {data.messages.map((m) => (
          <li key={m.uid} className="widget-mail-detail__item">
            <div className="widget-mail-detail__head">
              <span className="widget-mail-detail__from">{m.from}</span>
              <span className="widget-mail-detail__date">{formatDate(m.date)}</span>
            </div>
            <div className="widget-mail-detail__subject">{m.subject}</div>
          </li>
        ))}
        {data.messages.length === 0 && <li className="widget-mail__empty">未読はありません</li>}
      </ul>

      <p className="widget-usage-detail__note">
        表示のみで、既読化・削除・返信はできません（誤操作でメールを失わないため）。
      </p>
    </div>
  );
}

export default defineWidget<MailInboxConfig>({
  id: "mail-inbox",
  name: "メール",
  description: "IMAPで受信箱の未読件数と直近の差出人・件名を表示します（読み取り専用）",
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 2 * 60 * 1000, compactLimit: 3 },
  Component: MailInboxView,
  DetailComponent: MailInboxDetail,
});
