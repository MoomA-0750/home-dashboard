import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cx, reducedMotion } from "@home-dashboard/widget-sdk";
import { REPEAT_MS, type NoteBubble, type NoteBurst, type StickyNote } from "./notes";

/**
 * 付箋が動いている長さ。付箋の動き（本体の theme/small.css の animate-sticky-*、長くて 1.6 秒）と、
 * 中の効果（紙吹雪など、粒がいちばん遅く出て消えるまで）の長いほう。これが過ぎたら外す
 */
const PLAY_MS = 3200;

/** 軽い表示（弱い端末向け、本体の lib/lite.ts）では粒を減らす */
const isLite = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-lite");

/** 押すまで読めない見えないインクは、動きではなく状態なので「動かす」ものに数えない */
const movesBubble = (bubble: NoteBubble) => bubble !== "none" && bubble !== "ink";

/** 貼られたときや繰り返すときに、動かすものがあるか */
export const hasMotion = (note: Pick<StickyNote, "bubble" | "burst">) => movesBubble(note.bubble) || note.burst !== "none";

/**
 * 動いている付箋の id。flash(id) で動かし始め、PLAY_MS 後に外す。
 * 「動きを減らす」設定では何もしない（見えないインクは動きではないのでそのまま出る）
 */
export function useBubbleFlash() {
  const [playing, setPlaying] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const flash = useCallback((ids: string[]) => {
    if (ids.length === 0 || reducedMotion()) return;
    // いったん外してから付け直すと、同じ付箋でも動きが頭から始まる（中の効果の粒も作り直す）
    setPlaying((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    requestAnimationFrame(() => setPlaying((prev) => new Set([...prev, ...ids])));
    for (const id of ids) {
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setPlaying((prev) => new Set([...prev].filter((p) => p !== id)));
        }, PLAY_MS),
      );
    }
  }, []);

  return { playing, flash };
}

/**
 * 新しく貼られた付箋を見つけて動かす。最初に読んだ分は「前からあったもの」として動かさない。
 * repeat の付いた付箋は REPEAT_MS ごとにもう一度動かす
 */
export function useArrivals(notes: StickyNote[] | null, flash: (ids: string[]) => void) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!notes) return;
    if (seen.current === null) {
      seen.current = new Set(notes.map((n) => n.id));
      return;
    }
    const known = seen.current;
    const fresh = notes.filter((n) => !known.has(n.id));
    fresh.forEach((n) => known.add(n.id));
    flash(fresh.filter(hasMotion).map((n) => n.id));
  }, [notes, flash]);

  const repeating = notes?.filter((n) => n.repeat && hasMotion(n)).map((n) => n.id).join(",") ?? "";
  useEffect(() => {
    if (!repeating) return;
    const id = setInterval(() => flash(repeating.split(",")), REPEAT_MS);
    return () => clearInterval(id);
  }, [repeating, flash]);
}

const CONFETTI_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
const BALLOON_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

const between = (min: number, max: number) => min + Math.random() * (max - min);

function particlesFor(effect: NoteBurst): CSSProperties[] {
  const count = { none: 0, confetti: 22, balloons: 6, hearts: 9 }[effect];
  const n = Math.max(effect === "none" ? 0 : 3, Math.round(count * (isLite() ? 0.5 : 1)));
  return Array.from({ length: n }, (_, i) => {
    // 位置と横のずれは付箋の幅に対して決める（付箋の大きさが変わっても枠の中に収まる）
    const vars: Record<string, string> = {
      "--x": `${between(4, 92).toFixed(1)}%`,
      "--delay": `${between(0, effect === "confetti" ? 700 : 1000).toFixed(0)}ms`,
      "--drift": `${between(-1.2, 1.2).toFixed(2)}rem`,
    };
    if (effect === "confetti") {
      vars["--color"] = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      vars["--spin"] = `${between(360, 900).toFixed(0)}deg`;
      vars["--dur"] = `${between(1500, 2300).toFixed(0)}ms`;
    } else if (effect === "balloons") {
      vars["--color"] = BALLOON_COLORS[i % BALLOON_COLORS.length];
      vars["--size"] = `${between(1.2, 1.8).toFixed(2)}rem`;
      vars["--dur"] = `${between(1800, 2200).toFixed(0)}ms`;
    } else {
      vars["--size"] = `${between(0.8, 1.4).toFixed(2)}rem`;
      vars["--dur"] = `${between(1500, 2100).toFixed(0)}ms`;
    }
    return vars as CSSProperties;
  });
}

/**
 * 付箋の中で起こる効果（紙吹雪・風船・ハート）。付箋の枠からははみ出さず、文字の後ろで起こる（伝言は読めたまま）。
 * 粒は付箋の高さいっぱいの「通り道」を transform で動かし、その中の粒を描く（付箋の高さに合わせて動くよう、
 * 通り道の translateY の % が付箋の高さになる）
 */
export function NoteBurstLayer({ effect }: { effect: NoteBurst }) {
  const particles = useMemo(() => particlesFor(effect), [effect]);
  if (effect === "none") return null;
  const look = BURST_LOOK[effect];
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((style, i) => (
        <span key={i} className={cx("absolute inset-0 will-change-transform", look.lane)} style={style}>
          <span className={cx("absolute left-(--x)", look.piece)}>{effect === "hearts" ? "❤" : null}</span>
        </span>
      ))}
    </span>
  );
}

/** 効果ごとの通り道の動きと粒の形（形と動きは本体の theme/small.css の sticky-*） */
const BURST_LOOK: Record<Exclude<NoteBurst, "none">, { lane: string; piece: string }> = {
  confetti: { lane: "animate-sticky-fall", piece: "sticky-confetti animate-sticky-spin" },
  balloons: { lane: "animate-sticky-rise", piece: "sticky-balloon" },
  hearts: { lane: "animate-sticky-hearts", piece: "sticky-heart" },
};
