import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

/**
 * 音声アシスタントのやり取りの記録。誰（どのキャラクター）が、どこから話しかけられて、何に答えたかを1行1件で残す。
 *
 * キャラクターたちは会話の記憶を共有しているので、エージェントは新しい会話を始めるときにここから直近の記録を取って
 * Claude に渡す（エージェントを再起動しても、5分以上間が空いても、前のやり取りを覚えている）。
 */

export type TurnSource = "wake" | "follow-up" | "button" | "text";
export type TurnStatus = "answered" | "cancelled" | "error";

export interface TurnRecord {
  at: string;
  turnId: string | null;
  personaId: string;
  personaName: string;
  source: TurnSource;
  transcript: string;
  response: string;
  status: TurnStatus;
}

const historyPath = join(config.dataDir, "voice-history.jsonl");
const SOURCES: TurnSource[] = ["wake", "follow-up", "button", "text"];
const STATUSES: TurnStatus[] = ["answered", "cancelled", "error"];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** エージェントから届いた記録を、形を確かめてから保存する */
export async function appendTurn(message: Record<string, unknown>): Promise<TurnRecord | null> {
  const at = text(message.at, 40);
  const personaId = text(message.personaId, 64);
  if (!personaId || Number.isNaN(Date.parse(at))) return null;
  const record: TurnRecord = {
    at,
    turnId: text(message.turnId, 64) || null,
    personaId,
    personaName: text(message.personaName, 64),
    source: SOURCES.includes(message.source as TurnSource) ? (message.source as TurnSource) : "wake",
    transcript: text(message.transcript, 2000),
    response: text(message.response, 8000),
    status: STATUSES.includes(message.status as TurnStatus) ? (message.status as TurnStatus) : "answered",
  };
  await mkdir(config.dataDir, { recursive: true });
  await appendFile(historyPath, `${JSON.stringify(record)}\n`, "utf-8");
  return record;
}

export async function readRecentTurns(limit: number): Promise<TurnRecord[]> {
  let raw: string;
  try {
    raw = await readFile(historyPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const records: TurnRecord[] = [];
  for (const line of raw.trimEnd().split("\n").slice(-limit)) {
    try {
      records.push(JSON.parse(line) as TurnRecord);
    } catch {
      // 書きかけの行などは飛ばす
    }
  }
  return records;
}
