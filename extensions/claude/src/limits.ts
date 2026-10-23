import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Claude（サブスクリプション）の利用制限: 5時間の枠と週の枠の使用率・戻る時刻。
 *
 * この値は Claude Code が statusLine のコマンドへ標準入力で渡す JSON（`rate_limits`）にしか出てこない。
 * Anthropic の非公開の API をトークンで叩く手もあるが、仕様が予告なく変わりうるので使わず、
 * camp と同じく statusLine から受け取る（scripts/claude-limits-report.sh を statusline.sh から呼ぶ）。
 *
 * - 届くのは Claude Code の画面が描き直されたときだけなので、いつ観測した値かを必ず添えて返す
 * - 制限はアカウント単位なので、どこかで Claude Code が1つ開いていれば足りる
 * - 窓が切り替わる（resetsAt が変わる）までは、その窓で一番高かった値も覚えておく
 */

let dataDir = "";
const limitsPath = () => join(dataDir, "limits.json");
/** 受け付ける窓の種類の数の上限（入力を信用しないため） */
const MAX_WINDOWS = 8;
const KIND_PATTERN = /^[a-z0-9_]{1,64}$/;
/** resetsAt として受け付ける範囲（今から前後400日） */
const MAX_TIME_SKEW_MS = 400 * 24 * 60 * 60 * 1000;

export interface LimitWindow {
  kind: string;
  /** 0〜100 */
  usedPercent: number;
  /** この窓で観測した一番高い値 */
  peakPercent: number;
  /** 枠が戻る時刻（ISO） */
  resetsAt: string | null;
  /** 最後に観測した時刻（ISO） */
  observedAt: string;
}

interface LimitsStore {
  windows: Record<string, LimitWindow>;
}

let store: LimitsStore | null = null;

async function loadStore(): Promise<LimitsStore> {
  if (store) return store;
  try {
    store = JSON.parse(await readFile(limitsPath(), "utf-8")) as LimitsStore;
  } catch {
    store = { windows: {} };
  }
  return store;
}

async function saveStore(next: LimitsStore): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const tmp = `${limitsPath()}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
  await rename(tmp, limitsPath());
}

interface Observation {
  kind: string;
  usedPercent: number;
  resetsAt: string | null;
}

/**
 * statusLine の入力から利用制限の観測を取り出す。
 * 形は `{ rate_limits: { five_hour: { used_percentage, resets_at(Unix 秒) }, seven_day: {...} } }`。
 * 値が欠けている窓・範囲外の値は捨てる。
 */
export function parseStatusLineLimits(input: unknown, now = Date.now()): Observation[] {
  if (!input || typeof input !== "object") return [];
  const rateLimits = (input as { rate_limits?: unknown }).rate_limits;
  if (!rateLimits || typeof rateLimits !== "object") return [];

  const observations: Observation[] = [];
  for (const [kind, value] of Object.entries(rateLimits as Record<string, unknown>)) {
    if (observations.length >= MAX_WINDOWS) break;
    if (!KIND_PATTERN.test(kind) || !value || typeof value !== "object") continue;
    const { used_percentage: used, resets_at: resetsAt } = value as { used_percentage?: unknown; resets_at?: unknown };
    if (typeof used !== "number" || !Number.isFinite(used) || used < 0 || used > 100) continue;
    let resetsAtIso: string | null = null;
    if (typeof resetsAt === "number" && Number.isFinite(resetsAt)) {
      const ms = resetsAt * 1000;
      if (Math.abs(ms - now) <= MAX_TIME_SKEW_MS) resetsAtIso = new Date(ms).toISOString();
    }
    observations.push({ kind, usedPercent: used, resetsAt: resetsAtIso });
  }
  return observations;
}

/** 観測を窓ごとに畳む。窓が同じ（resetsAt が同じ）あいだは一番高い値を残す */
export function mergeObservations(
  windows: Record<string, LimitWindow>,
  observations: Observation[],
  observedAt: string,
): Record<string, LimitWindow> {
  const next = { ...windows };
  for (const observation of observations) {
    const previous = next[observation.kind];
    const sameWindow = previous && previous.resetsAt === observation.resetsAt;
    next[observation.kind] = {
      kind: observation.kind,
      usedPercent: observation.usedPercent,
      peakPercent: sameWindow ? Math.max(previous.peakPercent, observation.usedPercent) : observation.usedPercent,
      resetsAt: observation.resetsAt,
      observedAt,
    };
  }
  // ログインの要らない道で受けるので、知らない種類を送り続けられても増え続けないよう、新しく観測したものから上限まで残す
  const kept = Object.values(next)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, MAX_WINDOWS);
  return Object.fromEntries(kept.map((window) => [window.kind, window]));
}

export async function getClaudeLimits() {
  const { windows } = await loadStore();
  return { windows: Object.values(windows), serverNow: new Date().toISOString() };
}

export function setLimitsDataDir(dir: string): void {
  dataDir = dir;
  store = null;
}

/** statusLine の入力をそのまま受け取る（scripts/claude-limits-report.sh から送られる） */
export async function recordStatusLine(input: unknown) {
  const observations = parseStatusLineLimits(input);
  if (observations.length === 0) return { recorded: 0 };
  const current = await loadStore();
  store = { windows: mergeObservations(current.windows, observations, new Date().toISOString()) };
  await saveStore(store);
  return { recorded: observations.length };
}
