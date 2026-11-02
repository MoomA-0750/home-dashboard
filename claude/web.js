// host-module:@home-dashboard/widget-sdk
var m = globalThis.__homeDashboard?.modules?.["@home-dashboard/widget-sdk"];
if (!m) throw new Error("\u672C\u4F53\u306E @home-dashboard/widget-sdk \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var widget_sdk_default = m.default ?? m;
var { Avatar, AvatarStack, BackButton, Badge, Button, ButtonLink, ButtonRow, ChatAttachments, ChatBubble, ChatComposer, ChatFile, ChatFileChips, ChatFrom, ChatHeader, ChatIconButton, ChatImage, ChatLayout, ChatLog, ChatMeta, ChatPending, ChatRow, Check, Chip, CodeBlock, DEFAULT_DISPLAY, DetailFrame, Dialog, DisplayContext, FeatureProvidersContext, Field, Group, Icon, IconButton, LOCALES, List, ListIcon, ListItem, ListNoChevron, LocaleContext, Message, NarrowOnly, Note, Notice, PillMenu, PollingActiveContext, ProgressBar, ScreenFrame, ScreenNotice, ScreenSection, SectionTitle, SideLayout, Slider, StatGrid, StatTile, StatusDot, ToggleSwitch, WidgetCard, WidgetHint, WidgetRegistry, buttonClass, convertReading, convertTemperature, cx, defineMessages, defineWebExtension, defineWidget, extensionApiUrl, formatClock, formatDate, formatPastDay, formatTemperature, formatTime, getDisplay, getLocale, inputClass, intlLocale, motionMs, normalizeDisplay, openSettings, reducedMotion, scrollBehavior, setCurrentDisplay, setCurrentLocale, showSnackbar, startOfWeek, temperatureUnit, textFor, useClosing, useDateFormat, useDisplay, useFeatureProviders, useLocale, usePolledResource, usePolling, usePresence, useSettingsLinks, useSnackbars, useTemperature, useTimeFormat, weatherConditionText, weatherIcon, widgetRegistry } = m;

// host-module:react/jsx-runtime
var m2 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m2) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m2.default ?? m2;
var { Fragment, jsx, jsxs } = m2;

// extensions/claude/src/usage-widget.tsx
var messages = defineMessages({
  ja: {
    apiError: "claude usage API error: {status}",
    ended: "\u7D42\u4E86",
    hoursMinutes: "{h}\u6642\u9593{m}\u5206",
    minutes: "{m}\u5206",
    aggregating: "\u96C6\u8A08\u4E2D\u2026",
    notFound: "Claude Code\u672A\u691C\u51FA",
    todayLabel: "Claude Code \u4ECA\u65E5",
    blockRemaining: "5h\u30D6\u30ED\u30C3\u30AF \u6B8B\u308A{remaining} \xB7 {tokens}",
    noActiveBlock: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30D6\u30ED\u30C3\u30AF\u306A\u3057",
    input: "\u5165\u529B",
    output: "\u51FA\u529B",
    cacheWrite: "\u30AD\u30E3\u30C3\u30B7\u30E5\u66F8\u304D\u8FBC\u307F",
    cacheRead: "\u30AD\u30E3\u30C3\u30B7\u30E5\u8AAD\u307F\u51FA\u3057",
    total: "\u5408\u8A08",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    title: "Claude Code \u4F7F\u7528\u91CF",
    today: "\u4ECA\u65E5\uFF08{date}\uFF09",
    currentBlock: "\u73FE\u5728\u306E5\u6642\u9593\u30D6\u30ED\u30C3\u30AF\uFF08{start}\u301C{end}\uFF09",
    blockSummary: "\u6B8B\u308A {remaining} \xB7 {messages} \u30E1\u30C3\u30BB\u30FC\u30B8 \xB7 {tokens} \u30C8\u30FC\u30AF\u30F3",
    byProject: "\u4ECA\u65E5\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u5225",
    daily: "\u65E5\u5225\u63A8\u79FB",
    noCost: "\u6599\u91D1\u306F\u8868\u793A\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u30E2\u30C7\u30EB\u5358\u4FA1\u3092\u3053\u3061\u3089\u3067\u6301\u3064\u3068\u5B9F\u969B\u306E\u8ACB\u6C42\u3068\u4E56\u96E2\u3057\u305F\u6570\u5B57\u3092\u51FA\u3059\u3053\u3068\u306B\u306A\u308B\u305F\u3081\u3067\u3059\u3002"
  },
  en: {
    apiError: "claude usage API error: {status}",
    ended: "ended",
    hoursMinutes: "{h}h {m}m",
    minutes: "{m}m",
    aggregating: "Counting\u2026",
    notFound: "Claude Code not found",
    todayLabel: "Claude Code today",
    blockRemaining: "5h block {remaining} left \xB7 {tokens}",
    noActiveBlock: "No active block",
    input: "Input",
    output: "Output",
    cacheWrite: "Cache writes",
    cacheRead: "Cache reads",
    total: "Total",
    loading: "Loading\u2026",
    title: "Claude Code usage",
    today: "Today ({date})",
    currentBlock: "Current 5-hour block ({start}\u2013{end})",
    blockSummary: (p) => `${p.remaining} left \xB7 ${p.messages} ${p.messages === 1 ? "message" : "messages"} \xB7 ${p.tokens} tokens`,
    byProject: "Today by project",
    daily: "Daily trend",
    noCost: "Costs aren't shown: keeping model prices here would produce numbers that drift from your actual bill."
  }
});
async function fetchUsage(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/claude/usage`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}
function formatTokens(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(value);
}
function formatDuration(ms, t) {
  if (ms <= 0) return t("ended");
  const hours = Math.floor(ms / (60 * 60 * 1e3));
  const minutes = Math.floor(ms % (60 * 60 * 1e3) / (60 * 1e3));
  return hours > 0 ? t("hoursMinutes", { h: hours, m: minutes }) : t("minutes", { m: minutes });
}
function formatTime2(iso, locale) {
  const d = new Date(iso);
  if (locale !== "ja") return formatClock(d, locale);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function ClaudeUsageView({ ctx, config, openDetail }) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchUsage(ctx.apiBaseUrl), config.pollIntervalMs);
  if (loading && !data) {
    return /* @__PURE__ */ jsx(WidgetCard, { children: t("aggregating") });
  }
  if (data && !data.configured) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      t("notFound"),
      /* @__PURE__ */ jsx(WidgetHint, { children: data.reason })
    ] });
  }
  const today = data?.today;
  const block = data?.block;
  const blockProgress = block ? Math.min(1, 1 - block.remainingMs / (5 * 60 * 60 * 1e3)) : 0;
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "items-stretch justify-start gap-1 tabular-nums", onClick: openDetail, children: [
    /* @__PURE__ */ jsx("span", { className: "text-caption font-medium text-muted", children: t("todayLabel") }),
    /* @__PURE__ */ jsx("span", { className: "text-stat font-semibold leading-none", children: formatTokens(today?.tokens.total ?? 0) }),
    /* @__PURE__ */ jsxs("span", { className: "text-caption font-medium text-muted", children: [
      today?.messages ?? 0,
      " msg / ",
      today?.sessions ?? 0,
      " session"
    ] }),
    block ? /* @__PURE__ */ jsxs("div", { className: "mt-auto flex flex-col gap-1", children: [
      /* @__PURE__ */ jsx(ProgressBar, { value: blockProgress }),
      /* @__PURE__ */ jsx("span", { className: "text-caption font-medium text-muted", children: t("blockRemaining", {
        remaining: formatDuration(block.remainingMs, t),
        tokens: formatTokens(block.tokens.total)
      }) })
    ] }) : /* @__PURE__ */ jsx("span", { className: "text-caption font-medium text-muted", children: t("noActiveBlock") })
  ] });
}
var rowsClass = "flex flex-col gap-1 text-label tabular-nums [&>li]:flex [&>li]:justify-between [&>li]:gap-6";
function TokenBreakdown({ tokens }) {
  const t = messages.useT();
  return /* @__PURE__ */ jsxs("ul", { className: rowsClass, children: [
    /* @__PURE__ */ jsxs("li", { children: [
      /* @__PURE__ */ jsx("span", { children: t("input") }),
      /* @__PURE__ */ jsx("span", { children: tokens.input.toLocaleString() })
    ] }),
    /* @__PURE__ */ jsxs("li", { children: [
      /* @__PURE__ */ jsx("span", { children: t("output") }),
      /* @__PURE__ */ jsx("span", { children: tokens.output.toLocaleString() })
    ] }),
    /* @__PURE__ */ jsxs("li", { children: [
      /* @__PURE__ */ jsx("span", { children: t("cacheWrite") }),
      /* @__PURE__ */ jsx("span", { children: tokens.cacheCreate.toLocaleString() })
    ] }),
    /* @__PURE__ */ jsxs("li", { children: [
      /* @__PURE__ */ jsx("span", { children: t("cacheRead") }),
      /* @__PURE__ */ jsx("span", { children: tokens.cacheRead.toLocaleString() })
    ] }),
    /* @__PURE__ */ jsxs("li", { className: "mt-1 border-t border-glass-border pt-1.5 font-semibold", children: [
      /* @__PURE__ */ jsx("span", { children: t("total") }),
      /* @__PURE__ */ jsx("span", { children: tokens.total.toLocaleString() })
    ] })
  ] });
}
function ClaudeUsageDetail({ ctx, config }) {
  const t = messages.useT();
  const locale = useLocale();
  const { data } = usePolling(() => fetchUsage(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return /* @__PURE__ */ jsx(DetailFrame, { children: t("loading") });
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.total));
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("title"), className: "flex flex-col gap-5", children: [
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("today", { date: data.today.date }) }),
      /* @__PURE__ */ jsx(TokenBreakdown, { tokens: data.today.tokens }),
      /* @__PURE__ */ jsx("ul", { className: rowsClass, children: data.today.byModel.map((m3) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted", children: m3.model }),
        /* @__PURE__ */ jsx("span", { children: formatTokens(m3.total) })
      ] }, m3.model)) })
    ] }),
    data.block && /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("currentBlock", {
        start: formatTime2(data.block.startsAt, locale),
        end: formatTime2(data.block.endsAt, locale)
      }) }),
      /* @__PURE__ */ jsx(Note, { children: t("blockSummary", {
        remaining: formatDuration(data.block.remainingMs, t),
        messages: data.block.messages,
        tokens: formatTokens(data.block.tokens.total)
      }) })
    ] }),
    data.projects.length > 0 && /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("byProject") }),
      /* @__PURE__ */ jsx("ul", { className: rowsClass, children: data.projects.map((p) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted", children: p.name }),
        /* @__PURE__ */ jsx("span", { children: formatTokens(p.total) })
      ] }, p.name)) })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("daily") }),
      /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-1 text-note tabular-nums", children: data.daily.map((d) => /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "w-12 shrink-0 text-muted", children: d.date.slice(5) }),
        /* @__PURE__ */ jsx(ProgressBar, { value: d.total / maxDaily, className: "flex-1 [--progress-color:rgb(var(--accent-soft-rgb))]" }),
        /* @__PURE__ */ jsx("span", { className: "w-14 shrink-0 text-right text-muted", children: formatTokens(d.total) })
      ] }, d.date)) })
    ] }),
    /* @__PURE__ */ jsx(Note, { children: t("noCost") })
  ] });
}
var usage_widget_default = defineWidget({
  id: "claude-usage",
  name: { ja: "Claude Code\u4F7F\u7528\u91CF", en: "Claude Code usage" },
  description: {
    ja: "\u4ECA\u65E5\u306E\u30C8\u30FC\u30AF\u30F3\u4F7F\u7528\u91CF\u3068\u3001\u30EC\u30FC\u30C8\u5236\u9650\u306E\u5358\u4F4D\u3067\u3042\u308B5\u6642\u9593\u30D6\u30ED\u30C3\u30AF\u306E\u6D88\u8CBB\u72B6\u6CC1\u3092\u8868\u793A\u3057\u307E\u3059",
    en: "Shows today's token usage and how much of the 5-hour block (the rate-limit unit) is used"
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 60 * 1e3 },
  Component: ClaudeUsageView,
  DetailComponent: ClaudeUsageDetail
});

// extensions/claude/src/limits-widget.tsx
var messages2 = defineMessages({
  ja: {
    apiError: "claude limits API error: {status}",
    daysHours: "{d}\u65E5{h}\u6642\u9593",
    hoursMinutes: "{h}\u6642\u9593{m}\u5206",
    minutes: "{m}\u5206",
    minutesAgo: "{n}\u5206\u524D",
    hoursAgo: "{n}\u6642\u9593\u524D",
    daysAgo: "{n}\u65E5\u524D",
    usageOf: "{label}\u306E\u4F7F\u7528\u7387",
    resetDone: "\u30EA\u30BB\u30C3\u30C8\u6E08\u307F\uFF08\u6B21\u306E\u5024\u306F\u307E\u3060\u5C4A\u3044\u3066\u3044\u307E\u305B\u3093\uFF09",
    remaining: "\u3042\u3068{remaining} \xB7 {reset}\u306B\u623B\u308B",
    resetUnknown: "\u623B\u308B\u6642\u523B\u306F\u4E0D\u660E",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    title: "Claude \u306E\u5229\u7528\u5236\u9650",
    unreachable: "\u30B5\u30FC\u30D0\u30FC\u306B\u5C4A\u304D\u307E\u305B\u3093",
    noValues: "\u307E\u3060\u5024\u304C\u5C4A\u3044\u3066\u3044\u307E\u305B\u3093\u3002statusline.sh \u304B\u3089 scripts/claude-limits-report.sh \u3092\u547C\u3076\u3068\u51FA\u307E\u3059",
    staleValue: "{ago}\u306E\u5024"
  },
  en: {
    apiError: "claude limits API error: {status}",
    daysHours: "{d}d {h}h",
    hoursMinutes: "{h}h {m}m",
    minutes: "{m}m",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    usageOf: "{label} usage",
    resetDone: "Reset (no new value yet)",
    remaining: "{remaining} left \xB7 resets {reset}",
    resetUnknown: "Reset time unknown",
    loading: "Loading\u2026",
    title: "Claude usage limits",
    unreachable: "Can't reach the server",
    noValues: "No values yet. Call scripts/claude-limits-report.sh from statusline.sh to show them",
    staleValue: "As of {ago}"
  }
});
var KIND_LABELS = {
  five_hour: { ja: "5\u6642\u9593", en: "5-hour" },
  seven_day: { ja: "\u9031", en: "Weekly" },
  seven_day_opus: { ja: "\u9031\uFF08Opus\uFF09", en: "Weekly (Opus)" },
  seven_day_sonnet: { ja: "\u9031\uFF08Sonnet\uFF09", en: "Weekly (Sonnet)" }
};
var KIND_ORDER = Object.keys(KIND_LABELS);
var STALE_AFTER_MS = 15 * 60 * 1e3;
async function fetchLimits(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/claude/limits`);
  if (!res.ok) throw new Error(messages2.t("apiError", { status: res.status }));
  return res.json();
}
function formatRemaining(ms, t) {
  const totalMinutes = Math.max(0, Math.round(ms / 6e4));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor(totalMinutes % (24 * 60) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t("daysHours", { d: days, h: hours });
  if (hours > 0) return t("hoursMinutes", { h: hours, m: minutes });
  return t("minutes", { m: minutes });
}
function formatResetTime(date, now, locale) {
  const time = formatClock(date, locale);
  if (date.toDateString() === now.toDateString()) return time;
  return `${formatDate(date, "monthDayWeekday", locale)} ${time}`;
}
function formatAgo(ms, t) {
  const minutes = Math.round(ms / 6e4);
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.round(hours / 24) });
}
var LEVEL_COLOR = {
  ok: "[--limit-color:var(--accent-ok)]",
  warm: "[--limit-color:var(--accent-warn)]",
  hot: "[--limit-color:var(--danger-strong)]"
};
function level(percent) {
  if (percent >= 90) return "hot";
  if (percent >= 75) return "warm";
  return "ok";
}
function LimitRow({ window, now }) {
  const t = messages2.useT();
  const locale = useLocale();
  const resetsAt = window.resetsAt ? new Date(window.resetsAt) : null;
  const reset = resetsAt !== null && resetsAt.getTime() <= now.getTime();
  const percent = reset ? 0 : Math.round(window.usedPercent);
  const known = KIND_LABELS[window.kind];
  const label = known ? textFor(known, locale) : window.kind;
  const tone = reset ? "ok" : level(window.usedPercent);
  return /* @__PURE__ */ jsxs("div", { className: cx("flex min-w-0 flex-col justify-end gap-1.5", LEVEL_COLOR[tone]), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "text-small font-semibold", children: label }),
      /* @__PURE__ */ jsxs("span", { className: "text-stat leading-none font-semibold text-(--limit-color)", children: [
        reset ? "\u2014" : percent,
        !reset && /* @__PURE__ */ jsx("small", { className: "ml-0.5 text-small font-normal", children: "%" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(ProgressBar, { value: percent / 100, label: t("usageOf", { label }), className: "[--progress-color:var(--limit-color)]" }),
    /* @__PURE__ */ jsx("span", { className: "ellipsis text-micro text-muted", children: reset ? t("resetDone") : resetsAt ? t("remaining", {
      remaining: formatRemaining(resetsAt.getTime() - now.getTime(), t),
      reset: formatResetTime(resetsAt, now, locale)
    }) : t("resetUnknown") })
  ] });
}
function ClaudeLimitsView({ ctx, config }) {
  const t = messages2.useT();
  const { data, loading, error } = usePolling(() => fetchLimits(ctx.apiBaseUrl), config.pollIntervalMs);
  const now = ctx.now;
  if (loading && !data) {
    return /* @__PURE__ */ jsx(WidgetCard, { children: t("loading") });
  }
  if (!data || data.windows.length === 0) {
    return /* @__PURE__ */ jsxs(WidgetCard, { className: "items-stretch gap-2.5", children: [
      /* @__PURE__ */ jsx("span", { className: "text-note font-medium text-muted", children: t("title") }),
      /* @__PURE__ */ jsx("span", { className: "text-micro leading-normal text-muted untrim", children: error ? t("unreachable") : t("noValues") })
    ] });
  }
  const windows = [...data.windows].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a.kind);
    const bi = KIND_ORDER.indexOf(b.kind);
    return (ai < 0 ? KIND_ORDER.length : ai) - (bi < 0 ? KIND_ORDER.length : bi);
  });
  const latest = Math.max(...windows.map((w) => Date.parse(w.observedAt)));
  const staleMs = now.getTime() - latest;
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "items-stretch justify-start gap-2.5 tabular-nums", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-4", children: [
      /* @__PURE__ */ jsx("span", { className: "text-note font-medium text-muted", children: t("title") }),
      staleMs > STALE_AFTER_MS && /* @__PURE__ */ jsx(Badge, { tone: "warn", children: t("staleValue", { ago: formatAgo(staleMs, t) }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "grid flex-1 grid-cols-2 gap-6", children: windows.slice(0, 2).map((window) => /* @__PURE__ */ jsx(LimitRow, { window, now }, window.kind)) })
  ] });
}
var limits_widget_default = defineWidget({
  id: "claude-limits",
  name: { ja: "Claude \u5229\u7528\u5236\u9650", en: "Claude usage limits" },
  description: {
    ja: "Claude \u306E5\u6642\u9593\u306E\u67A0\u3068\u9031\u306E\u67A0\u3092\u3069\u308C\u3060\u3051\u4F7F\u3063\u305F\u304B\u3001\u3044\u3064\u623B\u308B\u304B\u3092\u8868\u793A\u3057\u307E\u3059\uFF08Claude Code \u306E statusLine \u304B\u3089\u53D7\u3051\u53D6\u308A\u307E\u3059\uFF09",
    en: "Shows how much of Claude's 5-hour and weekly limits you've used and when they reset (received from Claude Code's statusLine)"
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1e3 },
  Component: ClaudeLimitsView
});

// extensions/claude/src/web.tsx
var web_default = defineWebExtension({ widgets: [usage_widget_default, limits_widget_default] });
export {
  web_default as default
};
