import type { StateReading } from "@home-dashboard/extension-sdk";

/**
 * 夜の表示に入る条件（家の人が本体の設定画面で決める）。照度などの数値が何未満・照明が消えている・時間帯などを並べ、
 * 「すべて」か「どれか」を満たして、それが hold 分続いたら夜にする。満たさなくなったら（電気をつけたなど）すぐ戻す。
 * 値は、家の状態を差し出す拡張機能（api.provideStates。Home Assistant など）から読む。どの連携先の値でも同じに扱う
 */

/** source は値を差し出す拡張機能の id、id はその中の値の id */
export type NightCondition =
  | { kind: "below" | "above"; source: string; id: string; value: number }
  | { kind: "off" | "on"; source: string; id: string }
  | { kind: "time"; from: string; to: string };

export interface NightRules {
  match: "all" | "any";
  conditions: NightCondition[];
  /** 満たしてから夜にするまでの分（ちらつき・一瞬の暗さで入らないように） */
  holdMinutes: number;
}

export const DEFAULT_RULES: NightRules = { match: "all", conditions: [], holdMinutes: 1 };

export interface ConditionResult {
  condition: NightCondition;
  met: boolean;
  /** 今の値（3 lx・消えている・22:40 など。画面に出す）。読めなければ null */
  current: string | null;
  /** 理由の一言（「リビングの明るさが 5 lx 未満」） */
  label: string;
}

export interface NightEvaluation {
  /** 今、条件を満たしているか（続いた長さは見ない） */
  met: boolean;
  results: ConditionResult[];
  /** 満たした条件を「・」でつないだもの（設定画面に出す） */
  reason: string | null;
}

const SOURCE = /^[a-z0-9-]+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_CONDITIONS = 12;
const MAX_ID = 200;

/** 保存された値・画面から来た値を確かめる。おかしなものは捨てる（throw はしない） */
export function normalizeRules(value: unknown): NightRules {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const conditions = (Array.isArray(v.conditions) ? v.conditions : [])
    .map(normalizeCondition)
    .filter((c): c is NightCondition => c !== null)
    .slice(0, MAX_CONDITIONS);
  const hold = Number(v.holdMinutes);
  return {
    match: v.match === "any" ? "any" : "all",
    conditions,
    holdMinutes: Number.isFinite(hold) ? Math.min(60, Math.max(0, Math.round(hold))) : DEFAULT_RULES.holdMinutes,
  };
}

function normalizeCondition(value: unknown): NightCondition | null {
  const c = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (c.kind === "time") {
    return typeof c.from === "string" && typeof c.to === "string" && TIME.test(c.from) && TIME.test(c.to)
      ? { kind: "time", from: c.from, to: c.to }
      : null;
  }
  if (typeof c.source !== "string" || !SOURCE.test(c.source)) return null;
  if (typeof c.id !== "string" || c.id.length === 0 || c.id.length > MAX_ID) return null;
  if (c.kind === "off" || c.kind === "on") return { kind: c.kind, source: c.source, id: c.id };
  if ((c.kind === "below" || c.kind === "above") && typeof c.value === "number" && Number.isFinite(c.value))
    return { kind: c.kind, source: c.source, id: c.id, value: c.value };
  return null;
}

/**
 * Home Assistant の拡張機能が持っていた条件（extension-data/home-assistant/night.json）を、本体の形に直す。
 * 条件を本体へ移す前に決めたものを引き継ぐため。本体では条件があれば使うので、切ってあった（enabled でない）ものは引き継がない
 * （引き継ぐと、切っていた条件で急に暗くなるため）
 */
export function migrateHomeAssistantRules(value: unknown): NightRules {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (v.enabled !== true) return { ...DEFAULT_RULES };
  const conditions = (Array.isArray(v.conditions) ? v.conditions : []).map((c) => {
    const old = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    return old.kind === "time" ? old : { ...old, source: "home-assistant", id: old.entityId };
  });
  return normalizeRules({ ...v, conditions });
}

/** 条件が見る値（差し出す拡張機能ごと） */
export function referencedIds(rules: NightRules): Map<string, string[]> {
  const bySource = new Map<string, string[]>();
  for (const c of rules.conditions) {
    if (c.kind === "time") continue;
    const ids = bySource.get(c.source) ?? [];
    if (!ids.includes(c.id)) ids.push(c.id);
    bySource.set(c.source, ids);
  }
  return bySource;
}

export const readingKey = (source: string, id: string) => `${source}\u0000${id}`;

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** from〜to の間か（22:00〜06:00 のように日をまたいでもよい。from と to が同じなら一日中） */
export function withinHours(from: string, to: string, now: Date): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  const a = minutesOf(from);
  const b = minutesOf(to);
  if (a === b) return true;
  return a < b ? m >= a && m < b : m >= a || m < b;
}

export function evaluateCondition(condition: NightCondition, readings: Map<string, StateReading>, now: Date): ConditionResult {
  if (condition.kind === "time") {
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return {
      condition,
      met: withinHours(condition.from, condition.to, now),
      current: `${hh}:${mm}`,
      label: `${condition.from}〜${condition.to}`,
    };
  }
  const reading = readings.get(readingKey(condition.source, condition.id));
  const name = reading?.name ?? condition.id;
  if (condition.kind === "below" || condition.kind === "above") {
    const unit = reading?.unit ?? "";
    const value = typeof reading?.value === "number" && Number.isFinite(reading.value) ? reading.value : null;
    return {
      condition,
      // 読めない値は満たさない（壊れたセンサーで夜に入りっぱなしにならないように）
      met: value !== null && (condition.kind === "below" ? value < condition.value : value > condition.value),
      current: value !== null ? `${value}${unit && ` ${unit}`}` : null,
      label: `${name}が ${condition.value}${unit && ` ${unit}`} ${condition.kind === "below" ? "未満" : "より上"}`,
    };
  }
  const on = typeof reading?.value === "boolean" ? reading.value : null;
  return {
    condition,
    met: on !== null && (condition.kind === "on" ? on : !on),
    current: on === null ? null : on ? "ついている" : "消えている",
    label: `${name}が${condition.kind === "on" ? "ついている" : "消えている"}`,
  };
}

export function evaluateRules(rules: NightRules, readings: Map<string, StateReading>, now: Date): NightEvaluation {
  const results = rules.conditions.map((c) => evaluateCondition(c, readings, now));
  const met = results.length > 0 && (rules.match === "all" ? results.every((r) => r.met) : results.some((r) => r.met));
  const reason = met ? results.filter((r) => r.met).map((r) => r.label).join("・") : null;
  return { met, results, reason };
}

/**
 * 満たしてから hold 分続いたら夜にする。満たさなくなったらすぐ戻す。
 * metSince はメモリに持つ「満たし始めた時刻」（満たさなければ null）
 */
export function nextNight(
  evaluation: NightEvaluation,
  metSince: number | null,
  holdMinutes: number,
  now: number,
): { active: boolean; metSince: number | null } {
  if (!evaluation.met) return { active: false, metSince: null };
  const since = metSince ?? now;
  return { active: now - since >= holdMinutes * 60_000, metSince: since };
}
