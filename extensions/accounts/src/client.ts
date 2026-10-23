import { defineMessages, extensionApiUrl, type Locale, type WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import type { AccountInfo, ProviderKind } from "./store";
import { commonMessages } from "./webMessages";

/** 設定画面の「アカウント → インターネットアカウント」から、この拡張機能の道を呼ぶ */

type Ctx = Pick<WidgetRuntimeContext, "apiBaseUrl">;

async function request<T>(ctx: Ctx, path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "accounts", path), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? commonMessages.t("requestFailed", { status: res.status }));
  return body as T;
}

export const fetchProviders = (ctx: Ctx) => request<{ google: boolean; microsoft: boolean }>(ctx, "/providers");

export const fetchAccounts = async (ctx: Ctx) => (await request<{ accounts: AccountInfo[] }>(ctx, "/accounts")).accounts;

export const addAccount = async (ctx: Ctx, input: Record<string, unknown>) =>
  (await request<{ account: AccountInfo }>(ctx, "/accounts", { method: "POST", json: input })).account;

export const updateAccount = async (ctx: Ctx, id: string, input: Record<string, unknown>) =>
  (await request<{ account: AccountInfo }>(ctx, `/accounts/${encodeURIComponent(id)}`, { method: "PATCH", json: input }))
    .account;

export const removeAccount = (ctx: Ctx, id: string) =>
  request(ctx, `/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });

export const testAccount = (ctx: Ctx, id: string) =>
  request<{ ok: boolean; message: string }>(ctx, `/accounts/${encodeURIComponent(id)}/test`, { method: "POST" });

/** Google・Microsoft のログインのページへ移る（戻ってくると、設定のこのページが開く） */
export async function startOAuth(ctx: Ctx, provider: "google" | "microsoft", accountId?: string) {
  const query = accountId ? `?account=${encodeURIComponent(accountId)}` : "";
  const { url } = await request<{ url: string }>(ctx, `/oauth/${provider}/start${query}`);
  window.location.assign(url);
}

const providerLabels = defineMessages({
  ja: {
    google: "Google",
    microsoft: "Microsoft",
    icloud: "iCloud",
    imap: "メール（IMAP）",
    caldav: "カレンダー（CalDAV）",
    ical: "公開カレンダー（iCal）",
  },
  en: {
    google: "Google",
    microsoft: "Microsoft",
    icloud: "iCloud",
    imap: "Mail (IMAP)",
    caldav: "Calendar (CalDAV)",
    ical: "Public calendar (iCal)",
  },
});

/** アカウントの種類の名前（言語を省くと今の言語） */
export const providerLabel = (kind: ProviderKind, locale?: Locale) => providerLabels.t(kind, undefined, locale);
