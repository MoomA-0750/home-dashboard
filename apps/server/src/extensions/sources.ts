import { execFile as execFileCb } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { ServiceError } from "../serviceError.js";
import {
  ALLOWED_FILE,
  compareVersions,
  installExtensionFiles,
  isTrustedExtension,
  listExtensions,
  validateManifest,
  type ExtensionInfo,
} from "./host.js";

/**
 * 拡張機能のリポジトリ。Git のリポジトリの公開用の枝（scripts/publish-extensions.mjs が置く。既定は dist-extensions）を
 * 登録しておき、そこにある組み立て済みの拡張機能を入れる・更新する。ダッシュボードでは組み立てないので、どの環境でも同じものが動く。
 *
 * - 枝は data/extension-sources/<リポジトリの id>/ に浅く取ってくる（git clone --depth 1）。読むためのトークンは
 *   GIT_CONFIG_* の環境変数で渡す（コマンドの引数に出さない）。トークンは画面に返さない
 * - 一覧（catalog.json）の版が、入っているものより新しければ「更新があります」とする。入っているものの出どころが
 *   このリポジトリか、本体に入っている拡張機能のときだけ（ZIP で持ち込んだものは別物かもしれないので触らない）
 * - 拡張機能ごとに「自動で更新する」を選べる。定期的に確かめ、新しい版があれば入れ替える
 */

const execFile = promisify(execFileCb);

const STATE_PATH = join(config.dataDir, "extension-sources.json");
const CLONE_DIR = join(config.dataDir, "extension-sources");
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,100}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const GIT_TIMEOUT_MS = 120_000;
/** 定期的に確かめる間隔 */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface StoredSource {
  id: string;
  name: string;
  url: string;
  branch: string;
  token: string | null;
  addedAt: string;
}

interface SourceStatus {
  checkedAt: string | null;
  commit: string | null;
  error: string | null;
  catalog: CatalogEntry[];
}

interface State {
  sources: StoredSource[];
  /** 自動で更新する拡張機能の id */
  autoUpdate: string[];
  /** 既定のリポジトリ（EXTENSION_SOURCE_URL）を一度登録したか（外したあと、起動し直しても足し直さない） */
  defaultRegistered: boolean;
}

export interface CatalogEntry {
  id: string;
  name: string;
  version: string;
  description: string | null;
  path: string;
}

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  branch: string;
  hasToken: boolean;
  checkedAt: string | null;
  commit: string | null;
  error: string | null;
  /** このリポジトリにある拡張機能と、入っているかどうか */
  extensions: (CatalogEntry & { installedVersion: string | null; updatable: boolean })[];
}

export interface UpdateInfo {
  version: string;
  sourceId: string;
  sourceName: string;
}

let state: State | null = null;
const statuses = new Map<string, SourceStatus>();
let queue: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setInterval> | null = null;

// 取ってくる・入れるは1つずつ（同じフォルダを同時に触らない）
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

async function loadState(): Promise<State> {
  if (state) return state;
  try {
    const raw = JSON.parse(await readFile(STATE_PATH, "utf-8")) as Partial<State>;
    state = {
      sources: Array.isArray(raw.sources) ? raw.sources : [],
      autoUpdate: Array.isArray(raw.autoUpdate) ? raw.autoUpdate.filter((id) => typeof id === "string") : [],
      defaultRegistered: raw.defaultRegistered === true,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    state = { sources: [], autoUpdate: [], defaultRegistered: false };
  }
  return state;
}

async function saveState(next: State): Promise<void> {
  state = next;
  await mkdir(config.dataDir, { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  // トークンを持つので、持ち主だけが読めるようにする
  await writeFile(tmp, JSON.stringify(next, null, 2), { encoding: "utf-8", mode: 0o600 });
  await rename(tmp, STATE_PATH);
}

function checkUrl(url: unknown): string {
  const text = typeof url === "string" ? url.trim() : "";
  // https（GitHub など）と、同じ機械のリポジトリ（file://。試すとき）だけ。ssh は鍵の置き場が要るので受けない
  if (!/^(https:\/\/[^\s'"]+|file:\/\/\/[^\s'"]+)$/.test(text))
    throw new ServiceError(400, "URL は https://… か file:///… にしてください（例: https://github.com/<名前>/<リポジトリ>.git）", "Use an https://… or file:///… URL (for example https://github.com/<name>/<repository>.git)");
  return text;
}

function checkBranch(branch: unknown): string {
  const text = typeof branch === "string" && branch.trim() ? branch.trim() : "dist-extensions";
  if (!BRANCH_PATTERN.test(text) || text.includes("..")) throw new ServiceError(400, "枝の名前が正しくありません", "The branch name is not valid");
  return text;
}

function nameFromUrl(url: string): string {
  return (
    url
      .replace(/\/+$/, "")
      .split("/")
      .pop()
      ?.replace(/\.git$/, "") || "リポジトリ"
  );
}

/** git を動かす。トークンはコマンドの引数ではなく環境変数で渡す（ps に出さない） */
async function git(source: StoredSource, args: string[], cwd?: string): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" };
  if (source.token) {
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.extraHeader";
    env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${Buffer.from(`x-access-token:${source.token}`).toString("base64")}`;
  }
  try {
    const { stdout } = await execFile("git", args, { cwd, env, timeout: GIT_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    throw new ServiceError(502, describeGitError(String((err as { stderr?: string }).stderr ?? err), source));
  }
}

/** git のエラーを、画面に出す短い理由にする */
function describeGitError(stderr: string, source: StoredSource): string {
  if (/Authentication failed|could not read Username|terminal prompts disabled|403|401/i.test(stderr))
    return source.token
      ? "読めません（トークンが違うか、このリポジトリを読む権限がありません）"
      : "読めません（非公開のリポジトリなら、読むためのトークンを入れてください）";
  if (/Remote branch .* not found|couldn't find remote ref/i.test(stderr))
    return `枝「${source.branch}」がありません（拡張機能を公開する道具で置いた枝を選んでください）`;
  if (/not found|does not appear to be a git repository|Repository not found/i.test(stderr))
    return "リポジトリが見つかりません（URL を確かめてください）";
  if (/Could not resolve host|Failed to connect|timed out|Connection refused/i.test(stderr))
    return "リポジトリにつながりません（ネットワークを確かめてください）";
  return `取ってこられませんでした: ${stderr.trim().split("\n").pop()?.slice(0, 200) ?? ""}`;
}

/** 枝を取ってくる（初めては clone、2回目からは fetch して合わせる）。今の commit を返す */
async function fetchSource(source: StoredSource): Promise<string> {
  const dir = join(CLONE_DIR, source.id);
  if (!existsSync(join(dir, ".git"))) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(CLONE_DIR, { recursive: true });
    await git(source, ["clone", "--quiet", "--depth", "1", "--single-branch", "--branch", source.branch, source.url, dir]);
  } else {
    await git(source, ["remote", "set-url", "origin", source.url], dir);
    await git(source, ["fetch", "--quiet", "--depth", "1", "origin", `+refs/heads/${source.branch}:refs/remotes/origin/${source.branch}`], dir);
    await git(source, ["reset", "--quiet", "--hard", `origin/${source.branch}`], dir);
    await git(source, ["clean", "--quiet", "-fdx"], dir);
  }
  return git(source, ["rev-parse", "HEAD"], dir);
}

/** 取ってきた枝の catalog.json を読む */
async function readCatalog(source: StoredSource): Promise<CatalogEntry[]> {
  const dir = join(CLONE_DIR, source.id);
  let raw: { format?: unknown; extensions?: unknown };
  try {
    raw = JSON.parse(await readFile(join(dir, "catalog.json"), "utf-8"));
  } catch {
    throw new ServiceError(422, "catalog.json がありません（拡張機能を公開する道具で置いた枝か確かめてください）", "catalog.json is missing (check that the branch was published with the extension publishing tool)");
  }
  if (raw.format !== 1 || !Array.isArray(raw.extensions)) throw new ServiceError(422, "catalog.json の形が違います", "catalog.json is not in the expected format");
  const entries: CatalogEntry[] = [];
  for (const item of raw.extensions as Record<string, unknown>[]) {
    if (typeof item?.id !== "string" || !ID_PATTERN.test(item.id) || typeof item.version !== "string") continue;
    const path = typeof item.path === "string" && ID_PATTERN.test(item.path) ? item.path : item.id;
    entries.push({
      id: item.id,
      name: typeof item.name === "string" ? item.name : item.id,
      version: item.version,
      description: typeof item.description === "string" ? item.description : null,
      path,
    });
  }
  return entries;
}

/** 入っている拡張機能に対して、このリポジトリのものが更新になるか */
function isUpdate(entry: CatalogEntry, installed: ExtensionInfo | undefined, source: StoredSource): boolean {
  if (!installed || compareVersions(entry.version, installed.version) <= 0) return false;
  if (installed.origin.kind === "source") return installed.origin.sourceId === source.id;
  return installed.origin.kind === "builtin";
}

async function checkOne(source: StoredSource): Promise<SourceStatus> {
  const status: SourceStatus = statuses.get(source.id) ?? { checkedAt: null, commit: null, error: null, catalog: [] };
  try {
    status.commit = await fetchSource(source);
    status.catalog = await readCatalog(source);
    status.error = null;
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
  }
  status.checkedAt = new Date().toISOString();
  statuses.set(source.id, status);
  return status;
}

function toInfo(source: StoredSource, installed: ExtensionInfo[]): SourceInfo {
  const status = statuses.get(source.id);
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    branch: source.branch,
    hasToken: Boolean(source.token),
    checkedAt: status?.checkedAt ?? null,
    commit: status?.commit ?? null,
    error: status?.error ?? null,
    extensions: (status?.catalog ?? []).map((entry) => {
      const current = installed.find((ext) => ext.id === entry.id);
      return { ...entry, installedVersion: current?.version ?? null, updatable: isUpdate(entry, current, source) };
    }),
  };
}

export async function listSources(): Promise<SourceInfo[]> {
  const installed = listExtensions();
  return (await loadState()).sources.map((source) => toInfo(source, installed));
}

/** 入っている拡張機能ごとの、更新（あれば）と自動で更新するか */
export async function updateStatus(): Promise<Record<string, { update: UpdateInfo | null; autoUpdate: boolean }>> {
  const current = await loadState();
  const installed = listExtensions();
  const out: Record<string, { update: UpdateInfo | null; autoUpdate: boolean }> = {};
  for (const ext of installed) {
    let update: UpdateInfo | null = null;
    for (const source of current.sources) {
      const entry = statuses.get(source.id)?.catalog.find((e) => e.id === ext.id);
      if (entry && isUpdate(entry, ext, source) && (!update || compareVersions(entry.version, update.version) > 0))
        update = { version: entry.version, sourceId: source.id, sourceName: source.name };
    }
    // 本体と同じ権限で動かす（信頼する）ものは、自動では更新しない（管理者が中身を確かめて押す）
    out[ext.id] = { update, autoUpdate: current.autoUpdate.includes(ext.id) && !isTrustedExtension(ext.id) };
  }
  return out;
}

export function addSource(input: { url?: unknown; branch?: unknown; token?: unknown; name?: unknown }) {
  return serial(async () => {
    const current = await loadState();
    const url = checkUrl(input.url);
    const branch = checkBranch(input.branch);
    if (current.sources.some((s) => s.url === url && s.branch === branch))
      throw new ServiceError(409, "そのリポジトリと枝はもう登録してあります", "That repository and branch are already registered");
    const source: StoredSource = {
      id: randomUUID().slice(0, 8),
      name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 40) : nameFromUrl(url),
      url,
      branch,
      token: typeof input.token === "string" && input.token.trim() ? input.token.trim() : null,
      addedAt: new Date().toISOString(),
    };
    await saveState({ ...current, sources: [...current.sources, source] });
    await checkOne(source);
    return toInfo(source, listExtensions());
  });
}

/** 名前・枝・トークンを変える。トークンは空なら今のまま、null なら消す */
export function updateSource(id: string, input: { name?: unknown; branch?: unknown; token?: unknown }) {
  return serial(async () => {
    const current = await loadState();
    const source = current.sources.find((s) => s.id === id);
    if (!source) throw new ServiceError(404, "そのリポジトリは見つかりません", "Repository not found");
    const next: StoredSource = {
      ...source,
      name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 40) : source.name,
      branch: input.branch === undefined ? source.branch : checkBranch(input.branch),
      token:
        input.token === null ? null : typeof input.token === "string" && input.token.trim() ? input.token.trim() : source.token,
    };
    if (next.branch !== source.branch) await rm(join(CLONE_DIR, id), { recursive: true, force: true });
    await saveState({ ...current, sources: current.sources.map((s) => (s.id === id ? next : s)) });
    await checkOne(next);
    return toInfo(next, listExtensions());
  });
}

/** 登録を外す。そこから入れた拡張機能はそのまま残す（更新は来なくなる） */
export function removeSource(id: string) {
  return serial(async () => {
    const current = await loadState();
    if (!current.sources.some((s) => s.id === id)) throw new ServiceError(404, "そのリポジトリは見つかりません", "Repository not found");
    await saveState({ ...current, sources: current.sources.filter((s) => s.id !== id) });
    statuses.delete(id);
    await rm(join(CLONE_DIR, id), { recursive: true, force: true });
  });
}

async function readFiles(dir: string, base = dir, files = new Map<string, Uint8Array>()): Promise<Map<string, Uint8Array>> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const name = relative(base, path).split("\\").join("/");
    if (entry.isDirectory()) await readFiles(path, base, files);
    else if (entry.isFile() && ALLOWED_FILE.test(name)) files.set(name, new Uint8Array(await readFile(path)));
  }
  return files;
}

async function installEntry(source: StoredSource, entry: CatalogEntry, commit: string): Promise<ExtensionInfo> {
  const dir = join(CLONE_DIR, source.id, entry.path);
  if (!existsSync(join(dir, "manifest.json"))) throw new ServiceError(422, `${entry.id} のファイルがリポジトリにありません`, `The files for ${entry.id} are not in the repository`);
  const files = await readFiles(dir);
  const manifest = validateManifest(JSON.parse(new TextDecoder().decode(files.get("manifest.json"))));
  if (manifest.id !== entry.id) throw new ServiceError(422, `${entry.path} の manifest.json の id が一覧と違います`, `The id in ${entry.path}/manifest.json does not match the catalog`);
  return installExtensionFiles(files, { kind: "source", sourceId: source.id, commit });
}

/** リポジトリの拡張機能を入れる・更新する。取ってきてから入れるので、押した時点の最新が入る */
export function installFromSource(sourceId: string, extensionId: unknown) {
  return serial(async () => {
    const current = await loadState();
    const source = current.sources.find((s) => s.id === sourceId);
    if (!source) throw new ServiceError(404, "そのリポジトリは見つかりません", "Repository not found");
    const status = await checkOne(source);
    if (status.error) throw new ServiceError(502, status.error);
    const entry = status.catalog.find((e) => e.id === extensionId);
    if (!entry) throw new ServiceError(404, "そのリポジトリにその拡張機能はありません", "That extension is not in the repository");
    const installed = listExtensions().find((ext) => ext.id === entry.id);
    if (installed?.origin.kind === "zip")
      throw new ServiceError(409, `「${entry.id}」は ZIP で持ち込んだものが入っています。消してから入れてください`, `"${entry.id}" is installed from a ZIP. Remove it first`);
    if (installed && compareVersions(entry.version, installed.version) < 0)
      throw new ServiceError(409, `入っている版（${installed.version}）のほうが新しいので入れません`, `The installed version (${installed.version}) is newer, so it was not installed`);
    return installEntry(source, entry, status.commit!);
  });
}

export function setAutoUpdate(extensionId: string, enabled: boolean) {
  return serial(async () => {
    if (enabled && isTrustedExtension(extensionId))
      throw new ServiceError(
        409,
        "本体と同じ権限で動かしている拡張機能は、自動では更新できません。別のプロセスで動かすようにするか、更新を押してください",
        "Extensions running with full access can't update automatically. Run it in a separate process, or press update",
      );
    const current = await loadState();
    const others = current.autoUpdate.filter((id) => id !== extensionId);
    await saveState({ ...current, autoUpdate: enabled ? [...others, extensionId] : others });
  });
}

/**
 * すべてのリポジトリを確かめる。自動で更新する拡張機能に新しい版があれば入れ替える。
 * 入れ替えたものを返す（失敗したものは理由つき）
 */
export function checkAllSources() {
  return serial(async () => {
    const current = await loadState();
    for (const source of current.sources) await checkOne(source);
    const results: { id: string; version: string; error: string | null }[] = [];
    const updates = await updateStatus();
    for (const [id, { update, autoUpdate }] of Object.entries(updates)) {
      if (!update || !autoUpdate) continue;
      const source = current.sources.find((s) => s.id === update.sourceId)!;
      const status = statuses.get(source.id)!;
      const entry = status.catalog.find((e) => e.id === id)!;
      try {
        await installEntry(source, entry, status.commit!);
        console.log(`[extensions] ${id} を ${update.version} に自動で更新しました（${source.name}）`);
        results.push({ id, version: update.version, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[extensions] ${id} を自動で更新できませんでした:`, message);
        results.push({ id, version: update.version, error: message });
      }
    }
    return results;
  });
}

/**
 * 起動時に一度呼ぶ。EXTENSION_SOURCE_URL があり、まだ一度も登録していなければ、それを登録する（本体のリポジトリなど）。
 * そのあと少し待って確かめ、以後は定期的に確かめる
 */
export async function startExtensionSources(): Promise<void> {
  const current = await loadState();
  if (!current.defaultRegistered && config.extensionSource.url) {
    await saveState({ ...current, defaultRegistered: true });
    try {
      await addSource({
        url: config.extensionSource.url,
        branch: config.extensionSource.branch,
        token: config.extensionSource.token,
        name: config.extensionSource.name,
      });
    } catch (err) {
      console.error("[extensions] 既定のリポジトリを登録できませんでした:", err instanceof Error ? err.message : err);
    }
  }
  setTimeout(() => void checkAllSources().catch((err) => console.error("[extensions] 確かめられませんでした:", err)), 30_000);
  timer = setInterval(
    () => void checkAllSources().catch((err) => console.error("[extensions] 確かめられませんでした:", err)),
    CHECK_INTERVAL_MS,
  );
  timer.unref();
}

export function resetSourcesForTest(): void {
  state = null;
  statuses.clear();
  if (timer) clearInterval(timer);
  timer = null;
}
