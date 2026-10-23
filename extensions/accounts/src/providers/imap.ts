import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { HttpError } from "@home-dashboard/extension-sdk";
import { checkAddresses, parseMessage, replyHeaders, snippetOf } from "../mime";
import { isFolderKey, type FolderKey, type MailFolder } from "../mail/types";
import type { AccountContext, MailClient, RawMailSummary } from "./types";
import { jaText } from "../serverMessages";

/**
 * IMAP で読み、SMTP で送るメール（iCloud・一般）。メールの id は、受信箱（INBOX）なら UID、ほかのフォルダーなら「フォルダー:UID」。
 * フォルダー（送信済み・迷惑メールなど）は、サーバーの付ける用途の印（\\Sent など）で探し、無ければよくある名前で探す。
 * IMAP はつなぐ手間が大きく、ウィジェットが何台もの端末から読むので、未読の数と一覧は少しのあいだ覚えて使い回す
 */

export const ICLOUD_IMAP = { host: "imap.mail.me.com", port: 993, secure: true };
export const ICLOUD_SMTP = { host: "smtp.mail.me.com", port: 587, secure: false };
const MAILBOX = "INBOX";
const TIMEOUT_MS = 15_000;
const CACHE_MS = 30_000;
/** 一覧の本文の頭を作るために読む大きさ（添付ファイルまで読まないように） */
const SNIPPET_BYTES = 12_000;

const cache = new Map<string, { value: unknown; expiresAt: number }>();

async function cached<T>(key: string, work: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await work();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

/** 変えたら、そのアカウントの覚えたものを捨てる */
export function forgetMailCache(accountId: string): void {
  for (const key of cache.keys()) if (key.startsWith(`${accountId}:`)) cache.delete(key);
}

/** アカウントを変えた・外したとき、覚えたものとつながりを捨てる */
export function forgetImapAccount(accountId: string): void {
  forgetMailCache(accountId);
  closeConnection(accountId);
}

function credentials(ctx: AccountContext) {
  if (ctx.account.credentials.kind !== "password") throw new HttpError(400, jaText("noCredentials"));
  return { user: ctx.account.credentials.username, pass: ctx.account.credentials.password };
}

function servers(ctx: AccountContext) {
  if (ctx.account.provider === "icloud") return { imap: ICLOUD_IMAP, smtp: ICLOUD_SMTP };
  const { imap, smtp } = ctx.account.servers;
  if (!imap) throw new HttpError(400, jaText("noImapServer"));
  return { imap, smtp: smtp ?? null };
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const response = (err as { responseText?: string }).responseText ?? "";
  if (/auth|login|credentials|password/i.test(`${message} ${response}`))
    return jaText("imapLoginFailed");
  return jaText("imapConnectFailed", { detail: (response || message).slice(0, 200) });
}

// 用途の印の無いサーバーで探す、よくある名前（Gmail の IMAP の「[Gmail]/Sent Mail」なども、最後の名前で見る）
const FOLDERS: Record<Exclude<MailFolder, "inbox">, { use: string; names: RegExp }> = {
  sent: { use: "\\Sent", names: /^(sent|sent (messages|items|mail)|送信済み.*)$/i },
  drafts: { use: "\\Drafts", names: /^(drafts?|下書き)$/i },
  junk: { use: "\\Junk", names: /^(junk|spam|junk e-?mail|bulk mail|迷惑メール)$/i },
  trash: { use: "\\Trash", names: /^(trash|deleted (messages|items)|bin|ゴミ箱|ごみ箱)$/i },
};

// 自分で作ったメールボックスの一覧に出さない用途の印（決まったフォルダーと、Gmail の「すべてのメール」・スター付きなど）
const SPECIAL_USES = new Set(["\\Sent", "\\Drafts", "\\Junk", "\\Trash", "\\All", "\\Flagged", "\\Important"]);

async function folderPath(client: ImapFlow, folder: FolderKey): Promise<string | null> {
  if (folder === "inbox") return MAILBOX;
  if (folder.startsWith("box:")) return folder.slice(4);
  const { use, names } = FOLDERS[folder as Exclude<MailFolder, "inbox">];
  const boxes = await client.list();
  return (boxes.find((box) => box.specialUse === use) ?? boxes.find((box) => names.test(box.name)))?.path ?? null;
}

// つなぎっぱなしにする時間。IMAP はつなぐ（TLS・ログイン）だけで1〜2秒かかるので、続けて読むときは同じつながりを使う
const IDLE_MS = 2 * 60_000;

interface Connection {
  /** つなぎ先と名前・パスワード。変わったらつなぎ直す */
  key: string;
  ready: Promise<ImapFlow>;
  /** 1つのつながりでは一度に1つずつ（フォルダーを開いたまま別のフォルダーを読まない） */
  chain: Promise<unknown>;
  idle?: ReturnType<typeof setTimeout>;
}

const connections = new Map<string, Connection>();

function connectionKey(ctx: AccountContext): string {
  const { imap } = servers(ctx);
  const { user, pass } = credentials(ctx);
  return JSON.stringify([imap.host, imap.port, imap.secure, user, pass]);
}

function closeConnection(accountId: string): void {
  const connection = connections.get(accountId);
  if (!connection) return;
  connections.delete(accountId);
  clearTimeout(connection.idle);
  void connection.ready.then((client) => client.logout().catch(() => client.close())).catch(() => undefined);
}

function openConnection(ctx: AccountContext, key: string): Connection {
  const client = new ImapFlow({
    ...servers(ctx).imap,
    auth: credentials(ctx),
    logger: false,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS * 2,
  });
  // 切れたら捨てる（次に読むときにつなぎ直す）
  client.on("error", () => undefined);
  client.on("close", () => {
    if (connections.get(ctx.account.id)?.key === key) connections.delete(ctx.account.id);
  });
  const connection: Connection = {
    key,
    ready: client.connect().then(
      () => client,
      (err) => {
        connections.delete(ctx.account.id);
        throw new HttpError(502, describeError(err));
      },
    ),
    chain: Promise.resolve(),
  };
  connections.set(ctx.account.id, connection);
  return connection;
}

/** フォルダーを開いて work を呼ぶ。そのフォルダーがサーバーに無ければ missing の値を返す */
async function withImap<T>(
  ctx: AccountContext,
  work: (client: ImapFlow) => Promise<T>,
  folder: FolderKey = "inbox",
  missing?: () => T,
): Promise<T> {
  const key = connectionKey(ctx);
  let connection = connections.get(ctx.account.id);
  if (connection && connection.key !== key) {
    closeConnection(ctx.account.id);
    connection = undefined;
  }
  const current = connection ?? openConnection(ctx, key);
  const task = current.chain.then(async () => {
    clearTimeout(current.idle);
    const client = await current.ready;
    try {
      const path = await folderPath(client, folder);
      if (!path) {
        if (missing) return missing();
        throw new HttpError(404, jaText("mailNotFound"));
      }
      const lock = await client.getMailboxLock(path);
      try {
        return await work(client);
      } finally {
        lock.release();
      }
    } catch (err) {
      // つながりが壊れたら捨てる（次はつなぎ直す）
      if (!client.usable) closeConnection(ctx.account.id);
      throw err;
    } finally {
      if (connections.get(ctx.account.id) === current) {
        current.idle = setTimeout(() => closeConnection(ctx.account.id), IDLE_MS);
        current.idle.unref?.();
      }
    }
  });
  current.chain = task.catch(() => undefined);
  return task;
}

/** id を、フォルダーと UID に分ける（頭にフォルダーが無ければ受信箱。メールボックスの名前に : があってもよいよう、最後の : で分ける） */
function parseId(id: string): { folder: FolderKey; uid: number } {
  const index = id.lastIndexOf(":");
  const head = index < 0 ? "inbox" : id.slice(0, index);
  const uid = Number(index < 0 ? id : id.slice(index + 1));
  if (!isFolderKey(head)) throw new HttpError(400, jaText("badMailId"));
  if (!Number.isInteger(uid) || uid <= 0) throw new HttpError(400, jaText("badMailId"));
  return { folder: head, uid };
}

const idOf = (folder: FolderKey, uid: number) => (folder === "inbox" ? String(uid) : `${folder}:${uid}`);

export const imapMail: MailClient = {
  listFolders(ctx) {
    return cached(`${ctx.account.id}:folders`, () =>
      withImap(ctx, async (client) => {
        const boxes = await client.list();
        const standard = (name: string) => Object.values(FOLDERS).some((f) => f.names.test(name));
        return boxes
          .filter(
            (box) =>
              box.path.toUpperCase() !== MAILBOX &&
              !box.flags?.has("\\Noselect") &&
              !(box.specialUse && SPECIAL_USES.has(box.specialUse)) &&
              !(!box.specialUse && standard(box.name)),
          )
          .map((box) => ({ id: box.path, path: box.delimiter ? box.path.split(box.delimiter) : [box.path] }))
          .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
      }),
    );
  },

  unreadCount(ctx) {
    return cached(`${ctx.account.id}:unread`, () =>
      withImap(ctx, async (client) => (await client.status(MAILBOX, { unseen: true })).unseen ?? 0),
    );
  },

  listMessages(ctx, { unreadOnly, limit, folder }) {
    return cached(`${ctx.account.id}:list:${folder}:${unreadOnly}:${limit}`, () =>
      withImap(ctx, async (client) => {
        const found = await client.search(unreadOnly ? { seen: false } : { all: true }, { uid: true });
        const uids = (found || []).sort((a, b) => b - a).slice(0, limit);
        if (uids.length === 0) return [];
        const out: RawMailSummary[] = [];
        for await (const message of client.fetch(
          uids,
          { uid: true, flags: true, envelope: true, source: { start: 0, maxLength: SNIPPET_BYTES } },
          { uid: true },
        )) {
          const unread = !message.flags?.has("\\Seen");
          const parsed = message.source ? await parseMessage(message.source, String(message.uid), unread) : null;
          const envelope = message.envelope;
          const from = envelope?.from?.[0];
          out.push({
            id: idOf(folder, message.uid),
            from: from?.address ? { name: from.name || null, address: from.address } : (parsed?.from ?? null),
            to: (envelope?.to ?? [])
              .filter((a) => a.address)
              .map((a) => ({ name: a.name || null, address: a.address! })),
            subject: envelope?.subject || parsed?.subject || jaText("noSubject"),
            date: envelope?.date ? new Date(envelope.date).toISOString() : (parsed?.date ?? null),
            unread,
            snippet: parsed ? snippetOf(parsed.text) : "",
          });
        }
        return out.sort((a, b) => parseId(b.id).uid - parseId(a.id).uid);
      }, folder, () => []),
    );
  },

  getMessage(ctx, id) {
    const { folder, uid } = parseId(id);
    return withImap(ctx, async (client) => {
      const message = await client.fetchOne(String(uid), { uid: true, flags: true, source: true }, { uid: true });
      if (!message || !message.source) throw new HttpError(404, jaText("mailNotFound"));
      return parseMessage(message.source, id, !message.flags?.has("\\Seen"));
    }, folder);
  },

  async setRead(ctx, id, read) {
    const { folder, uid } = parseId(id);
    await withImap(ctx, async (client) => {
      if (read) await client.messageFlagsAdd([uid], ["\\Seen"], { uid: true });
      else await client.messageFlagsRemove([uid], ["\\Seen"], { uid: true });
    }, folder);
    forgetMailCache(ctx.account.id);
  },

  async move(ctx, id, target) {
    const { folder, uid } = parseId(id);
    await withImap(ctx, async (client) => {
      const destination = await folderPath(client, target);
      if (!destination) throw new HttpError(404, jaText("moveTargetMissing"));
      await client.messageMove([uid], destination, { uid: true });
    }, folder);
    forgetMailCache(ctx.account.id);
  },

  async send(ctx, draft) {
    const { smtp } = servers(ctx);
    if (!smtp) throw new HttpError(409, jaText("noSmtp"));
    const auth = credentials(ctx);
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: !smtp.secure,
      auth,
      connectionTimeout: TIMEOUT_MS,
    });
    const headers = replyHeaders(draft);
    try {
      await transport.sendMail({
        from: ctx.account.email ?? auth.user,
        to: checkAddresses(draft.to),
        cc: checkAddresses(draft.cc),
        subject: headers.subject,
        text: draft.text,
        inReplyTo: headers.inReplyTo,
        references: headers.references,
      });
    } catch (err) {
      if (err instanceof Error && /宛先の形/.test(err.message)) throw new HttpError(400, err.message);
      throw new HttpError(502, describeError(err));
    } finally {
      transport.close();
    }
  },
};
