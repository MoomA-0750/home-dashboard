// host-module:@home-dashboard/widget-sdk
var m = globalThis.__homeDashboard?.modules?.["@home-dashboard/widget-sdk"];
if (!m) throw new Error("\u672C\u4F53\u306E @home-dashboard/widget-sdk \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var widget_sdk_default = m.default ?? m;
var { Avatar, AvatarStack, BackButton, Badge, Button, ButtonLink, ButtonRow, ChatAttachments, ChatBubble, ChatComposer, ChatFile, ChatFileChips, ChatFrom, ChatHeader, ChatIconButton, ChatImage, ChatLayout, ChatLog, ChatMeta, ChatPending, ChatRow, Check, Chip, CodeBlock, DEFAULT_DISPLAY, DetailFrame, Dialog, DisplayContext, FeatureProvidersContext, Field, Group, Icon, IconButton, LOCALES, List, ListIcon, ListItem, ListNoChevron, LocaleContext, Message, NarrowOnly, Note, Notice, PillMenu, PollingActiveContext, ProgressBar, ScreenFrame, ScreenNotice, ScreenSection, SectionTitle, SideLayout, Slider, StatGrid, StatTile, StatusDot, ToggleSwitch, WidgetCard, WidgetHint, WidgetRegistry, buttonClass, convertReading, convertTemperature, cx, defineMessages, defineWebExtension, defineWidget, extensionApiUrl, formatClock, formatDate, formatPastDay, formatTemperature, formatTime, getDisplay, getLocale, inputClass, intlLocale, motionMs, normalizeDisplay, openSettings, reducedMotion, scrollBehavior, setCurrentDisplay, setCurrentLocale, showSnackbar, startOfWeek, temperatureUnit, textFor, useClosing, useDateFormat, useDisplay, useFeatureProviders, useLocale, usePolledResource, usePolling, usePresence, useSettingsLinks, useSnackbars, useTemperature, useTimeFormat, weatherConditionText, weatherIcon, widgetRegistry } = m;

// host-module:react
var m2 = globalThis.__homeDashboard?.modules?.["react"];
if (!m2) throw new Error("\u672C\u4F53\u306E react \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var react_default = m2.default ?? m2;
var { Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, act, cloneElement, createContext, createElement, createFactory, createRef, forwardRef, isValidElement, lazy, memo, startTransition, unstable_act, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, version } = m2;

// extensions/sticky-notes/src/notes.ts
var NOTE_COLORS = ["yellow", "pink", "blue", "green"];
var NOTE_EXPIRES = ["none", "today", "tomorrow", "week"];
var NOTE_ALIGN_X = ["start", "center", "end"];
var NOTE_ALIGN_Y = ["top", "middle", "bottom"];
var NOTE_BUBBLES = ["none", "slam", "loud", "gentle", "ink"];
var NOTE_BURSTS = ["none", "confetti", "balloons", "hearts"];
var MAX_TEXT = 200;
var MAX_FROM = 20;
var REPEAT_MS = 5 * 60 * 1e3;

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/sticky-notes/src/effects.tsx
var PLAY_MS = 3200;
var isLite = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-lite");
var movesBubble = (bubble) => bubble !== "none" && bubble !== "ink";
var hasMotion = (note) => movesBubble(note.bubble) || note.burst !== "none";
function useBubbleFlash() {
  const [playing, setPlaying] = useState(/* @__PURE__ */ new Set());
  const timers = useRef(/* @__PURE__ */ new Map());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const flash = useCallback((ids) => {
    if (ids.length === 0 || reducedMotion()) return;
    setPlaying((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    requestAnimationFrame(() => setPlaying((prev) => /* @__PURE__ */ new Set([...prev, ...ids])));
    for (const id of ids) {
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setPlaying((prev) => new Set([...prev].filter((p) => p !== id)));
        }, PLAY_MS)
      );
    }
  }, []);
  return { playing, flash };
}
function useArrivals(notes, flash) {
  const seen = useRef(null);
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
var CONFETTI_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
var BALLOON_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
var between = (min, max) => min + Math.random() * (max - min);
function particlesFor(effect) {
  const count = { none: 0, confetti: 22, balloons: 6, hearts: 9 }[effect];
  const n = Math.max(effect === "none" ? 0 : 3, Math.round(count * (isLite() ? 0.5 : 1)));
  return Array.from({ length: n }, (_, i) => {
    const vars = {
      "--x": `${between(4, 92).toFixed(1)}%`,
      "--delay": `${between(0, effect === "confetti" ? 700 : 1e3).toFixed(0)}ms`,
      "--drift": `${between(-1.2, 1.2).toFixed(2)}rem`
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
    return vars;
  });
}
function NoteBurstLayer({ effect }) {
  const particles = useMemo(() => particlesFor(effect), [effect]);
  if (effect === "none") return null;
  const look = BURST_LOOK[effect];
  return /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-0 overflow-hidden", "aria-hidden": "true", children: particles.map((style, i) => /* @__PURE__ */ jsx("span", { className: cx("absolute inset-0 will-change-transform", look.lane), style, children: /* @__PURE__ */ jsx("span", { className: cx("absolute left-(--x)", look.piece), children: effect === "hearts" ? "\u2764" : null }) }, i)) });
}
var BURST_LOOK = {
  confetti: { lane: "animate-sticky-fall", piece: "sticky-confetti animate-sticky-spin" },
  balloons: { lane: "animate-sticky-rise", piece: "sticky-balloon" },
  hearts: { lane: "animate-sticky-hearts", piece: "sticky-heart" }
};

// extensions/sticky-notes/src/widget.tsx
var messages = defineMessages({
  ja: {
    title: "\u4F1D\u8A00",
    count: "{n}\u679A",
    add: "\u4ED8\u7B8B\u3092\u8CBC\u308B",
    addShort: "\u8CBC\u308B",
    empty: "\u4F1D\u8A00\u306F\u3042\u308A\u307E\u305B\u3093",
    emptyHint: "\uFF0B\u304B\u3089\u4ED8\u7B8B\u3092\u8CBC\u308C\u307E\u3059",
    loadFailed: "\u4ED8\u7B8B\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
    requestFailed: "\u3046\u307E\u304F\u3044\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    detailTitle: "\u4ED8\u7B8B",
    text: "\u4F1D\u8A00",
    textPlaceholder: "\u4F8B: \u51B7\u8535\u5EAB\u306E\u30B1\u30FC\u30AD\u306F\u660E\u65E5\u306E\u5206\u3067\u3059",
    previewPlaceholder: "\u3053\u3053\u306B\u4F1D\u8A00\u304C\u51FA\u307E\u3059",
    preview: "\u898B\u672C",
    replay: "\u3082\u3046\u4E00\u5EA6\u52D5\u304B\u3059",
    from: "\u66F8\u3044\u305F\u4EBA\uFF08\u4EFB\u610F\uFF09",
    color: "\u8272",
    alignX: "\u6A2A\u306E\u63C3\u3048",
    alignY: "\u7E26\u306E\u63C3\u3048",
    bubble: "\u4ED8\u7B8B\u306E\u52D5\u304D",
    burst: "\u4ED8\u7B8B\u306E\u4E2D\u306E\u52B9\u679C",
    repeat: "\u3068\u304D\u3069\u304D\u7E70\u308A\u8FD4\u3057\u3066\u76EE\u7ACB\u305F\u305B\u308B\uFF085\u5206\u3054\u3068\uFF09",
    expires: "\u306F\u304C\u3059\u6642\u671F",
    expires_none: "\u306F\u304C\u3059\u307E\u3067",
    expires_today: "\u4ECA\u65E5\u4E2D",
    expires_tomorrow: "\u660E\u65E5\u307E\u3067",
    expires_week: "1\u9031\u9593",
    color_yellow: "\u9EC4",
    color_pink: "\u30D4\u30F3\u30AF",
    color_blue: "\u9752",
    color_green: "\u7DD1",
    alignX_start: "\u5DE6",
    alignX_center: "\u4E2D\u592E",
    alignX_end: "\u53F3",
    alignY_top: "\u4E0A",
    alignY_middle: "\u4E2D\u592E",
    alignY_bottom: "\u4E0B",
    bubble_none: "\u306A\u3057",
    bubble_slam: "\u30C9\u30F3",
    bubble_loud: "\u5927\u58F0",
    bubble_gentle: "\u305D\u3063\u3068",
    bubble_ink: "\u898B\u3048\u306A\u3044\u30A4\u30F3\u30AF",
    burst_none: "\u306A\u3057",
    burst_confetti: "\u7D19\u5439\u96EA",
    burst_balloons: "\u98A8\u8239",
    burst_hearts: "\u30CF\u30FC\u30C8",
    inkHint: "\u62BC\u3059\u3068\u8AAD\u3081\u307E\u3059",
    posting: "\u8CBC\u3063\u3066\u3044\u307E\u3059\u2026",
    peel: "\u306F\u304C\u3059",
    peelConfirm: "\u3082\u3046\u4E00\u5EA6\u62BC\u3059\u3068\u306F\u304C\u3057\u307E\u3059",
    board: "\u8CBC\u3063\u3066\u3042\u308B\u4ED8\u7B8B",
    justNow: "\u305F\u3063\u305F\u4ECA",
    minutesAgo: "{n}\u5206\u524D",
    hoursAgo: "{n}\u6642\u9593\u524D",
    daysAgo: "{n}\u65E5\u524D",
    untilToday: "\u4ECA\u65E5\u4E2D",
    untilTomorrow: "\u660E\u65E5\u307E\u3067",
    until: "{date}\u307E\u3067"
  },
  en: {
    title: "Notes",
    count: "{n}",
    add: "Stick a note",
    addShort: "Stick",
    empty: "No notes",
    emptyHint: "Tap + to stick one",
    loadFailed: "Couldn't load the notes",
    requestFailed: "That didn't work ({status})",
    detailTitle: "Sticky notes",
    text: "Message",
    textPlaceholder: "e.g. The cake in the fridge is for tomorrow",
    previewPlaceholder: "Your message shows here",
    preview: "Preview",
    replay: "Play again",
    from: "From (optional)",
    color: "Color",
    alignX: "Horizontal alignment",
    alignY: "Vertical alignment",
    bubble: "Note effect",
    burst: "Effect inside the note",
    repeat: "Repeat now and then to stand out (every 5 min)",
    expires: "Peel off",
    expires_none: "When peeled",
    expires_today: "End of today",
    expires_tomorrow: "End of tomorrow",
    expires_week: "In a week",
    color_yellow: "Yellow",
    color_pink: "Pink",
    color_blue: "Blue",
    color_green: "Green",
    alignX_start: "Left",
    alignX_center: "Center",
    alignX_end: "Right",
    alignY_top: "Top",
    alignY_middle: "Middle",
    alignY_bottom: "Bottom",
    bubble_none: "None",
    bubble_slam: "Slam",
    bubble_loud: "Loud",
    bubble_gentle: "Gentle",
    bubble_ink: "Invisible ink",
    burst_none: "None",
    burst_confetti: "Confetti",
    burst_balloons: "Balloons",
    burst_hearts: "Hearts",
    inkHint: "Tap to read",
    posting: "Sticking\u2026",
    peel: "Peel off",
    peelConfirm: "Tap again to peel off",
    board: "Notes on the board",
    justNow: "Just now",
    minutesAgo: "{n} min ago",
    hoursAgo: "{n} h ago",
    daysAgo: "{n} d ago",
    untilToday: "Until today",
    untilTomorrow: "Until tomorrow",
    until: "Until {date}"
  }
});
async function request(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "sticky-notes", path), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body;
}
var fetchNotes = async (ctx) => (await request(ctx, "/notes")).notes;
var CHANGED_EVENT = "sticky-notes:changed";
var notifyChanged = () => window.dispatchEvent(new Event(CHANGED_EVENT));
function useNotes(ctx, intervalMs) {
  const resource = usePolledResource(() => fetchNotes(ctx), intervalMs);
  const { refresh } = resource;
  useEffect(() => {
    const reload = () => void refresh();
    const socket = ctx.socket;
    const onMessage = (event) => {
      if (String(event.data).includes('"ext:sticky-notes:changed"')) reload();
    };
    socket?.addEventListener("message", onMessage);
    window.addEventListener(CHANGED_EVENT, reload);
    return () => {
      socket?.removeEventListener("message", onMessage);
      window.removeEventListener(CHANGED_EVENT, reload);
    };
  }, [ctx.socket, refresh]);
  return resource;
}
function ago(iso, t) {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 6e4);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}
function useUntilText(t) {
  const date = useDateFormat();
  return (iso) => {
    if (!iso) return null;
    const lastDay = new Date(Date.parse(iso) - 1);
    const today = /* @__PURE__ */ new Date();
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(lastDay, today)) return t("untilToday");
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (sameDay(lastDay, tomorrow)) return t("untilTomorrow");
    return t("until", { date: date(lastDay, "monthDay") });
  };
}
var PAPER = {
  yellow: "sticky-paper-yellow",
  pink: "sticky-paper-pink",
  blue: "sticky-paper-blue",
  green: "sticky-paper-green"
};
var TILT = ["-rotate-1", "rotate-1", "rotate-0"];
var BUBBLE_FX = {
  none: "",
  slam: "z-1 animate-sticky-slam",
  loud: "z-1 animate-sticky-loud",
  gentle: "animate-sticky-gentle",
  ink: ""
};
var BUBBLE_WORDS = {
  none: "",
  slam: "",
  loud: "font-semibold",
  gentle: "animate-sticky-gentle-words",
  ink: ""
};
var ALIGN_X = {
  start: { words: "text-left", meta: "justify-start" },
  center: { words: "text-center", meta: "justify-center" },
  end: { words: "text-right", meta: "justify-end" }
};
var ALIGN_Y = { top: "", middle: "my-auto", bottom: "mt-auto" };
function noteClass(note, index, extra) {
  return cx(
    "sticky-paper relative flex min-h-0 flex-col gap-1 overflow-hidden px-3 pt-3 pb-2 text-left",
    PAPER[note.color],
    TILT[index % 3],
    extra.large && "min-h-32",
    extra.playing && BUBBLE_FX[note.bubble]
  );
}
function NoteBody({
  note,
  text,
  meta,
  inked,
  large,
  playing,
  burst,
  t
}) {
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    burst && /* @__PURE__ */ jsx(NoteBurstLayer, { effect: burst }),
    /* @__PURE__ */ jsx(
      "span",
      {
        className: cx(
          "relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden",
          !large && "mask-b-from-85%",
          inked && "sticky-ink after:animate-sticky-ink motion-reduce:after:animate-none"
        ),
        children: /* @__PURE__ */ jsx(
          "span",
          {
            className: cx(
              "untrim leading-tight whitespace-pre-wrap wrap-anywhere",
              large ? "text-title" : "text-body",
              ALIGN_X[note.alignX].words,
              ALIGN_Y[note.alignY],
              playing && BUBBLE_WORDS[note.bubble]
            ),
            children: text
          }
        )
      }
    ),
    inked && /* @__PURE__ */ jsx("span", { className: "relative z-1 text-micro text-current/60", children: t("inkHint") }),
    meta
  ] });
}
function NoteMeta({ note, t }) {
  const until = useUntilText(t)(note.expiresAt);
  return /* @__PURE__ */ jsxs("span", { className: cx("relative z-1 flex flex-wrap gap-x-2 gap-y-1 text-micro text-current/65", ALIGN_X[note.alignX].meta), children: [
    note.from && /* @__PURE__ */ jsx("span", { className: "font-semibold", children: note.from }),
    /* @__PURE__ */ jsx("span", { children: ago(note.createdAt, t) }),
    until && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-black/8 px-1", children: until })
  ] });
}
function useInkReveal(ms = 1e4) {
  const [revealed, setRevealed] = useState(/* @__PURE__ */ new Set());
  const reveal = (id) => {
    setRevealed((prev) => /* @__PURE__ */ new Set([...prev, id]));
    setTimeout(() => setRevealed((prev) => new Set([...prev].filter((r) => r !== id))), ms);
  };
  return { revealed, reveal };
}
function StickyNotesView({ ctx, config, size, openDetail }) {
  const t = messages.useT();
  const { data, error } = useNotes(ctx, config.pollIntervalMs);
  const { playing, flash } = useBubbleFlash();
  const { revealed, reveal } = useInkReveal();
  useArrivals(data, flash);
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "flex-row-reverse items-stretch justify-start gap-3", label: t("title"), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2", children: [
      /* @__PURE__ */ jsx(IconButton, { icon: "add", label: t("add"), onClick: openDetail }),
      data && data.length > 0 && /* @__PURE__ */ jsx(Badge, { tone: "dim", children: t("count", { n: data.length }) })
    ] }),
    Boolean(error) && !data && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("loadFailed") }),
    data && data.length === 0 && /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "press flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-inner border border-dashed border-glass-border text-muted",
        onClick: openDetail,
        children: [
          t("empty"),
          /* @__PURE__ */ jsx("span", { className: "text-caption", children: t("emptyHint") })
        ]
      }
    ),
    data && data.length > 0 && // 高さ 1 段につき付箋 1 列。はみ出した分は横にめくって見る
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "sticky-columns grid min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-1",
        style: { gridTemplateRows: `repeat(${Math.max(1, size.h)}, minmax(0, 1fr))` },
        children: data.map((note, i) => {
          const inked = note.bubble === "ink" && !revealed.has(note.id);
          return /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cx(noteClass(note, i, { playing: playing.has(note.id) }), "press cursor-pointer"),
              onClick: inked ? () => reveal(note.id) : openDetail,
              children: /* @__PURE__ */ jsx(
                NoteBody,
                {
                  note,
                  text: note.text,
                  inked,
                  playing: playing.has(note.id),
                  burst: playing.has(note.id) ? note.burst : void 0,
                  t,
                  meta: /* @__PURE__ */ jsx(NoteMeta, { note, t })
                }
              )
            },
            note.id
          );
        })
      }
    )
  ] });
}
var FROM_KEY = "sticky-notes:from";
function rememberedFrom() {
  try {
    return localStorage.getItem(FROM_KEY) ?? "";
  } catch {
    return "";
  }
}
function Choices({
  label,
  values,
  value,
  onChange,
  text
}) {
  return /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", role: "radiogroup", "aria-label": label, children: values.map((v) => (
    // 1 つだけ選ぶので、押す・押さないの aria-pressed ではなく radio として読ませる
    /* @__PURE__ */ jsx(
      Chip,
      {
        role: "radio",
        "aria-checked": value === v,
        "aria-pressed": void 0,
        selected: value === v,
        onClick: () => onChange(v),
        children: text(v)
      },
      v
    )
  )) });
}
var PREVIEW_ID = "preview";
function NoteForm({ ctx, t }) {
  const [text, setText] = useState("");
  const [from, setFrom] = useState(rememberedFrom);
  const [color, setColor] = useState("yellow");
  const [alignX, setAlignX] = useState("start");
  const [alignY, setAlignY] = useState("top");
  const [bubble, setBubble] = useState("none");
  const [burst, setBurst] = useState("none");
  const [repeat, setRepeat] = useState(false);
  const [expires, setExpires] = useState("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { playing, flash } = useBubbleFlash();
  const [inkRevealed, setInkRevealed] = useState(false);
  const chooseBubble = (value) => {
    setBubble(value);
    setInkRevealed(false);
    if (hasMotion({ bubble: value, burst })) flash([PREVIEW_ID]);
  };
  const chooseBurst = (value) => {
    setBurst(value);
    if (hasMotion({ bubble, burst: value })) flash([PREVIEW_ID]);
  };
  const replay = () => {
    setInkRevealed(false);
    if (hasMotion({ bubble, burst })) flash([PREVIEW_ID]);
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request(ctx, "/notes", {
        method: "POST",
        json: { text, from, color, alignX, alignY, bubble, burst, repeat: repeat && hasMotion({ bubble, burst }), expires }
      });
      try {
        localStorage.setItem(FROM_KEY, from.trim());
      } catch {
      }
      setText("");
      notifyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const preview = { color, alignX, alignY, bubble, burst };
  const inked = bubble === "ink" && !inkRevealed;
  return /* @__PURE__ */ jsxs("form", { className: "mb-6 flex flex-col gap-4", onSubmit: (e) => void submit(e), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex gap-6 phone:flex-col", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-3", children: [
        /* @__PURE__ */ jsx(Field, { label: t("text"), children: /* @__PURE__ */ jsx(
          "textarea",
          {
            className: "resize-y",
            rows: 3,
            value: text,
            maxLength: MAX_TEXT,
            placeholder: t("textPlaceholder"),
            autoFocus: true,
            onChange: (e) => setText(e.target.value)
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 phone:grid-cols-1", children: [
          /* @__PURE__ */ jsx(Field, { label: t("from"), children: /* @__PURE__ */ jsx("input", { value: from, maxLength: MAX_FROM, onChange: (e) => setFrom(e.target.value) }) }),
          /* @__PURE__ */ jsx(Field, { label: t("expires"), children: /* @__PURE__ */ jsx("select", { value: expires, onChange: (e) => setExpires(e.target.value), children: NOTE_EXPIRES.map((value) => /* @__PURE__ */ jsx("option", { value, children: t(`expires_${value}`) }, value)) }) })
        ] }),
        /* @__PURE__ */ jsx(Field, { label: t("color"), children: /* @__PURE__ */ jsx("div", { className: "flex gap-3", role: "radiogroup", "aria-label": t("color"), children: NOTE_COLORS.map((value) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": color === value,
            "aria-label": t(`color_${value}`),
            className: cx(
              "press size-10 cursor-pointer rounded-art border-2 border-transparent bg-(--sticky-paper)",
              "aria-checked:border-text aria-checked:ring-2 aria-checked:ring-shade/50",
              PAPER[value]
            ),
            onClick: () => setColor(value)
          },
          value
        )) }) }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 phone:grid-cols-1", children: [
          /* @__PURE__ */ jsx(Field, { label: t("alignX"), children: /* @__PURE__ */ jsx(Choices, { label: t("alignX"), values: NOTE_ALIGN_X, value: alignX, onChange: setAlignX, text: (v) => t(`alignX_${v}`) }) }),
          /* @__PURE__ */ jsx(Field, { label: t("alignY"), children: /* @__PURE__ */ jsx(Choices, { label: t("alignY"), values: NOTE_ALIGN_Y, value: alignY, onChange: setAlignY, text: (v) => t(`alignY_${v}`) }) })
        ] }),
        /* @__PURE__ */ jsx(Field, { label: t("bubble"), children: /* @__PURE__ */ jsx(Choices, { label: t("bubble"), values: NOTE_BUBBLES, value: bubble, onChange: chooseBubble, text: (v) => t(`bubble_${v}`) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("burst"), children: /* @__PURE__ */ jsx(Choices, { label: t("burst"), values: NOTE_BURSTS, value: burst, onChange: chooseBurst, text: (v) => t(`burst_${v}`) }) }),
        /* @__PURE__ */ jsx(Check, { checked: repeat, disabled: !hasMotion({ bubble, burst }), onChange: setRepeat, children: t("repeat") })
      ] }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "sticky top-0 flex w-52 shrink-0 flex-col gap-3 self-start phone:static phone:w-auto phone:self-stretch",
          "aria-label": t("preview"),
          children: [
            /* @__PURE__ */ jsx("span", { className: "text-note text-muted", children: t("preview") }),
            /* @__PURE__ */ jsx(
              "div",
              {
                className: cx(noteClass(preview, 0, { large: true, playing: playing.has(PREVIEW_ID) }), "h-44"),
                onClick: inked ? () => setInkRevealed(true) : void 0,
                children: /* @__PURE__ */ jsx(
                  NoteBody,
                  {
                    note: preview,
                    text: text.trim() || t("previewPlaceholder"),
                    inked,
                    large: true,
                    playing: playing.has(PREVIEW_ID),
                    burst: playing.has(PREVIEW_ID) ? burst : void 0,
                    t
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(Button, { icon: "arrow-sync", onClick: replay, disabled: !hasMotion({ bubble, burst }), children: t("replay") })
          ]
        }
      )
    ] }),
    error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
    /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", icon: "add", disabled: busy || !text.trim(), children: busy ? t("posting") : t("addShort") }) })
  ] });
}
function StickyNotesDetail({ ctx, config }) {
  const t = messages.useT();
  const { data } = useNotes(ctx, config.pollIntervalMs);
  const { playing, flash } = useBubbleFlash();
  const { revealed, reveal } = useInkReveal();
  const [armed, setArmed] = useState(null);
  const [error, setError] = useState(null);
  const peel = async (id) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    setError(null);
    try {
      await request(ctx, `/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    notifyChanged();
  };
  const replay = (note) => {
    if (note.bubble === "ink" && !revealed.has(note.id)) return reveal(note.id);
    if (hasMotion(note)) flash([note.id]);
  };
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("detailTitle"), className: "w-208 max-w-full phone:w-auto", children: [
    /* @__PURE__ */ jsx(NoteForm, { ctx, t }),
    error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
    data && data.length > 0 && /* @__PURE__ */ jsx("section", { className: "sticky-board gap-4", "aria-label": t("board"), children: data.map((note, i) => {
      const inked = note.bubble === "ink" && !revealed.has(note.id);
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: cx(noteClass(note, i, { large: true, playing: playing.has(note.id) }), "cursor-pointer"),
          onClick: () => replay(note),
          children: [
            /* @__PURE__ */ jsx(
              NoteBody,
              {
                note,
                text: note.text,
                inked,
                large: true,
                playing: playing.has(note.id),
                burst: playing.has(note.id) ? note.burst : void 0,
                t,
                meta: /* @__PURE__ */ jsx(NoteMeta, { note, t })
              }
            ),
            /* @__PURE__ */ jsx(
              Button,
              {
                variant: armed === note.id ? "danger" : "default",
                className: "relative z-1 self-end",
                onClick: (e) => {
                  e.stopPropagation();
                  void peel(note.id);
                },
                children: armed === note.id ? t("peelConfirm") : t("peel")
              }
            )
          ]
        },
        note.id
      );
    }) })
  ] });
}
var widget_default = defineWidget({
  id: "sticky-notes",
  name: { ja: "\u4ED8\u7B8B\uFF08\u4F1D\u8A00\uFF09", en: "Sticky notes" },
  description: {
    ja: "\u5BB6\u306B\u3044\u308B\u4EBA\u3078\u306E\u4F1D\u8A00\u3092\u4ED8\u7B8B\u3067\u8CBC\u308A\u307E\u3059\u3002\u6587\u5B57\u306E\u63C3\u3048\u3084\u3001iMessage \u306E\u3088\u3046\u306A\u52B9\u679C\u3092\u4ED8\u3051\u3089\u308C\u307E\u3059",
    en: "Leave notes for whoever is at home, with text alignment and iMessage-style effects"
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  // ふだんは WebSocket の知らせで読み直す。これは知らせを取りこぼしたときの保険
  defaultConfig: { pollIntervalMs: 60 * 1e3 },
  Component: StickyNotesView,
  DetailComponent: StickyNotesDetail
});

// extensions/sticky-notes/src/web.tsx
var web_default = defineWebExtension({ widgets: [widget_default] });
export {
  web_default as default
};
