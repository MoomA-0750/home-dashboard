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

// extensions/git-repos/src/widget.tsx
var messages = defineMessages({
  ja: {
    apiError: "git repos API error: {status}",
    justNow: "\u305F\u3063\u305F\u4ECA",
    hoursAgo: "{n}\u6642\u9593\u524D",
    daysAgo: "{n}\u65E5\u524D",
    monthsAgo: "{n}\u30F6\u6708\u524D",
    checking: "\u78BA\u8A8D\u4E2D\u2026",
    noRepos: "\u30EA\u30DD\u30B8\u30C8\u30EA\u672A\u691C\u51FA",
    summary: "\u672A\u30B3\u30DF\u30C3\u30C8{dirty} / \u672Apush{unpushed}",
    more: "\u307B\u304B{n}\u4EF6",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    title: "git\u30EA\u30DD\u30B8\u30C8\u30EA",
    noUpstream: "upstream\u306A\u3057",
    changes: "staged {staged} / \u5909\u66F4 {unstaged} / \u672A\u8FFD\u8DE1 {untracked}"
  },
  en: {
    apiError: "git repos API error: {status}",
    justNow: "Just now",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    monthsAgo: (p) => p.n === 1 ? "1 month ago" : `${p.n} months ago`,
    checking: "Checking\u2026",
    noRepos: "No repositories found",
    summary: "Uncommitted {dirty} / Unpushed {unpushed}",
    more: "+{n} more",
    loading: "Loading\u2026",
    title: "Git repositories",
    noUpstream: "No upstream",
    changes: "staged {staged} / modified {unstaged} / untracked {untracked}"
  }
});
async function fetchRepos(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/git-repos/repos`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}
function changeCount(repo) {
  return repo.staged + repo.unstaged + repo.untracked;
}
function sortByAttention(repos) {
  return [...repos].sort((a, b) => {
    if (a.dirty !== b.dirty) return a.dirty ? -1 : 1;
    if (a.ahead > 0 !== b.ahead > 0) return a.ahead > 0 ? -1 : 1;
    const aDate = a.lastCommit?.date ?? "";
    const bDate = b.lastCommit?.date ?? "";
    return aDate < bDate ? 1 : -1;
  });
}
function relativeDate(iso, t) {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  const hours = Math.floor(diffMs / (60 * 60 * 1e3));
  if (hours < 1) return t("justNow");
  if (hours < 24) return t("hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("daysAgo", { n: days });
  return t("monthsAgo", { n: Math.floor(days / 30) });
}
function DirtyMark({ dirty }) {
  return /* @__PURE__ */ jsx("span", { className: dirty ? "text-warn" : "text-muted", children: dirty ? "\u25CF" : "\u25CB" });
}
function RepoRow({ repo }) {
  const changes = changeCount(repo);
  return /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-1.5 text-note", children: [
    /* @__PURE__ */ jsx(DirtyMark, { dirty: repo.dirty }),
    /* @__PURE__ */ jsx("span", { className: "ellipsis min-w-0 flex-1", children: repo.name }),
    /* @__PURE__ */ jsx("span", { className: "text-micro text-muted", children: repo.branch }),
    /* @__PURE__ */ jsxs("span", { className: "flex gap-1", children: [
      changes > 0 && /* @__PURE__ */ jsx(Badge, { tone: "warn", children: changes }),
      repo.ahead > 0 && /* @__PURE__ */ jsxs(Badge, { children: [
        "\u2191",
        repo.ahead
      ] }),
      repo.behind > 0 && /* @__PURE__ */ jsxs(Badge, { children: [
        "\u2193",
        repo.behind
      ] })
    ] })
  ] });
}
function GitReposView({ ctx, config, openDetail }) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchRepos(ctx.apiBaseUrl), config.pollIntervalMs);
  if (loading && !data) return /* @__PURE__ */ jsx(WidgetCard, { children: t("checking") });
  if (data && !data.configured) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      t("noRepos"),
      /* @__PURE__ */ jsx(WidgetHint, { children: data.reason })
    ] });
  }
  const sorted = sortByAttention(data?.repos ?? []);
  const visible = sorted.slice(0, config.compactLimit);
  const hidden = sorted.length - visible.length;
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "items-stretch justify-start gap-1.5", onClick: openDetail, children: [
    /* @__PURE__ */ jsxs("span", { className: "flex items-baseline justify-between gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "text-note text-muted", children: "git" }),
      /* @__PURE__ */ jsx("span", { className: "text-caption text-muted tabular-nums", children: t("summary", { dirty: data?.dirtyCount ?? 0, unpushed: data?.unpushedCount ?? 0 }) })
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-1", children: visible.map((repo) => /* @__PURE__ */ jsx(RepoRow, { repo }, repo.path)) }),
    hidden > 0 && /* @__PURE__ */ jsx("span", { className: "text-micro text-muted", children: t("more", { n: hidden }) })
  ] });
}
function GitReposDetail({ ctx, config }) {
  const t = messages.useT();
  const { data } = usePolling(() => fetchRepos(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return /* @__PURE__ */ jsx(DetailFrame, { children: t("loading") });
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("title"), children: [
    /* @__PURE__ */ jsx(Note, { children: data.root }),
    /* @__PURE__ */ jsx("ul", { className: "mt-3 flex flex-col gap-3", children: sortByAttention(data.repos).map((repo) => /* @__PURE__ */ jsxs("li", { className: "flex flex-col gap-1.5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-baseline gap-2", children: [
        /* @__PURE__ */ jsx(DirtyMark, { dirty: repo.dirty }),
        /* @__PURE__ */ jsx("span", { className: "font-semibold", children: repo.name }),
        /* @__PURE__ */ jsx("span", { className: "text-micro text-muted", children: repo.branch }),
        repo.upstream ? /* @__PURE__ */ jsxs("span", { className: "flex gap-1", children: [
          repo.ahead > 0 && /* @__PURE__ */ jsxs(Badge, { children: [
            "\u2191",
            repo.ahead
          ] }),
          repo.behind > 0 && /* @__PURE__ */ jsxs(Badge, { children: [
            "\u2193",
            repo.behind
          ] })
        ] }) : /* @__PURE__ */ jsx(Badge, { tone: "dim", children: t("noUpstream") })
      ] }),
      repo.error ? /* @__PURE__ */ jsx("div", { className: "pl-5 text-note text-warn", children: repo.error }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1 pl-5 text-note text-muted", children: [
        repo.dirty && /* @__PURE__ */ jsx("span", { children: t("changes", { staged: repo.staged, unstaged: repo.unstaged, untracked: repo.untracked }) }),
        repo.lastCommit && /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("code", { children: repo.lastCommit.hash }),
          " ",
          repo.lastCommit.subject,
          /* @__PURE__ */ jsx("span", { className: "ml-2", children: relativeDate(repo.lastCommit.date, t) })
        ] })
      ] })
    ] }, repo.path)) })
  ] });
}
var widget_default = defineWidget({
  id: "git-repos",
  name: { ja: "git\u30EA\u30DD\u30B8\u30C8\u30EA", en: "Git repositories" },
  description: {
    ja: "\u30ED\u30FC\u30AB\u30EB\u306E\u30EA\u30DD\u30B8\u30C8\u30EA\u306E\u30D6\u30E9\u30F3\u30C1\u30FB\u672A\u30B3\u30DF\u30C3\u30C8\u5909\u66F4\u30FB\u672Apush\u30B3\u30DF\u30C3\u30C8\u3092\u8868\u793A\u3057\u307E\u3059",
    en: "Shows branches, uncommitted changes and unpushed commits of local repositories"
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 60 * 1e3, compactLimit: 4 },
  Component: GitReposView,
  DetailComponent: GitReposDetail
});

// extensions/git-repos/src/web.tsx
var web_default = defineWebExtension({ widgets: [widget_default] });
export {
  web_default as default
};
