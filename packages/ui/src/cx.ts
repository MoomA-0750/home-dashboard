import { extendTailwindMerge } from "tailwind-merge";

/**
 * クラスをつなぐ。Tailwind のクラスがぶつかるとき（部品の p-4 と、使う側が渡した p-2 など）は、後に書いたものを残す。
 * テーマ（tailwind-theme.css）の名前を教えておく（text-caption は字の大きさ、text-muted は色、と見分けるため）
 */
const merge = extendTailwindMerge<"layer" | "tap" | "surface">({
  override: {
    theme: {
      color: [
        "accent",
        "accent-soft",
        "tint",
        "ink",
        "shade",
        "text",
        "muted",
        "line",
        "glass-border",
        "ok",
        "warn",
        "danger",
        "danger-strong",
        "on-danger",
        "success",
        "raised",
        "input",
        "fill",
        "on-fill",
        "backdrop",
        "transparent",
        "current",
        "white",
        "black",
      ],
      text: ["micro", "caption", "note", "label", "small", "body", "title", "heading", "screen", "stat", "card"],
      radius: ["card", "inner", "group", "nav", "art", "full"],
      shadow: ["widget"],
      "font-weight": ["normal", "medium", "semibold", "bold"],
      leading: ["none", "tight", "normal"],
      ease: ["out", "in", "standard"],
      animate: ["enter", "enter-slow", "fade", "pop", "drop", "fade-out", "exit", "pop-out", "drop-out", "reveal", "spin"],
    },
  },
  extend: {
    classGroups: {
      // 自前のクラス（tailwind-theme.css の @utility）のうち、同じものを替えるもの
      layer: [{ layer: ["base", "handle", "tabbar", "launcher", "popover", "bar", "snackbar", "modal", "voice", "guard"] }],
      tap: ["tap", "tap-lg", "tap-xl"],
      surface: ["glass", "raised", "fill-bright"],
      // Tailwind のクラスと同じものを替える自前のクラス。教えないと両方が残り、CSS の並び順で部品の既定（Icon の size-6 など）が勝つ
      size: [{ size: ["cap", (value: string) => value.startsWith("rem-")] }],
      h: [{ h: ["screen-phone"] }],
      "max-h": [{ "max-h": ["dialog", "menu"] }],
      "max-w": [{ "max-w": ["dialog", "dialog-wide"] }],
      w: [{ w: ["side-nav", "note-preview"] }],
      "min-w": [{ "min-w": ["dialog"] }],
      rounded: [{ rounded: ["nested"] }],
      "font-size": [{ text: ["unit", (value: string) => value.startsWith("fit-")] }],
      "text-color": [{ text: ["voice-accent"] }],
    },
  },
});

export function cx(...names: (string | false | null | undefined | 0)[]): string {
  return merge(names.filter(Boolean).join(" "));
}
