import { ImapFlow } from "imapflow";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

/**
 * メール（IMAP）の未読状況。
 *
 * IMAPは接続・認証のコストが高く、複数端末が同じダッシュボードを開くとその数だけ接続が張られるため、
 * 結果をサーバー側で一定時間キャッシュして共有する。
 *
 * 認証情報はサーバー内に留まり、フロントエンドには一切渡さない。
 * Gmailを使う場合は2段階認証を有効にした上で「アプリパスワード」を発行して使う
 * （通常のGoogleアカウントのパスワードではIMAPログインできない）。
 */

/** 一覧に出す未読メールの件数上限 */
const PREVIEW_LIMIT = 10;
const CACHE_TTL_MS = 60 * 1000;
const CONNECT_TIMEOUT_MS = 10 * 1000;

interface MailMessage {
  uid: number;
  from: string;
  subject: string;
  date: string | null;
}

interface MailSummary {
  configured: true;
  mailbox: string;
  unread: number;
  total: number;
  messages: MailMessage[];
  fetchedAt: string;
  error: string | null;
}

let cache: { value: MailSummary; expiresAt: number } | null = null;
let fetchInFlight: Promise<MailSummary> | null = null;

function formatAddress(address: { name?: string; address?: string } | undefined): string {
  if (!address) return "(不明)";
  return address.name || address.address || "(不明)";
}

async function fetchSummary(): Promise<MailSummary> {
  const { host, port, secure, user, password, mailbox } = config.mail;

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass: password },
    logger: false,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: CONNECT_TIMEOUT_MS * 3,
  });

  const summary: MailSummary = {
    configured: true,
    mailbox,
    unread: 0,
    total: 0,
    messages: [],
    fetchedAt: new Date().toISOString(),
    error: null,
  };

  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const status = await client.status(mailbox, { unseen: true, messages: true });
      summary.unread = status.unseen ?? 0;
      summary.total = status.messages ?? 0;

      if (summary.unread > 0) {
        // 未読が数千件あるアカウントもあるので、全件fetchせず直近のUIDだけに絞る
        const unseenUids = await client.search({ seen: false }, { uid: true });
        const targetUids = (unseenUids || []).slice(-PREVIEW_LIMIT).reverse();

        for (const uid of targetUids) {
          const message = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
          if (!message || typeof message === "boolean") continue;
          summary.messages.push({
            uid,
            from: formatAddress(message.envelope?.from?.[0]),
            subject: message.envelope?.subject || "(件名なし)",
            date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : null,
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  return summary;
}

export async function registerMailRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/mail/unread", async (_request, reply) => {
    const { host, user, password } = config.mail;
    if (!host || !user || !password) {
      return reply.send({
        configured: false,
        reason: "MAIL_HOST / MAIL_USER / MAIL_PASSWORD が未設定です",
      });
    }

    if (cache && cache.expiresAt > Date.now()) return cache.value;

    if (!fetchInFlight) {
      fetchInFlight = fetchSummary().finally(() => {
        fetchInFlight = null;
      });
    }

    try {
      const value = await fetchInFlight;
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    } catch (err) {
      // 一時的な接続エラーで表示が消えないよう、期限切れのキャッシュがあればエラー付きで返す
      const message = (err as Error).message;
      app.log.warn({ err }, "mail fetch failed");
      if (cache) return { ...cache.value, error: message };
      return reply.code(502).send({ configured: true, error: message });
    }
  });
}
