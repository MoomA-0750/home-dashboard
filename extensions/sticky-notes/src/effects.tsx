import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { reducedMotion } from "@home-dashboard/widget-sdk";
import { REPEAT_MS, type NoteScreen, type StickyNote } from "./notes";

/** 付箋の動き（web.css の sticky-note--fx-*）の長さ。これが過ぎたら class を外す */
const BUBBLE_MS = 1700;
/** 画面いっぱいの効果の長さ（粒がいちばん遅く出て消えるまで） */
const SCREEN_MS = 4200;

/** 軽い表示（弱い端末向け、本体の lib/lite.ts）では粒を減らす */
const isLite = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-lite");

/**
 * 動いている付箋の id。flash(id) で動かし始め、BUBBLE_MS 後に外す。
 * 「動きを減らす」設定では何もしない（見えないインクは動きではないので web.css 側でそのまま出る）
 */
export function useBubbleFlash() {
  const [playing, setPlaying] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const flash = useCallback((ids: string[]) => {
    if (ids.length === 0 || reducedMotion()) return;
    // いったん外してから付け直すと、同じ付箋でも動きが頭から始まる
    setPlaying((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    requestAnimationFrame(() => setPlaying((prev) => new Set([...prev, ...ids])));
    for (const id of ids) {
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setPlaying((prev) => new Set([...prev].filter((p) => p !== id)));
        }, BUBBLE_MS),
      );
    }
  }, []);

  return { playing, flash };
}

/** 画面いっぱいの効果は、同じ付箋につき 1 画面で 1 回だけ（ウィジェットを 2 つ置いても重ねない） */
const screenPlayed = new Set<string>();

type ScreenListener = (effect: NoteScreen) => void;
const screenListeners = new Set<ScreenListener>();

/**
 * 画面いっぱいの効果を出す。ScreenEffects はウィジェットごとに置かれるが、出すのはそのうち 1 つだけ
 * （ウィジェットを 2 つ置いても重ねない。先に置いたものが外れたら、次のものが出す）
 */
export function playScreenEffect(effect: NoteScreen) {
  if (effect === "none" || reducedMotion()) return;
  const [first] = screenListeners;
  first?.(effect);
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
      notes.forEach((n) => screenPlayed.add(n.id));
      return;
    }
    const known = seen.current;
    const fresh = notes.filter((n) => !known.has(n.id));
    fresh.forEach((n) => known.add(n.id));
    flash(fresh.filter((n) => n.bubble !== "none" && n.bubble !== "ink").map((n) => n.id));
    for (const note of fresh) {
      if (screenPlayed.has(note.id)) continue;
      screenPlayed.add(note.id);
      playScreenEffect(note.screen);
    }
  }, [notes, flash]);

  const repeating = notes?.filter((n) => n.repeat && n.bubble !== "none" && n.bubble !== "ink").map((n) => n.id).join(",") ?? "";
  useEffect(() => {
    if (!repeating) return;
    const id = setInterval(() => flash(repeating.split(",")), REPEAT_MS);
    return () => clearInterval(id);
  }, [repeating, flash]);
}

interface Particle {
  key: number;
  style: CSSProperties;
  glyph?: string;
}

const CONFETTI_COLORS = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#c084fc", "#f472b6"];
const BALLOON_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

const between = (min: number, max: number) => min + Math.random() * (max - min);

function particlesFor(effect: NoteScreen): Particle[] {
  const count = { none: 0, confetti: 70, balloons: 16, hearts: 26 }[effect];
  const n = Math.round(count * (isLite() ? 0.35 : 1));
  return Array.from({ length: n }, (_, i) => {
    const vars: Record<string, string> = {
      "--x": `${between(0, 100).toFixed(1)}vw`,
      "--delay": `${between(0, effect === "confetti" ? 900 : 1400).toFixed(0)}ms`,
      "--drift": `${between(-12, 12).toFixed(1)}vw`,
    };
    if (effect === "confetti") {
      vars["--color"] = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      vars["--spin"] = `${between(360, 1080).toFixed(0)}deg`;
      vars["--fall"] = `${between(2200, 3200).toFixed(0)}ms`;
    } else if (effect === "balloons") {
      vars["--color"] = BALLOON_COLORS[i % BALLOON_COLORS.length];
      vars["--size"] = `${between(3.5, 5.5).toFixed(2)}rem`;
      vars["--rise"] = `${between(2600, 3400).toFixed(0)}ms`;
    } else {
      vars["--size"] = `${between(1.6, 3.2).toFixed(2)}rem`;
      vars["--rise"] = `${between(2000, 3000).toFixed(0)}ms`;
    }
    return { key: i, style: vars as CSSProperties, glyph: effect === "hearts" ? "❤" : undefined };
  });
}

/**
 * 画面いっぱいの効果を body の直下に出す（ウィジェットのカードは transform で置かれ、はみ出しも切られるため）。
 * 押した所を邪魔しないよう pointer-events は通す
 */
export function ScreenEffects() {
  const [bursts, setBursts] = useState<{ id: number; effect: NoteScreen; particles: Particle[] }[]>([]);
  const next = useRef(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const listener: ScreenListener = (effect) => {
      const id = next.current++;
      setBursts((prev) => [...prev, { id, effect, particles: particlesFor(effect) }]);
      timers.push(setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), SCREEN_MS));
    };
    screenListeners.add(listener);
    return () => {
      screenListeners.delete(listener);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (bursts.length === 0) return null;
  return createPortal(
    <>
      {bursts.map((burst) => (
        <div key={burst.id} className={`sticky-notes-burst sticky-notes-burst--${burst.effect}`} aria-hidden="true">
          {burst.particles.map((p) => (
            <span key={p.key} className="sticky-notes-burst__piece" style={p.style}>
              {p.glyph}
            </span>
          ))}
        </div>
      ))}
    </>,
    document.body,
  );
}
