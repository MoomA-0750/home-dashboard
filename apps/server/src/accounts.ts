import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";

/**
 * アカウントとログイン。ダッシュボードの画面と API は、ログインしないと使えない。
 *
 * 壁掛け端末は常に表示しっぱなしで使うので、ログインは期限で切れないようにする（Home Assistant の長期トークンと同じ考え）。
 * - ログインした端末ごとに合言葉（セッションのトークン）を発行し、HttpOnly の cookie に置く。期限は無く、止めるときは一覧から外す
 * - サーバーにはトークンの SHA-256 と、パスワードの scrypt だけを置く（data/ が漏れてもなりすませない）
 * - アカウントが1つも無いうちは「最初のアカウント作成」だけを受け付け、作った人を管理者にする。
 *   届く人なら誰でも作れてしまわないよう、サーバーのログに出す一度きりの合言葉（setup code）を打った人だけが作れる
 * - 管理者だけが、アカウントの追加・削除と接続設定の変更をできる
 */

const ACCOUNTS_PATH = join(config.dataDir, "accounts.json");
const SESSIONS_PATH = join(config.dataDir, "sessions.json");

export const SESSION_COOKIE = "hd_session";
/** cookie の寿命。ブラウザが受け付ける上限（約400日）にし、使うたびに延ばす */
export const SESSION_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;
/** 最後に使った日時の記録と cookie の延長は、この間隔より空いたときだけ行う（毎回ファイルに書かないため） */
const TOUCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,32}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 256;
const DEVICE_NAME_MAX_LENGTH = 40;
const MAX_ACCOUNTS = 32;
const MAX_SESSIONS = 128;

// 総当たりを防ぐ。Docker の中では接続元が皆同じ（ブリッジの出口）に見えるので、名前ごとと全体で数える
const MAX_FAILURES_PER_USER = 5;
const MAX_FAILURES_TOTAL = 20;
const LOCKOUT_MS = 10 * 60 * 1000;

export type Role = "admin" | "member";
export type Locale = "ja" | "en";

export interface StoredAccount {
  id: string;
  username: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  /** 画面の言語。選ぶまでは無い（端末のブラウザの言語で出す） */
  locale?: Locale;
  /** 日付・時刻・温度の出し方（暦・温度の単位・週の始まり・日付の形・時刻）。選ぶまでは無い */
  display?: DisplaySettings;
}

export interface DisplaySettings {
  calendar: "gregorian" | "japanese";
  temperatureUnit: "c" | "f";
  weekStart: 0 | 1;
  dateFormat: "auto" | "ymd" | "mdy" | "dmy";
  clock: "24" | "12";
}

/**
 * 端末ごとの設定（ログインしている端末に持たせる）。
 * - dashboard: 家に置きっぱなしのダッシュボード端末。画面を眠らせず、ログアウトを出さず、ここで話した会話は部屋のマイクと同じ扱い
 *   （家族みんなの記録になり、「画面から話しかけたときだけ」の家の人の情報は出さない）。一覧から古い順に外されることもない
 * - lite: ガラスのぼかしを切った軽い表示。auto は端末の速さを見て決める
 */
export interface DeviceSettings {
  dashboard: boolean;
  lite: "auto" | "on" | "off";
}

const DEFAULT_DEVICE: DeviceSettings = { dashboard: false, lite: "auto" };
const LITE_MODES: DeviceSettings["lite"][] = ["auto", "on", "off"];

interface StoredSession {
  id: string;
  accountId: string;
  tokenHash: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  device?: Partial<DeviceSettings>;
}

export interface AccountInfo {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  locale?: Locale;
  display?: DisplaySettings;
}

export interface SessionInfo {
  id: string;
  accountId: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string;
  device: DeviceSettings;
}

/** ログインしているリクエストの持ち主 */
export interface AuthContext {
  account: AccountInfo;
  session: SessionInfo;
  /** cookie を延ばして送り直すべきか */
  refreshCookie: boolean;
}

let accounts: StoredAccount[] | null = null;
let sessions: StoredSession[] | null = null;
const failures: { username: string; at: number }[] = [];
// 書き込みを1つずつ行う（最初のアカウント作成が2つ同時に通らないように）
let queue: Promise<unknown> = Promise.resolve();

export function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

export async function readJson<T>(path: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), { encoding: "utf-8", mode: 0o600 });
  await rename(tmp, path);
}

export async function loadAccounts(): Promise<StoredAccount[]> {
  accounts ??= await readJson<StoredAccount>(ACCOUNTS_PATH);
  return accounts;
}

async function loadSessions(): Promise<StoredSession[]> {
  sessions ??= await readJson<StoredSession>(SESSIONS_PATH);
  return sessions;
}

async function saveAccounts(next: StoredAccount[]): Promise<void> {
  accounts = next;
  await writeJson(ACCOUNTS_PATH, next);
}

async function saveSessions(next: StoredSession[]): Promise<void> {
  sessions = next;
  await writeJson(SESSIONS_PATH, next);
}

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [scheme, saltText, hashText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltText, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toAccountInfo(account: StoredAccount): AccountInfo {
  const info: AccountInfo = { id: account.id, username: account.username, role: account.role, createdAt: account.createdAt };
  if (account.locale) info.locale = account.locale;
  if (account.display) info.display = account.display;
  return info;
}

function toSessionInfo(session: StoredSession): SessionInfo {
  return {
    id: session.id,
    accountId: session.accountId,
    deviceName: session.deviceName,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    device: { ...DEFAULT_DEVICE, ...session.device },
  };
}

function checkUsername(username: unknown): string {
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username.trim()))
    throw new ServiceError(400, "ユーザー名は半角の英数字と _ . - で32文字までにしてください", "Use up to 32 letters, digits, _ . or - for the user name");
  return username.trim();
}

function checkPassword(password: unknown): string {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH)
    throw new ServiceError(400, `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`, `Use at least ${PASSWORD_MIN_LENGTH} characters for the password`);
  if (password.length > PASSWORD_MAX_LENGTH) throw new ServiceError(400, "パスワードが長すぎます", "The password is too long");
  return password;
}

function checkDeviceName(name: unknown): string {
  const text = typeof name === "string" ? name.trim().slice(0, DEVICE_NAME_MAX_LENGTH) : "";
  return text || "名前の無い端末";
}

function checkRole(role: unknown): Role {
  if (role === "admin" || role === "member") return role;
  throw new ServiceError(400, "role は admin か member にしてください", "role must be admin or member");
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** ログインの失敗を数える（パスキーの失敗は名前が分からないので、全体の数にだけ効く） */
export function recordFailure(username: string, now = Date.now()): void {
  failures.push({ username, at: now });
}

export function checkLockout(username: string, now: number): void {
  while (failures.length > 0 && now - failures[0].at > LOCKOUT_MS) failures.shift();
  const forUser = failures.filter((failure) => sameName(failure.username, username)).length;
  // 全体の上限は、名前を変えながらパスワードを試すのを止めるためのもの。パスキー（username は ""）には掛けない
  // （でたらめな名前で20回失敗させるだけで、パスキーの家族まで締め出せてしまうため）
  if (forUser >= MAX_FAILURES_PER_USER || (username !== "" && failures.length >= MAX_FAILURES_TOTAL))
    throw new ServiceError(429, "ログインの失敗が続いたので、しばらく待ってからやり直してください", "Too many failed sign-ins. Wait a while and try again");
}

export async function startSession(account: StoredAccount, deviceName: unknown): Promise<{ token: string }> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const session: StoredSession = {
    id: randomUUID(),
    accountId: account.id,
    tokenHash: hashToken(token),
    deviceName: checkDeviceName(deviceName),
    createdAt: now,
    lastUsedAt: now,
  };
  // 多すぎるときは、いちばん長く使っていないものから外す（ダッシュボード端末は、置きっぱなしで切れると困るので外さない）
  const current = [...(await loadSessions())].sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt));
  while (current.length >= MAX_SESSIONS) {
    const index = current.findIndex((s) => !s.device?.dashboard);
    current.splice(index >= 0 ? index : 0, 1);
  }
  await saveSessions([...current, session]);
  return { token };
}

/** アカウントが1つも無く、最初のアカウントを作る必要があるか */
export async function isSetupRequired(): Promise<boolean> {
  return (await loadAccounts()).length === 0;
}

// 最初のアカウントを作るための合言葉。サーバーを起動し直すたびに作り直す（ログを見られる人＝この機械を持っている人だけが知る）
let setupCode: string | null = null;
const SETUP_CODE_LENGTH = 8;
// 読み違えやすい 0/O・1/I/L は使わない
const SETUP_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** アカウントが無ければ合言葉を作り、ログに出す（起動時に呼ぶ）。作った合言葉を返す（テスト用） */
export async function announceSetupCode(log: (message: string) => void = console.log): Promise<string | null> {
  if (!(await isSetupRequired())) return null;
  if (!setupCode) {
    const bytes = randomBytes(SETUP_CODE_LENGTH);
    setupCode = Array.from(bytes, (b) => SETUP_CODE_CHARS[b % SETUP_CODE_CHARS.length]).join("");
  }
  log(
    `\n  アカウントがまだありません。画面で最初の管理者を作るときに、この合言葉を入れてください: ${setupCode}\n` +
      `  (No accounts yet. Enter this setup code when creating the first administrator: ${setupCode})\n`,
  );
  return setupCode;
}

function setupCodeMatches(code: unknown): boolean {
  if (!setupCode || typeof code !== "string") return false;
  const given = Buffer.from(code.trim().toUpperCase().replace(/[\s-]/g, ""));
  const expected = Buffer.from(setupCode);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** 最初のアカウント（管理者）を作ってログインする。アカウントがすでにあるか、合言葉が違えば断る */
export function setupFirstAccount(username: unknown, password: unknown, deviceName: unknown, code: unknown) {
  return serial(async () => {
    if (!(await isSetupRequired()))
      throw new ServiceError(409, "アカウントはすでに作られています。ログインしてください", "The account already exists. Please sign in");
    const now = Date.now();
    checkLockout("(setup)", now);
    if (!setupCodeMatches(code)) {
      recordFailure("(setup)", now);
      throw new ServiceError(
        401,
        "合言葉が違います。サーバーのログ（docker compose logs home-dashboard）に出ている合言葉を入れてください",
        "Wrong setup code. Enter the code shown in the server log (docker compose logs home-dashboard)",
      );
    }
    const account: StoredAccount = {
      id: randomUUID(),
      username: checkUsername(username),
      role: "admin",
      passwordHash: await hashPassword(checkPassword(password)),
      createdAt: new Date().toISOString(),
    };
    await saveAccounts([account]);
    setupCode = null;
    return { ...(await startSession(account, deviceName)), account: toAccountInfo(account) };
  });
}

export async function login(username: unknown, password: unknown, deviceName: unknown) {
  const name = typeof username === "string" ? username.trim() : "";
  const now = Date.now();
  checkLockout(name, now);
  const account = (await loadAccounts()).find((a) => sameName(a.username, name));
  // 名前が無いときも同じだけ時間をかけ、名前があるかどうかを返事の速さから分からないようにする
  const ok =
    typeof password === "string" &&
    password.length <= PASSWORD_MAX_LENGTH &&
    (await passwordMatches(password, account?.passwordHash ?? `scrypt$${"A".repeat(24)}$${"A".repeat(88)}`)) &&
    account !== undefined;
  if (!ok || !account) {
    failures.push({ username: name, at: now });
    throw new ServiceError(401, "ユーザー名かパスワードが違います", "Wrong user name or password");
  }
  return serial(async () => ({ ...(await startSession(account, deviceName)), account: toAccountInfo(account) }));
}

/**
 * ログインしている人の本人確認（音声アシスタントの解錠などを許可する前に、パスワードを打ってもらう）。
 * 間違いはログインの失敗と同じく数え、続いたらしばらく受け付けない
 */
export async function verifyPassword(accountId: string, password: unknown): Promise<void> {
  const account = (await loadAccounts()).find((a) => a.id === accountId);
  if (!account) throw new ServiceError(401, "ログインしてください", "Please sign in");
  const now = Date.now();
  checkLockout(account.username, now);
  const ok =
    typeof password === "string" &&
    password.length <= PASSWORD_MAX_LENGTH &&
    (await passwordMatches(password, account.passwordHash));
  if (!ok) {
    recordFailure(account.username, now);
    throw new ServiceError(401, "パスワードが違います", "Wrong password");
  }
}

/** cookie のトークンから、ログインしている持ち主を引く。ログインしていなければ null */
export async function authenticate(token: unknown): Promise<AuthContext | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  const hash = hashToken(token);
  const session = (await loadSessions()).find((s) => s.tokenHash === hash);
  if (!session) return null;
  const account = (await loadAccounts()).find((a) => a.id === session.accountId);
  if (!account) return null;
  const refreshCookie = Date.now() - Date.parse(session.lastUsedAt) > TOUCH_INTERVAL_MS;
  if (refreshCookie) {
    // 一覧で「最後に使った日」を見せ、使っていない端末を外す目安にする
    void serial(async () => {
      const current = await loadSessions();
      await saveSessions(
        current.map((s) => (s.id === session.id ? { ...s, lastUsedAt: new Date().toISOString() } : s)),
      );
    });
  }
  return { account: toAccountInfo(account), session: toSessionInfo(session), refreshCookie };
}

export function logout(sessionId: string) {
  return serial(async () => saveSessions((await loadSessions()).filter((s) => s.id !== sessionId)));
}

/** 自分の、管理者ならすべての、ログインしている端末 */
export async function listSessions(auth: AuthContext): Promise<SessionInfo[]> {
  return (await loadSessions())
    .filter((s) => auth.account.role === "admin" || s.accountId === auth.account.id)
    .map(toSessionInfo)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/** 端末のログインを外す（自分の端末か、管理者ならどれでも）。外したセッションの id を返す */
export function revokeSession(auth: AuthContext, sessionId: string) {
  return serial(async () => {
    const current = await loadSessions();
    const target = current.find((s) => s.id === sessionId);
    if (!target || (auth.account.role !== "admin" && target.accountId !== auth.account.id))
      throw new ServiceError(404, "その端末は見つかりません", "Device not found");
    await saveSessions(current.filter((s) => s.id !== sessionId));
    return [sessionId];
  });
}

/** 端末の設定を変える。自分の端末か、管理者ならどの端末でも。送った項目だけを変える */
export function setDeviceSettings(auth: AuthContext, sessionId: string, input: unknown): Promise<SessionInfo> {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const change: Partial<DeviceSettings> = {};
  if ("dashboard" in raw) {
    if (typeof raw.dashboard !== "boolean")
      throw new ServiceError(400, "dashboard は true か false にしてください", "dashboard must be true or false");
    change.dashboard = raw.dashboard;
  }
  if ("lite" in raw) {
    if (!LITE_MODES.includes(raw.lite as DeviceSettings["lite"]))
      throw new ServiceError(400, "lite は auto・on・off のどれかにしてください", "lite must be auto, on or off");
    change.lite = raw.lite as DeviceSettings["lite"];
  }
  return serial(async () => {
    const current = await loadSessions();
    const target = current.find((s) => s.id === sessionId);
    if (!target || (auth.account.role !== "admin" && target.accountId !== auth.account.id))
      throw new ServiceError(404, "その端末は見つかりません", "Device not found");
    const next = { ...target, device: { ...DEFAULT_DEVICE, ...target.device, ...change } };
    await saveSessions(current.map((s) => (s.id === sessionId ? next : s)));
    return toSessionInfo(next);
  });
}

export async function listAccounts(): Promise<AccountInfo[]> {
  return (await loadAccounts()).map(toAccountInfo);
}

export function createAccount(username: unknown, password: unknown, role: unknown) {
  return serial(async () => {
    const current = await loadAccounts();
    const name = checkUsername(username);
    if (current.some((a) => sameName(a.username, name))) throw new ServiceError(409, "その名前はすでに使われています", "That name is already taken");
    if (current.length >= MAX_ACCOUNTS) throw new ServiceError(409, "アカウントが多すぎます", "Too many accounts");
    const account: StoredAccount = {
      id: randomUUID(),
      username: name,
      role: checkRole(role),
      passwordHash: await hashPassword(checkPassword(password)),
      createdAt: new Date().toISOString(),
    };
    await saveAccounts([...current, account]);
    return toAccountInfo(account);
  });
}

/** アカウントを消し、そのアカウントのログインもすべて外す。外したセッションの id を返す */
export function deleteAccount(accountId: string) {
  return serial(async () => {
    const current = await loadAccounts();
    const target = current.find((a) => a.id === accountId);
    if (!target) throw new ServiceError(404, "そのアカウントは見つかりません", "Account not found");
    if (target.role === "admin" && current.filter((a) => a.role === "admin").length === 1)
      throw new ServiceError(409, "最後の管理者は消せません", "The last administrator cannot be removed");
    await saveAccounts(current.filter((a) => a.id !== accountId));
    const allSessions = await loadSessions();
    const removed = allSessions.filter((s) => s.accountId === accountId).map((s) => s.id);
    await saveSessions(allSessions.filter((s) => s.accountId !== accountId));
    return removed;
  });
}

/**
 * パスワードを変える。自分のときは今のパスワードを確かめる（管理者が他の人のを変えるときは要らない）。
 * 変えたら、今使っている端末以外のログインを外す（漏れたパスワードで入った端末を締め出すため）。外したセッションの id を返す
 */
export function changePassword(auth: AuthContext, accountId: string, currentPassword: unknown, nextPassword: unknown) {
  return serial(async () => {
    const self = accountId === auth.account.id;
    if (!self && auth.account.role !== "admin") throw new ServiceError(403, "管理者だけができます", "Only administrators can do this");
    const current = await loadAccounts();
    const target = current.find((a) => a.id === accountId);
    if (!target) throw new ServiceError(404, "そのアカウントは見つかりません", "Account not found");
    if (self && (typeof currentPassword !== "string" || !(await passwordMatches(currentPassword, target.passwordHash))))
      throw new ServiceError(403, "今のパスワードが違います", "The current password is wrong");
    const passwordHash = await hashPassword(checkPassword(nextPassword));
    await saveAccounts(current.map((a) => (a.id === accountId ? { ...a, passwordHash } : a)));
    const allSessions = await loadSessions();
    const removed = allSessions.filter((s) => s.accountId === accountId && s.id !== auth.session.id).map((s) => s.id);
    await saveSessions(allSessions.filter((s) => !removed.includes(s.id)));
    return removed;
  });
}

/** 自分の画面の言語を変える（アカウントに覚え、どの端末でログインしても同じ言語で出す） */
export function setAccountLocale(auth: AuthContext, locale: unknown) {
  return serial(async () => {
    if (locale !== "ja" && locale !== "en")
      throw new ServiceError(400, "言語は ja か en にしてください", "locale must be ja or en");
    const current = await loadAccounts();
    await saveAccounts(current.map((a) => (a.id === auth.account.id ? { ...a, locale } : a)));
    return locale;
  });
}

const DISPLAY_CHOICES: { [K in keyof DisplaySettings]: readonly DisplaySettings[K][] } = {
  calendar: ["gregorian", "japanese"],
  temperatureUnit: ["c", "f"],
  weekStart: [0, 1],
  dateFormat: ["auto", "ymd", "mdy", "dmy"],
  clock: ["24", "12"],
};

/** 自分の表示の設定を変える（送られた項目だけを変え、ほかは今のまま） */
export function setAccountDisplay(auth: AuthContext, input: unknown) {
  return serial(async () => {
    if (!input || typeof input !== "object") throw new ServiceError(400, "表示の設定を送ってください", "Send display settings");
    const current = await loadAccounts();
    const account = current.find((a) => a.id === auth.account.id);
    if (!account) throw new ServiceError(404, "そのアカウントは見つかりません", "Account not found");
    const next: DisplaySettings = {
      calendar: "gregorian",
      temperatureUnit: "c",
      weekStart: 0,
      dateFormat: "auto",
      clock: "24",
      ...account.display,
    };
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const choices = DISPLAY_CHOICES[key as keyof DisplaySettings] as readonly unknown[] | undefined;
      if (!choices || !choices.includes(value))
        throw new ServiceError(400, `表示の設定の値が正しくありません: ${key}`, `Invalid display setting: ${key}`);
      (next as unknown as Record<string, unknown>)[key] = value;
    }
    await saveAccounts(current.map((a) => (a.id === account.id ? { ...a, display: next } : a)));
    return next;
  });
}

/** cookie ヘッダーから、ログインのトークンを取り出す */
export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return null; // 壊れた値はログインしていないのと同じ（500 にしない）
    }
  }
  return null;
}

export function resetAccountsForTest(): void {
  accounts = [];
  sessions = [];
  failures.length = 0;
  setupCode = null;
}
