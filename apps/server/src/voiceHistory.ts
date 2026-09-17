import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

/**
 * 音声アシスタントのやり取りの記録。1回のやり取りを1行のJSONで残す（data/voice-history.jsonl）。
 *
 * 誰（どのキャラクター）が、どこから・何と話しかけられて、どの表情で何と答えたかを項目に分けて持つ。
 * キャラクターたちは会話の記憶を共有しているので、エージェントは新しい会話を始めるときにここから直近の記録を取って
 * Claude に渡す（エージェントを再起動しても、5分以上間が空いても、前のやり取りを覚えている）。
 */

export type TurnSource = "wake" | "follow-up" | "button" | "text";
export type TurnStatus = "answered" | "cancelled" | "error";

export interface TurnRecord {
  /** 1回のやり取りのID */
  id: string | null;
  at: string;
  /** Claude Code の会話のID。同じ値のやり取りは、同じ会話の中で続けて話したもの */
  conversationId: string | null;
  persona: { id: string; name: string };
  input: {
    /** wake: ウェイクワードで呼んで声で / follow-up: 返答の後に続けて声で / button: マイクボタン / text: 文字入力 */
    source: TurnSource;
    text: string;
  };
  output: {
    /** 画面に出した返答（表情の指定は除いたもの） */
    text: string;
    /** 読み上げた区切りごとの文と、そのときの表情（指定が無ければ null） */
    segments: { expression: string | null; text: string }[];
  };
  status: TurnStatus;
}

const historyPath = join(config.dataDir, "voice-history.jsonl");
const SOURCES: TurnSource[] = ["wake", "follow-up", "button", "text"];
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
    persona: { id: personaId, name: text(persona.name, 64) },
    input: {
      source: SOURCES.includes(input.source as TurnSource) ? (input.source as TurnSource) : "wake",
      text: text(input.text, 2000),
    },
    output: {
      text: text(output.text, 8000),
      segments: segments.slice(0, 100).map((segment) => {
        const s = object(segment);
        return { expression: text(s.expression, 64) || null, text: text(s.text, 2000) };
      }),
    },
    status: STATUSES.includes(raw.status as TurnStatus) ? (raw.status as TurnStatus) : "answered",
  };
}

export async function appendTurn(raw: Loose): Promise<TurnRecord | null> {
  const record = normalizeTurn(raw);
  if (!record) return null;
  await mkdir(config.dataDir, { recursive: true });
  await appendFile(historyPath, `${JSON.stringify(record)}\n`, "utf-8");
  return record;
}

export async function readRecentTurns(limit: number): Promise<TurnRecord[]> {
  let content: string;
  try {
    content = await readFile(historyPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const records: TurnRecord[] = [];
  for (const line of content.trimEnd().split("\n").slice(-limit)) {
    try {
      const record = normalizeTurn(JSON.parse(line));
      if (record) records.push(record);
    } catch {
      // 書きかけの行などは飛ばす
    }
  }
  return records;
}
