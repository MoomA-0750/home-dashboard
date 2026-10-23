import {
  defineServerMessages,
  HttpError,
  type Locale,
  type MessageParams,
  type MessageValue,
  type RouteHandler,
  type RouteOptions,
  type HttpMethod,
  type ServerExtensionApi,
} from "@home-dashboard/extension-sdk";

/**
 * サーバー側で画面に返す文の、日本語と英語の辞書。
 * エラーは奥（アカウントのつなぎ方・まとめ役）で日本語の文として投げ（音声アシスタントには日本語で返す）、
 * 画面へ返す道の出口で、その文を辞書の日本語から探して、呼んだ画面の言語の文に直す（localize）
 */

const ja = {
  // 道
  loginRequired: "ログインしてください",
  badHost: "サーバーの名前が正しくありません: {host}",
  internalHost: "{host} は家の中か、引けない名前です。家の中のサーバーを足せるのは管理者だけです",
  httpsOnly: "カレンダーの URL は https（か webcal）にしてください",
  badPort: "ポートが正しくありません",
  kindNotAddable: "その種類は、この画面からは足せません",
  imapRequired: "IMAP のサーバーを入れてください",
  caldavUrlRequired: "CalDAV の URL（https://…）を入れてください",
  calendarUrlRequired: "カレンダーの URL を入れてください",
  credentialsRequired: "ユーザー名とパスワードを入れてください",
  connected: "つながりました（{detail}）",
  connectedCalendars: "カレンダー {n}件",
  connectedUnread: "未読のメール {n}通",
  connectedNothing: "使うものがありません",
  connectedSeparator: "・",
  rangeRequired: "from と to が要ります",
  // アカウント
  badId: "id の形が違います",
  accountNotFound: "そのアカウントは見つかりません",
  calendarOff: "{label} のカレンダーは使っていません",
  mailOff: "{label} のメールは使っていません",
  cannotMoveAccount: "ほかのアカウントのカレンダーへは移せません",
  replySameAccount: "返信は、受け取ったアカウントから送ってください",
  noRecipients: "宛先がありません",
  tooManyAccounts: "アカウントが多すぎます",
  badAddress: "宛先の形が違います: {address}",
  timeUnreadable: "時刻が読めません",
  timeUnreadableValue: "時刻が読めません: {value}",
  eventMissing: "予定が見つかりません",
  // ログイン（OAuth）
  oauthNotConfigured:
    "{provider} のクライアント ID とシークレットが設定されていません（管理者が「拡張機能 → カレンダー・メール」で入れます）",
  redirectBaseMissing: "戻り先の URL の頭が設定されていません（管理者が「拡張機能 → カレンダー・メール」で入れます）",
  loginExpired: "ログインが切れました。設定の「アカウント → インターネットアカウント」でログインし直してください",
  loginFailed: "ログインできませんでした（{reason}）",
  loginCancelled: "ログインを取りやめました（{reason}）",
  loginStale: "時間が経ちすぎたか、別の画面で始めたログインです。もう一度足してください",
  loginWrongUser: "始めたのと同じアカウントでダッシュボードにログインしてください",
  noRefreshToken: "ずっと使うための許し（refresh token）がもらえませんでした。もう一度足してください",
  notOAuth: "このアカウントは OAuth ではありません",
  forbidden: "許しが足りません（{reason}）。ログインし直してください",
  scopesMissing:
    "{provider} のカレンダーとメールを使う許しがもらえませんでした。もう一度足して、{provider} の画面で「すべて選択」（カレンダーと Gmail の項目すべて）にチェックを入れてから続けてください",
  scopesInsufficient:
    "カレンダーとメールを使う許しが足りません。設定の「アカウント → インターネットアカウント」でこのアカウントを外して足し直し、Google の画面ですべての項目にチェックを入れてください",
  apiDisabled:
    "Google Cloud で {api} が有効になっていません。管理者が Google Cloud の「API とサービス → ライブラリ」で {api} を有効にしてください（有効にしてから使えるまで数分かかることがあります）",
  notFound: "見つかりません",
  serviceFailed: "サービスが答えませんでした（{reason}）",
  // メール（IMAP・Gmail・Outlook）
  mailNotFound: "そのメールは見つかりません",
  noCredentials: "ユーザー名とパスワードがありません",
  noImapServer: "IMAP のサーバーがありません",
  imapLoginFailed: "ログインできません（iCloud なら「App 用パスワード」、Gmail なら「アプリパスワード」を確かめてください）",
  imapConnectFailed: "メールにつながりません: {detail}",
  badMailId: "メールの id が正しくありません",
  noSmtp: "このアカウントは送るためのサーバー（SMTP）が設定されていません",
  // カレンダー（CalDAV・iCal）
  noCaldavUrl: "CalDAV の URL がありません",
  caldavLoginFailed: "ログインできません（iCloud なら Apple ID のメールアドレスと「App 用パスワード」を確かめてください）",
  caldavConnectFailed: "カレンダーにつながりません: {detail}",
  calendarNotFound: "そのカレンダーは見つかりません",
  cannotToggleCalendar: "このカレンダーは入／切を変えられません",
  calendarToggleOwnerOnly: "カレンダーの入／切は、アカウントを足した人だけが変えられます",
  badRequest: "頼みの形が違います",
  cannotMove: "このメールは移せません",
  moveTargetMissing: "移す先のフォルダーが見つかりません",
  eventNotFound: "その予定は見つかりません",
  createFailed: "予定を足せませんでした（{status}）",
  updateFailed: "予定を変えられませんでした（{status}）",
  deleteFailed: "予定を消せませんでした（{status}）",
  readFailed: "カレンダーを読めませんでした（{status}）",
  icalNoAdd: "公開カレンダーには予定を足せません",
  icalNoEdit: "公開カレンダーの予定は変えられません",
  icalNoDelete: "公開カレンダーの予定は消せません",
  // まとめ役（機能の口）
  rangeInvalid: "期間が正しくありません",
  rangeTooLong: "期間が長すぎます（400日まで）",
  otherSource: "ほかの出どころのカレンダーへは移せません",
  titleRequired: "予定の名前を入れてください",
  allDayFormat: "終日の予定は日付（YYYY-MM-DD）で入れてください",
  allDayOrder: "終わりの日は始まりの日より後にしてください（終わりの日は含みません）",
  timeOrder: "終わりは始まりより後にしてください",
  toRequired: "宛先を入れてください",
  bodyRequired: "本文を入れてください",
  // 中身が無いときに入れる名前（画面に返すときに直す）
  noSubject: "（件名なし）",
  untitledEvent: "（名前のない予定）",
  calendarDefault: "カレンダー",
  // 名前を入れずに足したアカウントの名前
  defaultLabelIcal: "公開カレンダー",
  defaultLabelAccount: "アカウント",
} as const;

const en: { [K in keyof typeof ja]: MessageValue } = {
  loginRequired: "Please sign in",
  badHost: "Invalid server name: {host}",
  internalHost: "{host} is inside the home network or can't be resolved. Only administrators can add servers inside the home",
  httpsOnly: "Use an https (or webcal) calendar URL",
  badPort: "Invalid port",
  kindNotAddable: "That account type can't be added here",
  imapRequired: "Enter the IMAP server",
  caldavUrlRequired: "Enter the CalDAV URL (https://…)",
  calendarUrlRequired: "Enter the calendar URL",
  credentialsRequired: "Enter a username and password",
  connected: "Connected ({detail})",
  connectedCalendars: (p) => (p.n === "1" || p.n === 1 ? "1 calendar" : `${p.n} calendars`),
  connectedUnread: (p) => (p.n === "1" || p.n === 1 ? "1 unread email" : `${p.n} unread emails`),
  connectedNothing: "nothing in use",
  connectedSeparator: ", ",
  rangeRequired: "from and to are required",
  badId: "Invalid id",
  accountNotFound: "Account not found",
  calendarOff: "Calendar isn't turned on for {label}",
  mailOff: "Mail isn't turned on for {label}",
  cannotMoveAccount: "Events can't be moved to another account's calendar",
  replySameAccount: "Reply from the account that received the email",
  noRecipients: "No recipients",
  tooManyAccounts: "Too many accounts",
  badAddress: "Invalid address: {address}",
  timeUnreadable: "Couldn't read the time",
  timeUnreadableValue: "Couldn't read the time: {value}",
  eventMissing: "Event not found",
  oauthNotConfigured:
    "The {provider} client ID and secret aren't set (an admin sets them in Extensions → Calendar & Mail)",
  redirectBaseMissing: "The redirect URL base isn't set (an admin sets it in Extensions → Calendar & Mail)",
  loginExpired: "Your sign-in has expired. Sign in again in Settings → Accounts → Internet Accounts",
  loginFailed: "Couldn't sign in ({reason})",
  loginCancelled: "Sign-in was cancelled ({reason})",
  loginStale: "This sign-in took too long or was started on another screen. Please add the account again",
  loginWrongUser: "Sign in to the dashboard with the same account that started this",
  noRefreshToken: "Didn't receive long-term access (refresh token). Please add the account again",
  notOAuth: "This account doesn't use OAuth",
  forbidden: "Insufficient permissions ({reason}). Please sign in again",
  scopesMissing:
    "{provider} didn't grant access to calendars and mail. Add the account again and check Select all (every calendar and Gmail item) on the {provider} screen before continuing",
  scopesInsufficient:
    "Missing access to calendars and mail. Remove this account in Settings → Accounts → Internet Accounts, add it again, and check every item on the Google screen",
  apiDisabled:
    "{api} isn't enabled in Google Cloud. An admin needs to enable {api} under APIs & Services → Library in Google Cloud (it can take a few minutes to take effect)",
  notFound: "Not found",
  serviceFailed: "The service didn't respond ({reason})",
  mailNotFound: "Email not found",
  noCredentials: "No username or password",
  noImapServer: "No IMAP server",
  imapLoginFailed: "Couldn't sign in (for iCloud, check your app-specific password; for Gmail, your app password)",
  imapConnectFailed: "Couldn't connect to mail: {detail}",
  badMailId: "Invalid email id",
  noSmtp: "This account has no server for sending (SMTP)",
  noCaldavUrl: "No CalDAV URL",
  caldavLoginFailed: "Couldn't sign in (for iCloud, check your Apple ID email and app-specific password)",
  caldavConnectFailed: "Couldn't connect to the calendar: {detail}",
  calendarNotFound: "Calendar not found",
  cannotToggleCalendar: "This calendar can't be turned on or off",
  calendarToggleOwnerOnly: "Only the person who added the account can turn its calendars on or off",
  badRequest: "Bad request",
  cannotMove: "This email can't be moved",
  moveTargetMissing: "Couldn't find the folder to move to",
  eventNotFound: "Event not found",
  createFailed: "Couldn't add the event ({status})",
  updateFailed: "Couldn't update the event ({status})",
  deleteFailed: "Couldn't delete the event ({status})",
  readFailed: "Couldn't read the calendar ({status})",
  icalNoAdd: "Events can't be added to a public calendar",
  icalNoEdit: "Events in a public calendar can't be changed",
  icalNoDelete: "Events in a public calendar can't be deleted",
  rangeInvalid: "Invalid date range",
  rangeTooLong: "Date range is too long (up to 400 days)",
  otherSource: "Events can't be moved to a calendar from another source",
  titleRequired: "Enter a title for the event",
  allDayFormat: "Enter all-day events as dates (YYYY-MM-DD)",
  allDayOrder: "The end date must be after the start date (the end date isn't included)",
  timeOrder: "The end must be after the start",
  toRequired: "Enter a recipient",
  bodyRequired: "Enter a message",
  noSubject: "(No subject)",
  untitledEvent: "(Untitled event)",
  calendarDefault: "Calendar",
  defaultLabelIcal: "Public calendar",
  defaultLabelAccount: "Account",
};

export type ServerMessageKey = keyof typeof ja;

export const serverMessages = defineServerMessages({ ja, en });

/** 奥で投げる日本語の文（画面へ返すときに localize で直す） */
export const jaText = (key: ServerMessageKey, params?: MessageParams) => serverMessages.t("ja", key, params);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 日本語の文から、どの鍵か（と差し込んだ値）を探すための形
const exact = new Map<string, ServerMessageKey>();
const patterns: { key: ServerMessageKey; names: string[]; regex: RegExp }[] = [];
for (const key of Object.keys(ja) as ServerMessageKey[]) {
  const template: string = ja[key];
  const names = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (names.length === 0) exact.set(template, key);
  else {
    const source = template
      .split(/\{\w+\}/)
      .map(escape)
      .join("([\\s\\S]*?)");
    patterns.push({ key, names, regex: new RegExp(`^${source}$`) });
  }
}

/** 奥から来た日本語の文を、その言語の文にする（辞書に無い文はそのまま） */
export function localize(message: string, locale: Locale): string {
  if (locale !== "en") return message;
  const key = exact.get(message);
  if (key) return serverMessages.t(locale, key);
  for (const { key, names, regex } of patterns) {
    const match = regex.exec(message);
    if (!match) continue;
    // 差し込んだ値も、辞書の文なら直す（「メールにつながりません: …」の中など）
    const params = Object.fromEntries(names.map((name, i) => [name, localize(match[i + 1], locale)]));
    return serverMessages.t(locale, key, params);
  }
  return message;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

type Body = Record<string, unknown>;
const isObject = (value: unknown): value is Body => typeof value === "object" && value !== null && !Array.isArray(value);

/** 画面へ返す中身の、理由の文（errors[].message）と、中身が無いときの名前（件名・予定の名前・カレンダーの名前）を直す */
function localizeBody(body: unknown, locale: Locale): unknown {
  if (locale !== "en" || !isObject(body)) return body;
  if (!["errors", "events", "calendars", "messages", "event", "message"].some((key) => key in body)) return body;
  const fix = (value: unknown) => (typeof value === "string" ? localize(value, locale) : value);
  const fixItems = (list: unknown, field: string) =>
    Array.isArray(list) ? list.map((item) => (isObject(item) && field in item ? { ...item, [field]: fix(item[field]) } : item)) : list;
  const out: Body = { ...body };
  if ("errors" in out) out.errors = fixItems(out.errors, "message");
  if ("events" in out) out.events = fixItems(out.events, "title");
  if ("calendars" in out) out.calendars = fixItems(out.calendars, "name");
  if ("messages" in out) out.messages = fixItems(out.messages, "subject");
  if (isObject(out.event) && "title" in out.event) out.event = { ...out.event, title: fix(out.event.title) };
  if (isObject(out.message) && "subject" in out.message) out.message = { ...out.message, subject: fix(out.message.subject) };
  return out;
}

/**
 * api.route と同じに道を足す。返す中身と、投げた理由の文を、呼んだ画面の言語（ctx.locale）に直す
 */
export function localizedRoute(api: ServerExtensionApi) {
  return (method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions) =>
    api.route(
      method,
      path,
      async (ctx) => {
        try {
          return localizeBody(await handler(ctx), ctx.locale);
        } catch (err) {
          const statusCode = (err as { statusCode?: unknown }).statusCode;
          if (ctx.locale === "en" && typeof statusCode === "number" && err instanceof Error)
            throw new HttpError(statusCode, localize(err.message, ctx.locale));
          throw err;
        }
      },
      options,
    );
}
