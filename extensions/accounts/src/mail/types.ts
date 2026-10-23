/**
 * メールの機能の口「mail」の形。メールを持つ拡張機能（インターネットアカウントなど）は、
 * この MailBackend を api.provide("mail", backend) で渡す。画面・ウィジェット・音声アシスタントのツールは
 * メールの拡張機能が持ち、入っているものをまとめて扱う。
 */

/**
 * 誰として見るか。accountId はログインしている人（自分の分と、家で共有するものが見える）。
 * null は音声アシスタントなどからで、家で共有するものだけが見える
 */
export interface Viewer {
  accountId: string | null;
}

export interface MailAddress {
  name: string | null;
  address: string;
}

/** 受信箱1つ（アカウント1つ） */
export interface Mailbox {
  /** 口に入っているもの全体で一意な id */
  id: string;
  /** 画面に出す名前（「自分の Gmail」など） */
  name: string;
  address: string;
  unread: number;
  /** 送れるか */
  canSend: boolean;
  /** 家で共有しているか（音声アシスタントでも読める） */
  shared: boolean;
}

/** 受信箱のほかに読めるフォルダー（どのサービスにもあるものだけ） */
export type MailFolder = "inbox" | "sent" | "drafts" | "junk" | "trash";
export const MAIL_FOLDERS: MailFolder[] = ["inbox", "sent", "drafts", "junk", "trash"];

/** 読むフォルダー。決まったフォルダーか、自分で作ったメールボックス（「box:」＋サービスの中の id） */
export type FolderKey = MailFolder | `box:${string}`;

export function isFolderKey(value: unknown): value is FolderKey {
  return (
    (typeof value === "string" && (MAIL_FOLDERS as string[]).includes(value)) ||
    (typeof value === "string" && value.startsWith("box:") && value.length > 4 && value.length <= 500)
  );
}

/** メールを移せる先（送信済み・下書きへは移さない） */
export function isMoveTarget(value: unknown): value is FolderKey {
  return isFolderKey(value) && value !== "sent" && value !== "drafts";
}

/** 自分で作ったメールボックス（Gmail のラベル、Outlook・IMAP のフォルダー） */
export interface MailboxFolder {
  /** listMessages の folder に渡す（「box:…」） */
  id: string;
  /** 階層の最後の名前（「etc/Amazon」なら「Amazon」） */
  name: string;
  /** 階層（「etc/Amazon」なら ["etc", "Amazon"]）。画面はこれでツリーにする */
  path: string[];
  /** どのアカウント（受信箱）のものか */
  mailboxId: string;
}

export interface MailSummary {
  /** 読む・既読にする・返信するときに渡す id */
  id: string;
  mailboxId: string;
  from: MailAddress | null;
  subject: string;
  /** ISO 8601 */
  date: string | null;
  unread: boolean;
  /** 本文の頭（1行ほど） */
  snippet: string;
  /** 宛先（送信済み・下書きで、差出人の代わりに出す。分からなければ無し） */
  to?: MailAddress[];
}

export interface MailMessage extends MailSummary {
  to: MailAddress[];
  cc: MailAddress[];
  /** 本文（文字だけ。HTML のメールは文字にしたもの） */
  text: string;
}

export interface MailDraft {
  mailboxId: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  /** 返信なら、返信するメールの id（件名・宛先のつながりを付ける） */
  replyTo?: string | null;
}

export interface SourceError {
  source: string;
  message: string;
}

export interface MailBackend {
  listMailboxes(viewer: Viewer): Promise<{ mailboxes: Mailbox[]; errors: SourceError[] }>;
  /** 新しい順。mailboxId を省くとすべての受信箱から */
  listMessages(
    viewer: Viewer,
    options: { mailboxId?: string; unreadOnly?: boolean; limit: number; folder?: FolderKey },
  ): Promise<{ messages: MailSummary[]; errors: SourceError[] }>;
  /** 自分で作ったメールボックス。mailboxId を省くとすべてのアカウントから（持たない出どころは無くてよい） */
  listFolders?(viewer: Viewer, mailboxId?: string): Promise<{ folders: MailboxFolder[]; errors: SourceError[] }>;
  getMessage(viewer: Viewer, id: string): Promise<MailMessage>;
  setRead(viewer: Viewer, id: string, read: boolean): Promise<void>;
  /** 別のフォルダーへ移す（ゴミ箱へ移すのが「削除」）。from は今いるフォルダー（Gmail で外すラベル） */
  move?(viewer: Viewer, id: string, target: FolderKey, from: FolderKey): Promise<void>;
  send(viewer: Viewer, draft: MailDraft): Promise<void>;
}
