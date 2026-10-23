import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

/**
 * 音声アシスタントのやり取りの記録。1回のやり取りを1行のJSONで残す（data/voice-history.jsonl）。
 *
 * 誰（どのキャラクター）が、どこから・何と話しかけられて、どの表情で何と答えたかを項目に分けて持つ。
 * キャラクターたちは会話の記憶を共有しているので、エージェントは新しい会話を始めるときにここから直近の記録を取って
 * Claude に渡す（エージェントを再起動しても、5分以上間が空いても、前のやり取りを覚えている）。
 *
 * 記録は誰のものか（owner）を持つ。自分の画面のチャット・マイクで話した会話はその人のもので、本人にしか見せず、
 * キャラクターの記憶にもその人と話すときだけ添える。部屋のマイクとダッシュボード端末で話した会話は家族みんなのもの（owner が null）
 */

export type TurnSource = "wake" | "follow-up" | "button" | "text" | "browser-mic";
export type TurnStatus = "answered" | "cancelled" | "error";

export interface TurnRecord {
  /** 1回のやり取りのID */
  id: string | null;
  at: string;
  /** Claude Code の会話のID。同じ値のやり取りは、同じ会話の中で続けて話したもの */
  conversationId: string | null;
  /** 誰の会話か（アカウントのID）。家族みんなのもの（部屋のマイク・ダッシュボード端末）は null */
  owner: string | null;
  persona: { id: string; name: string };
  input: {
    /** wake: ウェイクワードで呼んで声で / follow-up: 返答の後に続けて声で / button: マイクボタン / text: 文字入力 / browser-mic: 画面（ブラウザ）のマイク */
    source: TurnSource;
    text: string;
    /** チャットで添えたファイル（中身は voice-attachments にあり、id で取れる） */
    attachments?: TurnAttachment[];
  };
  output: {
    /** 画面に出した返答（表情の指定は除いたもの） */
    text: string;
    /** 読み上げた区切りごとの文と、そのときの表情（指定が無ければ null） */
    segments: { expression: string | null; text: string }[];
  };
  status: TurnStatus;
}

export interface TurnAttachment {
  id: string;
  name: string;
  type: string;
}

const ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// アカウントの ID（randomUUID）
const ACCOUNT_ID = ATTACHMENT_ID;

function attachments(value: unknown): TurnAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 5)
    .map(object)
    .filter((a) => typeof a.id === "string" && ATTACHMENT_ID.test(a.id))
    .map((a) => ({ id: a.id as string, name: text(a.name, 120), type: text(a.type, 64) }));
}

const historyPath = join(config.dataDir, "voice-history.jsonl");
const SOURCES: TurnSource[] = ["wake", "follow-up", "button", "text", "browser-mic"];
const STATUSES: TurnStatus[] = ["answered", "cancelled", "error"];

type Loose = Record<string, unknown>;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function object(value: unknown): Loose {
  return value && typeof value === "object" ? (value as Loose) : {};
}

/** 届いた記録・保存済みの記録を、形を確かめてから TurnRecord にする。最初の形式（項目が平たいもの）も読める */
export function normalizeTurn(raw: Loose): TurnRecord | null {
  const flat = !("persona" in raw);
  const persona = flat ? { id: raw.personaId, name: raw.personaName } : object(raw.persona);
  const input = flat ? { source: raw.source, text: raw.transcript } : object(raw.input);
  const output = flat ? { text: raw.response, segments: [] } : object(raw.output);

  const at = text(raw.at, 40);
  const personaId = text(persona.id, 64);
  if (!personaId || Number.isNaN(Date.parse(at))) return null;

  const segments = Array.isArray(output.segments) ? output.segments : [];
  return {
    id: text(flat ? raw.turnId : raw.id, 64) || null,
    at,
    conversationId: text(raw.conversationId, 64) || null,
    // owner の無い前の形の記録は、分ける前に家族で共有していたものなので家族みんなのものにする
    owner: typeof raw.owner === "string" && ACCOUNT_ID.test(raw.owner) ? raw.owner : null,
    persona: { id: personaId, name: text(persona.name, 64) },
    input: {
      source: SOURCES.includes(input.source as TurnSource) ? (input.source as TurnSource) : "wake",
      text: text(input.text, 2000),
      ...(attachments(input.attachments).length ? { attachments: attachments(input.attachments) } : {}),
    },
    output: {
      text: text(output.text, 8000),
      segments: segments.slice(0, 100).map((segment) => {
        const s = object(segment);
        return {
          expression: text(s.expression, 64) || null,
          text: text(s.text, 2000),
        };
      }),
    },
    status: STATUSES.includes(raw.status as TurnStatus) ? (raw.status as TurnStatus) : "answered",
  };
}

// 読み込んだ記録。会話の一覧や、エージェントが新しい会話に添える記録を取るたびにファイル全体を読み直さないよう、
// ファイルの大きさが変わっていなければ使い回す（追記したときはここにも足す）
let cache: { size: number; records: TurnRecord[] } | null = null;

export async function appendTurn(raw: Loose): Promise<TurnRecord | null> {
  const record = normalizeTurn(raw);
  if (!record) return null;
  await mkdir(config.dataDir, { recursive: true });
  const line = `${JSON.stringify(record)}\n`;
  const before = cache?.size;
  await appendFile(historyPath, line, "utf-8");
  if (cache && before === cache.size) {
    const size = (await stat(historyPath)).size;
    // ほかから書き足されていなければ、読み直さずに足すだけにする
    if (size === before + Buffer.byteLength(line)) cache = { size, records: [...cache.records, record] };
  }
  return record;
}

/** その人（viewer）に見せてよい記録か。家族みんなのものと、その人のもの。viewer が null なら家族みんなのものだけ */
export function visibleTo(record: TurnRecord, viewer: string | null): boolean {
  return record.owner === null || record.owner === viewer;
}

export async function readRecentTurns(limit: number, viewer: string | null): Promise<TurnRecord[]> {
  return readTurns(viewer, limit);
}

/** 保存済みの記録のうち viewer に見せてよいもの（古い順）。limit を渡すと新しいものからその件数まで */
async function readTurns(viewer: string | null, limit?: number): Promise<TurnRecord[]> {
  const records = (await loadTurns()).filter((record) => visibleTo(record, viewer));
  return limit === undefined ? records : records.slice(-limit);
}

/**
 * 会話の持ち主（最初のやり取りの owner）。記録に無い会話は undefined。
 * 画面のチャットで会話を選んで続けるときに、ほかの人の会話でないかを確かめ、続けた分も同じ持ち主にする
 */
export async function conversationOwner(conversationId: string): Promise<string | null | undefined> {
  const first = (await loadTurns()).find((record) => record.conversationId === conversationId);
  return first ? first.owner : undefined;
}

async function loadTurns(): Promise<TurnRecord[]> {
  let content: string;
  try {
    if (cache?.size === (await stat(historyPath)).size) return cache.records;
    content = await readFile(historyPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const records: TurnRecord[] = [];
  for (const line of content.trimEnd().split("\n")) {
    try {
      const record = normalizeTurn(JSON.parse(line));
      if (record) records.push(record);
    } catch {
      // 書きかけの行などは飛ばす
    }
  }
  // 読んだ内容の大きさで覚える（stat と読み込みの間に書き足されても、次に読むときに気づける）
  cache = { size: Buffer.byteLength(content), records };
  return records;
}

/** 画面のチャットが会話を選ぶときの一覧の1件 */
export interface ConversationSummary {
  id: string;
  /** 最初に話しかけた言葉 */
  title: string;
  startedAt: string;
  updatedAt: string;
  turns: number;
  /** 答えたキャラクター（最初に答えた順） */
  personas: { id: string; name: string }[];
}

const TITLE_MAX = 60;

/** 記録を会話（Claude Code の会話のID）ごとにまとめる。新しく話した会話から */
export function summarizeConversations(records: TurnRecord[]): ConversationSummary[] {
  const byId = new Map<string, ConversationSummary>();
  for (const record of records) {
    if (!record.conversationId) continue;
    let summary = byId.get(record.conversationId);
    if (!summary) {
      summary = {
        id: record.conversationId,
        title: "",
        startedAt: record.at,
        updatedAt: record.at,
        turns: 0,
        personas: [],
      };
      byId.set(record.conversationId, summary);
    }
    // 最初の一言を題にする。ファイルだけを添えて始めたときは、そのファイルの名前
    const first = record.input.text || (record.input.attachments ?? []).map((a) => a.name).join("、");
    if (!summary.title && first) {
      summary.title = first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX)}…` : first;
    }
    summary.updatedAt = record.at;
    summary.turns += 1;
    if (!summary.personas.some((p) => p.id === record.persona.id)) summary.personas.push(record.persona);
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function readConversations(limit: number, viewer: string | null): Promise<ConversationSummary[]> {
  return summarizeConversations(await readTurns(viewer)).slice(0, limit);
}

/** 1つの会話のやり取り（古い順。長い会話は新しいものから limit 件） */
export async function readConversationTurns(
  conversationId: string,
  limit: number,
  viewer: string | null,
): Promise<TurnRecord[]> {
  return (await readTurns(viewer)).filter((record) => record.conversationId === conversationId).slice(-limit);
}
