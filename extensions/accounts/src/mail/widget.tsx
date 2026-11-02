import {
  defineMessages,
  defineWidget,
  DetailFrame,
  Icon,
  List,
  ListItem,
  Note,
  useLocale,
  usePolling,
  WidgetCard,
  WidgetHint,
  type WidgetDetailProps,
  type WidgetProps,
} from "@home-dashboard/widget-sdk";
import { fetchMailboxes, fetchMessages, mailDate, senderName } from "./client";

/**
 * メールのウィジェット。見える受信箱（自分の分と家で共有の分）の未読の数と、新しい未読の差出人・件名を出す。
 * 押すと未読の一覧を開く（読む・返信するのは Mail 画面）
 */

const messages = defineMessages({
  ja: {
    loadFailed: "読めませんでした",
    checking: "確かめています…",
    noAccounts: "設定の「アカウント → インターネットアカウント」でメールのアカウントを足すと、未読が出ます",
    cardLabel: "未読 {n}通（一覧を開く）",
    unread: "未読",
    cantRead: "{sources}を読めません",
    sourceSeparator: "・",
    noUnreadShort: "未読なし",
    detailTitle: "未読のメール",
    mailboxUnread: "{name}: 未読 {n}通",
    noUnread: "未読はありません",
    openMailScreen: "読む・返信するのは、サイドバーの「メール」の画面で。",
  },
  en: {
    loadFailed: "Couldn't load",
    checking: "Checking…",
    noAccounts: "Add a mail account in Settings → Accounts → Internet Accounts to see unread mail",
    cardLabel: (p) => `${p.n} unread (open the list)`,
    unread: "Unread",
    cantRead: "Can't read {sources}",
    sourceSeparator: ", ",
    noUnreadShort: "No unread mail",
    detailTitle: "Unread mail",
    mailboxUnread: "{name}: {n} unread",
    noUnread: "No unread mail",
    openMailScreen: "To read or reply, use the Mail screen in the sidebar.",
  },
});

interface MailInboxConfig {
  pollIntervalMs: number;
  /** カードに出す件数の上限 */
  compactLimit: number;
}

function useUnread(ctx: WidgetProps["ctx"], limit: number, intervalMs: number) {
  return usePolling(async () => {
    const [boxes, list] = await Promise.all([fetchMailboxes(ctx), fetchMessages(ctx, { unread: true, limit })]);
    return {
      mailboxes: boxes.mailboxes,
      unread: boxes.mailboxes.reduce((sum, m) => sum + m.unread, 0),
      messages: list.messages,
      errors: [...boxes.errors, ...list.errors],
    };
  }, intervalMs);
}

function MailInboxView({ ctx, config, openDetail }: WidgetProps<MailInboxConfig>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error } = useUnread(ctx, config.compactLimit, config.pollIntervalMs);
  if (!data) {
    return (
      <WidgetCard>
        {error ? <WidgetHint tone="error">{t("loadFailed")}</WidgetHint> : <WidgetHint>{t("checking")}</WidgetHint>}
      </WidgetCard>
    );
  }
  if (data.mailboxes.length === 0 && data.errors.length === 0) {
    return (
      <WidgetCard>
        <WidgetHint>{t("noAccounts")}</WidgetHint>
      </WidgetCard>
    );
  }
  return (
    <WidgetCard className="items-stretch justify-start gap-1.5" onClick={openDetail} label={t("cardLabel", { n: data.unread })}>
      <span className="flex items-baseline gap-1.5">
        <Icon name="mail" className="size-5.5 self-center text-muted" />
        <span className="text-stat leading-none font-semibold tabular-nums">{data.unread}</span>
        <span className="text-caption font-medium text-muted">{t("unread")}</span>
      </span>
      {data.errors.length > 0 && <WidgetHint tone="error">{t("cantRead", { sources: data.errors.map((e) => e.source).join(t("sourceSeparator")) })}</WidgetHint>}
      <ul className="flex flex-col gap-1">
        {data.messages.slice(0, config.compactLimit).map((m) => (
          <li key={m.id} className="flex gap-2 text-note">
            <span className="ellipsis w-24 shrink-0 text-muted">{senderName(m, locale)}</span>
            <span className="ellipsis min-w-0 flex-1">{m.subject}</span>
          </li>
        ))}
        {data.messages.length === 0 && <li className="text-note font-medium text-muted">{t("noUnreadShort")}</li>}
      </ul>
    </WidgetCard>
  );
}

function MailInboxDetail({ ctx, config }: WidgetDetailProps<MailInboxConfig>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data } = useUnread(ctx, 20, config.pollIntervalMs);
  return (
    <DetailFrame title={t("detailTitle")}>
      {data?.mailboxes.map((m) => (
        <Note key={m.id}>{t("mailboxUnread", { name: m.name, n: m.unread })}</Note>
      ))}
      {data?.errors.map((e) => (
        <Note key={e.source}>
          {e.source}: {e.message}
        </Note>
      ))}
      {data && data.messages.length === 0 && <Note>{t("noUnread")}</Note>}
      {data && data.messages.length > 0 && (
        <List label={t("detailTitle")}>
          {data.messages.map((m) => (
            <ListItem key={m.id} title={m.subject} detail={`${senderName(m, locale)} · ${mailDate(m.date, locale)}`} />
          ))}
        </List>
      )}
      <Note>{t("openMailScreen")}</Note>
    </DetailFrame>
  );
}

export const mailWidget = defineWidget<MailInboxConfig>({
  id: "mail-inbox",
  name: { ja: "メール", en: "Mail" },
  description: {
    ja: "未読の数と、新しい未読の差出人・件名を出します（設定の「アカウント → インターネットアカウント」で足したメール）",
    en: "Shows the unread count and the sender and subject of new unread mail (from accounts added in Settings → Accounts → Internet Accounts)",
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 2 * 60 * 1000, compactLimit: 3 },
  Component: MailInboxView,
  DetailComponent: MailInboxDetail,
});
