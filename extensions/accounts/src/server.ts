import { randomUUID } from "node:crypto";
import { defineServerExtension, HttpError, type ExtensionAccount, type Locale, type ServerExtensionApi } from "@home-dashboard/extension-sdk";
import { createBackends, type Clients } from "./backend";
import { registerCalendar } from "./calendar/routes";
import { isPublicHost } from "./destination";
import { registerMail } from "./mail/routes";
import { finishOAuth, oauthAvailable, startOAuth, tokenFor, type OAuthProvider } from "./oauth";
import { caldavCalendar, forgetCaldavClient, icalUrlCalendar } from "./providers/caldav";
import { gmail, googleCalendar } from "./providers/google";
import { forgetImapAccount, imapMail } from "./providers/imap";
import { microsoftCalendar, outlookMail } from "./providers/microsoft";
import {
  AccountStore,
  supportsOf,
  toInfo,
  type Credentials,
  type Editor,
  type ProviderKind,
  type ServerSettings,
  type StoredAccount,
} from "./store";
import { errorText, jaText, localize, localizedRoute, serverMessages } from "./serverMessages";

/**
 * カレンダー・メールの拡張機能のサーバー側。インターネットアカウントを人ごとに置き、そのカレンダーとメールを出す。
 * ほかの拡張機能も、機能の口「calendar」「mail」に入れば、同じ画面・ウィジェット・音声アシスタントに出る。
 * - /providers … 足せる種類（Google・Microsoft はクライアントが設定してあるときだけ）
 * - /accounts … 自分の（と家で共有の）アカウント。足す・変える・外す・確かめる
 * - /oauth/<google|microsoft>/start … ログインのページへ。戻り先は /auth/accounts/<種類>/callback
 * - /calendar/*・/mail/* … カレンダーとメール（./calendar/routes・./mail/routes）
 */

const CLIENTS: Clients = {
  calendar: {
    google: googleCalendar,
    microsoft: microsoftCalendar,
    icloud: caldavCalendar,
    caldav: caldavCalendar,
    ical: icalUrlCalendar,
  },
  mail: { google: gmail, microsoft: outlookMail, icloud: imapMail, imap: imapMail },
};

const PASSWORD_KINDS: ProviderKind[] = ["icloud", "imap", "caldav", "ical"];
const OAUTH_KINDS: OAuthProvider[] = ["google", "microsoft"];

function requireUser(account: ExtensionAccount | null): Editor {
  if (!account) throw new HttpError(401, jaText("loginRequired"));
  return { id: account.id, role: account.role };
}

const text = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function server(value: unknown, fallbackPort: number, fallbackSecure: boolean) {
  const v = (value ?? {}) as { host?: unknown; port?: unknown; secure?: unknown };
  const host = text(v.host, 253);
  if (!host) return undefined;
  if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new HttpError(400, jaText("badHost", { host }));
  const port = v.port === undefined || v.port === "" ? fallbackPort : Number(v.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HttpError(400, jaText("badPort"));
  return { host, port, secure: typeof v.secure === "boolean" ? v.secure : fallbackSecure };
}

/** パスワードで足すアカウント（iCloud・一般）の中身を確かめる */
function passwordAccount(body: Record<string, unknown>): {
  provider: ProviderKind;
  credentials: Credentials;
  servers: ServerSettings;
  email: string | null;
} {
  const provider = body.provider as ProviderKind;
  if (!PASSWORD_KINDS.includes(provider)) throw new HttpError(400, jaText("kindNotAddable"));
  const username = text(body.username, 320);
  const password = typeof body.password === "string" ? body.password : "";
  const servers: ServerSettings = {};
  if (provider === "imap") {
    servers.imap = server(body.imap, 993, true);
    servers.smtp = server(body.smtp, 587, false);
    if (!servers.imap) throw new HttpError(400, jaText("imapRequired"));
  }
  if (provider === "caldav" || provider === "ical") {
    const url = text(body.calendarUrl, 2000);
    const pattern = provider === "caldav" ? /^https:\/\/\S+$/ : /^(https?|webcal):\/\/\S+$/;
    if (!pattern.test(url))
      throw new HttpError(400, jaText(provider === "caldav" ? "caldavUrlRequired" : "calendarUrlRequired"));
    servers.calendarUrl = url;
  }
  if (provider === "ical") return { provider, credentials: { kind: "none" }, servers, email: null };
  if (!username || !password) throw new HttpError(400, jaText("credentialsRequired"));
  const email = text(body.email, 320) || (username.includes("@") ? username : null);
  return { provider, credentials: { kind: "password", username, password }, servers, email };
}

/** 管理者でない人の接続先は外のサーバーだけ（destination.ts）。iCal も https に限る */
async function requirePublicDestinations(servers: ServerSettings, locale: Locale): Promise<void> {
  const hosts = [servers.imap?.host, servers.smtp?.host];
  if (servers.calendarUrl) {
    const url = new URL(servers.calendarUrl.replace(/^webcal:\/\//, "https://"));
    if (url.protocol !== "https:") throw new HttpError(400, serverMessages.t(locale, "httpsOnly"));
    hosts.push(url.hostname);
  }
  for (const host of hosts) {
    if (host && !(await isPublicHost(host))) throw new HttpError(400, serverMessages.t(locale, "internalHost", { host }));
  }
}

export default defineServerExtension({
  register(api) {
    const store = new AccountStore(api.dataDir);
    const backends = createBackends(store, CLIENTS, (account) => tokenFor(account, api.settings, store));
    const own = { extensionId: api.manifest.id, name: api.manifest.name };
    const route = localizedRoute(api);
    registerCalendar(api, { ...own, implementation: backends.calendar });
    registerMail(api, { ...own, implementation: backends.mail });

    const forget = (id: string) => {
      backends.forget(id);
      forgetCaldavClient(id);
      forgetImapAccount(id);
    };

    /** つながるかを確かめる（使うものだけ）。だめなら理由を投げる */
    async function check(account: StoredAccount, locale: Locale): Promise<string> {
      const ctx = { account, token: () => tokenFor(account, api.settings, store) };
      const t = (key: Parameters<typeof serverMessages.t>[1], params?: Record<string, string | number>) =>
        serverMessages.t(locale, key, params);
      const done: string[] = [];
      if (account.services.calendar && CLIENTS.calendar[account.provider]) {
        const calendars = await CLIENTS.calendar[account.provider]!.listCalendars(ctx);
        done.push(t("connectedCalendars", { n: calendars.length }));
      }
      if (account.services.mail && CLIENTS.mail[account.provider]) {
        const unread = await CLIENTS.mail[account.provider]!.unreadCount(ctx);
        done.push(t("connectedUnread", { n: unread }));
      }
      return t("connected", { detail: done.join(t("connectedSeparator")) || t("connectedNothing") });
    }

    route("GET", "/providers", () => ({
      google: oauthAvailable("google", api.settings),
      microsoft: oauthAvailable("microsoft", api.settings),
    }));

    route("GET", "/accounts", async ({ account }) => {
      const user = requireUser(account);
      const visible = await store.visible({ accountId: user.id });
      return { accounts: visible.map((a) => toInfo(a, user)) };
    });

    route("POST", "/accounts", async ({ account, body, locale }) => {
      const user = requireUser(account);
      const input = (body ?? {}) as Record<string, unknown>;
      const parsed = passwordAccount(input);
      if (user.role !== "admin") await requirePublicDestinations(parsed.servers, locale);
      const supports = supportsOf(parsed);
      const draft: StoredAccount = {
        // 確かめの間の覚え（未読数・CalDAV の接続）が、ほかの人の確かめと混ざらないよう、毎回ちがう id にする
        id: `draft-${randomUUID()}`,
        createdAt: "",
        ...parsed,
        label: text(input.label, 40) || parsed.email || defaultLabel(parsed, locale),
        ownerId: user.id,
        shared: input.shared === true,
        services: supports,
      };
      // 足す前につながるかを確かめる（間違ったパスワードを置かない）
      try {
        await check(draft, locale);
      } catch (err) {
        throw new HttpError(400, errorText(err));
      } finally {
        forget(draft.id);
      }
      const { id: _id, createdAt: _createdAt, ...rest } = draft;
      return { account: toInfo(await store.add(rest), user) };
    });

    route("PATCH", "/accounts/:id", async ({ account, params, body }) => {
      const user = requireUser(account);
      await store.owned(params.id, user);
      const input = (body ?? {}) as Record<string, unknown>;
      const next = await store.update(params.id, (current) => {
        const supports = supportsOf(current);
        const services = (input.services ?? {}) as { calendar?: unknown; mail?: unknown };
        const password = typeof input.password === "string" && input.password ? input.password : null;
        return {
          ...current,
          label: text(input.label, 40) || current.label,
          shared: typeof input.shared === "boolean" ? input.shared : current.shared,
          services: {
            calendar: supports.calendar && (typeof services.calendar === "boolean" ? services.calendar : current.services.calendar),
            mail: supports.mail && (typeof services.mail === "boolean" ? services.mail : current.services.mail),
          },
          credentials:
            password && current.credentials.kind === "password" ? { ...current.credentials, password } : current.credentials,
        };
      });
      forget(params.id);
      return { account: toInfo(next, user) };
    });

    route("DELETE", "/accounts/:id", async ({ account, params }) => {
      const user = requireUser(account);
      await store.owned(params.id, user);
      await store.remove(params.id);
      forget(params.id);
      return { ok: true };
    });

    route("POST", "/accounts/:id/test", async ({ account, params, locale }) => {
      const user = requireUser(account);
      const target = await store.owned(params.id, user);
      forget(params.id);
      try {
        return { ok: true, message: await check(target, locale) };
      } catch (err) {
        return { ok: false, message: localize(errorText(err), locale) };
      }
    });

    for (const provider of OAUTH_KINDS) {
      // ログインのページの URL（画面がそこへ移る）。account を付けると、そのアカウントのログインし直し
      route("GET", `/oauth/${provider}/start`, async ({ account, query }) => {
        const user = requireUser(account);
        const reauth = query.account ? (await store.owned(query.account, user)).id : null;
        return { url: startOAuth(provider, user.id, api.settings, reauth) };
      });
      // ログインのページからの戻り先（/auth/accounts/<種類>/callback でも受ける）
      // ダッシュボードのログイン（cookie）が付いてこないこともあるので、ログインの要らない道にし、だれのものかは state で決める
      // （Android でアプリとして開いたダッシュボードから、ログインの画面が別のブラウザーで開いたときなど）。
      // そのときは戻った画面がログインしていないので、signedOut を付けて「元の画面に戻って」と出してもらう
      route(
        "GET",
        `/auth/${provider}/callback`,
        async ({ account, query, locale }) => {
          const signedOut = account ? "" : "&signedOut=1";
          try {
            const added = await finishOAuth(provider, query, account?.id ?? null, api.settings, store);
            forget(added.id);
            return api.redirect(`/?settings=account&added=${encodeURIComponent(added.label)}${signedOut}`);
          } catch (err) {
            const message = localize(errorText(err), locale);
            return api.redirect(`/?settings=account&error=${encodeURIComponent(message)}${signedOut}`);
          }
        },
        { public: true },
      );
    }

    void migrateLegacyMail(api, store);
  },
});

/**
 * 前のメールの拡張機能の設定（.env の MAIL_*）を、家のアカウント（家で共有する・管理者が変える）として一度だけ移す
 */
async function migrateLegacyMail(api: ServerExtensionApi, store: AccountStore): Promise<void> {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USER?.trim();
  const password = process.env.MAIL_PASSWORD;
  if (!host || !user || !password) return;
  const all = await store.all();
  if (all.some((a) => a.provider === "imap" && a.credentials.kind === "password" && a.credentials.username === user)) return;
  try {
    await store.add({
      provider: "imap",
      label: user,
      email: user.includes("@") ? user : null,
      ownerId: "",
      shared: true,
      services: { calendar: false, mail: true },
      credentials: { kind: "password", username: user, password },
      servers: {
        imap: {
          host,
          port: Number(process.env.MAIL_PORT ?? 993) || 993,
          secure: process.env.MAIL_SECURE !== "false",
        },
      },
    });
    api.log.info(`前のメールの設定（${user}）を、家のアカウントとして移しました`);
  } catch (err) {
    api.log.warn("前のメールの設定を移せませんでした", err instanceof Error ? err.message : err);
  }
}

/** 名前を入れなかったときの名前（メールアドレスが無いもの） */
function defaultLabel(account: { provider: ProviderKind; servers: ServerSettings }, locale: Locale): string {
  if (account.provider === "icloud") return "iCloud";
  if (account.provider === "ical") return serverMessages.t(locale, "defaultLabelIcal");
  const url = account.servers.calendarUrl;
  if (url) {
    try {
      return new URL(url.replace(/^webcal:/, "https:")).hostname;
    } catch {
      // URL が読めなければ下へ
    }
  }
  return account.servers.imap?.host ?? serverMessages.t(locale, "defaultLabelAccount");
}
