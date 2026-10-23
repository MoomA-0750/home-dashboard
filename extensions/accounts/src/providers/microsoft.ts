import type { MailFolder } from "../mail/types";
import { HttpError } from "@home-dashboard/extension-sdk";
import { checkAddresses, htmlToText, snippetOf } from "../mime";
import { apiFetch, endpoints } from "../oauth";
import type { AccountContext, CalendarClient, MailClient, RawAddress, RawEvent, RawEventInput, RawMailMessage } from "./types";
import { jaText } from "../serverMessages";

/**
 * Outlook.com・Microsoft 365 のカレンダーとメール（Microsoft Graph）。時刻は UTC で受け取る（Prefer: outlook.timezone）。
 * 繰り返しの予定は calendarView で Microsoft に広げてもらう
 */

const graphUrl = (path: string) => `${endpoints.graph}${path}`;
const enc = encodeURIComponent;
const UTC = { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' };

interface GraphTime {
  dateTime: string;
  timeZone: string;
}

interface GraphEvent {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  start: GraphTime;
  end: GraphTime;
  location?: { displayName?: string };
  body?: { content?: string };
  bodyPreview?: string;
  type?: string;
}

/** Graph の UTC の時刻（Z が付かない）を ISO にする */
const utc = (time: GraphTime) => new Date(`${time.dateTime.replace(/Z$/, "")}Z`).toISOString();

function toRaw(event: GraphEvent, calendarId: string): RawEvent {
  const allDay = Boolean(event.isAllDay);
  return {
    id: event.id,
    calendarId,
    title: event.subject || jaText("untitledEvent"),
    start: allDay ? event.start.dateTime.slice(0, 10) : utc(event.start),
    end: allDay ? event.end.dateTime.slice(0, 10) : utc(event.end),
    allDay,
    location: event.location?.displayName || null,
    description: (event.body?.content || event.bodyPreview || "").trim() || null,
    recurring: event.type === "occurrence" || event.type === "exception",
  };
}

function toGraph(input: RawEventInput) {
  // 終日は、その日の0時（UTC として渡し、isAllDay で日付だけが使われる）
  const time = (value: string) => ({
    dateTime: input.allDay ? `${value.slice(0, 10)}T00:00:00` : new Date(value).toISOString().replace(/Z$/, ""),
    timeZone: "UTC",
  });
  return {
    subject: input.title,
    isAllDay: input.allDay,
    start: time(input.start),
    end: time(input.end),
    location: { displayName: input.location ?? "" },
    body: { contentType: "text", content: input.description ?? "" },
  };
}

export const microsoftCalendar: CalendarClient = {
  async listCalendars(ctx) {
    const body = await apiFetch<{ value?: { id: string; name?: string; hexColor?: string; canEdit?: boolean }[] }>(
      graphUrl("/me/calendars?$top=100"),
      await ctx.token(),
    );
    return (body.value ?? []).map((calendar) => ({
      id: calendar.id,
      name: calendar.name || jaText("calendarDefault"),
      color: calendar.hexColor || null,
      writable: calendar.canEdit !== false,
    }));
  },

  async listEvents(ctx, calendarId, range) {
    const params = new URLSearchParams({
      startDateTime: new Date(range.from).toISOString(),
      endDateTime: new Date(range.to).toISOString(),
      $top: "250",
      $select: "id,subject,isAllDay,isCancelled,start,end,location,bodyPreview,type",
      $orderby: "start/dateTime",
    });
    const body = await apiFetch<{ value?: GraphEvent[] }>(
      graphUrl(`/me/calendars/${enc(calendarId)}/calendarView?${params}`),
      await ctx.token(),
      { headers: UTC },
    );
    return (body.value ?? []).filter((e) => !e.isCancelled).map((e) => toRaw(e, calendarId));
  },

  async createEvent(ctx, calendarId, input) {
    const event = await apiFetch<GraphEvent>(graphUrl(`/me/calendars/${enc(calendarId)}/events`), await ctx.token(), {
      method: "POST",
      json: toGraph(input),
      headers: UTC,
    });
    return toRaw(event, calendarId);
  },

  async updateEvent(ctx, calendarId, eventId, input) {
    const event = await apiFetch<GraphEvent>(graphUrl(`/me/events/${enc(eventId)}`), await ctx.token(), {
      method: "PATCH",
      json: toGraph(input),
      headers: UTC,
    });
    return toRaw(event, calendarId);
  },

  async deleteEvent(ctx, _calendarId, eventId) {
    await apiFetch(graphUrl(`/me/events/${enc(eventId)}`), await ctx.token(), { method: "DELETE" });
  },
};

interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  isRead?: boolean;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  internetMessageId?: string;
}

const address = (r?: GraphRecipient): RawAddress | null =>
  r?.emailAddress?.address ? { name: r.emailAddress.name || null, address: r.emailAddress.address } : null;
const recipients = (list?: GraphRecipient[]) => (list ?? []).map(address).filter((a): a is RawAddress => a !== null);
const toRecipients = (list: string[]) => list.map((a) => ({ emailAddress: { address: a } }));

function addresses(list: string[]): string[] {
  try {
    return checkAddresses(list);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : String(err));
  }
}

// Microsoft Graph のよく知られたフォルダーの名前
const GRAPH_FOLDERS: Record<MailFolder, string> = {
  inbox: "inbox",
  sent: "sentitems",
  drafts: "drafts",
  junk: "junkemail",
  trash: "deleteditems",
};

// 一覧に出さない、決まったフォルダー（左の欄の決まったものと、送信トレイ・会話の履歴など）
const HIDDEN_FOLDERS = [...Object.values(GRAPH_FOLDERS), "outbox", "conversationhistory", "syncissues", "scheduled"];

export const outlookMail: MailClient = {
  async listFolders(ctx) {
    const token = await ctx.token();
    type GraphFolder = { id: string; displayName?: string; isHidden?: boolean; childFolderCount?: number };
    const select = "$top=100&$select=id,displayName,isHidden,childFolderCount";
    // 入れ子のフォルダーは、子を持つものだけ下を読む（深さは4段まで）
    const walk = async (url: string, parents: string[], depth: number): Promise<{ folder: GraphFolder; path: string[] }[]> => {
      const body = await apiFetch<{ value?: GraphFolder[] }>(url, token);
      const here = (body.value ?? []).filter((f) => !f.isHidden).map((folder) => ({ folder, path: [...parents, folder.displayName || folder.id] }));
      const nested = await Promise.all(
        here
          .filter(({ folder }) => depth < 4 && (folder.childFolderCount ?? 0) > 0)
          .map(({ folder, path }) => walk(graphUrl(`/me/mailFolders/${enc(folder.id)}/childFolders?${select}`), path, depth + 1)),
      );
      return [...here, ...nested.flat()];
    };
    const [list, ...known] = await Promise.all([
      walk(graphUrl(`/me/mailFolders?${select}`), [], 1),
      // 決まったフォルダーの id（名前は言語で変わるので、id で見分ける）。無いものは飛ばす
      ...HIDDEN_FOLDERS.map((name) =>
        apiFetch<{ id: string }>(graphUrl(`/me/mailFolders/${name}?$select=id`), token).catch(() => null),
      ),
    ]);
    const hidden = new Set(known.filter((f): f is { id: string } => f !== null).map((f) => f.id));
    // 決まったフォルダーの下に作ったフォルダーは出す（受信箱の下の「仕事」など）
    return list
      .filter(({ folder }) => !hidden.has(folder.id))
      .map(({ folder, path }) => ({ id: folder.id, path }))
      .sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
  },

  async unreadCount(ctx) {
    const folder = await apiFetch<{ unreadItemCount?: number }>(graphUrl("/me/mailFolders/inbox"), await ctx.token());
    return folder.unreadItemCount ?? 0;
  },

  async listMessages(ctx, { unreadOnly, limit, folder }) {
    const params = new URLSearchParams({
      $top: String(limit),
      $select: "id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview",
      $orderby: "receivedDateTime desc",
    });
    if (unreadOnly) params.set("$filter", "isRead eq false");
    const body = await apiFetch<{ value?: GraphMessage[] }>(graphUrl(`/me/mailFolders/${folder.startsWith("box:") ? enc(folder.slice(4)) : GRAPH_FOLDERS[folder as MailFolder]}/messages?${params}`), await ctx.token());
    return (body.value ?? []).map((m) => ({
      id: m.id,
      from: address(m.from),
      to: recipients(m.toRecipients),
      subject: m.subject || jaText("noSubject"),
      date: m.receivedDateTime ? new Date(m.receivedDateTime).toISOString() : null,
      unread: !m.isRead,
      snippet: snippetOf(m.bodyPreview ?? ""),
    }));
  },

  async getMessage(ctx, id): Promise<RawMailMessage> {
    const params = new URLSearchParams({
      $select: "id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,body,internetMessageId",
    });
    const m = await apiFetch<GraphMessage>(graphUrl(`/me/messages/${enc(id)}?${params}`), await ctx.token(), { headers: UTC });
    const content = m.body?.content ?? "";
    const text = (m.body?.contentType === "html" ? htmlToText(content) : content).trim();
    return {
      id: m.id,
      from: address(m.from),
      to: recipients(m.toRecipients),
      cc: recipients(m.ccRecipients),
      subject: m.subject || jaText("noSubject"),
      date: m.receivedDateTime ? new Date(m.receivedDateTime).toISOString() : null,
      unread: !m.isRead,
      text,
      snippet: snippetOf(text),
      messageId: m.internetMessageId ?? null,
      references: [],
    };
  },

  async setRead(ctx, id, read) {
    await apiFetch(graphUrl(`/me/messages/${enc(id)}`), await ctx.token(), { method: "PATCH", json: { isRead: read } });
  },

  async move(ctx, id, target) {
    const destinationId = target.startsWith("box:") ? target.slice(4) : GRAPH_FOLDERS[target as MailFolder];
    await apiFetch(graphUrl(`/me/messages/${enc(id)}/move`), await ctx.token(), { method: "POST", json: { destinationId } });
  },

  async send(ctx: AccountContext, draft) {
    const token = await ctx.token();
    const to = addresses(draft.to);
    const cc = addresses(draft.cc);
    if (draft.replyTo) {
      // 返信は Microsoft の返信の口で（件名の RE: と、元のメールとのつながりを Microsoft が付ける）
      await apiFetch(graphUrl(`/me/messages/${enc(draft.replyTo.id)}/reply`), token, {
        method: "POST",
        json: { message: { toRecipients: toRecipients(to), ccRecipients: toRecipients(cc) }, comment: draft.text },
      });
      return;
    }
    await apiFetch(graphUrl("/me/sendMail"), token, {
      method: "POST",
      json: {
        message: {
          subject: draft.subject,
          body: { contentType: "Text", content: draft.text },
          toRecipients: toRecipients(to),
          ccRecipients: toRecipients(cc),
        },
        saveToSentItems: true,
      },
    });
  },
};
