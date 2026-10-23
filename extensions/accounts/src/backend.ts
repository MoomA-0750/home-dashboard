import { HttpError } from "@home-dashboard/extension-sdk";
import type { CalendarBackend, CalendarEvent, CalendarInfo, SourceError } from "./calendar/types";
import type { Mailbox, MailboxFolder, MailBackend, MailSummary } from "./mail/types";
import { canSee, type AccountStore, type ProviderKind, type StoredAccount, type Viewer } from "./store";
import type { AccountContext, CalendarClient, MailClient, RawCalendar, RawEvent } from "./providers/types";
import { jaText } from "./serverMessages";
import { SwrCache, TTL } from "./cache";

/**
 * カレンダーとメールの機能の口に渡すもの。見える（本人の・家で共有の）アカウントをまとめて読み、書くときは id から
 * アカウントを探して、その種類のつなぎ方（./providers）へ渡す。
 * 口に渡す id は「アカウントの id.（サービスの中の id を base64url にしたもの）」にして、どのアカウントのものか分かるようにする
 */

export interface Clients {
  calendar: Partial<Record<ProviderKind, CalendarClient>>;
  mail: Partial<Record<ProviderKind, MailClient>>;
}

const encode = (value: string) => Buffer.from(value, "utf-8").toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf-8");

/** 「アカウントの id.部分.部分」を分ける */
function splitId(id: string, parts: number): [string, ...string[]] {
  const pieces = String(id).split(".");
  if (pieces.length !== parts + 1 || pieces.some((p) => !p)) throw new HttpError(400, jaText("badId"));
  const [accountId, ...rest] = pieces;
  return [accountId, ...rest.map(decode)];
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function createBackends(
  store: AccountStore,
  clients: Clients,
  tokenFor: (account: StoredAccount) => Promise<string>,
): { calendar: CalendarBackend; mail: MailBackend; forget: (accountId: string) => void } {
  // 外から読んだものは覚えておき、開き直したときはすぐ返す（キーはアカウントの id で始める。書いたらそのアカウントの分を捨てる）
  const cache = new SwrCache();
  const contextOf = (account: StoredAccount): AccountContext => ({ account, token: () => tokenFor(account) });

  /** 見えるアカウントの中から id のものを探す（見えないものは無いのと同じに扱う） */
  async function accountFor(viewer: Viewer, accountId: string): Promise<StoredAccount> {
    const account = await store.get(accountId);
    if (!account || !canSee(account, viewer)) throw new HttpError(404, jaText("accountNotFound"));
    return account;
  }

  function calendarClient(account: StoredAccount): CalendarClient {
    const client = clients.calendar[account.provider];
    if (!client || !account.services.calendar) throw new HttpError(409, jaText("calendarOff", { label: account.label }));
    return client;
  }

  function mailClient(account: StoredAccount): MailClient {
    const client = clients.mail[account.provider];
    if (!client || !account.services.mail) throw new HttpError(409, jaText("mailOff", { label: account.label }));
    return client;
  }

  const toEvent = (account: StoredAccount, raw: RawEvent): CalendarEvent => ({
    ...raw,
    id: `${account.id}.${encode(raw.calendarId)}.${encode(raw.id)}`,
    calendarId: `${account.id}.${encode(raw.calendarId)}`,
  });

  /** 入っているカレンダーか（決めていなければ、サービスの側で「出す」になっているか。分からなければ入） */
  const enabledOf = (account: StoredAccount, raw: RawCalendar) => account.calendarChoices?.[raw.id] ?? raw.selected ?? true;

  const cachedCalendars = (account: StoredAccount) =>
    cache.get(`${account.id}:cal:calendars`, TTL.calendars, () => calendarClient(account).listCalendars(contextOf(account)));

  async function calendarAccounts(viewer: Viewer) {
    return (await store.visible(viewer)).filter((a) => a.services.calendar && clients.calendar[a.provider]);
  }

  const calendar: CalendarBackend = {
    async listCalendars(viewer) {
      const errors: SourceError[] = [];
      const lists = await Promise.all(
        (await calendarAccounts(viewer)).map(async (account) => {
          try {
            const raws = await cachedCalendars(account);
            return raws.map(
              (raw): CalendarInfo => ({
                id: `${account.id}.${encode(raw.id)}`,
                name: raw.name,
                color: raw.color,
                source: account.label,
                writable: raw.writable,
                shared: account.shared,
                enabled: enabledOf(account, raw),
                // 入／切はアカウントを足した本人だけが変える（家で共有のものは、家族みんなに効くため）
                toggleable: viewer.accountId !== null && account.ownerId === viewer.accountId,
              }),
            );
          } catch (err) {
            errors.push({ source: account.label, message: message(err) });
            return [];
          }
        }),
      );
      return { calendars: lists.flat(), errors };
    },

    async listEvents(viewer, range) {
      const errors: SourceError[] = [];
      const lists = await Promise.all(
        (await calendarAccounts(viewer)).map(async (account) => {
          const ctx = contextOf(account);
          const client = calendarClient(account);
          try {
            const calendars = (await cachedCalendars(account)).filter((c) => enabledOf(account, c));
            const events = await Promise.all(
              calendars.map((c) =>
                cache.get(`${account.id}:cal:events:${c.id}:${range.from}:${range.to}`, TTL.events, () =>
                  client.listEvents(ctx, c.id, range),
                ),
              ),
            );
            return events.flat().map((raw) => toEvent(account, raw));
          } catch (err) {
            errors.push({ source: account.label, message: message(err) });
            return [];
          }
        }),
      );
      const events = lists.flat().sort((a, b) => a.start.localeCompare(b.start));
      return { events, errors };
    },

    async createEvent(viewer, input) {
      const [accountId, calendarId] = splitId(input.calendarId, 1);
      const account = await accountFor(viewer, accountId);
      const raw = await calendarClient(account).createEvent(contextOf(account), calendarId, input);
      cache.forget(`${account.id}:cal:events`);
      return toEvent(account, raw);
    },

    async updateEvent(viewer, eventId, input) {
      const [accountId, calendarId, rawId] = splitId(eventId, 2);
      const [targetAccount] = splitId(input.calendarId, 1);
      if (targetAccount !== accountId) throw new HttpError(400, jaText("cannotMoveAccount"));
      const account = await accountFor(viewer, accountId);
      const raw = await calendarClient(account).updateEvent(contextOf(account), calendarId, rawId, input);
      cache.forget(`${account.id}:cal:events`);
      return toEvent(account, raw);
    },

    async setCalendarEnabled(viewer, calendarId, enabled) {
      const [accountId, rawId] = splitId(calendarId, 1);
      const account = await accountFor(viewer, accountId);
      if (viewer.accountId === null || account.ownerId !== viewer.accountId)
        throw new HttpError(403, jaText("calendarToggleOwnerOnly"));
      await store.update(account.id, (current) => ({
        ...current,
        calendarChoices: { ...current.calendarChoices, [rawId]: enabled },
      }));
    },

    async deleteEvent(viewer, eventId) {
      const [accountId, calendarId, rawId] = splitId(eventId, 2);
      const account = await accountFor(viewer, accountId);
      await calendarClient(account).deleteEvent(contextOf(account), calendarId, rawId);
      cache.forget(`${account.id}:cal:events`);
    },
  };

  async function mailAccounts(viewer: Viewer, mailboxId?: string) {
    return (await store.visible(viewer)).filter(
      (a) => a.services.mail && clients.mail[a.provider] && (!mailboxId || a.id === mailboxId),
    );
  }

  const mail: MailBackend = {
    async listMailboxes(viewer) {
      const errors: SourceError[] = [];
      const boxes = await Promise.all(
        (await mailAccounts(viewer)).map(async (account): Promise<Mailbox | null> => {
          try {
            const unread = await cache.get(`${account.id}:mail:unread`, TTL.unread, () =>
              mailClient(account).unreadCount(contextOf(account)),
            );
            return {
              id: account.id,
              name: account.label,
              address: account.email ?? "",
              unread,
              canSend: account.provider !== "imap" || Boolean(account.servers.smtp),
              shared: account.shared,
            };
          } catch (err) {
            errors.push({ source: account.label, message: message(err) });
            return null;
          }
        }),
      );
      return { mailboxes: boxes.filter((b): b is Mailbox => b !== null), errors };
    },

    async listMessages(viewer, { mailboxId, unreadOnly = false, limit, folder = "inbox" }) {
      const errors: SourceError[] = [];
      const lists = await Promise.all(
        (await mailAccounts(viewer, mailboxId)).map(async (account) => {
          try {
            const raws = await cache.get(`${account.id}:mail:list:${folder}:${unreadOnly}:${limit}`, TTL.messages, () =>
              mailClient(account).listMessages(contextOf(account), { unreadOnly, limit, folder }),
            );
            return raws.map((raw): MailSummary => ({ ...raw, id: `${account.id}.${encode(raw.id)}`, mailboxId: account.id }));
          } catch (err) {
            errors.push({ source: account.label, message: message(err) });
            return [];
          }
        }),
      );
      const messages = lists
        .flat()
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, limit);
      return { messages, errors };
    },

    async listFolders(viewer, mailboxId) {
      const errors: SourceError[] = [];
      const lists = await Promise.all(
        (await mailAccounts(viewer, mailboxId)).map(async (account) => {
          try {
            const raws = await cache.get(`${account.id}:mail:folders`, TTL.folders, () =>
              mailClient(account).listFolders(contextOf(account)),
            );
            return raws.map(
              (raw): MailboxFolder => ({ id: `box:${raw.id}`, name: raw.path.at(-1) ?? raw.id, path: raw.path, mailboxId: account.id }),
            );
          } catch (err) {
            errors.push({ source: account.label, message: message(err) });
            return [];
          }
        }),
      );
      return { folders: lists.flat(), errors };
    },

    async getMessage(viewer, id) {
      const [accountId, rawId] = splitId(id, 1);
      const account = await accountFor(viewer, accountId);
      const raw = await cache.get(`${account.id}:mail:message:${rawId}`, TTL.message, () =>
        mailClient(account).getMessage(contextOf(account), rawId),
      );
      return { ...raw, id, mailboxId: account.id };
    },

    async setRead(viewer, id, read) {
      const [accountId, rawId] = splitId(id, 1);
      const account = await accountFor(viewer, accountId);
      await mailClient(account).setRead(contextOf(account), rawId, read);
      forgetMessages(account.id, rawId);
    },

    async move(viewer, id, target, from) {
      const [accountId, rawId] = splitId(id, 1);
      const account = await accountFor(viewer, accountId);
      if (target === from) return;
      await mailClient(account).move(contextOf(account), rawId, target, from);
      forgetMessages(account.id, rawId);
    },

    async send(viewer, draft) {
      const account = await accountFor(viewer, draft.mailboxId);
      const client = mailClient(account);
      let replyTo = null;
      if (draft.replyTo) {
        const [replyAccount, rawId] = splitId(draft.replyTo, 1);
        if (replyAccount !== account.id) throw new HttpError(400, jaText("replySameAccount"));
        replyTo = await client.getMessage(contextOf(account), rawId);
      }
      if (draft.to.length === 0) throw new HttpError(400, jaText("noRecipients"));
      await client.send(contextOf(account), {
        to: draft.to,
        cc: draft.cc ?? [],
        subject: draft.subject,
        text: draft.text,
        replyTo,
      });
      forgetMessages(account.id);
    },
  };

  /** メールを変えたら、一覧・未読の数（と、そのメール）を捨てる。メールボックスの一覧は変わらないので残す */
  function forgetMessages(accountId: string, rawId?: string) {
    cache.forget(`${accountId}:mail:list:`);
    cache.forget(`${accountId}:mail:unread`);
    if (rawId) cache.forget(`${accountId}:mail:message:${rawId}`);
  }

  return { calendar, mail, forget: (accountId) => cache.forget(`${accountId}:`) };
}
