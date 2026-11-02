import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StateReading, StateSource } from "@home-dashboard/extension-sdk";
import { config } from "./config.js";
import {
  DEFAULT_RULES,
  evaluateRules,
  migrateHomeAssistantRules,
  nextNight,
  normalizeRules,
  readingKey,
  referencedIds,
  type NightEvaluation,
  type NightRules,
} from "./nightRules.js";
import { ServiceError } from "./serviceError.js";

/**
 * 夜の表示（部屋が暗い・電気が消えているときに、画面をぐっと暗くする）。全部の端末で同じ。
 * - mode が "auto" なら、条件（rules。設定画面で決める）を満たしている間か、拡張機能が「夜の条件を満たした」と
 *   知らせている間（api.setNightSignal）だけ夜にする。条件に使う値（照度・照明のオンオフなど）は、家の状態を差し出す
 *   拡張機能（api.provideStates。Home Assistant など）から読むので、連携先を問わない
 * - "on" はいつも夜、"off" は使わない
 * 設定は data/night.json。知らせと「満たし始めた時刻」はメモリだけで、起動し直すと測り直す
 */

export type NightMode = "auto" | "on" | "off";

export interface NightSettings {
  mode: NightMode;
  /** 夜のときに画面に重ねる暗さ（0.3〜0.95。大きいほど暗い） */
  darkness: number;
  rules: NightRules;
}

export interface NightSignal {
  /** 知らせたもの（拡張機能の id。本体の条件なら CONDITIONS_SOURCE） */
  source: string;
  /** 何を満たしたか（「リビングの照度が 5 lx 未満」など。画面の設定に出す） */
  reason: string | null;
  since: string;
}

export interface NightState extends NightSettings {
  /** 今、夜の表示か */
  active: boolean;
  /** 立っている知らせ（mode が auto でなくても出す） */
  signals: NightSignal[];
  /** 最後に条件を確かめた結果（条件が無ければ null） */
  evaluation: NightEvaluation | null;
}

/** 家の状態を差し出している拡張機能（host.ts の stateSources） */
export interface NamedStateSource {
  extensionId: string;
  name: string;
  source: StateSource;
}

export const DEFAULT_NIGHT: NightSettings = { mode: "auto", darkness: 0.75, rules: DEFAULT_RULES };
/** 本体の条件で立てる知らせの名前（拡張機能の id には使えない文字で始める） */
export const CONDITIONS_SOURCE = "@conditions";
const MIN_DARKNESS = 0.3;
const MAX_DARKNESS = 0.95;
const CHECK_MS = 30_000;
const READ_TIMEOUT_MS = 8_000;

const settingsPath = () => join(config.dataDir, "night.json");
/** 条件を本体へ移す前に、Home Assistant の拡張機能が持っていた条件 */
const legacyRulesPath = () => join(config.dataDir, "extension-data", "home-assistant", "night.json");

let settings: NightSettings = { ...DEFAULT_NIGHT };
const signals = new Map<string, NightSignal>();
let lastActive: boolean | null = null;
let evaluation: NightEvaluation | null = null;
let metSince: number | null = null;
let sources: () => NamedStateSource[] = () => [];
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(state: NightState) => void>();

function normalize(value: unknown): NightSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof NightSettings, unknown>>;
  const mode = v.mode === "on" || v.mode === "off" ? v.mode : "auto";
  const darkness =
    typeof v.darkness === "number" && Number.isFinite(v.darkness)
      ? Math.min(MAX_DARKNESS, Math.max(MIN_DARKNESS, v.darkness))
      : DEFAULT_NIGHT.darkness;
  return { mode, darkness, rules: normalizeRules(v.rules) };
}

async function save(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`);
}

export async function loadNightSettings(): Promise<void> {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(await readFile(settingsPath(), "utf-8")) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  settings = normalize(raw);
  // 条件がまだ本体に無ければ、Home Assistant の拡張機能が持っていた条件を一度だけ引き継ぐ
  if (raw.rules === undefined) {
    try {
      settings.rules = migrateHomeAssistantRules(JSON.parse(await readFile(legacyRulesPath(), "utf-8")));
      if (settings.rules.conditions.length > 0) await save();
    } catch {
      // 引き継ぐものが無い
    }
  }
  lastActive = null;
}

export function nightState(): NightState {
  const list = [...signals.values()];
  const active = settings.mode === "on" || (settings.mode === "auto" && list.length > 0);
  return { ...settings, active, signals: list, evaluation };
}

/** 状態が変わったときに呼ぶもの（画面へ知らせる）。戻り値で外す */
export function onNightChange(listener: (state: NightState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(force = false) {
  const state = nightState();
  if (!force && state.active === lastActive) return;
  lastActive = state.active;
  for (const listener of listeners) listener(state);
}

/** 設定を変える（管理者）。変えたら、夜かどうかが同じでも画面へ知らせる（暗さ・条件が変わるため） */
export async function setNightSettings(patch: unknown): Promise<NightState> {
  const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  if (p.mode !== undefined && p.mode !== "auto" && p.mode !== "on" && p.mode !== "off")
    throw new ServiceError(400, "mode は auto・on・off のどれかにしてください", "mode must be auto, on or off");
  if (p.darkness !== undefined && (typeof p.darkness !== "number" || p.darkness < MIN_DARKNESS || p.darkness > MAX_DARKNESS))
    throw new ServiceError(400, "暗さは 0.3〜0.95 にしてください", "Darkness must be between 0.3 and 0.95");
  settings = normalize({
    ...settings,
    ...p,
    darkness: p.darkness === undefined ? settings.darkness : Math.round((p.darkness as number) * 100) / 100,
  });
  await save();
  if (p.rules !== undefined) {
    // 条件を変えたら、続いた長さを数え直して、すぐ確かめる
    metSince = null;
    await checkConditions();
  }
  emit(true);
  return nightState();
}

/** 拡張機能・本体の条件が「夜の条件を満たした・満たさなくなった」を知らせる */
export function setNightSignal(source: string, active: boolean, reason?: string | null): void {
  const current = signals.get(source);
  if (active) {
    const nextReason = reason ?? null;
    if (current && current.reason === nextReason) return;
    signals.set(source, { source, reason: nextReason, since: current?.since ?? new Date().toISOString() });
    // 理由だけ変わったときも、設定画面の表示のために知らせる
    emit(Boolean(current));
  } else if (current) {
    signals.delete(source);
    emit();
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), READ_TIMEOUT_MS)),
  ]);
}

/** 条件が見る値を、差し出している拡張機能から読む。読めないもの（止まっている・答えない）は入れない（満たさない扱い） */
async function readReferenced(rules: NightRules): Promise<Map<string, StateReading>> {
  const readings = new Map<string, StateReading>();
  const available = new Map(sources().map((s) => [s.extensionId, s.source]));
  await Promise.all(
    [...referencedIds(rules)].map(async ([extensionId, ids]) => {
      const source = available.get(extensionId);
      if (!source) return;
      try {
        for (const reading of await withTimeout(source.read(ids))) readings.set(readingKey(extensionId, reading.id), reading);
      } catch (err) {
        console.warn(`[night] ${extensionId} の値を読めませんでした: ${(err as Error).message}`);
      }
    }),
  );
  return readings;
}

/** 条件を確かめて、満たして hold 分続いていれば夜の知らせを立てる。条件が無ければ知らせを下ろす */
export async function checkConditions(now = new Date()): Promise<void> {
  const rules = settings.rules;
  if (rules.conditions.length === 0) {
    evaluation = null;
    metSince = null;
    setNightSignal(CONDITIONS_SOURCE, false);
    return;
  }
  const result = evaluateRules(rules, await readReferenced(rules), now);
  const changed = JSON.stringify(result) !== JSON.stringify(evaluation);
  evaluation = result;
  const next = nextNight(result, metSince, rules.holdMinutes, now.getTime());
  metSince = next.metSince;
  setNightSignal(CONDITIONS_SOURCE, next.active, result.reason);
  // 夜かどうかが変わらなくても、設定画面の「満たしている・いない」を新しくする
  if (changed) emit(true);
}

/** 条件を決めた間隔で確かめ始める。sources は家の状態を差し出している拡張機能を返すもの */
export function startNightWatch(list: () => NamedStateSource[]): void {
  sources = list;
  if (timer) clearInterval(timer);
  timer = setInterval(() => void checkConditions(), CHECK_MS);
  timer.unref?.();
  void checkConditions();
}

/** 条件に選べる値（設定画面で条件を足すとき）。差し出している拡張機能ごと */
export async function listStateReadings(): Promise<
  { source: string; name: string; readings: StateReading[]; error: string | null }[]
> {
  return Promise.all(
    sources().map(async ({ extensionId, name, source }) => {
      try {
        return { source: extensionId, name, readings: await withTimeout(source.list()), error: null };
      } catch (err) {
        return { source: extensionId, name, readings: [], error: (err as Error).message };
      }
    }),
  );
}

export function resetNightForTest(): void {
  settings = { ...DEFAULT_NIGHT };
  signals.clear();
  lastActive = null;
  evaluation = null;
  metSince = null;
  sources = () => [];
  if (timer) clearInterval(timer);
  timer = null;
  listeners.clear();
}
