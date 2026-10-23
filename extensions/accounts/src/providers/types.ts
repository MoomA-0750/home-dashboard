import type { FolderKey } from "../mail/types";
import type { EventInput } from "../calendar/types";
import type { StoredAccount } from "../store";

/**
 * アカウントの種類ごとの、つなぎ方（Google・Microsoft・CalDAV・iCal・IMAP）。
 * id はそのサービスの中のもの（カレンダー・予定・メールの id）。口に渡すときに、アカウントの id を付けて一意にする（../backend）
 */

/** つなぐときに使うもの。OAuth のアカウントは token() で使える access token を得る（切れていれば取り直す） */
export interface AccountContext {
  account: StoredAccount;
  token(): Promise<string>;
}

export interface RawCalendar {
  id: string;
  name: string;
  color: string | null;
  writable: boolean;
  /** サービスの側で「出す」になっているか（Google カレンダーの左の一覧のチェック）。入／切を決めていないときの既定にする */
  selected?: boolean;
}

export interface RawEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  recurring: boolean;
}

/** 予定を足す・変えるときに渡すもの（どのカレンダーかは別に渡す） */
export type RawEventInput = Omit<EventInput, "calendarId">;

export interface CalendarClient {
  listCalendars(ctx: AccountContext): Promise<RawCalendar[]>;
  listEvents(ctx: AccountContext, calendarId: string, range: { from: string; to: string }): Promise<RawEvent[]>;
  createEvent(ctx: AccountContext, calendarId: string, input: RawEventInput): Promise<RawEvent>;
  updateEvent(ctx: AccountContext, calendarId: string, eventId: string, input: RawEventInput): Promise<RawEvent>;
  deleteEvent(ctx: AccountContext, calendarId: string, eventId: string): Promise<void>;
}

export interface RawAddress {
  name: string | null;
  address: string;
}

export interface RawMailSummary {
  /** IMAP では、受信箱のほかのフォルダーのものに「フォルダー:」を頭に付ける（同じ番号がフォルダーごとにあるため） */
  id: string;
  from: RawAddress | null;
  subject: string;
  date: string | null;
  unread: boolean;
  snippet: string;
  to?: RawAddress[];
}

export interface RawMailMessage extends RawMailSummary {
  to: RawAddress[];
  cc: RawAddress[];
  text: string;
  /** 返信のつながりに使う Message-ID・References（分かれば） */
  messageId: string | null;
  references: string[];
  /** Gmail のスレッド（返信を同じスレッドに入れる） */
  threadId?: string;
}

export interface RawDraft {
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  /** 返信なら、返信するメール */
  replyTo: RawMailMessage | null;
}

export interface MailClient {
  unreadCount(ctx: AccountContext): Promise<number>;
  listMessages(
    ctx: AccountContext,
    options: { unreadOnly: boolean; limit: number; folder: FolderKey },
  ): Promise<RawMailSummary[]>;
  /** 自分で作ったメールボックス（決まったフォルダーは除く）。id は listMessages の「box:」の後ろに付けて渡す */
  listFolders(ctx: AccountContext): Promise<{ id: string; path: string[] }[]>;
  getMessage(ctx: AccountContext, id: string): Promise<RawMailMessage>;
  setRead(ctx: AccountContext, id: string, read: boolean): Promise<void>;
  /** 別のフォルダーへ移す。from は今いるフォルダー */
  move(ctx: AccountContext, id: string, target: FolderKey, from: FolderKey): Promise<void>;
  send(ctx: AccountContext, draft: RawDraft): Promise<void>;
}
