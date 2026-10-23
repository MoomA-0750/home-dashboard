import { useEffect, useState } from "react";

/**
 * 軽い表示。ガラスのぼかし（backdrop-filter）を切って、後ろが透けない落ち着いた板にする（theme.css の :root[data-lite]）。
 * ぼかしは画面の後ろを毎回描き直すので、GPU の無い・弱い端末（キオスクの小さな PC など）では動きがかくつく。
 *
 * 端末ごとに「自動・入・切」を選ぶ（サーバーの DeviceSettings.lite）。自動のときは次のどれかで入れる:
 * - 透明を減らす設定（prefers-reduced-transparency）
 * - 描画がソフトウェア（SwiftShader・llvmpipe など。GPU が使えていない）
 * - 開いてしばらくしてから数秒測った描画の速さが遅い
 * 測った結果は端末に覚え、次からはすぐ使う（軽くした後に測り直すと速く見えて、入／切を繰り返すため）
 */

export type LiteMode = "auto" | "on" | "off";
export type LiteReason = "setting" | "transparency" | "software" | "slow" | null;

const STORAGE_KEY = "home-dashboard:lite-auto";
// 開いた直後は読み込みで遅いので、落ち着いてから測る
const MEASURE_DELAY_MS = 8_000;
const MEASURE_MS = 3_000;
// フレームの間隔の中央値がこれより長い（おおよそ 30fps を切る）なら遅い
const SLOW_FRAME_MS = 34;

function readStored(): LiteReason | "fast" | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "software" || value === "slow" || value === "fast" ? value : null;
  } catch {
    return null;
  }
}

function store(value: "software" | "slow" | "fast"): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 覚えられなくても、次に開いたときにもう一度測るだけ
  }
}

/** 自動で決めたものを忘れる（「自動」を選び直したとき、測り直す） */
export function forgetLiteMeasurement(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** WebGL の描き手の名前から、GPU を使わずに描いているかを見る */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer);
}

function rendererName(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) return "software (no webgl)";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

/** フレームの間隔の中央値（ms）を測る。タブが隠れていたら null */
function measureFrames(durationMs: number, signal: { cancelled: boolean }): Promise<number | null> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = 0;
    const started = performance.now();
    const step = (now: number) => {
      if (signal.cancelled || document.visibilityState !== "visible") return resolve(null);
      if (last) gaps.push(now - last);
      last = now;
      if (now - started < durationMs) return void requestAnimationFrame(step);
      gaps.sort((a, b) => a - b);
      resolve(gaps.length > 10 ? gaps[Math.floor(gaps.length / 2)] : null);
    };
    requestAnimationFrame(step);
  });
}

function reducedTransparency(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

function initialAuto(): LiteReason {
  if (reducedTransparency()) return "transparency";
  const stored = readStored();
  return stored === "software" || stored === "slow" ? stored : null;
}

/**
 * 端末の設定に合わせて軽い表示を入れ、入っているか・なぜかを返す。
 * generation を変えると、自動で決めたものを忘れて測り直す（「自動」を選び直したとき）
 */
export function useLiteMode(mode: LiteMode, generation = 0): { active: boolean; reason: LiteReason } {
  const [auto, setAuto] = useState<LiteReason>(initialAuto);
  const [seenGeneration, setSeenGeneration] = useState(generation);
  if (generation !== seenGeneration) {
    // 描いている途中で前の結果を捨てる（React の「props が変わったら state を直す」書き方）
    forgetLiteMeasurement();
    setSeenGeneration(generation);
    setAuto(initialAuto());
  }

  useEffect(() => {
    if (mode !== "auto" || auto !== null || readStored() === "fast") return;
    if (isSoftwareRenderer(rendererName())) {
      store("software");
      setAuto("software");
      return;
    }
    const signal = { cancelled: false };
    const timer = setTimeout(() => {
      void measureFrames(MEASURE_MS, signal).then((median) => {
        if (median === null || signal.cancelled) return;
        const slow = median > SLOW_FRAME_MS;
        store(slow ? "slow" : "fast");
        if (slow) setAuto("slow");
      });
    }, MEASURE_DELAY_MS);
    return () => {
      signal.cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, auto]);

  const reason: LiteReason = mode === "on" ? "setting" : mode === "off" ? null : auto;
  const active = reason !== null;
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.lite = "";
    else delete root.dataset.lite;
  }, [active]);
  return { active, reason };
}
