/**
 * 夜の表示に入る条件（家の人が決める）。照度のセンサーが何 lx 未満・照明が消えている・時間帯などを並べ、
 * 「すべて」か「どれか」を満たして、それが hold 分続いたら夜にする。満たさなくなったら（電気をつけたなど）すぐ戻す。
 * 判定は Home Assistant の状態だけで行い、ここには状態を覚えない（続いた長さだけメモリに持つ）
 */

export type NightCondition =
  | { kind: "below" | "above"; entityId: string; value: number }
  | { kind: "off" | "on"; entityId: string }
  | { kind: "time"; from: string; to: string };

export interface NightRules {
  /** 条件で夜にするか（切っておけば本体へ知らせない） */
  enabled: boolean;
  match: "all" | "any";
  conditions: NightCondition[];
  /** 満たしてから夜にするまでの分（ちらつき・一瞬の暗さで入らないように） */
  holdMinutes: number;
}

export const DEFAULT_RULES: NightRules = { enabled: false, match: "all", conditions: [], holdMinutes: 1 };

export interface EntityState {
  entityId: string;
  name: string;
  state: string;
  unit: string | null;
}

export interface ConditionResult {
  condition: NightCondition;
  met: boolean;
  /** 今の値（照度 3 lx・消えている・22:40 など。画面に出す） */
  current: string | null;
  /** 理由の一言（「リビングの明るさが 5 lx 未満」） */
  label: string;
}

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_CONDITIONS = 12;

/** 保存された値・画面から来た値を確かめる。おかしなものは捨てる（throw はしない） */
export function normalizeRules(value: unknown): NightRules {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const conditions = (Array.isArray(v.conditions) ? v.conditions : [])
    .map(normalizeCondition)
    .filter((c): c is NightCondition => c !== null)
    .slice(0, MAX_CONDITIONS);
  const hold = Number(v.holdMinutes);
  return {
    enabled: v.enabled === true,
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
  if (typeof c.entityId !== "string" || !ENTITY_ID.test(c.entityId)) return null;
  if (c.kind === "off" || c.kind === "on") return { kind: c.kind, entityId: c.entityId };
  if ((c.kind === "below" || c.kind === "above") && typeof c.value === "number" && Number.isFinite(c.value))
    return { kind: c.kind, entityId: c.entityId, value: c.value };
  return null;
}

/** 条件が見る entity_id */
export function referencedEntities(rules: NightRules): string[] {
  return [...new Set(rules.conditions.flatMap((c) => (c.kind === "time" ? [] : [c.entityId])))];
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** from〜to の間か（22:00〜06:00 のように日をまたいでもよい。from と to が同じなら一日中） */
export function withinHours(from: string, to: string, now: Date): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  const a = minutesOf(from);
  const b = minutesOf(to);
  if (a === b) return true;
  return a < b ? m >= a && m < b : m >= a || m < b;
}

/** 照明・スイッチなどが「ついている」か。読めない（unavailable）ときは null */
function isOn(state: string): boolean | null {
  if (state === "unavailable" || state === "unknown") return null;
  return ["on", "open", "playing", "home", "heat", "cool", "auto"].includes(state);
}

export function evaluateCondition(condition: NightCondition, states: Map<string, EntityState>, now: Date): ConditionResult {
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
  const entity = states.get(condition.entityId);
  const name = entity?.name ?? condition.entityId;
  if (condition.kind === "below" || condition.kind === "above") {
    const unit = entity?.unit ?? "";
    const value = entity ? Number(entity.state) : Number.NaN;
    const readable = entity !== undefined && entity.state.trim() !== "" && Number.isFinite(value);
    return {
      condition,
      // 読めないセンサーは満たさない（壊れたセンサーで夜に入りっぱなしにならないように）
      met: readable && (condition.kind === "below" ? value < condition.value : value > condition.value),
      current: readable ? `${value}${unit && ` ${unit}`}` : null,
      label: `${name}が ${condition.value}${unit && ` ${unit}`} ${condition.kind === "below" ? "未満" : "より上"}`,
    };
  }
  const on = entity ? isOn(entity.state) : null;
  return {
    condition,
    met: on !== null && (condition.kind === "on" ? on : !on),
    current: entity?.state ?? null,
    label: `${name}が${condition.kind === "on" ? "ついている" : "消えている"}`,
  };
}

export interface NightEvaluation {
  /** 今、条件を満たしているか（続いた長さは見ない） */
  met: boolean;
  results: ConditionResult[];
  /** 本体へ知らせる理由（満たした条件を「・」でつなぐ） */
  reason: string | null;
}

export function evaluateRules(rules: NightRules, states: Map<string, EntityState>, now: Date): NightEvaluation {
  const results = rules.conditions.map((c) => evaluateCondition(c, states, now));
  const met =
    rules.enabled &&
    results.length > 0 &&
    (rules.match === "all" ? results.every((r) => r.met) : results.some((r) => r.met));
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
