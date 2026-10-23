/**
 * カレンダーの機能の口「calendar」の形。カレンダーを持つ拡張機能（インターネットアカウントなど）は、
 * この CalendarBackend を api.provide("calendar", backend) で渡す。画面・ウィジェット・音声アシスタントのツールは
 * カレンダーの拡張機能が持ち、入っているものをまとめて扱う。
 */

/**
 * 誰として見るか。accountId はログインしている人（自分の分と、家で共有するものが見える）。
 * null は壁の画面以外から（音声アシスタントなど）で、家で共有するものだけが見える
 */
export interface Viewer {
  accountId: string | null;
}

export interface CalendarInfo {
  /** 口に入っているもの全体で一意な id（出どころの中で作ってよい。カレンダーの拡張機能はそのまま返す） */
  id: string;
  name: string;
  /** #rrggbb。分からなければ null */
  color: string | null;
  /** どのアカウントのものか（「自分の Google」など。画面に出す） */
  source: string;
  /** 予定を足したり変えたりできるか */
  writable: boolean;
  /** 家で共有しているか（壁の画面・音声アシスタントでも見える） */
  shared: boolean;
  /** 入っているか。切ったカレンダーの予定は、画面・ウィジェット・音声アシスタントのどこにも出さない（無ければ入） */
  enabled?: boolean;
  /** 見ている人が入／切を変えられるか（無ければ変えられない） */
  toggleable?: boolean;
}

export interface CalendarEvent {
  /** 変える・消すときに渡す id */
  id: string;
  calendarId: string;
  title: string;
  /** 終日なら YYYY-MM-DD、時刻があれば ISO 8601（タイムゾーン付き） */
  start: string;
  /** 終日なら次の日の YYYY-MM-DD（その日を含まない）、時刻があれば ISO 8601 */
  end: string;
  allDay: boolean;
  location: string | null;
  description: string | null;
  /** 繰り返しの予定の1回か（変える・消すと、その1回だけでなく繰り返し全体が変わる出どころもある） */
  recurring: boolean;
}

export interface EventInput {
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
}

/** いくつかのアカウントをまとめて読んだとき、読めなかったものの理由 */
export interface SourceError {
  source: string;
  message: string;
}

export interface CalendarBackend {
  listCalendars(viewer: Viewer): Promise<{ calendars: CalendarInfo[]; errors: SourceError[] }>;
  /** from 以上 to 未満にかかる予定（どちらも ISO 8601） */
  listEvents(
    viewer: Viewer,
    range: { from: string; to: string },
  ): Promise<{ events: CalendarEvent[]; errors: SourceError[] }>;
  createEvent(viewer: Viewer, input: EventInput): Promise<CalendarEvent>;
  updateEvent(viewer: Viewer, eventId: string, input: EventInput): Promise<CalendarEvent>;
  deleteEvent(viewer: Viewer, eventId: string): Promise<void>;
  /** カレンダーを入れる・切る（できない出どころは持たない） */
  setCalendarEnabled?(viewer: Viewer, calendarId: string, enabled: boolean): Promise<void>;
}
