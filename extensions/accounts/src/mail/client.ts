import {
  defineMessages,
  extensionApiUrl,
  formatClock,
  formatDate,
  getLocale,
  type Locale,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import type { Mailbox, MailDraft, MailMessage, MailSummary, SourceError, FolderKey, MailboxFolder } from "./types";
import { commonMessages } from "../webMessages";

/** 画面側からメールの拡張機能の道を呼ぶ */

type Ctx = Pick<WidgetRuntimeContext, "apiBaseUrl">;

async function request<T>(ctx: Ctx, path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "accounts", `/mail${path}`), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? commonMessages.t("requestFailed", { status: res.status }));
  return body as T;
}

export const fetchMailboxes = (ctx: Ctx) => request<{ mailboxes: Mailbox[]; errors: SourceError[] }>(ctx, "/mailboxes");

export const fetchMessages = (
  ctx: Ctx,
  options: { mailbox?: string; unread?: boolean; limit?: number; folder?: FolderKey },
) => {
  const params = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.mailbox) params.set("mailbox", options.mailbox);
  if (options.folder && options.folder !== "inbox") params.set("folder", options.folder);
  if (options.unread) params.set("unread", "true");
  return request<{ messages: MailSummary[]; errors: SourceError[] }>(ctx, `/messages?${params}`);
};

export const fetchFolders = (ctx: Ctx, mailbox: string | null) =>
  request<{ folders: MailboxFolder[]; errors: SourceError[] }>(
    ctx,
    `/folders${mailbox ? `?${new URLSearchParams({ mailbox })}` : ""}`,
  );

export const fetchMessage = async (ctx: Ctx, id: string) =>
  (await request<{ message: MailMessage }>(ctx, `/messages/${encodeURIComponent(id)}`)).message;

export const setRead = (ctx: Ctx, id: string, read: boolean) =>
  request(ctx, `/messages/${encodeURIComponent(id)}/read`, { method: "PUT", json: { read } });

export const moveMessage = (ctx: Ctx, id: string, folder: FolderKey, from: FolderKey) =>
  request(ctx, `/messages/${encodeURIComponent(id)}/move`, { method: "POST", json: { folder, from } });

export const sendMail = (ctx: Ctx, draft: MailDraft) => request(ctx, "/send", { method: "POST", json: draft });

const messages = defineMessages({
  ja: { noSender: "（差出人なし）" },
  en: { noSender: "(No sender)" },
});

/** 今日なら時刻、今年なら月日、それより前なら年月日 */
export function mailDate(iso: string | null, locale: Locale = getLocale()): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return formatClock(date, locale);
  const sameYear = date.getFullYear() === now.getFullYear();
  return formatDate(date, sameYear ? "monthDay" : "full", locale);
}

export const senderName = (message: Pick<MailSummary, "from">, locale?: Locale) =>
  message.from?.name || message.from?.address || messages.t("noSender", undefined, locale);
