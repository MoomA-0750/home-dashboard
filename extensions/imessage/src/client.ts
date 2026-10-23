import { request as httpsRequest } from "node:https";
import { defineServerMessages, HttpError, type Locale, type MessageParams } from "@home-dashboard/extension-sdk";
import type {
  CapabilitySnapshot,
  ChatSnapshot,
  HistorySnapshot,
  SendResult,
  UploadResult,
} from "./types";

/**
 * imsg-web（Mac で動く iMessage の Web サーバー）の API を呼ぶ。docs/api.md（imsg-web）のとおり:
 * - トークンは Authorization: Bearer で渡す。Origin・Cookie・Sec-Fetch-Site は付けない（付けると 403 で断られる）。
 *   このためブラウザからではなく、ここ（ダッシュボードのサーバー）から呼ぶ
 * - LAN では自己署名の証明書なので、imsg-web の cert.pem を CA として渡して確かめる（確かめるのを切ることはしない）
 * - 上限は1分あたり120リクエスト。何台もの端末が画面を開くので、ここで覚えて使い回し、使う数も数える
 */

export interface ImsgConfig {
  url: string;
  token: string;
  /** PEM。Tailscale Serve の名前など、本物の証明書なら null */
  ca: string | null;
}

export interface ImsgRequest {
  method: "GET" | "POST";
  url: URL;
  headers: Record<string, string>;
  body?: Uint8Array;
}

export interface ImsgResponse {
  status: number;
  contentType: string;
  body: Buffer;
}

/** 実際に送る部分（テストでは差し替える） */
export type Transport = (request: ImsgRequest, ca: string | null) => Promise<ImsgResponse>;

const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 110 * 1024 * 1024;

export const httpsTransport: Transport = (req, ca) =>
  new Promise((resolve, reject) => {
    const r = httpsRequest(
      req.url,
      {
        method: req.method,
        headers: req.headers,
        // undefined なら Node の持っている CA で確かめる（Tailscale Serve の本物の証明書）
        ca: ca ?? undefined,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            res.destroy(new Error("response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", reject);
      },
    );
    r.on("timeout", () => r.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    r.on("error", reject);
    r.end(req.body);
  });

/**
 * 貼り付けた証明書を PEM に戻す。設定の入力欄は1行なので、改行が空白になったり消えたりしている。
 * BEGIN と END のあいだの文字だけを取り出し、64文字ずつ折り返す（いくつ並んでいてもよい）。読めなければ null
 */
export function normalizePem(text: string): string | null {
  const blocks = [...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)];
  if (blocks.length === 0) return null;
  const pems = blocks.map((block) => {
    const base64 = block[1].replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) return null;
    const lines = base64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
  });
  return pems.includes(null) ? null : pems.join("");
}

/** 画面に返す文（エラーの理由・接続の確かめの結果） */
export const messages = defineServerMessages({
  ja: {
    badToken: "imsg-web がトークンを受け付けませんでした。Mac で発行し直して、接続設定に入れてください",
    fromBrowser: "imsg-web がブラウザからの呼び出しとみなして断りました",
    readOnly: "このトークンではできません（読むだけのトークンです）",
    notFound: "見つかりませんでした",
    stale: "会話の一覧が新しくなりました。読み直します",
    tooLarge: "ファイルが大きすぎます",
    busy: "imsg-web が混んでいます（送るのは1分に10件まで）。少し待ってください",
    failed: (p) => `imsg-web でうまくいきませんでした（${p.status}${p.code ? ` ${p.code}` : ""}）`,
    certName: "imsg-web の証明書がこの URL の名前を含んでいません。証明書を作ったときの名前か IP アドレスでつないでください",
    certUnverified: "imsg-web の証明書を確かめられません。Mac の state/tls/cert.pem を接続設定の「証明書」に入れてください",
    timeout: "imsg-web から返事がありません",
    unreachable: (p) => `imsg-web につながりません${p.code ? `（${p.code}）` : ""}`,
    notConfigured: "imsg-web の URL とトークンを、拡張機能「iMessage」の接続設定に入れてください",
    rateLimited: "imsg-web への問い合わせが多すぎるので、少し待っています",
    badResponse: "imsg-web の答えが読めませんでした",
    // ./server
    httpsOnly: "imsg-web の URL は https:// から始めてください",
    badCert: "接続設定の証明書が読めません。cert.pem の中身を BEGIN から END まで貼ってください",
    forbidden: "このアカウントでは iMessage を見られません",
    needUrlToken: "URL とトークンを入れてください",
    canRead: "会話を読めます",
    cannotRead: "会話を読めない状態です",
    cannotSend: "送れません（読むだけのトークン）",
    dryRun: "送る操作は試しだけ（imsg-web が dry-run）",
    canSend: "送れます",
    connected: "つながりました。{chats}。{sending}",
    emptyFile: "ファイルが空です",
    noChat: "送る会話を選んでください",
    nothingToSend: "送るものがありません",
    tooManyFiles: "ファイルは{max}個までです",
    tooLong: "文が長すぎます（日本語でおよそ600文字まで）。分けて送ってください",
  },
  en: {
    badToken: "imsg-web didn't accept the token. Issue a new one on the Mac and enter it in the connection settings",
    fromBrowser: "imsg-web refused the request as coming from a browser",
    readOnly: "This token can't do that (it's read-only)",
    notFound: "Not found",
    stale: "The conversation list changed. Reloading",
    tooLarge: "The file is too large",
    busy: "imsg-web is busy (up to 10 sends per minute). Please wait a moment",
    failed: (p) => `imsg-web ran into a problem (${p.status}${p.code ? ` ${p.code}` : ""})`,
    certName: "imsg-web's certificate doesn't include this URL's host name. Connect using the name or IP address the certificate was made for",
    certUnverified: "Couldn't verify imsg-web's certificate. Put the Mac's state/tls/cert.pem in the \"Certificate\" connection setting",
    timeout: "No response from imsg-web",
    unreachable: (p) => `Can't connect to imsg-web${p.code ? ` (${p.code})` : ""}`,
    notConfigured: "Enter the imsg-web URL and token in the iMessage extension's connection settings",
    rateLimited: "Too many requests to imsg-web; waiting a moment",
    badResponse: "Couldn't read imsg-web's response",
    httpsOnly: "The imsg-web URL must start with https://",
    badCert: "Couldn't read the certificate in the connection settings. Paste the contents of cert.pem from BEGIN to END",
    forbidden: "This account can't view iMessage",
    needUrlToken: "Enter the URL and token",
    canRead: "Conversations can be read",
    cannotRead: "Conversations can't be read right now",
    cannotSend: "Can't send (read-only token)",
    dryRun: "Sending is a dry run only (imsg-web is in dry-run mode)",
    canSend: "Can send",
    connected: "Connected. {chats}. {sending}",
    emptyFile: "The file is empty",
    noChat: "Choose a conversation to send to",
    nothingToSend: "Nothing to send",
    tooManyFiles: "Up to {max} files",
    tooLong: "The message is too long (about 2,000 English characters max). Split it into several messages",
  },
});

type MessageKey = Parameters<typeof messages.t>[1];

/** 言語ごとの文にできるエラー。message は日本語（音声エージェント・ログ向け）。画面へ返すときは localizeError で言語を合わせる */
export class ImsgError extends HttpError {
  constructor(
    statusCode: number,
    readonly key: MessageKey,
    readonly params?: MessageParams,
  ) {
    super(statusCode, messages.t("ja", key, params));
  }
}

/** ImsgError なら、その言語の文のエラーにする（ほかのエラーはそのまま） */
export function localizeError(err: unknown, locale: Locale): unknown {
  return err instanceof ImsgError && locale !== "ja" ? new HttpError(err.statusCode, messages.t(locale, err.key, err.params)) : err;
}

/** imsg-web の答えのエラー（{ code }）と、つながらなかったときを、画面に出せる言葉にする */
export function describeFailure(status: number, code: string | undefined): HttpError {
  switch (status) {
    case 401:
      return new ImsgError(502, "badToken");
    case 403:
      return code === "CLIENT_FROM_BROWSER"
        ? new ImsgError(502, "fromBrowser")
        : new ImsgError(403, "readOnly");
    case 404:
      return new ImsgError(404, "notFound");
    case 409:
      // id が古い（imsg-web が再起動した・Messages のデータが入れ替わった）。画面は一覧から読み直す
      return new ImsgError(409, "stale");
    case 413:
      return new ImsgError(413, "tooLarge");
    case 429:
      return new ImsgError(429, "busy");
    default:
      return new ImsgError(502, "failed", { status, code: code ?? "" });
  }
}

const CERT_ERRORS = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function describeNetworkError(err: unknown): HttpError {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (CERT_ERRORS.has(code)) {
    return new ImsgError(502, code === "ERR_TLS_CERT_ALTNAME_INVALID" ? "certName" : "certUnverified");
  }
  if (code === "ETIMEDOUT") return new ImsgError(504, "timeout");
  return new ImsgError(502, "unreachable", { code });
}

/** 1分あたりの使う数を数える。上限（120）より少し下で止め、会話の一覧・送信のぶんを画像より先に残す */
export class RateBudget {
  private stamps: number[] = [];
  constructor(
    private readonly limit = 110,
    private readonly now: () => number = Date.now,
  ) {}

  /** 使えるなら数えて true。bulk（顔写真・画像）は上限の 3/4 まで */
  take(bulk: boolean): boolean {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => s > t - 60_000);
    if (this.stamps.length >= (bulk ? Math.floor((this.limit * 3) / 4) : this.limit)) return false;
    this.stamps.push(t);
    return true;
  }
}

interface Cached<T> {
  value: T;
  expiresAt: number;
}

/** 顔写真・画像を覚えておく量（バイト）。id は epoch が変わると捨てる */
const FILE_CACHE_BYTES = 64 * 1024 * 1024;
const LIST_TTL_MS = 10_000;

export class ImsgClient {
  private chatsCache: Cached<ChatSnapshot> | null = null;
  private readonly historyCache = new Map<string, Cached<HistorySnapshot>>();
  private capabilitiesCache: Cached<CapabilitySnapshot> | null = null;
  private readonly files = new Map<string, { type: string; body: Buffer }>();
  private filesBytes = 0;
  private epoch: string | null = null;
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly config: () => ImsgConfig | null,
    private readonly transport: Transport = httpsTransport,
    private readonly budget = new RateBudget(),
    private readonly now: () => number = Date.now,
  ) {}

  /** 接続設定が変わったとき */
  reset(): void {
    this.chatsCache = null;
    this.capabilitiesCache = null;
    this.forgetEpoch();
  }

  private forgetEpoch(): void {
    this.historyCache.clear();
    this.files.clear();
    this.filesBytes = 0;
  }

  /** epoch が変わったら、前の epoch の id で覚えているものを捨てる */
  private seeEpoch(epoch: string): void {
    if (this.epoch !== null && this.epoch !== epoch) this.forgetEpoch();
    this.epoch = epoch;
  }

  private async call(
    method: "GET" | "POST",
    path: string,
    options: { bulk?: boolean; body?: Uint8Array; contentType?: string } = {},
  ): Promise<ImsgResponse> {
    const config = this.config();
    if (!config) throw new ImsgError(503, "notConfigured");
    if (!this.budget.take(options.bulk ?? false)) {
      throw new ImsgError(429, "rateLimited");
    }
    const headers: Record<string, string> = { authorization: `Bearer ${config.token}`, accept: "application/json, */*" };
    if (options.contentType) headers["content-type"] = options.contentType;
    let res: ImsgResponse;
    try {
      res = await this.transport({ method, url: new URL(path, config.url), headers, body: options.body }, config.ca);
    } catch (err) {
      throw describeNetworkError(err);
    }
    if (res.status >= 200 && res.status < 300) return res;
    let code: string | undefined;
    try {
      code = (JSON.parse(res.body.toString("utf-8")) as { code?: string }).code;
    } catch {
      code = undefined;
    }
    if (res.status === 409) this.reset();
    throw describeFailure(res.status, code);
  }

  private async json<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await this.call(method, path, {
      body: body === undefined ? undefined : Buffer.from(JSON.stringify(body)),
      contentType: body === undefined ? undefined : "application/json",
    });
    try {
      return JSON.parse(res.body.toString("utf-8")) as T;
    } catch {
      throw new ImsgError(502, "badResponse");
    }
  }

  /** 同じものを同時に何台もが求めたら、1回だけ問い合わせる */
  private once<T>(key: string, task: () => Promise<T>): Promise<T> {
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const promise = task().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  async capabilities(): Promise<CapabilitySnapshot> {
    if (this.capabilitiesCache && this.capabilitiesCache.expiresAt > this.now()) return this.capabilitiesCache.value;
    return this.once("capabilities", async () => {
      const value = await this.json<CapabilitySnapshot>("GET", "/api/capabilities");
      this.seeEpoch(value.epoch);
      this.capabilitiesCache = { value, expiresAt: this.now() + 60_000 };
      return value;
    });
  }

  async chats(): Promise<ChatSnapshot> {
    if (this.chatsCache && this.chatsCache.expiresAt > this.now()) return this.chatsCache.value;
    return this.once("chats", async () => {
      const value = await this.json<ChatSnapshot>("GET", "/api/chats?limit=50");
      this.seeEpoch(value.epoch);
      this.chatsCache = { value, expiresAt: this.now() + LIST_TTL_MS };
      return value;
    });
  }

  async messages(chatId: string): Promise<HistorySnapshot> {
    const hit = this.historyCache.get(chatId);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    return this.once(`messages:${chatId}`, async () => {
      const value = await this.json<HistorySnapshot>("GET", `/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`);
      this.seeEpoch(value.epoch);
      this.historyCache.set(chatId, { value, expiresAt: this.now() + LIST_TTL_MS });
      return value;
    });
  }

  /** 画像・録音（attachments）と顔写真（avatars）。覚えておいて、何台もの端末に同じものを配る */
  async file(kind: "attachments" | "avatars", id: string): Promise<{ type: string; body: Buffer }> {
    const key = `${kind}/${id}`;
    const hit = this.files.get(key);
    if (hit) return hit;
    return this.once(key, async () => {
      const res = await this.call("GET", `/api/${kind}/${encodeURIComponent(id)}`, { bulk: true });
      const file = { type: res.contentType, body: res.body };
      if (res.body.length <= FILE_CACHE_BYTES / 4) {
        this.files.set(key, file);
        this.filesBytes += res.body.length;
        // 古いものから捨てる（Map は入れた順）
        for (const [oldKey, old] of this.files) {
          if (this.filesBytes <= FILE_CACHE_BYTES) break;
          this.files.delete(oldKey);
          this.filesBytes -= old.body.length;
        }
      }
      return file;
    });
  }

  async upload(name: string, bytes: Uint8Array): Promise<UploadResult> {
    const res = await this.call("POST", `/api/uploads?name=${encodeURIComponent(name)}`, {
      body: bytes,
      contentType: "application/octet-stream",
    });
    return JSON.parse(res.body.toString("utf-8")) as UploadResult;
  }

  /** 送る。結果がどうであれ、一覧とその会話の履歴は次に読み直す */
  async send(input: { chatId: string; text?: string; uploadIds?: string[] }): Promise<SendResult> {
    try {
      return await this.json<SendResult>("POST", "/api/send", input);
    } finally {
      this.chatsCache = null;
      this.historyCache.delete(input.chatId);
    }
  }
}
