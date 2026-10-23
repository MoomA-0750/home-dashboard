import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync } from "fflate";
// 型だけを読む（SDK は TypeScript のまま置いてあり、本番の node では読めない。値は下で持つ）
import type {
  ExtensionManifest,
  FeatureProvider,
  HttpMethod,
  RouteContext,
  RouteHandler,
  RouteOptions,
  ServerExtension,
  ServerExtensionApi,
  SettingField,
  ToolDefinition,
} from "@home-dashboard/extension-sdk";
import { config } from "../config.js";
import {
  onConnectionChange,
  registerSettingsSection,
  unregisterSettingsSection,
  updateConnectionSettings,
} from "../connectionSettings.js";
import { ServiceError } from "../serviceError.js";
import { broadcast } from "../ws.js";
import { startSandbox } from "./sandbox.js";

/**
 * 拡張機能を読み込み、入／切・持ち込み・削除を受け持つ。
 *
 * - 本体に入っている拡張機能: config.extensionsDir/<id>/dist（リポジトリの extensions/*。消せないが切れる）
 * - 持ち込んだ拡張機能:       data/extensions/<id>（設定画面から ZIP で入れるか、登録したリポジトリから入れる。切ることも消すこともできる）
 *   リポジトリから入れたものは、本体の拡張機能と同じ id でも、版が同じか新しければ本体のものの代わりに動く（消すと本体のものに戻る）
 * どちらも manifest.json・server.js・web.js・web.css を持つ同じ形で、読み込み方も同じ。
 * 切った拡張機能は、道・音声アシスタントのツール・接続設定の節を外し、後片付け（onDispose）を呼ぶ。
 *
 * 持ち込んだ拡張機能は、管理者が「信頼する」にしない限り、別のプロセスで権限を絞って動かす（sandbox.ts）。
 * 本体と同じ権限で動かす（信頼する）ものは、自動では更新しない（リポジトリが乗っ取られたときに、そのまま本体の中で動かないように）。
 */

/** 拡張機能の形の版（packages/extension-sdk の EXTENSION_API_VERSION と同じ値にする） */
const EXTENSION_API_VERSION = 1;

const INSTALLED_DIR = join(config.dataDir, "extensions");
const EXTENSION_DATA_DIR = join(config.dataDir, "extension-data");
// server.js を版ごとの名前で写して読み込む置き場（同じ道のモジュールは読み込み直せないため）
const MODULE_CACHE_DIR = join(config.dataDir, "extension-cache");
const STATE_PATH = join(config.dataDir, "extensions.json");

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 500;
// ZIP に入れてよいもの。サーバーが読むのは manifest.json と server.js だけで、ほかは画面に配るだけ
export const ALLOWED_FILE = /^(manifest\.json|server\.js|web\.js|web\.css|assets\/[A-Za-z0-9._\-/]+)$/;
// 入れたものがどこから来たかの覚え書き（data/extensions/<id>/ に置く。画面には配らない）
const ORIGIN_FILE = ".origin.json";
// 画面に配ってよいもの
const SERVABLE_FILE = /^(web\.js|web\.css|assets\/[A-Za-z0-9._\-/]+)$/;

interface Route {
  method: HttpMethod;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
  options: RouteOptions;
}

interface Tool {
  extensionId: string;
  definition: ToolDefinition;
}

/** 拡張機能がどこから来たか */
export type ExtensionOrigin =
  | { kind: "builtin" }
  | { kind: "zip" }
  | { kind: "source"; sourceId: string; commit: string };

interface Extension {
  manifest: ExtensionManifest;
  dir: string;
  builtin: boolean;
  origin: ExtensionOrigin;
  /** 本体の拡張機能をリポジトリの新しい版で置き換えているときの、元の本体のもの（消すとこれに戻る） */
  shadowed: Extension | null;
  enabled: boolean;
  /** 読み込んで動いているか */
  active: boolean;
  /** 読み込めなかった理由 */
  error: string | null;
  /** 別のプロセスで権限を絞って動かすか（持ち込んだもので、管理者が信頼するにしていないもの） */
  sandboxed: boolean;
  /** 画面側のファイルが変わったら変わる値（キャッシュを捨てさせる） */
  revision: string;
  routes: Route[];
  tools: Tool[];
  /** 入っている機能の口と、そこへ渡したもの */
  provisions: Map<string, unknown>;
  disposers: Array<() => void>;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string | null;
  builtin: boolean;
  enabled: boolean;
  active: boolean;
  error: string | null;
  hasWeb: boolean;
  hasStyle: boolean;
  revision: string;
  origin: ExtensionOrigin;
  /** 別のプロセスで権限を絞って動かしているか（本体の拡張機能と、管理者が信頼するにしたものは false） */
  sandboxed: boolean;
  /** 本体に入っている版（本体の拡張機能を置き換えているときは、元の本体の版）。本体に無いものは null */
  builtinVersion: string | null;
  /** この拡張機能が持つ機能の口 */
  features: { id: string; name: string; description: string | null }[];
  /** 入る機能の口の id */
  provides: string[];
  /** 英語にしたときの文言（manifest の locales）。画面が言語に合わせて使う */
  locales: ExtensionManifest["locales"];
}

class RouteResponse {
  constructor(
    readonly kind: "redirect" | "text",
    readonly body: string,
    readonly statusCode: number,
  ) {}
}

class FileResponse {
  constructor(
    readonly body: Uint8Array,
    readonly contentType: string,
    readonly cacheSeconds: number,
  ) {}
}

// 拡張機能の道から、ダッシュボードと同じ場所（オリジン）でそのまま開かせてよいファイルの形（HTML・SVG などは開かせない）
const INLINE_FILE_TYPE = /^(image\/(png|jpeg|gif|webp|heic|heif|avif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+)$/;

const extensions = new Map<string, Extension>();
let disabled = new Set<string>();
// 本体と同じ権限で動かす（管理者が信頼するにした）持ち込んだ拡張機能
let trusted = new Set<string>();
// 別のプロセスで動かすようになる前から入っていたものを、信頼するにしたか（急に動かなくならないよう一度だけ）
let sandboxMigrated = false;

function compileRoute(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        keys.push(part.slice(1));
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

export function validateManifest(raw: unknown): ExtensionManifest {
  const m = raw as Partial<ExtensionManifest> | null;
  if (!m || typeof m !== "object") throw new ServiceError(400, "manifest.json が読めません", "Cannot read manifest.json");
  if (typeof m.id !== "string" || !ID_PATTERN.test(m.id))
    throw new ServiceError(400, "manifest.json の id は小文字の英数字と - で40文字までにしてください", "The id in manifest.json must be up to 40 lowercase letters, digits or -");
  if (typeof m.name !== "string" || !m.name.trim()) throw new ServiceError(400, "manifest.json に name がありません", "manifest.json has no name");
  if (typeof m.version !== "string") throw new ServiceError(400, "manifest.json に version がありません", "manifest.json has no version");
  if (m.apiVersion !== EXTENSION_API_VERSION)
    throw new ServiceError(400, `この拡張機能は形の版が合いません（${m.apiVersion}。本体は ${EXTENSION_API_VERSION}）`, `This extension is for a different API version (${m.apiVersion}; the dashboard uses ${EXTENSION_API_VERSION})`);
  const settings = Array.isArray(m.settings) ? m.settings : [];
  for (const field of settings as SettingField[]) {
    if (typeof field?.key !== "string" || typeof field.label !== "string")
      throw new ServiceError(400, "manifest.json の settings の形が違います", "The settings in manifest.json are not in the expected format");
    if (!["text", "url", "secret", "number", "boolean"].includes(field.kind))
      throw new ServiceError(400, `manifest.json の settings の kind が違います: ${field.kind}`, `Unknown settings kind in manifest.json: ${field.kind}`);
  }
  const features = Array.isArray(m.features) ? m.features : [];
  for (const feature of features) {
    if (typeof feature?.id !== "string" || !ID_PATTERN.test(feature.id) || typeof feature.name !== "string")
      throw new ServiceError(400, "manifest.json の features の形が違います（id は小文字の英数字と -、name は名前）", "The features in manifest.json are not in the expected format (id: lowercase letters, digits and -; name: a name)");
  }
  const provides = Array.isArray(m.provides) ? m.provides : [];
  if (provides.some((id) => typeof id !== "string" || !ID_PATTERN.test(id)))
    throw new ServiceError(400, "manifest.json の provides は機能の口の id の並びにしてください", "provides in manifest.json must be a list of feature ids");
  // 区画は見た目を分けるだけなので、形の違うものは捨てて読み込みは止めない
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  const settingsGroups = (Array.isArray(m.settingsGroups) ? m.settingsGroups : [])
    .filter((group) => typeof group?.id === "string" && typeof group.title === "string")
    .map((group) => ({
      id: group.id,
      title: group.title,
      note: typeof group.note === "string" ? group.note : undefined,
      fields: strings(group.fields),
      steps: strings(group.steps),
      links: (Array.isArray(group.links) ? group.links : []).filter(
        (link) => typeof link?.label === "string" && typeof link.href === "string",
      ),
    }));
  // 英語の文言（locales.en）は、形が違えば無視する（日本語のまま出すだけなので、読み込みは止めない）
  const en = (m.locales as { en?: unknown } | undefined)?.en;
  const locales = en && typeof en === "object" && !Array.isArray(en) ? { en } : undefined;
  return { ...m, settings, settingsGroups, features, provides, locales } as ExtensionManifest;
}

const idList = (value: unknown) => new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);

async function readState(): Promise<void> {
  try {
    const raw = JSON.parse(await readFile(STATE_PATH, "utf-8")) as { disabled?: unknown; trusted?: unknown; sandboxMigrated?: unknown };
    disabled = idList(raw.disabled);
    trusted = idList(raw.trusted);
    sandboxMigrated = raw.sandboxMigrated === true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    disabled = new Set();
    trusted = new Set();
    sandboxMigrated = false;
  }
}

async function writeState(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  const state = { disabled: [...disabled].sort(), trusted: [...trusted].sort(), sandboxMigrated };
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  await rename(tmp, STATE_PATH);
}

/** 本体と同じ権限で動かす（信頼する）持ち込んだ拡張機能か。自動で更新しないものを見分けるのに使う */
export function isTrustedExtension(id: string): boolean {
  const ext = extensions.get(id);
  return ext !== undefined && !ext.builtin && !ext.sandboxed;
}

async function revisionOf(dir: string): Promise<string> {
  const hash = createHash("sha256");
  // 中身から作る（入れ替えで大きさも時刻も同じになることがあるため）。ファイルは小さいので毎回読んでよい
  for (const name of ["manifest.json", "web.js", "web.css", "server.js"]) {
    const content = await readFile(join(dir, name)).catch(() => null);
    if (content) hash.update(`${name}:`).update(content);
  }
  return hash.digest("hex").slice(0, 12);
}

function makeApi(ext: Extension): ServerExtensionApi {
  const { manifest } = ext;
  const settings = registerSettingsSection(manifest.id, manifest.name, manifest.settings ?? [], {
    note: manifest.settingsNote,
    test: manifest.settingsTest,
    // 外のページへは飛ばさない（本体の中の道だけ）
    links: (manifest.settingsLinks ?? []).filter((link) => link.href.startsWith("/") && !link.href.startsWith("//")),
    groups: manifest.settingsGroups,
    locales: manifest.locales,
  });
  const dataDir = join(EXTENSION_DATA_DIR, manifest.id);
  const prefix = `[ext:${manifest.id}]`;
  return {
    manifest,
    dataDir,
    configDir: config.configDir,
    settings,
    onSettingsChange: (listener) => onConnectionChange(manifest.id, listener),
    updateSettings: async (values) => {
      await updateConnectionSettings(manifest.id, values);
    },
    route: (method, path, handler, options = {}) => {
      if (!path.startsWith("/")) throw new Error(`${prefix} route path must start with /: ${path}`);
      ext.routes.push({ method, ...compileRoute(path), handler, options });
    },
    tool: (definition) => {
      const taken = [...extensions.values()].some((other) =>
        other.tools.some((tool) => tool.definition.name === definition.name),
      );
      if (taken) throw new Error(`${prefix} tool name is already used: ${definition.name}`);
      ext.tools.push({ extensionId: manifest.id, definition: definition as unknown as ToolDefinition });
    },
    provide: (feature, implementation) => {
      if (!(manifest.provides ?? []).includes(feature))
        throw new Error(`${prefix} manifest.json の provides に ${feature} がありません`);
      ext.provisions.set(feature, implementation);
    },
    providers: <T>(feature: string) => featureProviders<T>(feature),
    broadcast: (type, payload) => broadcast({ type: `ext:${manifest.id}:${type}`, payload }),
    error: (statusCode, message) => new ServiceError(statusCode, message),
    redirect: (url) => new RouteResponse("redirect", url, 302),
    text: (body, statusCode = 200) => new RouteResponse("text", body, statusCode),
    file: (body, contentType, options) => {
      const type = contentType.split(";")[0].trim().toLowerCase();
      return new FileResponse(
        body,
        INLINE_FILE_TYPE.test(type) ? type : "application/octet-stream",
        Math.max(0, Math.floor(options?.cacheSeconds ?? 0)),
      );
    },
    log: {
      info: (message, detail) => console.log(prefix, message, detail ?? ""),
      warn: (message, detail) => console.warn(prefix, message, detail ?? ""),
      error: (message, detail) => console.error(prefix, message, detail ?? ""),
    },
    onDispose: (listener) => ext.disposers.push(listener),
  };
}

async function activate(ext: Extension): Promise<void> {
  ext.routes = [];
  ext.tools = [];
  ext.provisions = new Map();
  ext.disposers = [];
  ext.error = null;
  try {
    const api = makeApi(ext);
    await mkdir(api.dataDir, { recursive: true });
    const serverPath = join(ext.dir, "server.js");
    if (existsSync(serverPath) && ext.sandboxed) {
      await activateSandboxed(ext, api);
    } else if (existsSync(serverPath)) {
      // 入れ替えたあとも新しい中身を読むよう、版ごとに別の名前で写してから読み込む
      // （URL に ?v= を付ける手は、開発で使う tsx の読み込みが無視するので使えない。古いものはメモリに残るが、入れ替えは稀）
      const copy = join(MODULE_CACHE_DIR, `${ext.manifest.id}-${ext.revision}.mjs`);
      if (!existsSync(copy)) {
        await mkdir(MODULE_CACHE_DIR, { recursive: true });
        await copyFile(serverPath, copy);
      }
      const module = (await import(pathToFileURL(copy).href)) as { default?: ServerExtension };
      if (typeof module.default?.register !== "function")
        throw new Error("server.js の default export に register がありません");
      await module.default.register(api);
    }
    ext.active = true;
  } catch (err) {
    deactivate(ext);
    ext.error = err instanceof Error ? err.message : String(err);
    console.error(`[ext:${ext.manifest.id}] 読み込めませんでした:`, err);
  }
}

/** 別のプロセスで読み込み、足した道・道具・機能の口をこちらに写す。止まったら切れた扱いにする */
async function activateSandboxed(ext: Extension, api: ServerExtensionApi): Promise<void> {
  let stopping = false;
  const handle = await startSandbox(api, {
    dir: ext.dir,
    toRouteResult: (result) => {
      if (result.kind === "redirect") return new RouteResponse("redirect", result.url, 302);
      if (result.kind === "text") return new RouteResponse("text", result.body, result.statusCode);
      if (result.kind === "file") return api.file(result.body, result.contentType, { cacheSeconds: result.cacheSeconds });
      return result.body;
    },
    onExit: (reason) => {
      if (stopping || extensions.get(ext.manifest.id) !== ext || !ext.active) return;
      console.error(`[ext:${ext.manifest.id}] ${reason}`);
      deactivate(ext);
      ext.error = reason;
      notifyChanged();
    },
  });
  ext.disposers.push(() => {
    stopping = true;
    handle.stop();
  });
  api.onSettingsChange(() => handle.sendSettings(api.settings));
}

function deactivate(ext: Extension): void {
  for (const dispose of ext.disposers) {
    try {
      dispose();
    } catch (err) {
      console.error(`[ext:${ext.manifest.id}] 後片付けに失敗しました:`, err);
    }
  }
  ext.routes = [];
  ext.tools = [];
  ext.provisions = new Map();
  ext.disposers = [];
  ext.active = false;
  unregisterSettingsSection(ext.manifest.id);
}

async function readOrigin(dir: string): Promise<ExtensionOrigin> {
  try {
    const raw = JSON.parse(await readFile(join(dir, ORIGIN_FILE), "utf-8")) as { kind?: unknown; sourceId?: unknown; commit?: unknown };
    if (raw.kind === "source" && typeof raw.sourceId === "string" && typeof raw.commit === "string")
      return { kind: "source", sourceId: raw.sourceId, commit: raw.commit };
  } catch {
    // 覚え書きの無いものは ZIP で持ち込んだもの
  }
  return { kind: "zip" };
}

/** 1.2.10 と 1.2.9 のような版を比べる（数でない部分は文字として比べる）。a が新しければ正 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/);
  const pb = b.split(/[.+-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "0";
    const y = pb[i] ?? "0";
    const nx = Number(x);
    const ny = Number(y);
    const diff = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function loadFrom(dir: string, builtin: boolean): Promise<Extension | null> {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf-8")));
  return {
    manifest,
    dir,
    builtin,
    origin: builtin ? { kind: "builtin" } : await readOrigin(dir),
    shadowed: null,
    enabled: !disabled.has(manifest.id),
    active: false,
    error: null,
    sandboxed: !builtin && !trusted.has(manifest.id),
    revision: await revisionOf(dir),
    routes: [],
    tools: [],
    provisions: new Map(),
    disposers: [],
  };
}

async function subdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name));
}

/** 起動時に一度呼ぶ。本体の拡張機能と持ち込んだ拡張機能を読み込み、入っているものを動かす */
export async function loadExtensions(): Promise<void> {
  await readState();
  // 前に動かしたときの写しは捨てる（いま要るものは読み込むときに写し直す）
  await rm(MODULE_CACHE_DIR, { recursive: true, force: true });
  const found: Extension[] = [];
  for (const dir of await subdirs(config.extensionsDir)) {
    try {
      const ext = await loadFrom(join(dir, "dist"), true);
      if (ext) found.push(ext);
    } catch (err) {
      console.error(`本体の拡張機能を読めませんでした（${dir}）:`, err);
    }
  }
  for (const dir of await subdirs(INSTALLED_DIR)) {
    if (dir.split(sep).pop()!.startsWith(".")) continue;
    try {
      const ext = await loadFrom(dir, false);
      if (!ext) continue;
      const index = found.findIndex((other) => other.manifest.id === ext.manifest.id);
      if (index >= 0) {
        const builtinExt = found[index];
        // リポジトリから入れた、本体と同じか新しい版は、本体のものの代わりに動かす
        if (ext.origin.kind === "source" && compareVersions(ext.manifest.version, builtinExt.manifest.version) >= 0) {
          ext.shadowed = builtinExt;
          found[index] = ext;
          continue;
        }
        if (ext.origin.kind === "source") {
          // 本体のほうが新しくなった（本体を更新した）。古い置き換えは捨てる
          console.log(`リポジトリから入れた ${ext.manifest.id} ${ext.manifest.version} より本体の版が新しいので、本体のものに戻します`);
          await rm(dir, { recursive: true, force: true });
        } else {
          console.error(`持ち込んだ拡張機能 ${ext.manifest.id} は本体のものと名前が重なるので読み込みません`);
        }
        continue;
      }
      found.push(ext);
    } catch (err) {
      console.error(`持ち込んだ拡張機能を読めませんでした（${dir}）:`, err);
    }
  }
  if (!sandboxMigrated) {
    // 別のプロセスで動かすようになる前から入っていたものは、これまでどおり本体と同じ権限で動かす（管理者が後から外せる）
    for (const ext of found.filter((e) => !e.builtin)) {
      trusted.add(ext.manifest.id);
      ext.sandboxed = false;
    }
    sandboxMigrated = true;
    await writeState();
  }
  for (const ext of found) {
    extensions.set(ext.manifest.id, ext);
    if (ext.enabled) await activate(ext);
  }
}

function toInfo(ext: Extension): ExtensionInfo {
  return {
    id: ext.manifest.id,
    name: ext.manifest.name,
    version: ext.manifest.version,
    description: ext.manifest.description ?? null,
    builtin: ext.builtin,
    enabled: ext.enabled,
    active: ext.active,
    error: ext.error,
    hasWeb: existsSync(join(ext.dir, "web.js")),
    hasStyle: existsSync(join(ext.dir, "web.css")),
    revision: ext.revision,
    origin: ext.origin,
    sandboxed: ext.sandboxed,
    builtinVersion: ext.builtin ? ext.manifest.version : (ext.shadowed?.manifest.version ?? null),
    features: (ext.manifest.features ?? []).map((f) => ({ id: f.id, name: f.name, description: f.description ?? null })),
    provides: ext.manifest.provides ?? [],
    locales: ext.manifest.locales ?? {},
  };
}

export function listExtensions(): ExtensionInfo[] {
  return [...extensions.values()]
    .map(toInfo)
    .sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.name.localeCompare(b.name, "ja"));
}

/** 動いている拡張機能の id（接続設定の並びなどに使う） */
export function activeExtensionIds(): string[] {
  return listExtensions()
    .filter((ext) => ext.active)
    .map((ext) => ext.id);
}

function notifyChanged(): void {
  broadcast({ type: "extensions-changed" });
}

export async function setExtensionEnabled(id: string, enabled: boolean): Promise<ExtensionInfo> {
  const ext = extensions.get(id);
  if (!ext) throw new ServiceError(404, "その拡張機能は見つかりません", "Extension not found");
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  await writeState();
  ext.enabled = enabled;
  if (enabled && !ext.active) await activate(ext);
  if (!enabled && ext.active) deactivate(ext);
  notifyChanged();
  return toInfo(ext);
}

/**
 * 持ち込んだ拡張機能を、本体と同じ権限で動かす（信頼する）か、別のプロセスで権限を絞って動かすか。管理者だけ。
 * 動いていれば読み込み直す
 */
export async function setExtensionTrusted(id: string, value: boolean): Promise<ExtensionInfo> {
  const ext = extensions.get(id);
  if (!ext) throw new ServiceError(404, "その拡張機能は見つかりません", "Extension not found");
  if (ext.builtin) throw new ServiceError(409, "本体の拡張機能は、いつも本体と同じ権限で動きます", "Built-in extensions always run with full access");
  if (value) trusted.add(id);
  else trusted.delete(id);
  await writeState();
  ext.sandboxed = !value;
  if (ext.active) {
    deactivate(ext);
    await activate(ext);
  }
  notifyChanged();
  return toInfo(ext);
}

/** ZIP の中身を確かめて取り出す。ZIP の直下か、1段のフォルダの下に manifest.json がある形を受ける */
export function unpackExtension(zip: Uint8Array): { manifest: ExtensionManifest; files: Map<string, Uint8Array> } {
  if (zip.byteLength > MAX_ZIP_BYTES) throw new ServiceError(413, "ZIP が大きすぎます（20MB まで）", "The ZIP is too large (up to 20 MB)");
  let entries: Record<string, Uint8Array>;
  let total = 0;
  let count = 0;
  try {
    entries = unzipSync(zip, {
      filter: (file) => {
        count++;
        total += file.originalSize;
        if (count > MAX_FILES || total > MAX_UNPACKED_BYTES) throw new ServiceError(413, "ZIP の中身が多すぎます", "The ZIP contains too much");
        return !file.name.endsWith("/");
      },
    });
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    throw new ServiceError(400, "ZIP を開けませんでした", "Could not open the ZIP");
  }
  const names = Object.keys(entries).filter((name) => !name.startsWith("__MACOSX/") && !name.endsWith(".DS_Store"));
  const manifestName = names.find((name) => /^([^/]+\/)?manifest\.json$/.test(name));
  if (!manifestName) throw new ServiceError(400, "ZIP に manifest.json がありません", "The ZIP has no manifest.json");
  const root = manifestName.slice(0, -"manifest.json".length);

  const files = new Map<string, Uint8Array>();
  for (const name of names) {
    if (!name.startsWith(root)) continue;
    const relative = name.slice(root.length);
    // フォルダの外へ出る名前や、決まったもの以外は受けない
    if (relative.includes("..") || relative.includes("\\") || !ALLOWED_FILE.test(relative))
      throw new ServiceError(400, `ZIP に入れられないファイルがあります: ${relative}`, `The ZIP contains a file that is not allowed: ${relative}`);
    files.set(relative, entries[name]);
  }
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
  } catch {
    throw new ServiceError(400, "manifest.json が JSON として読めません", "manifest.json is not valid JSON");
  }
  return { manifest: validateManifest(manifestJson), files };
}

/** 拡張機能を持ち込む（同じ id のものがあれば入れ替える）。入れた拡張機能は入の状態にする */
export async function installExtension(zip: Uint8Array): Promise<ExtensionInfo> {
  const { manifest, files } = unpackExtension(zip);
  return installFiles(manifest, files, { kind: "zip" });
}

/**
 * リポジトリから取ってきたファイルで入れる・更新する。本体の拡張機能と同じ id なら、版が同じか新しいときだけ置き換える。
 * 更新のときは入／切をそのままにする
 */
export async function installExtensionFiles(
  files: Map<string, Uint8Array>,
  origin: Extract<ExtensionOrigin, { kind: "source" }>,
): Promise<ExtensionInfo> {
  for (const name of files.keys())
    if (name.includes("..") || name.includes("\\") || !ALLOWED_FILE.test(name))
      throw new ServiceError(400, `入れられないファイルがあります: ${name}`, `A file that is not allowed: ${name}`);
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
  } catch {
    throw new ServiceError(400, "manifest.json が読めません", "Cannot read manifest.json");
  }
  return installFiles(validateManifest(manifestJson), files, origin);
}

async function installFiles(
  manifest: ExtensionManifest,
  files: Map<string, Uint8Array>,
  origin: ExtensionOrigin,
): Promise<ExtensionInfo> {
  const existing = extensions.get(manifest.id);
  const builtinBase = existing?.builtin ? existing : (existing?.shadowed ?? null);
  if (builtinBase && origin.kind !== "source")
    throw new ServiceError(409, `「${manifest.id}」は本体の拡張機能と同じ名前です`, `"${manifest.id}" has the same name as a built-in extension`);
  if (builtinBase && compareVersions(manifest.version, builtinBase.manifest.version) < 0)
    throw new ServiceError(
      409,
      `本体に入っている版（${builtinBase.manifest.version}）より古い（${manifest.version}）ので入れません`,
    );

  const target = join(INSTALLED_DIR, manifest.id);
  const staging = join(INSTALLED_DIR, `.staging-${manifest.id}-${Date.now()}`);
  for (const [relative, content] of files) {
    const path = normalize(join(staging, relative));
    if (!path.startsWith(staging + sep)) throw new ServiceError(400, `入れられないファイルがあります: ${relative}`, `A file that is not allowed: ${relative}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  if (origin.kind === "source") await writeFile(join(staging, ORIGIN_FILE), JSON.stringify(origin, null, 2));
  if (existing?.active) deactivate(existing);
  // 本体の拡張機能は別の置き場（extensions/<id>/dist）にあるので、ここで消すのは前に入れたものだけ
  await rm(target, { recursive: true, force: true });
  await rename(staging, target);

  // 新しく入れたものは入にする。更新（同じ id があった）なら入／切をそのままにする
  if (!existing) {
    disabled.delete(manifest.id);
    await writeState();
  }
  const ext = (await loadFrom(target, false))!;
  ext.shadowed = builtinBase;
  extensions.set(manifest.id, ext);
  if (ext.enabled) await activate(ext);
  notifyChanged();
  return toInfo(ext);
}

/**
 * 持ち込んだ・リポジトリから入れた拡張機能を消す（本体の拡張機能は切れるだけで消せない）。
 * 本体の拡張機能を置き換えていたものは、消すと本体の版に戻る。拡張機能の書いたデータと接続設定は残す
 */
export async function uninstallExtension(id: string): Promise<void> {
  const ext = extensions.get(id);
  if (!ext) throw new ServiceError(404, "その拡張機能は見つかりません", "Extension not found");
  if (ext.builtin) throw new ServiceError(409, "本体の拡張機能は消せません。切ってください", "Built-in extensions cannot be removed. Turn it off instead");
  if (ext.active) deactivate(ext);
  await rm(ext.dir, { recursive: true, force: true });
  // 入れ直したときは、あらためて別のプロセスで動かす
  if (trusted.delete(id)) await writeState();
  if (ext.shadowed) {
    const original = ext.shadowed;
    original.enabled = !disabled.has(id);
    extensions.set(id, original);
    if (original.enabled) await activate(original);
  } else {
    extensions.delete(id);
    disabled.delete(id);
    await writeState();
  }
  notifyChanged();
}

/** 画面に配るファイル（web.js・web.css・assets/）の場所。配ってよくないものは null */
export function extensionFilePath(id: string, relative: string): string | null {
  const ext = extensions.get(id);
  if (!ext || !ext.enabled || !SERVABLE_FILE.test(relative) || relative.includes("..")) return null;
  const path = normalize(join(ext.dir, relative));
  return path.startsWith(ext.dir + sep) ? path : null;
}

function findRoute(
  id: string,
  method: string,
  subpath: string,
): { ext: Extension; route: Route; params: Record<string, string> } | null {
  const ext = extensions.get(id);
  if (!ext?.active) return null;
  for (const route of ext.routes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(subpath);
    if (!match) continue;
    let params: Record<string, string>;
    try {
      params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
    } catch {
      return null; // 壊れた %xx の道は、無い道と同じに扱う
    }
    return { ext, route, params };
  }
  return null;
}

/** ログインしなくても通す道か（auth のフックから呼ぶ） */
export function isPublicExtensionRoute(id: string, method: string, subpath: string): boolean {
  return findRoute(id, method, subpath)?.route.options.public === true;
}

export type DispatchResult =
  | { kind: "json"; statusCode: number; body: unknown }
  | { kind: "redirect"; url: string }
  | { kind: "text"; statusCode: number; body: string }
  | { kind: "file"; body: Uint8Array; contentType: string; cacheSeconds: number };

/**
 * 画面に理由を出してよいエラーなら、その状態コード。拡張機能はそれぞれ自分の HttpError を同梱しているので、
 * クラスではなく statusCode を持つかで見分ける
 */
export function errorStatus(err: unknown): number | null {
  if (err instanceof ServiceError) return err.statusCode;
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  return err instanceof Error && typeof status === "number" && status >= 400 && status < 600 ? status : null;
}

/** 拡張機能の道を呼ぶ。見つからなければ 404 */
export async function dispatchExtensionRoute(
  id: string,
  method: string,
  subpath: string,
  ctx: Omit<RouteContext, "params">,
): Promise<DispatchResult> {
  const found = findRoute(id, method, subpath);
  if (!found) return { kind: "json", statusCode: 404, body: { error: "not found" } };
  if (found.route.options.adminOnly && ctx.account?.role !== "admin")
    return { kind: "json", statusCode: 403, body: { error: "管理者だけができます" } };
  try {
    // 添えられた合言葉は、ログインの要らない道にだけ渡す（音声エージェントのトークンなどを拡張機能に見せない）
    const bearer = found.route.options.public ? ctx.bearer : null;
    const result = await found.route.handler({ ...ctx, bearer, params: found.params });
    if (result instanceof FileResponse) {
      return { kind: "file", body: result.body, contentType: result.contentType, cacheSeconds: result.cacheSeconds };
    }
    if (result instanceof RouteResponse) {
      return result.kind === "redirect"
        ? { kind: "redirect", url: result.body }
        : { kind: "text", statusCode: result.statusCode, body: result.body };
    }
    return { kind: "json", statusCode: 200, body: result ?? { ok: true } };
  } catch (err) {
    const status = errorStatus(err);
    if (status !== null) return { kind: "json", statusCode: status, body: { error: (err as Error).message } };
    console.error(`[ext:${id}] ${method} ${subpath} で失敗しました:`, err);
    return { kind: "json", statusCode: 500, body: { error: "internal error" } };
  }
}

/** 機能の口に入っているもの（動いている拡張機能のもの。拡張機能の並びの順） */
export function featureProviders<T>(feature: string): FeatureProvider<T>[] {
  return listExtensions()
    .map((info) => extensions.get(info.id)!)
    .filter((ext) => ext.active && ext.provisions.has(feature))
    .map((ext) => ({
      extensionId: ext.manifest.id,
      name: ext.manifest.name,
      implementation: ext.provisions.get(feature) as T,
    }));
}

/** 動いている拡張機能の、音声アシスタント向けのツール */
export function extensionTools(): Tool[] {
  return [...extensions.values()].filter((ext) => ext.active).flatMap((ext) => ext.tools);
}

export function resetExtensionsForTest(): void {
  for (const ext of extensions.values()) if (ext.active) deactivate(ext);
  extensions.clear();
  disabled = new Set();
}
