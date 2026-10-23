import { defineMessages, formatClock, formatDate, getLocale, type Locale } from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    requestFailed: "うまくいきませんでした（{status}）",
    notChecked: "まだ確かめていません",
    checkedAt: "{date} {time} に確かめました",
  },
  en: {
    requestFailed: "Something went wrong ({status})",
    notChecked: "Not checked yet",
    checkedAt: "Checked {date} at {time}",
  },
});

/**
 * 拡張機能のリポジトリの API（管理者だけ）。リポジトリの公開用の枝にある組み立て済みの拡張機能を、入れる・更新する。
 * トークンはサーバーから返らない（hasToken だけ）。
 */

export interface SourceExtension {
  id: string;
  name: string;
  version: string;
  description: string | null;
  /** 入っている版（入っていなければ null） */
  installedVersion: string | null;
  /** 入れると更新になるか */
  updatable: boolean;
}

export interface ExtensionSource {
  id: string;
  name: string;
  url: string;
  branch: string;
  hasToken: boolean;
  checkedAt: string | null;
  commit: string | null;
  error: string | null;
  extensions: SourceExtension[];
}

async function request<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body as T;
}

export async function fetchSources(apiBaseUrl: string): Promise<ExtensionSource[]> {
  return (await request<{ sources: ExtensionSource[] }>(apiBaseUrl, "/api/extension-sources")).sources;
}

export async function addSource(apiBaseUrl: string, input: { url: string; branch: string; token: string; name: string }) {
  return (
    await request<{ source: ExtensionSource }>(apiBaseUrl, "/api/extension-sources", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).source;
}

/** token は空なら今のまま、null なら消す */
export async function updateSource(
  apiBaseUrl: string,
  id: string,
  input: { name?: string; branch?: string; token?: string | null },
) {
  return (
    await request<{ source: ExtensionSource }>(apiBaseUrl, `/api/extension-sources/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  ).source;
}

export function removeSource(apiBaseUrl: string, id: string) {
  return request(apiBaseUrl, `/api/extension-sources/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** すべてのリポジトリを確かめる（自動で更新するものは入れ替わる） */
export function checkSources(apiBaseUrl: string) {
  return request<{ updated: { id: string; version: string; error: string | null }[]; sources: ExtensionSource[] }>(
    apiBaseUrl,
    "/api/extension-sources/check",
    { method: "POST" },
  );
}

/** リポジトリの拡張機能を入れる・更新する */
export function installFromSource(apiBaseUrl: string, sourceId: string, extensionId: string) {
  return request<{ extension: { name: string; version: string; active: boolean; error: string | null } }>(
    apiBaseUrl,
    `/api/extension-sources/${encodeURIComponent(sourceId)}/install`,
    { method: "POST", body: JSON.stringify({ extensionId }) },
  );
}

export function setAutoUpdate(apiBaseUrl: string, extensionId: string, enabled: boolean) {
  return request(apiBaseUrl, `/api/extensions/${encodeURIComponent(extensionId)}/auto-update`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

/** 持ち込んだ拡張機能を本体と同じ権限で動かす（信頼する）か、別のプロセスで権限を絞って動かすか */
export function setExtensionTrusted(apiBaseUrl: string, extensionId: string, trusted: boolean) {
  return request(apiBaseUrl, `/api/extensions/${encodeURIComponent(extensionId)}/trust`, {
    method: "PUT",
    body: JSON.stringify({ trusted }),
  });
}

/** 日時を「10/20 15:04」（英語なら「Oct 20 at 3:04 PM」）の形にする */
export function formatChecked(iso: string | null, locale: Locale = getLocale()): string {
  if (!iso) return messages.t("notChecked", undefined, locale);
  const date = new Date(iso);
  const day = formatDate(date, "monthDay", locale);
  return messages.t("checkedAt", { date: day, time: formatClock(date, locale) }, locale);
}
