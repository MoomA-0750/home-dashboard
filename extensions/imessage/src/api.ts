import { extensionApiUrl, type WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { messages } from "./i18n";
import type { ChatView, MessageView, SendResult, UploadResult } from "./types";

/** 画面からこの拡張機能のサーバー側（./server）を呼ぶ */

type Ctx = Pick<WidgetRuntimeContext, "apiBaseUrl">;

export interface ImsgStatus {
  allowed: boolean;
  configured: boolean;
  canSend: boolean;
  dryRun?: boolean;
  error: string | null;
}

/** 状態コードも持つエラー（409 なら一覧から読み直す） */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(ctx: Ctx, path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "imessage", path), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(body.error ?? messages.t("requestFailed", { status: res.status }), res.status);
  return body as T;
}

export const fetchStatus = (ctx: Ctx) => request<ImsgStatus>(ctx, "/status");
export const fetchChats = async (ctx: Ctx) => (await request<{ chats: ChatView[] }>(ctx, "/chats")).chats;
export const fetchMessages = async (ctx: Ctx, chatId: string) =>
  (await request<{ messages: MessageView[] }>(ctx, `/chats/${encodeURIComponent(chatId)}/messages`)).messages;

export const fileUrl = (ctx: Ctx, kind: "attachments" | "avatars", id: string) =>
  extensionApiUrl(ctx, "imessage", `/${kind}/${encodeURIComponent(id)}`);

export const upload = (ctx: Ctx, file: File) =>
  request<UploadResult>(ctx, `/uploads?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });

export const send = (ctx: Ctx, input: { chatId: string; text?: string; uploadIds?: string[] }) =>
  request<SendResult>(ctx, "/send", { method: "POST", json: input });
