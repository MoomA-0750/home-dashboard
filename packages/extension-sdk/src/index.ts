import type { z as Zod, ZodRawShape } from "zod";

/**
 * 拡張機能（Spotify・Home Assistant などの連携）のサーバー側の形。
 *
 * 1つの拡張機能は1つのフォルダで、次のファイルを持つ（scripts/build-extension.mjs が作る）:
 * - manifest.json … 名前・説明・設定の項目（ExtensionManifest）
 * - server.js     … サーバー側（default export が ServerExtension）。無くてもよい
 * - web.js        … 画面側（default export が @home-dashboard/widget-sdk の WebExtension）。無くてもよい
 * - web.css       … 画面側のスタイル。無くてもよい
 *
 * 本体に入っている拡張機能（extensions/*）も、外から持ち込んだ拡張機能（data/extensions/*）も同じ形で読み込む。
 *
 * 拡張機能どうしは「機能の口」でつながる。ある拡張機能が口を持ち（manifest の features。Media の「音楽アプリ」など）、
 * ほかの拡張機能がそこへ入る（manifest の provides と api.provide。wave・Spotify など）。口を持つ側は api.providers で
 * 入っているものを集めて使う。入る側は口を持つ側の決めた形（型）だけを満たせばよく、画面や音声アシスタントのツールは口を持つ側が持つ。
 * サーバー側はダッシュボードのサーバーの中で動き、接続設定のトークンにも触れられる。信頼できるものだけを入れる。
 */

/** 拡張機能の形の版。本体と合わない拡張機能は読み込まない */
export const EXTENSION_API_VERSION = 1;

export type SettingKind = "text" | "url" | "secret" | "number" | "boolean";
export type SettingValue = string | number | boolean;

/** 設定画面の「接続設定」に出す項目。値は .env（env の名前）を既定にし、画面で変えた分を優先する */
export interface SettingField {
  key: string;
  label: string;
  kind: SettingKind;
  /** 既定値を読む環境変数の名前 */
  env?: string;
  /** 環境変数も無いときの既定値 */
  default?: SettingValue;
  placeholder?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  /** 画面に出さない（.env でだけ決める、危ない設定など） */
  hidden?: boolean;
}

/**
 * manifest の文言の、ほかの言語の版（いまは英語だけ）。書いていないものは日本語のまま出す。
 * settings・features は項目の key・口の id ごと、settingsLinks は並びの順に書く
 */
export interface ManifestTranslation {
  name?: string;
  description?: string;
  settingsNote?: string;
  settingsLinks?: string[];
  settings?: Record<string, { label?: string; placeholder?: string }>;
  /** 区画ごと（id で）。steps・links は並びの順に書く */
  settingsGroups?: Record<string, { title?: string; note?: string; steps?: string[]; links?: string[] }>;
  features?: Record<string, { name?: string; description?: string }>;
}

/**
 * 接続設定を、出どころごとの区画（Google・Microsoft など）に分ける。fields に書いた項目はその区画に出し、
 * どの区画にも書いていない項目は、いちばん上の区画（settingsNote・settingsTest・settingsLinks と一緒）に出す
 */
export interface SettingGroup {
  id: string;
  title: string;
  /** 区画の上に出す説明 */
  note?: string;
  /** この区画に出す項目の key（settings の並びの順に出す） */
  fields: string[];
  /**
   * 「手順」を開くと出す、番号付きの手順。{key} と書いたところは、その項目の今の値（秘密の項目を除く）に置き換える
   * （まだ無ければ項目の名前）。戻り先の URL など、入れた値から決まるものを写せるようにする
   */
  steps?: string[];
  /** 区画に出すリンク（手順のページ・外のサービスの管理画面など）。https:// の外のページか、/ から始まる本体の中の道 */
  links?: { label: string; href: string }[];
}

export interface ExtensionManifest {
  /** 小文字の英数字と - で。URL（/api/ext/<id>/）や設定の置き場の名前になる */
  id: string;
  name: string;
  version: string;
  description?: string;
  /** EXTENSION_API_VERSION と同じ値 */
  apiVersion: number;
  /** 設定画面に出す説明 */
  settingsNote?: string;
  /** 設定画面に「接続を確かめる」を出す。押すと、この道（POST /api/ext/<id><path>）を呼び、{ ok, message } を見せる */
  settingsTest?: string;
  /** 設定画面に出すリンク（外のサービスの認可を始めるページなど）。href は / から始まる本体の中の道 */
  settingsLinks?: { label: string; href: string }[];
  settings?: SettingField[];
  /** 接続設定を区画に分ける（SettingGroup） */
  settingsGroups?: SettingGroup[];
  /** この拡張機能が持つ機能の口。ほかの拡張機能がここへ入る（例: Media の { id: "music", name: "音楽アプリ" }） */
  features?: FeatureSlot[];
  /** 入る機能の口の id（ほかの拡張機能の features の id）。設定画面で、その口を持つ拡張機能の下にまとめて出す */
  provides?: string[];
  /** 画面を英語にしたときの名前・説明・設定の項目の名前（ManifestTranslation） */
  locales?: { en?: ManifestTranslation };
}

export interface FeatureSlot {
  /** 小文字の英数字と - で。provides・api.provide・api.providers に書く名前 */
  id: string;
  /** 設定画面に出す名前（「音楽アプリ」など） */
  name: string;
  description?: string;
}

/** 機能の口に入っているもの */
export interface FeatureProvider<T> {
  /** 入っている拡張機能の id */
  extensionId: string;
  /** 入っている拡張機能の名前（manifest の name） */
  name: string;
  /** 入っている拡張機能が渡したもの（口を持つ側が決めた形） */
  implementation: T;
}

/** ログインしている人 */
export interface ExtensionAccount {
  id: string;
  username: string;
  role: "admin" | "member";
}

/** 画面の言語（設定の「一般」で選んだもの） */
export type Locale = "ja" | "en";

export interface RouteContext {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  /** ログインしている人。ログインの要らない道（public）や音声エージェントからでは null */
  account: ExtensionAccount | null;
  /** 音声エージェント（VOICE_AGENT_TOKEN）からの呼び出しか */
  fromAgent: boolean;
  /**
   * ログインの要らない道（public）に `Authorization: Bearer <値>` で添えられた値。外のプログラムに合言葉を持たせて確かめるときに使う。
   * ほかの道では常に null（ログインしている人や音声エージェントの合言葉は拡張機能に渡さない）
   */
  bearer: string | null;
  /** 呼んだ画面の言語。画面に出す文（エラーの理由など）はこの言語で返す。音声エージェントからは "ja" */
  locale: Locale;
}

/** 道（ルート）の返り値。普通のオブジェクトは JSON で返す。api.redirect / api.text / api.file で別の形にする */
export type RouteResult = unknown;
export type RouteHandler = (ctx: RouteContext) => RouteResult | Promise<RouteResult>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteOptions {
  /** ログインしなくても通す（外のプログラムから値を受け取る道など）。既定はログインが要る */
  public?: boolean;
  /** 管理者のアカウントからだけ通す */
  adminOnly?: boolean;
}

/**
 * ツールの危なさ。音声アシスタントは部屋にいる誰の声でも動くので、本体がこれを見て、実行の前に確かめを挟む
 * （Google のスマートホームの「操作ごとの確認」、Apple の App Intents の認証の決まりと同じ考え方）。
 * - read    … 読むだけ。そのまま実行する
 * - low     … 間違えてもすぐ戻せる操作（照明・音楽など）。そのまま実行する。ただし外から来た文（メールの本文・Webページ）を
 *             読んだ後の会話では confirm に上げる（その文に仕込まれた指示で動かされないため）
 * - confirm … 話している人の了承が要る（「〜してよいですか」に「はい」と答える。画面で押してもよい）。送信・削除など
 * - approve … ログインしている人が画面で、パスキーかパスワードで本人確認して許可したときだけ実行する。解錠など
 */
export type ToolRisk = "read" | "low" | "confirm" | "approve";

/** ツールの handler が受け取る、呼び出しのようす */
export interface ToolCallContext {
  /** approve のツールを、画面で本人確認して許可したアカウント（それ以外は null） */
  approvedBy: ExtensionAccount | null;
}

type ToolArgs<Shape extends ZodRawShape> = { [K in keyof Shape]: Zod.infer<Shape[K]> };

export interface ToolDefinition<Shape extends ZodRawShape = ZodRawShape> {
  /** 音声アシスタントに見せるツールの名前。ほかの拡張機能と重ならないものにする */
  name: string;
  /** ツールの説明。関数にすると、音声アシスタントが一覧を読むときだけ作る（家電の一覧を埋め込むなど） */
  description: string | (() => Promise<string>);
  /** 引数の形。本体の zod を受け取って、そのスキーマを返す（拡張機能ごとに zod を抱えないため） */
  inputSchema?: (z: typeof Zod) => Shape;
  /** risk: "read" と同じ（前からの書き方） */
  readOnly?: boolean;
  /** 危なさ（ToolRisk）。引数で変わるもの（鍵は施錠と解錠で違う など）は関数にする。省くと readOnly なら read、そうでなければ confirm */
  risk?: ToolRisk | ((args: ToolArgs<Shape>) => ToolRisk);
  /** 家の人の情報（メール・予定など）を返す。音声の設定で、声では出さないようにできる */
  personal?: boolean;
  /** 外の人が書いた文（メールの本文・予定の招待の名前など）を返す。読んだ後の会話では、操作の前に了承を求める */
  untrusted?: boolean;
  /** 確認・許可の画面と、聞き返す文に出す「何をするか」の一文（例: 「玄関の鍵を開ける」）。省くとツールの名前と引数を出す */
  describe?: (args: ToolArgs<Shape>) => string | Promise<string>;
  handler: (args: ToolArgs<Shape>, context: ToolCallContext) => unknown | Promise<unknown>;
}

export interface ExtensionLogger {
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
}

export interface ServerExtensionApi {
  manifest: ExtensionManifest;
  /** この拡張機能だけが使う書き込める置き場（data/extension-data/<id>） */
  dataDir: string;
  /** 本体の config/（Docker ではホストからマウントしてある） */
  configDir: string;
  /** 接続設定の今の値。画面で変えるとすぐ変わる（読むたびに今の値を返す） */
  settings: Record<string, SettingValue>;
  /** 接続設定が変わったとき（覚えているトークンやキャッシュを捨てるのに使う） */
  onSettingsChange(listener: () => void): void;
  /** 接続設定を書き換える（外のサービスの認可で受け取ったトークンを保存するなど）。null で .env の値に戻す */
  updateSettings(values: Record<string, SettingValue | null>): Promise<void>;
  /** 道を足す。/api/ext/<id><path> で受ける。path が /auth/ で始まるものは /auth/<id>/... でも受ける（外のサービスの認可の戻り先） */
  route(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions): void;
  /** 音声アシスタント（Claude）に渡すツールを足す */
  tool<Shape extends ZodRawShape>(definition: ToolDefinition<Shape>): void;
  /** 機能の口に入る。implementation は口を持つ拡張機能が決めた形にする（manifest の provides にも書く） */
  provide<T>(feature: string, implementation: T): void;
  /** 機能の口に入っているもの（動いている拡張機能のものだけ）。読むたびに今のものを返すので、使うときに読む */
  providers<T>(feature: string): FeatureProvider<T>[];
  /** つないでいるすべての画面に知らせる（WebSocket）。type には自動で "ext:<id>:" を付ける */
  broadcast(type: string, payload?: unknown): void;
  /** 状態コードと、画面に出してよい理由を持つエラー */
  error(statusCode: number, message: string): Error;
  redirect(url: string): RouteResult;
  text(body: string, statusCode?: number): RouteResult;
  /**
   * ファイル（画像・音声など）をそのまま返す。contentType は image/・audio/・video/ で始まるものだけ（ほかは
   * application/octet-stream にして、ダウンロードさせる）。cacheSeconds を付けると、その間ブラウザが覚えて使う（ログインした人だけ）
   */
  file(body: Uint8Array, contentType: string, options?: { cacheSeconds?: number }): RouteResult;
  log: ExtensionLogger;
  /** 切ったとき・入れ替えたときに呼ぶ後片付け（タイマーを止めるなど） */
  onDispose(listener: () => void): void;
}

export interface ServerExtension {
  register(api: ServerExtensionApi): void | Promise<void>;
}

/**
 * 状態コードと、画面に出してよい理由を持つエラー。道やツールの中で投げると、本体がその状態コードと理由で返す
 * （statusCode を持つエラーなら、このクラスでなくても同じに扱う）
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export type MessageParams = Record<string, string | number>;
export type MessageValue = string | ((params: MessageParams) => string);

/**
 * サーバー側で画面に返す文（エラーの理由など）の、日本語と英語の辞書。画面側の defineMessages（widget-sdk）と同じ書き方で、
 * 言語は道の ctx.locale を渡す。
 *
 *   const messages = defineServerMessages({ ja: { notFound: "その場所はありません" }, en: { notFound: "No such place" } });
 *   throw api.error(404, messages.t(ctx.locale, "notFound"));
 */
export function defineServerMessages<const J extends Record<string, MessageValue>>(dicts: {
  ja: J;
  en: { [K in keyof J]: MessageValue };
}) {
  return {
    t(locale: Locale, key: keyof J & string, params?: MessageParams): string {
      const value = (dicts[locale] as Record<string, MessageValue>)[key] ?? dicts.ja[key];
      if (typeof value === "function") return value(params ?? {});
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
    },
  };
}

/** 型を効かせるためのヘルパー。server.ts で `export default defineServerExtension({ register(api) { ... } })` */
export function defineServerExtension(extension: ServerExtension): ServerExtension {
  return extension;
}

/**
 * 外へ問い合わせた結果を少しの間覚え、同じ間に来た問い合わせは1回にまとめる（何台もの画面が同じものを数秒おきに読むとき用）。
 * 失敗した結果は覚えない。操作して状態が変わったら clear() で捨てる。
 *
 *   const status = cachedLoader(10_000);
 *   api.route("GET", "/status", () => status("all", () => readEverything()));
 */
export function cachedLoader(ttlMs: number) {
  const values = new Map<string, { value: unknown; expiresAt: number }>();
  const pending = new Map<string, Promise<unknown>>();
  function load<T>(key: string, task: () => Promise<T>): Promise<T> {
    const hit = values.get(key);
    if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value as T);
    const running = pending.get(key);
    if (running) return running as Promise<T>;
    const promise = task()
      .then((value) => {
        values.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  /** 覚えた結果を捨てる（操作して状態が変わったとき。次の問い合わせで読み直す） */
  load.clear = () => values.clear();
  return load;
}
