import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError } from "@home-dashboard/extension-sdk";
import { jaText } from "./serverMessages";

/**
 * インターネットアカウント（Google・iCloud・Microsoft・一般）の置き場。data/extension-data/accounts/accounts.json（持ち主だけが読める）。
 *
 * - アカウントは登録した人（ダッシュボードのログインアカウント）のもの。本人と、「家で共有する」にしたものは家の誰からも見える
 * - 壁の画面のほかに、音声アシスタントからは「家で共有する」ものだけが見える（だれが話しかけたか分からないため）
 * - パスワード・トークンは画面に返さない
 */

export type ProviderKind = "google" | "microsoft" | "icloud" | "imap" | "caldav" | "ical";

export interface OAuthCredentials {
  kind: "oauth";
  refreshToken: string;
  accessToken: string | null;
  /** accessToken が切れる時刻（ミリ秒） */
  expiresAt: number;
}

export interface PasswordCredentials {
  kind: "password";
  username: string;
  password: string;
}

export interface NoCredentials {
  kind: "none";
}

export type Credentials = OAuthCredentials | PasswordCredentials | NoCredentials;

/** 一般のアカウントのサーバー（iCloud は決まっているので持たない） */
export interface ServerSettings {
  imap?: { host: string; port: number; secure: boolean };
  smtp?: { host: string; port: number; secure: boolean };
  /** CalDAV の入口（https://…）か、公開カレンダー（iCal）の URL */
  calendarUrl?: string;
}

export interface StoredAccount {
  id: string;
  provider: ProviderKind;
  /** 画面に出す名前（「自分の Google」など） */
  label: string;
  /** アカウントのメールアドレス（分かれば） */
  email: string | null;
  /** 登録した人（ログインアカウントの id）。空は家のもの（前のメールの設定から移したものなど。管理者が変える） */
  ownerId: string;
  /** 家で共有する（家の誰からも・音声アシスタントからも見える） */
  shared: boolean;
  /** 使うもの（アカウントが扱えるもののうち） */
  services: { calendar: boolean; mail: boolean };
  credentials: Credentials;
  servers: ServerSettings;
  /** カレンダーごとの入／切（サービスの中のカレンダーの id ごと）。決めていないものはサービスの側の「出す」に従う */
  calendarChoices?: Record<string, boolean>;
  createdAt: string;
}

/** 誰として見るか（カレンダー・メールの機能の口の Viewer と同じ形） */
export interface Viewer {
  accountId: string | null;
}

/** 画面に返す形（パスワード・トークンを抜く） */
export interface AccountInfo {
  id: string;
  provider: ProviderKind;
  label: string;
  email: string | null;
  shared: boolean;
  services: { calendar: boolean; mail: boolean };
  /** そのアカウントが扱えるもの */
  supports: { calendar: boolean; mail: boolean };
  /** 変えられるか（本人のもの。管理者なら家のものも）。ほかの人の、家で共有しているものは見えるだけ */
  mine: boolean;
  /** 一般のアカウントのサーバー（パスワードは無し） */
  servers: ServerSettings;
  username: string | null;
  createdAt: string;
}

/** そのアカウントの種類で扱えるもの */
export function supportsOf(account: Pick<StoredAccount, "provider" | "servers">): { calendar: boolean; mail: boolean } {
  switch (account.provider) {
    case "google":
    case "microsoft":
    case "icloud":
      return { calendar: true, mail: true };
    case "imap":
      return { calendar: false, mail: true };
    case "caldav":
    case "ical":
      return { calendar: true, mail: false };
  }
}

/** 変える人（ログインしている人） */
export interface Editor {
  id: string;
  role: "admin" | "member";
}

export function canEdit(account: StoredAccount, user: Editor): boolean {
  return account.ownerId === user.id || (account.ownerId === "" && user.role === "admin");
}

export function canSee(account: StoredAccount, viewer: Viewer): boolean {
  return account.shared || (viewer.accountId !== null && account.ownerId === viewer.accountId);
}

export class AccountStore {
  private accounts: StoredAccount[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly path: string;

  constructor(private readonly dataDir: string) {
    this.path = join(dataDir, "accounts.json");
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async all(): Promise<StoredAccount[]> {
    if (this.accounts) return this.accounts;
    try {
      const raw = JSON.parse(await readFile(this.path, "utf-8")) as { accounts?: StoredAccount[] };
      this.accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.accounts = [];
    }
    return this.accounts;
  }

  private async save(next: StoredAccount[]): Promise<void> {
    this.accounts = next;
    await mkdir(this.dataDir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify({ accounts: next }, null, 2), { encoding: "utf-8", mode: 0o600 });
    await chmod(tmp, 0o600);
    await rename(tmp, this.path);
  }

  /** その人に見えるもの（本人のものと、家で共有しているもの） */
  async visible(viewer: Viewer): Promise<StoredAccount[]> {
    return (await this.all()).filter((account) => canSee(account, viewer));
  }

  async get(id: string): Promise<StoredAccount | undefined> {
    return (await this.all()).find((account) => account.id === id);
  }

  /** 本人のもの（と、管理者なら家のもの）だけを返す。ほかの人のものは、家で共有していても変えられない */
  async owned(id: string, user: Editor): Promise<StoredAccount> {
    const account = await this.get(id);
    if (!account || !canEdit(account, user)) throw new HttpError(404, jaText("accountNotFound"));
    return account;
  }

  add(input: Omit<StoredAccount, "id" | "createdAt">): Promise<StoredAccount> {
    return this.serial(async () => {
      const current = await this.all();
      if (current.filter((a) => a.ownerId === input.ownerId).length >= 20)
        throw new HttpError(409, jaText("tooManyAccounts"));
      const account: StoredAccount = { ...input, id: randomUUID().slice(0, 12), createdAt: new Date().toISOString() };
      await this.save([...current, account]);
      return account;
    });
  }

  update(id: string, patch: (account: StoredAccount) => StoredAccount): Promise<StoredAccount> {
    return this.serial(async () => {
      const current = await this.all();
      const target = current.find((a) => a.id === id);
      if (!target) throw new HttpError(404, jaText("accountNotFound"));
      const next = patch(target);
      await this.save(current.map((a) => (a.id === id ? next : a)));
      return next;
    });
  }

  remove(id: string): Promise<void> {
    return this.serial(async () => {
      await this.save((await this.all()).filter((a) => a.id !== id));
    });
  }
}

export function toInfo(account: StoredAccount, user: Editor | null): AccountInfo {
  return {
    id: account.id,
    provider: account.provider,
    label: account.label,
    email: account.email,
    shared: account.shared,
    services: account.services,
    supports: supportsOf(account),
    mine: user !== null && canEdit(account, user),
    servers: account.servers,
    username: account.credentials.kind === "password" ? account.credentials.username : null,
    createdAt: account.createdAt,
  };
}
