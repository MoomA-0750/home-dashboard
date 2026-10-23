import { simpleParser, type AddressObject } from "mailparser";
import type { RawAddress, RawDraft, RawMailMessage } from "./providers/types";
import { jaText } from "./serverMessages";

/** メールの中身（RFC 822 の生のもの）を読む・返信の形を作る。IMAP と Gmail で使う */

/** HTML のメールを文字にする（タグを外し、改行と空白を整える）。表示は文字だけにする（HTML は出さない） */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "・")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function snippetOf(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 140);
}

function addresses(value: AddressObject | AddressObject[] | undefined): RawAddress[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((group) =>
    group.value
      .filter((item) => item.address)
      .map((item) => ({ name: item.name || null, address: item.address! })),
  );
}

/** 生のメールを読む。id・既読かは呼ぶ側が決める */
export async function parseMessage(
  source: Buffer | string,
  id: string,
  unread: boolean,
): Promise<RawMailMessage> {
  const mail = await simpleParser(source, { skipImageLinks: true, skipTextToHtml: true });
  const text = (mail.text?.trim() || (typeof mail.html === "string" ? htmlToText(mail.html) : "")).slice(0, 100_000);
  const references = Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : [];
  return {
    id,
    from: addresses(mail.from)[0] ?? null,
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    subject: mail.subject ?? jaText("noSubject"),
    date: mail.date ? mail.date.toISOString() : null,
    unread,
    text,
    snippet: snippetOf(text),
    messageId: mail.messageId ?? null,
    references,
  };
}

/** 返信なら件名に Re: を付け、In-Reply-To・References を付ける */
export function replyHeaders(draft: RawDraft): {
  subject: string;
  inReplyTo?: string;
  references?: string[];
} {
  const original = draft.replyTo;
  if (!original) return { subject: draft.subject };
  const subject = draft.subject || (/^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`);
  if (!original.messageId) return { subject };
  return { subject, inReplyTo: original.messageId, references: [...original.references, original.messageId] };
}

/** 宛先の並びを確かめる（形だけ。送る前に） */
export function checkAddresses(list: string[]): string[] {
  const cleaned = list.map((a) => a.trim()).filter(Boolean);
  for (const address of cleaned)
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) throw new Error(jaText("badAddress", { address }));
  return cleaned;
}
