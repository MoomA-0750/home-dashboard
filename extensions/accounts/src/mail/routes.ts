import { HttpError, type ExtensionAccount, type FeatureProvider, type ServerExtensionApi } from "@home-dashboard/extension-sdk";
import { aggregate } from "./aggregate";
import { jaText, localizedRoute } from "../serverMessages";
import { isFolderKey, isMoveTarget, type MailBackend, type MailDraft, type Viewer } from "./types";

/**
 * メールの道と音声アシスタントのツール。この拡張機能のアカウント（own）と、機能の口「mail」に入っているものを束ねる。
 * - /mail/mailboxes・/mail/messages・/mail/send … ウィジェットと Mail 画面。ログインしている人として読む（自分の分と家で共有の分）
 * - 音声アシスタントの list_mail・read_mail・send_mail（家で共有の分だけ。送る前に必ず確かめる）
 */

const viewerOf = (account: ExtensionAccount | null): Viewer => ({ accountId: account?.id ?? null });

export function registerMail(api: ServerExtensionApi, own: FeatureProvider<MailBackend>): void {
  const mail: MailBackend = aggregate(() => [own, ...api.providers<MailBackend>("mail")]);
  const route = localizedRoute(api);

  route("GET", "/mail/mailboxes", ({ account }) => mail.listMailboxes(viewerOf(account)));
  route("GET", "/mail/messages", ({ account, query }) =>
    mail.listMessages(viewerOf(account), {
      mailboxId: query.mailbox || undefined,
      unreadOnly: query.unread === "true",
      limit: Number(query.limit ?? 20),
      folder: isFolderKey(query.folder) ? query.folder : "inbox",
    }),
  );
  route("GET", "/mail/folders", ({ account, query }) => mail.listFolders!(viewerOf(account), query.mailbox || undefined));
  route("GET", "/mail/messages/:id", async ({ account, params }) => ({
    message: await mail.getMessage(viewerOf(account), params.id),
  }));
  route("PUT", "/mail/messages/:id/read", async ({ account, params, body }) => {
    const read = (body as { read?: unknown } | null)?.read;
    if (typeof read !== "boolean") throw new HttpError(400, "read must be a boolean");
    await mail.setRead(viewerOf(account), params.id, read);
    return { ok: true };
  });
  route("POST", "/mail/messages/:id/move", async ({ account, params, body }) => {
    const { folder, from } = (body ?? {}) as { folder?: unknown; from?: unknown };
    if (!isMoveTarget(folder) || !isFolderKey(from)) throw new HttpError(400, jaText("badRequest"));
    await mail.move!(viewerOf(account), params.id, folder, from);
    return { ok: true };
  });
  route("POST", "/mail/send", async ({ account, body }) => {
    if (!account) throw new HttpError(401, jaText("loginRequired"));
    await mail.send(viewerOf(account), body as MailDraft);
    return { ok: true };
  });

  // 音声アシスタントからは、家で共有する受信箱だけ
  const household: Viewer = { accountId: null };

  api.tool({
    name: "list_mail",
    description:
      "家で共有している受信箱のメールを新しい順に返す（既定は未読だけ・5通）。中身は read_mail で読む。読み上げるときは差出人と件名を短く。",
    inputSchema: (z) => ({
      unreadOnly: z.boolean().optional().describe("未読だけか（既定 true）"),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    readOnly: true,
    personal: true,
    // 件名・冒頭の文は、送ってきた外の人が書いたもの
    untrusted: true,
    handler: async ({ unreadOnly, limit }) => {
      const [{ mailboxes }, { messages, errors }] = await Promise.all([
        mail.listMailboxes(household),
        mail.listMessages(household, { unreadOnly: unreadOnly ?? true, limit: limit ?? 5 }),
      ]);
      return {
        mailboxes: mailboxes.map((m) => ({ id: m.id, name: m.name, address: m.address, unread: m.unread, canSend: m.canSend })),
        messages: messages.map((m) => ({
          id: m.id,
          mailboxId: m.mailboxId,
          from: m.from?.name ?? m.from?.address ?? null,
          fromAddress: m.from?.address ?? null,
          subject: m.subject,
          date: m.date,
          unread: m.unread,
          snippet: m.snippet,
        })),
        errors,
      };
    },
  });

  api.tool({
    name: "read_mail",
    description: "メールの本文を読む（id は list_mail のもの）。長いものは頭だけ。既読にはしない。",
    inputSchema: (z) => ({ id: z.string() }),
    readOnly: true,
    personal: true,
    untrusted: true,
    handler: async ({ id }) => {
      const message = await mail.getMessage(household, id);
      return {
        from: message.from,
        to: message.to,
        subject: message.subject,
        date: message.date,
        text: message.text.length > 3000 ? `${message.text.slice(0, 3000)}…（続きあり）` : message.text,
      };
    },
  });

  api.tool({
    name: "send_mail",
    description:
      "家で共有している受信箱からメールを送る・返信する。送る前に本体が話している人の了承を求めるので、宛先・件名・本文を決めてそのまま呼ぶ。返信なら replyTo に list_mail の id を渡す（宛先は元の差出人にする）。",
    inputSchema: (z) => ({
      mailboxId: z.string().optional().describe("送る受信箱（list_mail の mailboxes の id。省くと送れる最初のもの）"),
      to: z.array(z.string()).min(1),
      subject: z.string().max(500),
      text: z.string().min(1).max(10000),
      replyTo: z.string().optional(),
    }),
    // 家の外へ文を出すので、毎回了承を求める（Apple も、外へ持ち出す操作は確かめを勧めている）
    risk: "confirm",
    personal: true,
    describe: ({ to, subject, text }) =>
      `メールを送る（宛先: ${to.join("、")}／件名: ${subject || "なし"}／本文: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}）`,
    handler: async ({ mailboxId, to, subject, text, replyTo }) => {
      const { mailboxes } = await mail.listMailboxes(household);
      const from = mailboxId ? mailboxes.find((m) => m.id === mailboxId) : mailboxes.find((m) => m.canSend);
      if (!from || !from.canSend) throw new HttpError(404, "送れる受信箱がありません（家で共有している受信箱から送ります）");
      const preview = { from: from.address || from.name, to, subject, text };
      await mail.send(household, { mailboxId: from.id, to, subject, text, replyTo: replyTo ?? null });
      return { ok: true, sent: preview };
    },
  });
}
