/**
 * 動き（本体の theme.css の --motion-* と --ease-*）を JS から使うとき用。CSS で書ける動きは CSS に書き、
 * スクロールや「何秒後に外す」のように JS で動かすものだけ、これで「動きを減らす」設定に合わせる。
 *
 *   el.scrollTo({ top, behavior: scrollBehavior() })
 *   setTimeout(done, motionMs("reveal"))
 */

export type MotionDuration = "fast" | "base" | "slow" | "reveal";

const FALLBACK_MS: Record<MotionDuration, number> = { fast: 120, base: 200, slow: 280, reveal: 1600 };

/** 端末の「動きを減らす」設定が入っているか */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** スクロールの動き方（動きを減らす設定なら、すぐ飛ぶ） */
export function scrollBehavior(): ScrollBehavior {
  return reducedMotion() ? "auto" : "smooth";
}

/** 動きの時間（ミリ秒）。theme.css の --motion-<name> を読む（動きを減らす設定では 0） */
export function motionMs(name: MotionDuration): number {
  if (typeof document === "undefined") return FALLBACK_MS[name];
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${name}`).trim();
  const ms = value.endsWith("ms") ? parseFloat(value) : value.endsWith("s") ? parseFloat(value) * 1000 : NaN;
  return Number.isFinite(ms) ? ms : FALLBACK_MS[name];
}
