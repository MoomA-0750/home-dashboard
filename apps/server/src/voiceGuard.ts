import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAccount, ToolDefinition, ToolRisk } from "@home-dashboard/extension-sdk";
import { config } from "./config.js";
import { extensionTools } from "./extensions/host.js";
import { broadcast } from "./ws.js";

/**
 * 音声アシスタント（Claude）の道具の呼び出しを、実行の前に確かめる。
 *
 * 部屋にいる誰の声でも、読んだメールに書かれた文でも Claude は動くので、Claude に任せず、ここで決まった形で止める
 * （Google のスマートホームの「操作ごとの確認」、Apple の App Intents の認証・確認、WWDC26 の「AIに操作させるときの守り」と同じ考え方）。
 *
 * - 音声エージェントは Claude Code の「道具を使ってよいか」の問い合わせ（--permission-prompt-tool stdio）を、すべてここ（POST /api/voice/guard）へ回す
 * - 道具の危なさ（read / low / confirm / approve）は、ダッシュボードの道具は拡張機能が宣言し（ToolDefinition.risk）、
 *   外のコネクター・MCPサーバーの道具は管理者が道具ごとに決める（決めていないものは approve）。名前（get・list…）では決めない
 * - confirm は「〜してよいですか」に、次の発話で「はい」と答えたとき（か画面で押したとき）だけ通す。Claude が了承したことにはできない
 * - approve は、ログインしている人が画面でパスキーかパスワードで本人確認して許可したときだけ通す（HomePod → iPhone の確認と同じ形）
 * - 外の人が書いた文（メールの本文・Webページなど）を読んだ会話では、low の操作にも了承を求める（その文に仕込まれた指示で動かされないため）
 * - 家の人の情報（メール・予定）を声で出すか、記録を残さないゲストモードかは、音声の設定で決める
 * - ダッシュボードの道具は、ここで通したものだけを /mcp が実行する（takeGrant。エージェントのトークンだけでは動かせない）
 */

export type ToolLevel = ToolRisk | "deny";
const LEVELS: ToolLevel[] = ["read", "low", "confirm", "approve", "deny"];

/** 声で、家の人の情報を出すか。all: いつでも / screen: 画面からログインして話しかけたときだけ / none: 出さない */
export type PersonalPolicy = "all" | "screen" | "none";
const PERSONAL_POLICIES: PersonalPolicy[] = ["all", "screen", "none"];

export interface ToolOverride {
  /** ダッシュボードの道具では、宣言より緩くはならない（下限）。外の道具ではこの段にする */
  level?: ToolLevel;
  /** 外の道具が家の人の情報を返すか（既定は返すものとみなす） */
  personal?: boolean;
}

export interface GuardSettings {
  personal: PersonalPolicy;
  /** ゲストモード: 家の人の情報を出さず、やり取りを記録に残さない */
  guest: boolean;
  tools: Record<string, ToolOverride>;
}

interface GuardStore {
  settings: GuardSettings;
  /** 呼ばれたことのある外の道具（設定画面で段を決められるように並べる） */
  seen: Record<string, string>;
  /** 外の人が書いた文を読んだ会話（Claude Code の会話のID）。会話を再開しても続くので保存する */
  tainted: string[];
}

const DASHBOARD_PREFIX = "mcp__dashboard__";
const MAX_TAINTED = 500;
const MAX_SEEN = 300;
const CONFIRM_TTL_MS = 5 * 60 * 1000;
const APPROVE_TTL_MS = 2 * 60 * 1000;
const GRANT_TTL_MS = 60 * 1000;

const defaultStore = (): GuardStore => ({
  settings: { personal: "all", guest: false, tools: {} },
  seen: {},
  tainted: [],
});

let store: GuardStore | null = null;
const storePath = () => join(config.dataDir, "voice-guard.json");

async function loadStore(): Promise<GuardStore> {
  if (store) return store;
  try {
    const raw = JSON.parse(await readFile(storePath(), "utf-8"));
    store = {
      settings: parseSettings(raw.settings ?? {}, defaultStore().settings),
      seen: raw.seen && typeof raw.seen === "object" ? raw.seen : {},
      tainted: Array.isArray(raw.tainted) ? raw.tainted.filter((id: unknown) => typeof id === "string") : [],
    };
  } catch {
    store = defaultStore();
  }
  return store;
}

let saving = Promise.resolve();
function saveStore(): Promise<void> {
  saving = saving.then(async () => {
    if (!store) return;
    const tmp = `${storePath()}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
    await rename(tmp, storePath());
  });
  return saving;
}

export class GuardSettingsError extends Error {}

/** 画面から送られた設定を確かめる（足りない項目は current のまま） */
function parseSettings(input: unknown, current: GuardSettings): GuardSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const personal = raw.personal ?? current.personal;
  if (!PERSONAL_POLICIES.includes(personal as PersonalPolicy)) throw new GuardSettingsError("personal must be all, screen or none");
  const guest = raw.guest ?? current.guest;
  if (typeof guest !== "boolean") throw new GuardSettingsError("guest must be a boolean");
  const tools: Record<string, ToolOverride> = {};
  const rawTools = raw.tools ?? current.tools;
  if (!rawTools || typeof rawTools !== "object") throw new GuardSettingsError("tools must be an object");
  for (const [name, value] of Object.entries(rawTools as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_.-]{1,200}$/.test(name) || !value || typeof value !== "object") continue;
    const { level, personal: toolPersonal } = value as Record<string, unknown>;
    const entry: ToolOverride = {};
    if (LEVELS.includes(level as ToolLevel)) entry.level = level as ToolLevel;
    if (typeof toolPersonal === "boolean") entry.personal = toolPersonal;
    if (entry.level || entry.personal !== undefined) tools[name] = entry;
  }
  return { personal: personal as PersonalPolicy, guest, tools };
}

export async function readGuardSettings(): Promise<GuardSettings> {
  return (await loadStore()).settings;
}

const guestListeners = new Set<(guest: boolean) => void>();

/** ゲストモードが変わったとき（音声エージェントに、記録を残さない会話へ切り替えさせる） */
export function onGuestChange(listener: (guest: boolean) => void): void {
  guestListeners.add(listener);
}

export async function writeGuardSettings(input: unknown): Promise<GuardSettings> {
  const current = await loadStore();
  const before = current.settings.guest;
  current.settings = parseSettings(input, current.settings);
  await saveStore();
  broadcast({ type: "voice-guard-settings" });
  if (current.settings.guest !== before) for (const listener of guestListeners) listener(current.settings.guest);
  return current.settings;
}

/** ゲストモードの入／切（画面からは誰でも、声でも変えられる。Google のゲストモードと同じ） */
export async function setGuestMode(guest: boolean): Promise<void> {
  await writeGuardSettings({ guest });
}

// ---- 道具の素性 ----

interface ToolInfo {
  /** 設定画面に出す名前 */
  label: string;
  kind: "dashboard" | "builtin" | "external";
  risk: (input: Record<string, unknown>) => ToolLevel | Promise<ToolLevel>;
  personal: boolean;
  untrusted: boolean;
  describe: (input: Record<string, unknown>) => Promise<string>;
}

/** 道具の名前と引数をそのまま並べた一文（describe の無い道具に） */
function plainDescription(label: string, input: Record<string, unknown>): string {
  const args = JSON.stringify(input);
  return `${label} を使う${args && args !== "{}" ? `（${args.length > 160 ? `${args.slice(0, 160)}…` : args}）` : ""}`;
}

const rank = (level: ToolLevel) => LEVELS.indexOf(level);
const stricter = (a: ToolLevel, b: ToolLevel | undefined) => (b && rank(b) > rank(a) ? b : a);

/** 引数に依らない宣言（省くと readOnly なら read、そうでなければ confirm） */
function staticRisk(definition: ToolDefinition): ToolRisk {
  const risk = definition.risk;
  return typeof risk === "string" && LEVELS.includes(risk) ? risk : definition.readOnly ? "read" : "confirm";
}

/**
 * ダッシュボードの道具の宣言した危なさ。引数で変わるものは尋ねる（別のプロセスで動く拡張機能は答えが Promise になる）。
 * 答えが壊れていれば、いちばん慎重な「画面で許可」にする
 */
export async function declaredRisk(definition: ToolDefinition, input: Record<string, unknown>): Promise<ToolRisk> {
  const risk = definition.risk;
  if (typeof risk !== "function") return staticRisk(definition);
  try {
    const value: unknown = await (risk as (args: Record<string, unknown>) => ToolRisk | Promise<ToolRisk>)(input);
    return typeof value === "string" && LEVELS.includes(value as ToolLevel) ? (value as ToolRisk) : "approve";
  } catch {
    return "approve";
  }
}

/** 本体が持つ道具（拡張機能ではないもの） */
export const coreTools: ToolDefinition[] = [
  {
    name: "set_guest_mode",
    description:
      "ゲストモードの入／切。入れると、家の人の情報（メール・予定など）を出さず、やり取りを記録に残さない。「ゲストモードにして」「ゲストモードを終わって」と頼まれたときに使う。",
    inputSchema: (z) => ({ enabled: z.boolean() }),
    risk: "low",
    describe: ({ enabled }) => (enabled ? "ゲストモードにする" : "ゲストモードを終える"),
    handler: async ({ enabled }) => {
      await setGuestMode(enabled === true);
      return { ok: true, guest: enabled === true };
    },
  } as ToolDefinition,
];

export function dashboardTools(): { extensionId: string | null; definition: ToolDefinition }[] {
  return [...coreTools.map((definition) => ({ extensionId: null, definition })), ...extensionTools()];
}

// Claude Code の組み込みの道具で、音声アシスタントに使わせるもの（VOICE_CLAUDE_TOOLS）。Web の文は外の人が書いたもの
const BUILTIN_TOOLS: Record<string, { label: string; risk: ToolLevel; untrusted: boolean }> = {
  WebSearch: { label: "Web検索", risk: "read", untrusted: true },
  WebFetch: { label: "Webページを読む", risk: "read", untrusted: true },
  // 使える道具を探すだけ（MCPの道具が多いとき、Claude Code が自分で使う）
  ToolSearch: { label: "道具を探す", risk: "read", untrusted: false },
};

// 読むだけに見える道具の名前の頭（Gmail の search_threads・get_message、カレンダーの list_events など）
const READ_LIKE = /^(get|list|search|read|query|fetch|find|view|describe|show|lookup)/i;

/** 管理者が段を決めていない外の道具の段（設定画面にも「決めていないとき」として出す） */
export function guessExternal(name: string): ToolLevel {
  return READ_LIKE.test(name.split("__").pop() ?? "") ? "confirm" : "approve";
}

function toolInfo(name: string, settings: GuardSettings): ToolInfo | null {
  const override = settings.tools[name];
  if (name.startsWith(DASHBOARD_PREFIX)) {
    const short = name.slice(DASHBOARD_PREFIX.length);
    const found = dashboardTools().find((tool) => tool.definition.name === short);
    if (!found) return null;
    const { definition } = found;
    return {
      label: short,
      kind: "dashboard",
      risk: async (input) => stricter(await declaredRisk(definition, input), override?.level),
      personal: definition.personal === true,
      untrusted: definition.untrusted === true,
      describe: async (input) => {
        if (!definition.describe) return plainDescription(short, input);
        try {
          return await (definition.describe as (args: Record<string, unknown>) => string | Promise<string>)(input);
        } catch {
          return plainDescription(short, input);
        }
      },
    };
  }
  const builtin = BUILTIN_TOOLS[name];
  if (builtin) {
    return {
      label: builtin.label,
      kind: "builtin",
      risk: () => stricter(builtin.risk, override?.level),
      personal: false,
      untrusted: builtin.untrusted,
      describe: async (input) => plainDescription(builtin.label, input),
    };
  }
  if (/^mcp__[A-Za-z0-9_-]+__.+$/.test(name)) {
    // 外のコネクター・MCPサーバーの道具。何をするかは名前からは確かには分からないので、管理者が段を決めるまでは、
    // 読むだけに見える名前でも話している人の了承を、それ以外は画面での許可を求める（名前だけでは通さない）
    return {
      label: name.replace(/^mcp__/, "").replace("__", " / "),
      kind: "external",
      risk: () => override?.level ?? guessExternal(name),
      personal: override?.personal ?? true,
      untrusted: true,
      describe: async (input) => plainDescription(name.replace(/^mcp__/, "").replace("__", " / "), input),
    };
  }
  return null;
}

// ---- 呼び出しの確かめ ----

export interface GuardRequest {
  /** Claude Code の会話のID */
  conversationId: string | null;
  /** やり取りのID（話しかけられるたびに変わる）。了承は、聞き返したのとは別のやり取りでだけ受ける */
  turnId: string;
  /** どこから話しかけられたか（wake・follow-up・button・text・browser-mic） */
  source: string;
  /** 画面から話しかけたときの、ログインしているアカウント（ホストのマイクでは null） */
  accountId: string | null;
  /** このやり取りで話しかけられた文 */
  utterance: string;
  /** チャットでファイルを添えたか（中身は外の人が書いたものかもしれない） */
  attachments: boolean;
  tool: string;
  input: Record<string, unknown>;
}

export type GuardDecision =
  | { decision: "allow" }
  | { decision: "deny"; message: string }
  /** 画面での許可を待つ。say は待っている間に読み上げる文。結果は waitForAnswer で受ける */
  | { decision: "pending"; requestId: string; say: string };

export interface PendingRequest {
  id: string;
  kind: "confirm" | "approve";
  conversationId: string | null;
  /** 自分の画面から話しかけた人。その人の画面にだけ出す（部屋のマイク・ダッシュボード端末からなら null で、どの画面にも出す） */
  owner: string | null;
  key: string;
  tool: string;
  input: Record<string, unknown>;
  description: string;
  turnId: string;
  createdAt: number;
  expiresAt: number;
  status: "waiting" | "allowed" | "denied";
  approvedBy: ExtensionAccount | null;
}

const pending = new Map<string, PendingRequest>();
const waiters = new Map<string, Set<() => void>>();
const grants = new Map<string, { expiresAt: number; approvedBy: ExtensionAccount | null }>();

/** 引数の並び順に左右されない形（同じ操作かどうかを見分ける） */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const keyOf = (tool: string, input: Record<string, unknown>) => `${tool} ${canonical(input)}`;

function sweep(now = Date.now()): void {
  for (const [id, request] of pending) {
    if (request.expiresAt < now) {
      pending.delete(id);
      wake(id);
    }
  }
  for (const [key, grant] of grants) if (grant.expiresAt < now) grants.delete(key);
}

function wake(id: string): void {
  for (const resolve of waiters.get(id) ?? []) resolve();
  waiters.delete(id);
}

function grant(tool: string, input: Record<string, unknown>, approvedBy: ExtensionAccount | null): void {
  if (tool.startsWith(DASHBOARD_PREFIX))
    grants.set(keyOf(tool, input), { expiresAt: Date.now() + GRANT_TTL_MS, approvedBy });
}

/**
 * /mcp がダッシュボードの道具を実行する前に呼ぶ。ここで通した呼び出しなら、許可した人（approve のとき）を返す。
 * 通していなければ undefined（実行しない）。一度だけ使える
 */
export function takeGrant(name: string, input: Record<string, unknown>): { approvedBy: ExtensionAccount | null } | undefined {
  sweep();
  const key = keyOf(DASHBOARD_PREFIX + name, input);
  const found = grants.get(key);
  if (!found) return undefined;
  grants.delete(key);
  return { approvedBy: found.approvedBy };
}

// 了承の言葉。「大丈夫」「いいです」「結構です」は断りにも使うので入れない
const YES = /(はい|うん|ええ|いいよ|いいね|お願い|おねがい|どうぞ|オーケー|オッケー|ok|okay|やって|送って|消して|開けて|閉めて|進めて|頼む|たのむ|了解|りょうかい|yes|sure)/i;
const NO = /(いいえ|いや|だめ|ダメ|やめ|待って|まって|ストップ|キャンセル|ちが|違|しないで|ないで|no\b|nope|cancel|stop)/i;

/** 聞き返しへの答えが了承か（短い答えだけを見る。長い文は、別の頼みごとかもしれないので了承としない） */
export function isAffirmative(utterance: string): boolean {
  const text = utterance.replace(/[\s、。,.!?！？「」]/g, "");
  if (!text || text.length > 24) return false;
  return YES.test(text) && !NO.test(text);
}

export function isNegative(utterance: string): boolean {
  const text = utterance.replace(/[\s、。,.!?！？「」]/g, "");
  return text.length <= 24 && NO.test(text);
}

function personalAllowed(settings: GuardSettings, request: GuardRequest): boolean {
  if (settings.guest || settings.personal === "none") return false;
  if (settings.personal === "screen")
    return request.accountId !== null && (request.source === "text" || request.source === "browser-mic");
  return true;
}

async function markTainted(conversationId: string | null): Promise<void> {
  if (!conversationId) return;
  const current = await loadStore();
  if (current.tainted.includes(conversationId)) return;
  current.tainted = [...current.tainted, conversationId].slice(-MAX_TAINTED);
  await saveStore();
}

async function recordSeen(name: string): Promise<void> {
  const current = await loadStore();
  const first = !(name in current.seen);
  current.seen[name] = new Date().toISOString();
  const names = Object.keys(current.seen);
  if (names.length > MAX_SEEN) {
    const oldest = names.sort((a, b) => current.seen[a].localeCompare(current.seen[b])).slice(0, names.length - MAX_SEEN);
    for (const old of oldest) delete current.seen[old];
  }
  await saveStore();
  if (first) broadcast({ type: "voice-guard-settings" });
}

export async function isTainted(conversationId: string | null): Promise<boolean> {
  return conversationId !== null && (await loadStore()).tainted.includes(conversationId);
}

function publishPending(): void {
  broadcast({ type: "voice-guard" });
}

/** Claude Code の「この道具を使ってよいか」に答える */
export async function checkToolUse(request: GuardRequest): Promise<GuardDecision> {
  sweep();
  const { settings } = await loadStore();
  const info = toolInfo(request.tool, settings);
  if (!info) return { decision: "deny", message: "この道具は音声アシスタントでは使えません。" };
  if (info.kind === "external") await recordSeen(request.tool);

  if (info.personal && !personalAllowed(settings, request)) {
    return {
      decision: "deny",
      message: settings.guest
        ? "ゲストモード中なので、家の人の情報（メール・予定など）は使えません。そう短く伝えてください。"
        : settings.personal === "screen"
          ? "この家の設定で、この話しかけ方では家の人の情報（メール・予定など）を出せません。画面のチャットからなら使えることを短く伝えてください。"
          : "この家の設定で、音声アシスタントでは家の人の情報（メール・予定など）を扱いません。そう短く伝えてください。",
    };
  }

  if (request.attachments) await markTainted(request.conversationId);
  const tainted = await isTainted(request.conversationId);
  let level = await info.risk(request.input);
  // 外の人が書いた文を読んだ後は、すぐ戻せる操作にも了承を求める
  if (level === "low" && tainted) level = "confirm";

  if (level === "deny") return { decision: "deny", message: "この家の設定で、この道具は使わないことになっています。" };
  if (level === "read" || level === "low") {
    grant(request.tool, request.input, null);
    if (info.untrusted) await markTainted(request.conversationId);
    return { decision: "allow" };
  }

  const key = keyOf(request.tool, request.input);
  const description = await info.describe(request.input);
  const existing = [...pending.values()].find(
    (p) => p.kind === level && p.key === key && p.conversationId === request.conversationId,
  );

  if (level === "confirm") {
    if (existing?.status === "allowed" || (existing?.status === "waiting" && existing.turnId !== request.turnId && isAffirmative(request.utterance))) {
      pending.delete(existing.id);
      publishPending();
      grant(request.tool, request.input, null);
      if (info.untrusted) await markTainted(request.conversationId);
      return { decision: "allow" };
    }
    if (existing && existing.status === "waiting" && existing.turnId !== request.turnId && isNegative(request.utterance)) {
      pending.delete(existing.id);
      publishPending();
      return { decision: "deny", message: "話している人に断られたので、実行していません。やめたことを短く伝えてください。" };
    }
    if (existing) pending.delete(existing.id);
    const now = Date.now();
    const created: PendingRequest = {
      id: randomUUID(),
      kind: "confirm",
      conversationId: request.conversationId,
      owner: request.accountId,
      key,
      tool: request.tool,
      input: request.input,
      description,
      turnId: request.turnId,
      createdAt: now,
      expiresAt: now + CONFIRM_TTL_MS,
      status: "waiting",
      approvedBy: null,
    };
    pending.set(created.id, created);
    publishPending();
    const reason = tainted
      ? "この会話では外から来た文（メール・Webページなど）を読んだので、操作の前に必ず了承をもらう決まりです。"
      : "";
    return {
      decision: "deny",
      message:
        `【まだ実行していません】この操作には、話している人の了承が要ります: ${description}。${reason}` +
        `いま実行しようとせず、相手に「${description}。よろしいですか？」と短く聞いて、このやり取りを終えてください。` +
        "相手が了承したら、同じ内容でもう一度呼んでください（了承したかどうかは本体が確かめます）。",
    };
  }

  // approve: ログインしている人が画面で本人確認して許可するまで待つ
  if (existing?.status === "allowed") {
    pending.delete(existing.id);
    publishPending();
    grant(request.tool, request.input, existing.approvedBy);
    return { decision: "allow" };
  }
  if (existing) pending.delete(existing.id);
  const now = Date.now();
  const created: PendingRequest = {
    id: randomUUID(),
    kind: "approve",
    conversationId: request.conversationId,
    owner: request.accountId,
    key,
    tool: request.tool,
    input: request.input,
    description,
    turnId: request.turnId,
    createdAt: now,
    expiresAt: now + APPROVE_TTL_MS,
    status: "waiting",
    approvedBy: null,
  };
  pending.set(created.id, created);
  publishPending();
  return { decision: "pending", requestId: created.id, say: "画面で許可をお願いします。" };
}

/** 画面での許可を待つ（音声エージェントが pending を受けたあと）。許可されたら実行の許しを出して allow を返す */
export async function waitForAnswer(requestId: string, timeoutMs: number): Promise<GuardDecision> {
  const request = pending.get(requestId);
  if (!request) return { decision: "deny", message: "許可の時間が過ぎたので、実行していません。" };
  if (request.status === "waiting") {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.min(timeoutMs, Math.max(0, request.expiresAt - Date.now())));
      const set = waiters.get(requestId) ?? new Set();
      set.add(() => {
        clearTimeout(timer);
        resolve();
      });
      waiters.set(requestId, set);
    });
  }
  const answered = pending.get(requestId);
  // まだ答えが無く期限も来ていなければ、エージェントにもう一度待ってもらう
  if (answered?.status === "waiting" && answered.expiresAt > Date.now())
    return { decision: "pending", requestId, say: "" };
  if (answered?.status === "allowed") {
    pending.delete(requestId);
    publishPending();
    grant(answered.tool, answered.input, answered.approvedBy);
    return { decision: "allow" };
  }
  if (answered) pending.delete(requestId);
  publishPending();
  return {
    decision: "deny",
    message:
      answered?.status === "denied"
        ? "家の人が画面で許可しなかったので、実行していません。そう短く伝えてください。"
        : "時間内に画面で許可されなかったので、実行していません。もう一度頼まれるまで実行しないでください。",
  };
}

/** その人（viewer。ダッシュボード端末なら null）の画面に出してよい確かめか */
function visibleTo(request: PendingRequest, viewer: string | null): boolean {
  return request.owner === null || request.owner === viewer;
}

/** 画面に出す、答えを待っている確かめ */
export function listPending(viewer: string | null = null): Omit<PendingRequest, "key" | "input" | "approvedBy">[] {
  sweep();
  return [...pending.values()]
    .filter((p) => p.status === "waiting" && visibleTo(p, viewer))
    .map(({ key: _key, input: _input, approvedBy: _approvedBy, ...rest }) => rest);
}

export class GuardAnswerError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 画面からの答え。approve を許可するときは、呼ぶ側で本人確認（パスキーかパスワード）を済ませてから verified を true にする。
 * confirm を画面で了承したときは、そのことを音声エージェントへ伝えられるよう、その確かめを返す
 */
export function answerRequest(
  id: string,
  allow: boolean,
  account: ExtensionAccount,
  verified: boolean,
  viewer: string | null = account.id,
): PendingRequest {
  sweep();
  const request = pending.get(id);
  if (!request || request.status !== "waiting" || !visibleTo(request, viewer)) throw new GuardAnswerError(404, "その確かめは終わっているか、時間が過ぎました");
  if (allow && request.kind === "approve" && !verified) throw new GuardAnswerError(401, "本人確認が要ります");
  request.status = allow ? "allowed" : "denied";
  request.approvedBy = allow ? account : null;
  if (!allow && request.kind === "confirm") pending.delete(id);
  wake(id);
  publishPending();
  return request;
}

/** 設定画面に並べる道具（ダッシュボードの道具・組み込みの道具・呼ばれたことのある外の道具） */
export async function listGuardTools() {
  const { settings, seen } = await loadStore();
  const describeRisk = (definition: ToolDefinition) =>
    typeof definition.risk === "function" ? "varies" : staticRisk(definition);
  return [
    ...dashboardTools().map(({ extensionId, definition }) => ({
      name: DASHBOARD_PREFIX + definition.name,
      label: definition.name,
      kind: "dashboard" as const,
      extensionId,
      declared: describeRisk(definition),
      personal: definition.personal === true,
      untrusted: definition.untrusted === true,
      override: settings.tools[DASHBOARD_PREFIX + definition.name] ?? null,
    })),
    ...Object.entries(BUILTIN_TOOLS).filter(([name]) => name !== "ToolSearch").map(([name, builtin]) => ({
      name,
      label: builtin.label,
      kind: "builtin" as const,
      extensionId: null,
      declared: builtin.risk,
      personal: false,
      untrusted: builtin.untrusted,
      override: settings.tools[name] ?? null,
    })),
    ...Object.keys({ ...seen, ...settings.tools })
      .filter((name) => !name.startsWith(DASHBOARD_PREFIX) && !(name in BUILTIN_TOOLS) && name.startsWith("mcp__"))
      .sort()
      .map((name) => ({
        name,
        label: name.replace(/^mcp__/, "").replace("__", " / "),
        kind: "external" as const,
        extensionId: null,
        declared: guessExternal(name),
        personal: settings.tools[name]?.personal ?? true,
        untrusted: true,
        override: settings.tools[name] ?? null,
        lastUsedAt: seen[name] ?? null,
      })),
  ];
}

export function resetGuardForTest(): void {
  store = defaultStore();
  pending.clear();
  waiters.clear();
  grants.clear();
}
