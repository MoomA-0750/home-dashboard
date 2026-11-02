import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 動き（styles/tokens.css の --motion-* と --ease-*）を JS から使うとき用。CSS で書ける動きは CSS に書き、
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

/** 動きの時間（ミリ秒）。tokens.css の --motion-<name> を読む（動きを減らす設定では 0） */
export function motionMs(name: MotionDuration): number {
  if (typeof document === "undefined") return FALLBACK_MS[name];
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${name}`).trim();
  const ms = value.endsWith("ms") ? parseFloat(value) : value.endsWith("s") ? parseFloat(value) * 1000 : NaN;
  return Number.isFinite(ms) ? ms : FALLBACK_MS[name];
}

/**
 * 消えるときの動きのため、open が false になってからも消える動きの間だけ出しておく（親が開け閉めを持つ部品用）。
 *
 *   const menu = usePresence(open);
 *   {menu.shown && <ul className={cx("animate-drop closing:animate-drop-out", menu.closing && "is-closing")}>…}
 */
export function usePresence(open: boolean, name: MotionDuration = "base"): { shown: boolean; closing: boolean } {
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setShown(true);
      return;
    }
    const timer = setTimeout(() => setShown(false), motionMs(name));
    return () => clearTimeout(timer);
  }, [open, name]);
  return { shown: open || shown, closing: !open && shown };
}

/**
 * 消えるときの動きのため、閉じるのを少し待つ（親が出し消しする小窓が、自分の × や背景・Esc で閉じるとき用）。
 * close() を呼ぶと closing が true になり、消える動きの後で onClose を呼ぶ
 */
export function useClosing(onClose: () => void, name: MotionDuration = "base"): { closing: boolean; close: () => void } {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => onCloseRef.current(), motionMs(name));
  }, [name]);
  return { closing, close };
}
