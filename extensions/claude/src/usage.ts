import { open, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { defineServerMessages, type Locale } from "@home-dashboard/extension-sdk";

const messages = defineServerMessages({
  ja: { notFound: "Claude Codeのセッションディレクトリが見つかりません: {dir}" },
  en: { notFound: "Claude Code session folder not found: {dir}" },
});

let projectsDir = "";

/**
 * Claude Code の使用量集計（ccusage相当）。
 *
 * Claude Codeはセッションの全メッセージを ~/.claude/projects/<プロジェクト>/<セッション>.jsonl に
 * 追記していく。assistantメッセージの `message.usage` にトークン数が入っているので、それを拾って集計する。
 *
 * 実装上の要点:
 * - jsonlは**追記のみ**なので、ファイルごとに読み込み済みバイト位置を覚えておき差分だけ読む
 *   （全部で200MB近くあり、ポーリングのたびに全読みするのは現実的でないため）
 * - 同一メッセージがストリーミングの都合で複数行に分かれて出てくるので `message.id + requestId` で重複排除する
 * - 料金は算出しない。モデルごとの単価をこちら側に持つと実際の請求と乖離して嘘の数字を出すことになるため、
 *   トークン数と「5時間ブロック」の消費状況（サブスクのレート制限に効くのはこちら）を見せる方針にしている
 */

/** レート制限の集計単位。Claude Codeのセッションブロックは5時間 */
const BLOCK_DURATION_MS = 5 * 60 * 60 * 1000;
/** メモリに保持する期間。これより古いエントリと、これより古い更新のファイルは読まない */
const RETENTION_DAYS = 30;

interface UsageEntry {
  ts: number;
  model: string;
  project: string;
  sessionId: string;
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}

interface TokenTotals {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
  total: number;
}

interface FileState {
  offset: number;
  mtimeMs: number;
}

const fileStates = new Map<string, FileState>();
const seenMessages = new Set<string>();
let entries: UsageEntry[] = [];
let lastScanAt: string | null = null;
/** 同時に複数のリクエストが来てもスキャンは1つだけ走らせる */
let scanInFlight: Promise<void> | null = null;

function emptyTotals(): TokenTotals {
  return { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0 };
}

function addEntry(totals: TokenTotals, entry: UsageEntry): void {
  totals.input += entry.input;
  totals.output += entry.output;
  totals.cacheCreate += entry.cacheCreate;
  totals.cacheRead += entry.cacheRead;
  totals.total += entry.input + entry.output + entry.cacheCreate + entry.cacheRead;
}

/**
 * ディレクトリ名からプロジェクト名を推測する（フォールバック用）。
 * ディレクトリ名はcwdのパス区切りを"-"に置換したものだが、元のディレクトリ名にも"-"が含まれうるため
 * 正確には復元できない（"Obsidian-Vault" が "Vault" になってしまう）。
 * 各レコードの `cwd` が取れる場合はそちらを優先する。
 */
function projectNameFromDir(dirName: string): string {
  const parts = dirName.split("-").filter(Boolean);
  return parts[parts.length - 1] ?? dirName;
}

/** "claude-opus-5" → "opus-5" のように表示用に短くする */
function shortModelName(model: string): string {
  return model.replace(/^claude-/, "");
}

function parseLine(line: string, project: string): UsageEntry | null {
  if (!line.startsWith("{")) return null;

  let record: Record<string, unknown>;
  try {
    record = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null; // 書き込み途中などで壊れた行は黙って捨てる
  }

  if (record.type !== "assistant") return null;
  const message = record.message as Record<string, unknown> | undefined;
  const usage = message?.usage as Record<string, unknown> | undefined;
  if (!usage) return null;

  // 同じアシスタント応答が複数行に分かれて記録されるため、ここで重複排除する
  const dedupeKey = `${String(message?.id ?? "")}:${String(record.requestId ?? "")}`;
  if (dedupeKey !== ":" && seenMessages.has(dedupeKey)) return null;
  if (dedupeKey !== ":") seenMessages.add(dedupeKey);

  const ts = Date.parse(String(record.timestamp ?? ""));
  if (Number.isNaN(ts)) return null;

  // cwdが記録されていればそちらから正確なプロジェクト名を取る（ディレクトリ名からの復元は不正確なため）
  const cwd = typeof record.cwd === "string" ? record.cwd : "";
  const cwdName = cwd ? basename(cwd) : "";

  return {
    ts,
    model: shortModelName(String(message?.model ?? "unknown")),
    project: cwdName || project,
    sessionId: String(record.sessionId ?? ""),
    input: Number(usage.input_tokens ?? 0),
    output: Number(usage.output_tokens ?? 0),
    cacheCreate: Number(usage.cache_creation_input_tokens ?? 0),
    cacheRead: Number(usage.cache_read_input_tokens ?? 0),
  };
}

/**
 * ファイルの未読部分だけを読む。
 * 追記途中で最終行が欠けている可能性があるので、**最後の改行までしか消費しない**
 * （次回のスキャンで続きから読み直す）。
 */
async function readNewLines(path: string, from: number, to: number): Promise<{ text: string; consumed: number }> {
  const handle = await open(path, "r");
  try {
    const length = to - from;
    const buffer = Buffer.allocUnsafe(length);
    await handle.read(buffer, 0, length, from);
    const lastNewline = buffer.lastIndexOf(0x0a);
    if (lastNewline < 0) return { text: "", consumed: 0 };
    // UTF-8のマルチバイト文字に0x0aは現れないので、改行バイトでの切断は安全
    return { text: buffer.subarray(0, lastNewline).toString("utf-8"), consumed: lastNewline + 1 };
  } finally {
    await handle.close();
  }
}

async function scanFile(path: string, project: string, cutoff: number): Promise<void> {
  const info = await stat(path);
  const state = fileStates.get(path);

  // 保持期間より前にしか更新されていないファイルは中身を見ずに読み飛ばす（初回スキャンの負荷対策）
  if (!state && info.mtimeMs < cutoff) {
    fileStates.set(path, { offset: info.size, mtimeMs: info.mtimeMs });
    return;
  }
  if (state && state.offset === info.size && state.mtimeMs === info.mtimeMs) return;

  // ファイルが作り直された等で縮んでいたら最初から読み直す
  const from = state && info.size >= state.offset ? state.offset : 0;
  if (from >= info.size) {
    fileStates.set(path, { offset: info.size, mtimeMs: info.mtimeMs });
    return;
  }

  const { text, consumed } = await readNewLines(path, from, info.size);
  for (const line of text.split("\n")) {
    const entry = parseLine(line, project);
    if (entry && entry.ts >= cutoff) entries.push(entry);
  }

  fileStates.set(path, { offset: from + consumed, mtimeMs: info.mtimeMs });
}

async function scan(): Promise<void> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const root = projectsDir;

  const projectDirs = await readdir(root, { withFileTypes: true });
  for (const dirent of projectDirs) {
    if (!dirent.isDirectory()) continue;
    const project = projectNameFromDir(dirent.name);
    const dirPath = join(root, dirent.name);
    const files = await readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      try {
        await scanFile(join(dirPath, file), project, cutoff);
      } catch {
        // 読めないファイルが1つあっても他の集計は続ける
      }
    }
  }

  entries = entries.filter((e) => e.ts >= cutoff).sort((a, b) => a.ts - b.ts);
  lastScanAt = new Date().toISOString();
}

function scanOnce(): Promise<void> {
  if (!scanInFlight) {
    scanInFlight = scan().finally(() => {
      scanInFlight = null;
    });
  }
  return scanInFlight;
}

interface Block {
  startsAt: number;
  endsAt: number;
  entries: UsageEntry[];
}

/**
 * 5時間のセッションブロックに切り分ける。
 * ブロックは最初のメッセージの「時」に切り下げた時刻から始まり、5時間で終わる。
 * 5時間以上メッセージが途切れた場合もそこでブロックを区切る。
 */
function buildBlocks(sorted: UsageEntry[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let lastTs = 0;

  for (const entry of sorted) {
    const startsNewBlock = !current || entry.ts >= current.endsAt || entry.ts - lastTs >= BLOCK_DURATION_MS;

    if (startsNewBlock) {
      const startsAt = new Date(entry.ts).setMinutes(0, 0, 0);
      current = { startsAt, endsAt: startsAt + BLOCK_DURATION_MS, entries: [] };
      blocks.push(current);
    }
    current!.entries.push(entry);
    lastTs = entry.ts;
  }

  return blocks;
}

function summarizeByModel(list: UsageEntry[]): Array<{ model: string } & TokenTotals> {
  const byModel = new Map<string, TokenTotals>();
  for (const entry of list) {
    let totals = byModel.get(entry.model);
    if (!totals) {
      totals = emptyTotals();
      byModel.set(entry.model, totals);
    }
    addEntry(totals, entry);
  }
  return [...byModel.entries()].map(([model, totals]) => ({ model, ...totals })).sort((a, b) => b.total - a.total);
}

function localDateKey(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function buildSummary() {
  const now = Date.now();
  const todayKey = localDateKey(now);
  const todayEntries = entries.filter((e) => localDateKey(e.ts) === todayKey);

  const blocks = buildBlocks(entries);
  const activeBlock = blocks.length > 0 && blocks[blocks.length - 1].endsAt > now ? blocks[blocks.length - 1] : null;

  const dailyMap = new Map<string, TokenTotals>();
  for (const entry of entries) {
    const key = localDateKey(entry.ts);
    let totals = dailyMap.get(key);
    if (!totals) {
      totals = emptyTotals();
      dailyMap.set(key, totals);
    }
    addEntry(totals, entry);
  }
  const daily = [...dailyMap.entries()]
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 14);

  const projectMap = new Map<string, TokenTotals>();
  for (const entry of todayEntries) {
    let totals = projectMap.get(entry.project);
    if (!totals) {
      totals = emptyTotals();
      projectMap.set(entry.project, totals);
    }
    addEntry(totals, entry);
  }
  const projects = [...projectMap.entries()]
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.total - a.total);

  const todayTotals = emptyTotals();
  for (const entry of todayEntries) addEntry(todayTotals, entry);

  const blockTotals = emptyTotals();
  for (const entry of activeBlock?.entries ?? []) addEntry(blockTotals, entry);

  return {
    configured: true,
    lastScanAt,
    today: {
      date: todayKey,
      tokens: todayTotals,
      messages: todayEntries.length,
      sessions: new Set(todayEntries.map((e) => e.sessionId)).size,
      byModel: summarizeByModel(todayEntries),
    },
    block: activeBlock
      ? {
          startsAt: new Date(activeBlock.startsAt).toISOString(),
          endsAt: new Date(activeBlock.endsAt).toISOString(),
          remainingMs: activeBlock.endsAt - now,
          tokens: blockTotals,
          messages: activeBlock.entries.length,
          byModel: summarizeByModel(activeBlock.entries),
        }
      : null,
    daily,
    projects,
  };
}

/** Claude Code の使用量（トークン数と5時間ブロック）。projectsDir はセッションログの置き場 */
export async function getClaudeUsage(locale: Locale = "ja") {
  try {
    await stat(projectsDir);
  } catch {
    return {
      configured: false,
      reason: messages.t(locale, "notFound", { dir: projectsDir }),
    };
  }

  await scanOnce();
  return buildSummary();
}

/** 置き場が変わったら、読んだところまでの覚えを捨てて読み直す */
export function setProjectsDir(dir: string): void {
  if (dir === projectsDir) return;
  projectsDir = dir;
  fileStates.clear();
  entries.length = 0;
}
