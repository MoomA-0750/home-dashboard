import type { FolderKey, MailFolder } from "../mail/types";
import nodemailer from "nodemailer";
import { HttpError } from "@home-dashboard/extension-sdk";
import { checkAddresses, parseMessage, replyHeaders } from "../mime";
import { apiFetch, endpoints } from "../oauth";
import type { AccountContext, CalendarClient, MailClient, RawEvent, RawEventInput } from "./types";
import { jaText } from "../serverMessages";

/** Google カレンダー（Calendar API v3）と Gmail（Gmail API v1）。繰り返しの予定は Google に広げてもらう（singleEvents） */

const calendarUrl = (path: string) => `${endpoints.googleApi}/calendar/v3${path}`;
const gmailUrl = (path: string) => `${endpoints.googleApi}/gmail/v1/users/me${path}`;
const enc = encodeURIComponent;

interface GoogleTime {
  date?: string;
  dateTime?: string;
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: GoogleTime;
  end?: GoogleTime;
  recurringEventId?: string;
}

function toRaw(event: GoogleEvent, calendarId: string): RawEvent {
  const allDay = Boolean(event.start?.date);
  const time = (t?: GoogleTime) => (allDay ? (t?.date ?? "") : new Date(t?.dateTime ?? 0).toISOString());
  return {
    id: event.id,
    calendarId,
    title: event.summary || jaText("untitledEvent"),
    start: time(event.start),
    end: time(event.end ?? event.start),
    allDay,
    location: event.location ?? null,
    description: event.description ?? null,
    recurring: Boolean(event.recurringEventId),
  };
}

function toGoogle(input: RawEventInput) {
  const time = (value: string) => (input.allDay ? { date: value.slice(0, 10) } : { dateTime: new Date(value).toISOString() });
  return {
    summary: input.title,
    location: input.location ?? "",
    description: input.description ?? "",
    start: time(input.start),
    end: time(input.end),
  };
}

export const googleCalendar: CalendarClient = {
  async listCalendars(ctx) {
    const body = await apiFetch<{
      items?: {
        id: string;
        summary?: string;
        summaryOverride?: string;
        backgroundColor?: string;
        accessRole?: string;
        selected?: boolean;
      }[];
    }>(calendarUrl("/users/me/calendarList?maxResults=100"), await ctx.token());
    return (body.items ?? []).map((item) => ({
      id: item.id,
      name: item.summaryOverride || item.summary || jaText("calendarDefault"),
      color: item.backgroundColor ?? null,
      writable: item.accessRole === "owner" || item.accessRole === "writer",
      selected: item.selected === true,
    }));
  },

  async listEvents(ctx, calendarId, range) {
    const params = new URLSearchParams({
      timeMin: new Date(range.from).toISOString(),
      timeMax: new Date(range.to).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const body = await apiFetch<{ items?: GoogleEvent[] }>(
      calendarUrl(`/calendars/${enc(calendarId)}/events?${params}`),
      await ctx.token(),
    );
    return (body.items ?? []).filter((e) => e.status !== "cancelled").map((e) => toRaw(e, calendarId));
  },

  async createEvent(ctx, calendarId, input) {
    const event = await apiFetch<GoogleEvent>(calendarUrl(`/calendars/${enc(calendarId)}/events`), await ctx.token(), {
      method: "POST",
      json: toGoogle(input),
    });
    return toRaw(event, calendarId);
  },

  async updateEvent(ctx, calendarId, eventId, input) {
    const event = await apiFetch<GoogleEvent>(
      calendarUrl(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`),
      await ctx.token(),
      { method: "PATCH", json: toGoogle(input) },
    );
    return toRaw(event, calendarId);
  },

  async deleteEvent(ctx, calendarId, eventId) {
    await apiFetch(calendarUrl(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`), await ctx.token(), {
      method: "DELETE",
    });
  },
};

interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  raw?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

const header = (message: GmailMessage, name: string) =>
  message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

/** 「名前 <address>」を分ける */
function parseFrom(value: string | null) {
  if (!value) return null;
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  return match ? { name: match[1] || null, address: match[2] } : { name: null, address: value.trim() };
}

/** 本文の頭の HTML の文字参照（&#39; など）を戻す */
const decodeEntities = (text: string) =>
  text.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const GMAIL_LABELS: Record<MailFolder, string> = { inbox: "INBOX", sent: "SENT", drafts: "DRAFT", junk: "SPAM", trash: "TRASH" };

export const gmail: MailClient = {
  async unreadCount(ctx) {
    const label = await apiFetch<{ messagesUnread?: number }>(gmailUrl("/labels/INBOX"), await ctx.token());
    return label.messagesUnread ?? 0;
  },

  async listMessages(ctx, { unreadOnly, limit, folder }) {
    const token = await ctx.token();
    const labelId = folder.startsWith("box:") ? folder.slice(4) : GMAIL_LABELS[folder as MailFolder];
    const params = new URLSearchParams({ labelIds: labelId, maxResults: String(limit) });
    // 迷惑メールとゴミ箱は、頼まないと一覧に入らない
    if (folder === "junk" || folder === "trash") params.set("includeSpamTrash", "true");
    if (unreadOnly) params.set("q", "is:unread");
    const list = await apiFetch<{ messages?: { id: string }[] }>(gmailUrl(`/messages?${params}`), token);
    const metadata = new URLSearchParams({ format: "metadata" });
    for (const name of ["From", "To", "Subject", "Date"]) metadata.append("metadataHeaders", name);
    const messages = await Promise.all(
      (list.messages ?? []).map((m) => apiFetch<GmailMessage>(gmailUrl(`/messages/${enc(m.id)}?${metadata}`), token)),
    );
    return messages.map((message) => {
      const date = header(message, "Date");
      return {
        id: message.id,
        from: parseFrom(header(message, "From")),
        to: (header(message, "To") ?? "")
          .split(",")
          .map((part) => parseFrom(part))
          .filter((a): a is NonNullable<typeof a> => a !== null),
        subject: header(message, "Subject") || jaText("noSubject"),
        date: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null,
        unread: message.labelIds?.includes("UNREAD") ?? false,
        snippet: decodeEntities(message.snippet ?? ""),
      };
    });
  },

  async listFolders(ctx) {
    // 自分で作ったラベル（type が user）だけ。受信箱・送信済みなどの決まったものは system
    const body = await apiFetch<{ labels?: { id: string; name: string; type?: string }[] }>(gmailUrl("/labels"), await ctx.token());
    return (body.labels ?? [])
      .filter((label) => label.type === "user")
      // 入れ子のラベルは「親/子」の名前で返る
      .map((label) => ({ id: label.id, path: label.name.split("/") }))
      .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
  },

  async getMessage(ctx, id) {
    const message = await apiFetch<GmailMessage>(gmailUrl(`/messages/${enc(id)}?format=raw`), await ctx.token());
    if (!message.raw) throw new HttpError(404, jaText("mailNotFound"));
    const parsed = await parseMessage(Buffer.from(message.raw, "base64url"), id, message.labelIds?.includes("UNREAD") ?? false);
    return { ...parsed, threadId: message.threadId };
  },

  async setRead(ctx, id, read) {
    await apiFetch(gmailUrl(`/messages/${enc(id)}/modify`), await ctx.token(), {
      method: "POST",
      json: read ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] },
    });
  },

  async move(ctx, id, target, from) {
    const token = await ctx.token();
    const url = (path: string) => gmailUrl(`/messages/${enc(id)}${path}`);
    // ゴミ箱へは専用の口で（30日で消える）。ゴミ箱から出すときも、先に専用の口で戻す
    if (target === "trash") {
      await apiFetch(url("/trash"), token, { method: "POST" });
      return;
    }
    if (from === "trash") await apiFetch(url("/untrash"), token, { method: "POST" });
    // Gmail はフォルダーではなくラベルなので、「移す」は移す先のラベルを付けて、今いるところのラベルを外す
    const labelOf = (folder: FolderKey) => (folder.startsWith("box:") ? folder.slice(4) : GMAIL_LABELS[folder as MailFolder]);
    const remove = from === "inbox" || from === "junk" || from.startsWith("box:") ? [labelOf(from)] : [];
    // 迷惑メールにしたら受信箱から、受信箱に戻したら迷惑メールからも外す
    if (target === "junk") remove.push("INBOX");
    if (target === "inbox") remove.push("SPAM");
    await apiFetch(url("/modify"), token, {
      method: "POST",
      json: { addLabelIds: [labelOf(target)], removeLabelIds: [...new Set(remove)].filter((l) => l !== labelOf(target)) },
    });
  },

  async send(ctx, draft) {
    const headers = replyHeaders(draft);
    let to: string[];
    let cc: string[];
    try {
      to = checkAddresses(draft.to);
      cc = checkAddresses(draft.cc);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : String(err));
    }
    // 送るメールの中身（RFC 822）を作って Gmail に渡す（Gmail が差出人を付け、送信済みに入れる）
    const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const info = await composer.sendMail({
      from: ctx.account.email ?? undefined,
      to,
      cc,
      subject: headers.subject,
      text: draft.text,
      inReplyTo: headers.inReplyTo,
      references: headers.references,
    });
    const raw = Buffer.from(info.message as Buffer).toString("base64url");
    await apiFetch(gmailUrl("/messages/send"), await ctx.token(), {
      method: "POST",
      json: { raw, ...(draft.replyTo?.threadId ? { threadId: draft.replyTo.threadId } : {}) },
    });
  },
};
