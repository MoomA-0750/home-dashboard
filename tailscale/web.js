// host-module:@home-dashboard/widget-sdk
var m = globalThis.__homeDashboard?.modules?.["@home-dashboard/widget-sdk"];
if (!m) throw new Error("\u672C\u4F53\u306E @home-dashboard/widget-sdk \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var widget_sdk_default = m.default ?? m;
var { Avatar, AvatarStack, BackButton, Badge, Button, ButtonLink, ButtonRow, ChatBubble, ChatComposer, ChatFrom, ChatHeader, ChatIconButton, ChatLayout, ChatLog, ChatMeta, ChatPending, ChatRow, Check, CodeBlock, DetailFrame, Dialog, FeatureProvidersContext, Field, Group, Icon, LOCALES, List, ListItem, LocaleContext, Message, Note, Notice, PillMenu, ScreenFrame, ScreenNotice, ScreenSection, SectionTitle, StatGrid, StatTile, ToggleSwitch, WidgetCard, WidgetHint, WidgetRegistry, defineMessages, defineWebExtension, defineWidget, extensionApiUrl, formatClock, formatPastDay, getLocale, intlLocale, setCurrentLocale, textFor, useFeatureProviders, useLocale, usePolledResource, usePolling, weatherConditionText, weatherIcon, widgetRegistry } = m;

// host-module:react/jsx-runtime
var m2 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m2) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m2.default ?? m2;
var { Fragment, jsx, jsxs } = m2;

// extensions/tailscale/src/widget.tsx
var messages = defineMessages({
  ja: {
    apiError: "tailscale API error: {status}",
    minutesAgo: "{n}\u5206\u524D",
    hoursAgo: "{n}\u6642\u9593\u524D",
    daysAgo: "{n}\u65E5\u524D",
    checking: "\u78BA\u8A8D\u4E2D\u2026",
    notConnected: "Tailscale\u672A\u63A5\u7D9A",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    self: "{name}\uFF08{ip}\uFF09",
    exitCapable: "exit\u53EF",
    note: "\u8868\u793A\u306E\u307F\u3067\u3001exit node\u306E\u5207\u308A\u66FF\u3048\u306A\u3069\u7D4C\u8DEF\u3092\u5909\u66F4\u3059\u308B\u64CD\u4F5C\u306F\u3067\u304D\u307E\u305B\u3093\u3002 \u3053\u306E\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306FLAN\u4E0A\u306B\u8A8D\u8A3C\u306A\u3057\u3067\u516C\u958B\u3055\u308C\u308B\u305F\u3081\u3001\u30DB\u30B9\u30C8\u81EA\u8EAB\u306E\u7D4C\u8DEF\u8A2D\u5B9A\u306F\u624B\u5143\u306ECLI\u306B\u6B8B\u3057\u3066\u3044\u307E\u3059\u3002"
  },
  en: {
    apiError: "tailscale API error: {status}",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    checking: "Checking\u2026",
    notConnected: "Tailscale not connected",
    loading: "Loading\u2026",
    self: "{name} ({ip})",
    exitCapable: "exit OK",
    note: "View only: you can't change routes here (such as switching the exit node). This dashboard is served on the LAN without authentication, so the host's own routing stays with the local CLI."
  }
});
async function fetchStatus(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/tailscale/status`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}
var osIcon = (os) => os === "iOS" || os === "android" ? "phone" : "desktop";
function relativeLastSeen(iso, t) {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diffMs / 6e4);
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}
function TailscaleView({ ctx, config, openDetail }) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  if (loading && !data) return /* @__PURE__ */ jsx("div", { className: "widget-card widget-tailscale", children: t("checking") });
  if (data && !data.configured) {
    return /* @__PURE__ */ jsxs("div", { className: "widget-card widget-tailscale widget-tailscale--unconfigured", children: [
      t("notConnected"),
      /* @__PURE__ */ jsx("span", { className: "widget-hint", children: data.reason })
    ] });
  }
  const running = data?.backendState === "Running";
  return /* @__PURE__ */ jsxs("button", { type: "button", className: "widget-card widget-tailscale", onClick: openDetail, children: [
    /* @__PURE__ */ jsxs("span", { className: "widget-tailscale__header", children: [
      /* @__PURE__ */ jsx("span", { className: `widget-homelab__dot ${running ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}` }),
      /* @__PURE__ */ jsx("span", { className: "widget-tailscale__title", children: "Tailscale" })
    ] }),
    /* @__PURE__ */ jsxs("span", { className: "widget-tailscale__count", children: [
      data?.onlineCount ?? 0,
      /* @__PURE__ */ jsxs("span", { className: "widget-tailscale__total", children: [
        "/",
        data?.totalCount ?? 0
      ] })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "widget-tailscale__sub", children: data?.self?.ip ?? "" }),
    data?.exitNode && /* @__PURE__ */ jsxs("span", { className: "widget-tailscale__exit", children: [
      "exit: ",
      data.exitNode.name
    ] })
  ] });
}
function TailscaleDetail({ ctx, config }) {
  const t = messages.useT();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return /* @__PURE__ */ jsx("div", { className: "widget-detail", children: t("loading") });
  return /* @__PURE__ */ jsxs("div", { className: "widget-detail widget-tailscale-detail", children: [
    /* @__PURE__ */ jsx("h2", { children: "Tailscale" }),
    /* @__PURE__ */ jsxs("p", { className: "widget-tailscale-detail__self", children: [
      t("self", { name: data.self?.name ?? "", ip: data.self?.ip ?? "" }),
      " \xB7 ",
      data.backendState,
      " \xB7 v",
      data.version.split("-")[0]
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "widget-tailscale-detail__list", children: data.peers.map((peer) => /* @__PURE__ */ jsxs("li", { className: "widget-tailscale-detail__item", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `widget-homelab__dot ${peer.online ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "widget-tailscale-detail__name", children: [
        /* @__PURE__ */ jsx(Icon, { name: osIcon(peer.os), label: peer.os || void 0, className: "widget-tailscale-detail__os" }),
        peer.name
      ] }),
      /* @__PURE__ */ jsx("span", { className: "widget-tailscale-detail__ip", children: peer.ip }),
      /* @__PURE__ */ jsxs("span", { className: "widget-tailscale-detail__meta", children: [
        peer.isExitNode && /* @__PURE__ */ jsx("span", { className: "widget-tailscale-detail__badge", children: "exit node" }),
        !peer.isExitNode && peer.offersExitNode && /* @__PURE__ */ jsx("span", { className: "widget-tailscale-detail__badge widget-tailscale-detail__badge--dim", children: t("exitCapable") }),
        peer.active && peer.directAddr && /* @__PURE__ */ jsx("span", { className: "widget-tailscale-detail__badge", children: "direct" }),
        peer.active && !peer.directAddr && peer.relay && /* @__PURE__ */ jsxs("span", { className: "widget-tailscale-detail__badge", children: [
          "derp:",
          peer.relay
        ] }),
        !peer.online && /* @__PURE__ */ jsx("span", { className: "widget-tailscale-detail__seen", children: relativeLastSeen(peer.lastSeen, t) })
      ] })
    ] }, peer.dnsName || peer.name)) }),
    /* @__PURE__ */ jsx("p", { className: "widget-note", children: t("note") })
  ] });
}
var widget_default = defineWidget({
  id: "tailscale-status",
  name: "Tailscale",
  description: {
    ja: "tailnet\u5185\u306E\u30CE\u30FC\u30C9\u306E\u30AA\u30F3\u30E9\u30A4\u30F3\u72B6\u6CC1\u30FB\u63A5\u7D9A\u7D4C\u8DEF\u3092\u8868\u793A\u3057\u307E\u3059\uFF08\u8AAD\u307F\u53D6\u308A\u5C02\u7528\uFF09",
    en: "Shows which tailnet nodes are online and how they connect (read-only)"
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1e3 },
  Component: TailscaleView,
  DetailComponent: TailscaleDetail
});

// extensions/tailscale/src/web.tsx
var web_default = defineWebExtension({ widgets: [widget_default] });
export {
  web_default as default
};
