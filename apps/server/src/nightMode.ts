import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";

/**
 * 夜の表示（部屋が暗い・電気が消えているときに、画面をぐっと暗くする）。全部の端末で同じ。
 * - mode が "auto" なら、拡張機能が知らせる「夜の条件を満たした」（api.setNightSignal）のどれかが立っている間だけ夜にする。
 *   条件そのもの（照度・照明・時間帯）は、その状態を知っている拡張機能（Home Assistant）が持って判定する
 * - "on" はいつも夜、"off" は使わない
 * 設定は data/night.json。知らせはメモリだけで、起動し直すと拡張機能がまた知らせ直す
 */

export type NightMode = "auto" | "on" | "off";

export interface NightSettings {
  mode: NightMode;
  /** 夜のときに画面に重ねる暗さ（0.3〜0.95。大きいほど暗い） */
  darkness: number;
}

export interface NightSignal {
  /** 知らせた拡張機能の id */
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
}

export const DEFAULT_NIGHT: NightSettings = { mode: "auto", darkness: 0.75 };
const MIN_DARKNESS = 0.3;
const MAX_DARKNESS = 0.95;

const settingsPath = () => join(config.dataDir, "night.json");

let settings: NightSettings = { ...DEFAULT_NIGHT };
const signals = new Map<string, NightSignal>();
let lastActive: boolean | null = null;
const listeners = new Set<(state: NightState) => void>();

function normalize(value: unknown): NightSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof NightSettings, unknown>>;
  const mode = v.mode === "on" || v.mode === "off" ? v.mode : "auto";
  const darkness =
    typeof v.darkness === "number" && Number.isFinite(v.darkness)
      ? Math.min(MAX_DARKNESS, Math.max(MIN_DARKNESS, v.darkness))
      : DEFAULT_NIGHT.darkness;
  return { mode, darkness };
}

export async function loadNightSettings(): Promise<void> {
  try {
    settings = normalize(JSON.parse(await readFile(settingsPath(), "utf-8")));
  } catch {
    settings = { ...DEFAULT_NIGHT };
  }
  lastActive = null;
}

export function nightState(): NightState {
  const list = [...signals.values()];
  const active = settings.mode === "on" || (settings.mode === "auto" && list.length > 0);
  return { ...settings, active, signals: list };
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

/** 設定を変える（管理者）。変えたら、夜かどうかが同じでも画面へ知らせる（暗さが変わるため） */
export async function setNightSettings(patch: unknown): Promise<NightState> {
  const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  if (p.mode !== undefined && p.mode !== "auto" && p.mode !== "on" && p.mode !== "off")
    throw new ServiceError(400, "mode は auto・on・off のどれかにしてください", "mode must be auto, on or off");
  if (p.darkness !== undefined && (typeof p.darkness !== "number" || p.darkness < MIN_DARKNESS || p.darkness > MAX_DARKNESS))
    throw new ServiceError(400, "暗さは 0.3〜0.95 にしてください", "Darkness must be between 0.3 and 0.95");
  settings = normalize({ ...settings, ...p, darkness: p.darkness === undefined ? settings.darkness : Math.round((p.darkness as number) * 100) / 100 });
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`);
  emit(true);
  return nightState();
}

/** 拡張機能が「夜の条件を満たした・満たさなくなった」を知らせる（api.setNightSignal から） */
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

export function resetNightForTest(): void {
  settings = { ...DEFAULT_NIGHT };
  signals.clear();
  lastActive = null;
  listeners.clear();
}
