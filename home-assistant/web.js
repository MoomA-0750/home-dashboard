// host-module:@home-dashboard/widget-sdk
var m = globalThis.__homeDashboard?.modules?.["@home-dashboard/widget-sdk"];
if (!m) throw new Error("\u672C\u4F53\u306E @home-dashboard/widget-sdk \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var widget_sdk_default = m.default ?? m;
var { Avatar, AvatarStack, BackButton, Badge, Button, ButtonLink, ButtonRow, ChatBubble, ChatComposer, ChatFrom, ChatHeader, ChatIconButton, ChatLayout, ChatLog, ChatMeta, ChatPending, ChatRow, Check, CodeBlock, DetailFrame, Dialog, FeatureProvidersContext, Field, Group, Icon, LOCALES, List, ListItem, LocaleContext, Message, Note, Notice, PillMenu, ScreenFrame, ScreenNotice, ScreenSection, SectionTitle, StatGrid, StatTile, ToggleSwitch, WidgetCard, WidgetHint, WidgetRegistry, defineMessages, defineWebExtension, defineWidget, extensionApiUrl, formatClock, formatPastDay, getLocale, intlLocale, setCurrentLocale, textFor, useFeatureProviders, useLocale, usePolledResource, usePolling, weatherConditionText, weatherIcon, widgetRegistry } = m;

// host-module:react
var m2 = globalThis.__homeDashboard?.modules?.["react"];
if (!m2) throw new Error("\u672C\u4F53\u306E react \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var react_default = m2.default ?? m2;
var { Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, act, cloneElement, createContext, createElement, createFactory, createRef, forwardRef, isValidElement, lazy, memo, startTransition, unstable_act, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, version } = m2;

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/home-assistant/src/controls-widget.tsx
var DEFAULT_ENTITY_COUNT = 4;
var DEFAULT_READINGS = ["temperature", "humidity"];
var READING_META = {
  temperature: { label: { ja: "\u5BA4\u6E29", en: "Temperature" }, icon: "temperature", digits: 1 },
  humidity: { label: { ja: "\u6E7F\u5EA6", en: "Humidity" }, icon: "drop", digits: 0 },
  carbon_dioxide: { label: "CO\u2082", icon: "molecule", digits: 0 },
  pm25: { label: "PM2.5", icon: "molecule", digits: 0 },
  illuminance: { label: { ja: "\u660E\u308B\u3055", en: "Brightness" }, icon: "weather-sunny", digits: 0 }
};
function ordinal(n) {
  const rem100 = n % 100;
  const suffix = rem100 >= 11 && rem100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
var messages = defineMessages({
  ja: {
    apiError: "home assistant API error: {status}",
    serviceFailed: "service call failed: {status}",
    disabled: "\u3053\u306E\u64CD\u4F5C\u306F\u7121\u52B9\u5316\u3055\u308C\u3066\u3044\u307E\u3059",
    notConnected: "Home Assistant\u672A\u63A5\u7D9A",
    notConnectedHint: "\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 Home Assistant\u300D\u3067 URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    readingAverage: "{label}\uFF08{n}\u500B\u306E\u30BB\u30F3\u30B5\u30FC\u306E\u5E73\u5747\uFF09",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    unreachable: "Home Assistant \u306B\u5C4A\u304D\u307E\u305B\u3093",
    chooseHint: "\u30DB\u30FC\u30E0\u306E\u7DE8\u96C6\u4E2D\u306B\u6B6F\u8ECA\u304B\u3089\u3001\u51FA\u3059\u5BB6\u96FB\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044",
    readingsTitle: "\u5DE6\u306B\u51FA\u3059\u60C5\u5831",
    readingsNote: "\u5BB6\u3058\u3085\u3046\u306E\u3001\u5165\u3063\u3066\u3044\u308B\u30BB\u30F3\u30B5\u30FC\u306E\u5E73\u5747\u3092\u51FA\u3057\u307E\u3059\uFF08\u30BB\u30F3\u30B5\u30FC\u306E\u5165\uFF0F\u5207\u306F\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 Home Assistant\u300D\uFF09\u3002",
    noSensor: "\u8AAD\u3081\u308B\u30BB\u30F3\u30B5\u30FC\u304C\u3042\u308A\u307E\u305B\u3093",
    hide: "{name}\u3092\u51FA\u3055\u306A\u3044",
    show: "{name}\u3092\u51FA\u3059",
    devicesTitle: "\u51FA\u3059\u5BB6\u96FB",
    loadingDevices: "\u5BB6\u96FB\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    position: "{n}\u756A\u76EE\u306B\u51FA\u3059"
  },
  en: {
    apiError: "home assistant API error: {status}",
    serviceFailed: "service call failed: {status}",
    disabled: "This action is disabled",
    notConnected: "Home Assistant not connected",
    notConnectedHint: "Enter the URL and token in Settings under Extensions \u2192 Home Assistant",
    readingAverage: (p) => `${p.label} (average of ${p.n} ${p.n === 1 ? "sensor" : "sensors"})`,
    loading: "Loading\u2026",
    unreachable: "Can't reach Home Assistant",
    chooseHint: "While editing Home, open the gear to choose devices",
    readingsTitle: "Readings on the left",
    readingsNote: "Shows the average of the enabled sensors around the home (turn sensors on or off in Settings under Extensions \u2192 Home Assistant).",
    noSensor: "No readable sensors",
    hide: "Hide {name}",
    show: "Show {name}",
    devicesTitle: "Devices to show",
    loadingDevices: "Loading devices\u2026",
    position: (p) => `Shown ${ordinal(Number(p.n))}`
  }
});
async function fetchControls(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/controls`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}
async function callService(apiBaseUrl, entityId, service) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, service })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? messages.t("serviceFailed", { status: res.status }));
  }
}
function entityIcon(entity) {
  switch (entity.domain) {
    case "light":
      return "lightbulb";
    case "switch":
      return "plug";
    case "fan":
      return "arrow-sync";
    case "lock":
      return entity.state === "unlocked" ? "lock-open" : "lock-closed";
    case "climate":
      return "temperature";
    default:
      return "unknown";
  }
}
var STATE_LABELS = {
  on: { ja: "\u30AA\u30F3", en: "On" },
  off: { ja: "\u30AA\u30D5", en: "Off" },
  locked: { ja: "\u65BD\u9320\u4E2D", en: "Locked" },
  unlocked: { ja: "\u89E3\u9320\u4E2D", en: "Unlocked" },
  locking: { ja: "\u65BD\u9320\u3057\u3066\u3044\u307E\u3059", en: "Locking" },
  unlocking: { ja: "\u89E3\u9320\u3057\u3066\u3044\u307E\u3059", en: "Unlocking" },
  jammed: { ja: "\u52D5\u304D\u307E\u305B\u3093", en: "Jammed" },
  unavailable: { ja: "\u3064\u306A\u304C\u308A\u307E\u305B\u3093", en: "Unavailable" },
  heat: { ja: "\u6696\u623F", en: "Heat" },
  cool: { ja: "\u51B7\u623F", en: "Cool" },
  heat_cool: { ja: "\u51B7\u6696\u623F", en: "Heat/Cool" },
  auto: { ja: "\u81EA\u52D5", en: "Auto" },
  dry: { ja: "\u9664\u6E7F", en: "Dry" },
  fan_only: { ja: "\u9001\u98A8", en: "Fan" }
};
var stateLabel = (state, locale) => {
  const label = STATE_LABELS[state];
  return label ? textFor(label, locale) : state;
};
function isOn(entity) {
  return entity.state === "on" || entity.state === "unlocked" || entity.state === "heat" || entity.state === "cool";
}
function serviceForToggle(entity, allowUnlock) {
  switch (entity.domain) {
    case "light":
    case "switch":
      return "toggle";
    case "climate":
      return entity.state === "off" ? "turn_on" : "turn_off";
    case "lock":
      if (entity.state === "locked") return allowUnlock ? "unlock" : null;
      return "lock";
    default:
      return null;
  }
}
function chosenEntities(entities, entityIds) {
  if (!entityIds) return entities.slice(0, DEFAULT_ENTITY_COUNT);
  const byId = new Map(entities.map((e) => [e.entityId, e]));
  return entityIds.flatMap((id) => byId.get(id) ?? []);
}
function chosenReadings(readings, classes) {
  const wanted = classes ?? DEFAULT_READINGS;
  return readings.filter((r) => wanted.includes(r.deviceClass) && READING_META[r.deviceClass]);
}
function useEntityControl(apiBaseUrl, pollIntervalMs) {
  const { data, error, loading } = usePolling(() => fetchControls(apiBaseUrl), pollIntervalMs);
  const [pending, setPending] = useState({});
  const [failure, setFailure] = useState(null);
  const toggle = useCallback(
    async (entity, allowUnlock) => {
      const service = serviceForToggle(entity, allowUnlock);
      if (!service) return;
      const optimistic = entity.domain === "lock" ? service === "lock" ? "locked" : "unlocked" : isOn(entity) ? "off" : "on";
      setPending((p) => ({ ...p, [entity.entityId]: optimistic }));
      setFailure(null);
      try {
        await callService(apiBaseUrl, entity.entityId, service);
      } catch (err) {
        setPending((p) => {
          const next = { ...p };
          delete next[entity.entityId];
          return next;
        });
        setFailure(err instanceof Error ? err.message : String(err));
      }
    },
    [apiBaseUrl]
  );
  const entities = (data?.entities ?? []).map((e) => pending[e.entityId] ? { ...e, state: pending[e.entityId] } : e);
  return { data, entities, error, loading, toggle, failure };
}
function EntityButton({
  entity,
  allowUnlock,
  onToggle
}) {
  const t = messages.useT();
  const locale = useLocale();
  const service = serviceForToggle(entity, allowUnlock);
  const on = isOn(entity);
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: `ha-entity ${on ? "ha-entity--on" : ""} ${service ? "" : "ha-entity--readonly"}`,
      disabled: !service,
      onClick: () => onToggle(entity),
      "aria-label": `${entity.name}\uFF08${stateLabel(entity.state, locale)}\uFF09`,
      title: service ? stateLabel(entity.state, locale) : t("disabled"),
      children: [
        /* @__PURE__ */ jsx(Icon, { name: entityIcon(entity), className: "ha-entity__icon" }),
        /* @__PURE__ */ jsx("span", { className: "ha-entity__name", children: entity.name })
      ]
    }
  );
}
function HaControlsView({ ctx, config }) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error, entities, loading, toggle, failure } = useEntityControl(ctx.apiBaseUrl, config.pollIntervalMs);
  if (!loading && data && !data.configured) {
    return /* @__PURE__ */ jsxs("div", { className: "widget-card ha-controls ha-controls--unconfigured", children: [
      t("notConnected"),
      /* @__PURE__ */ jsx("span", { className: "widget-hint", children: t("notConnectedHint") })
    ] });
  }
  const shown = chosenEntities(entities, config.entityIds);
  const readings = chosenReadings(data?.readings ?? [], config.readings);
  return /* @__PURE__ */ jsxs("div", { className: "widget-card ha-controls", children: [
    readings.length > 0 && /* @__PURE__ */ jsx("div", { className: "ha-controls__readings", children: readings.map((reading) => {
      const meta = READING_META[reading.deviceClass];
      return /* @__PURE__ */ jsxs(
        "span",
        {
          className: "ha-controls__reading",
          title: t("readingAverage", { label: textFor(meta.label, locale), n: reading.count }),
          children: [
            /* @__PURE__ */ jsx(Icon, { name: meta.icon }),
            /* @__PURE__ */ jsxs("span", { className: "ha-controls__reading-value", children: [
              reading.value.toFixed(meta.digits),
              /* @__PURE__ */ jsx("small", { children: reading.unit })
            ] })
          ]
        },
        reading.deviceClass
      );
    }) }),
    /* @__PURE__ */ jsxs("div", { className: "ha-controls__main", children: [
      loading && !data && /* @__PURE__ */ jsx("span", { className: "widget-status", children: t("loading") }),
      Boolean(error) && !data && /* @__PURE__ */ jsx("span", { className: "widget-status--error", children: t("unreachable") }),
      failure && /* @__PURE__ */ jsx("span", { className: "ha-controls__error", children: failure }),
      data && shown.length === 0 && /* @__PURE__ */ jsx("span", { className: "widget-hint", children: t("chooseHint") }),
      /* @__PURE__ */ jsx("div", { className: "ha-controls__grid", children: shown.map((e) => /* @__PURE__ */ jsx(
        EntityButton,
        {
          entity: e,
          allowUnlock: data?.allowUnlock ?? false,
          onToggle: (entity) => toggle(entity, data?.allowUnlock ?? false)
        },
        e.entityId
      )) })
    ] })
  ] });
}
function HaControlsSettings({ ctx, config, onChange }) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error } = usePolling(() => fetchControls(ctx.apiBaseUrl), 60 * 1e3);
  const readings = config.readings ?? DEFAULT_READINGS;
  const entityIds = config.entityIds ?? (data?.entities ?? []).slice(0, DEFAULT_ENTITY_COUNT).map((e) => e.entityId);
  const available = new Set((data?.readings ?? []).map((r) => r.deviceClass));
  const setReading = (deviceClass, on) => {
    const next = on ? [...readings, deviceClass] : readings.filter((c) => c !== deviceClass);
    onChange({ ...config, readings: Object.keys(READING_META).filter((c) => next.includes(c)) });
  };
  const setEntity = (entityId, on) => {
    const next = on ? [...entityIds.filter((id) => id !== entityId), entityId] : entityIds.filter((id) => id !== entityId);
    onChange({ ...config, entityIds: next });
  };
  return /* @__PURE__ */ jsxs("div", { className: "ha-controls-settings", children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: t("readingsTitle") }),
    /* @__PURE__ */ jsx(Note, { children: t("readingsNote") }),
    /* @__PURE__ */ jsx(List, { children: Object.entries(READING_META).map(([deviceClass, meta]) => /* @__PURE__ */ jsx(
      ListItem,
      {
        leading: /* @__PURE__ */ jsx(Icon, { name: meta.icon, className: "ha-controls-settings__icon" }),
        title: textFor(meta.label, locale),
        detail: data && !available.has(deviceClass) ? t("noSensor") : void 0,
        trailing: /* @__PURE__ */ jsx(
          ToggleSwitch,
          {
            checked: readings.includes(deviceClass),
            label: t(readings.includes(deviceClass) ? "hide" : "show", { name: textFor(meta.label, locale) }),
            onChange: (on) => setReading(deviceClass, on)
          }
        )
      },
      deviceClass
    )) }),
    /* @__PURE__ */ jsx(SectionTitle, { children: t("devicesTitle") }),
    Boolean(error) && !data && /* @__PURE__ */ jsx(Note, { children: t("unreachable") }),
    !data && !error && /* @__PURE__ */ jsx(Note, { children: t("loadingDevices") }),
    data && /* @__PURE__ */ jsx(List, { children: data.entities.map((entity) => {
      const on = entityIds.includes(entity.entityId);
      return /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx(Icon, { name: entityIcon(entity), className: "ha-controls-settings__icon" }),
          title: entity.name,
          detail: on ? t("position", { n: entityIds.indexOf(entity.entityId) + 1 }) : entity.entityId,
          trailing: /* @__PURE__ */ jsx(
            ToggleSwitch,
            {
              checked: on,
              label: t(on ? "hide" : "show", { name: entity.name }),
              onChange: (next) => setEntity(entity.entityId, next)
            }
          )
        },
        entity.entityId
      );
    }) })
  ] });
}
var controls_widget_default = defineWidget({
  id: "ha-controls",
  name: { ja: "\u5BB6\u96FB\u64CD\u4F5C", en: "Home controls" },
  description: {
    ja: "Home Assistant\u306E\u7167\u660E\u30FB\u30B9\u30A4\u30C3\u30C1\u30FB\u9375\u30FB\u30A8\u30A2\u30B3\u30F3\u3092\u64CD\u4F5C\u3057\u3001\u5BA4\u6E29\u30FB\u6E7F\u5EA6\u306A\u3069\u3092\u8868\u793A\u3057\u307E\u3059",
    en: "Controls Home Assistant lights, switches, locks and air conditioners, and shows temperature, humidity and more"
  },
  defaultSize: { w: 4, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 10 * 1e3 },
  Component: HaControlsView,
  SettingsComponent: HaControlsSettings
});

// host-module:react-dom
var m4 = globalThis.__homeDashboard?.modules?.["react-dom"];
if (!m4) throw new Error("\u672C\u4F53\u306E react-dom \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var react_dom_default = m4.default ?? m4;
var { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED2, createPortal, createRoot, findDOMNode, flushSync, hydrate, hydrateRoot, render, unmountComponentAtNode, unstable_batchedUpdates, unstable_renderSubtreeIntoContainer, version: version2 } = m4;

// extensions/home-assistant/src/SensorDetail.tsx
var RANGES = [
  { hours: 24, label: "range24h" },
  { hours: 168, label: "range7d" }
];
var messages2 = defineMessages({
  ja: {
    range24h: "24\u6642\u9593",
    range7d: "7\u65E5",
    noRecords: "\u3053\u306E\u671F\u9593\u306E\u8A18\u9332\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    trend: "{range}\u306E\u63A8\u79FB",
    now: "\u3044\u307E",
    loadFailed: "\u8A18\u9332\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    close: "\u9589\u3058\u308B",
    minMax: "{min}\u301C{max}",
    period: "\u671F\u9593",
    loading: "\u8A18\u9332\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    note: "\u540D\u524D\u306E\u53F3\u306E\u300C\u301C\u300D\u306E\u5024\u306F\u3001\u3053\u306E\u671F\u9593\u306E\u6700\u4F4E\u3068\u6700\u9AD8\u3067\u3059\u3002"
  },
  en: {
    range24h: "24 hours",
    range7d: "7 days",
    noRecords: "No records for this period.",
    trend: "Trend over {range}",
    now: "Now",
    loadFailed: "Couldn't load records ({status})",
    close: "Close",
    minMax: "{min}\u2013{max}",
    period: "Period",
    loading: "Loading records\u2026",
    note: "The range to the right of each name is the lowest and highest value in this period."
  }
});
var COLORS = ["#8adcf8", "#f6c177", "#c4a7e7", "#9ccfd8", "#eb6f92", "#a3e635"];
var CHART_WIDTH = 640;
var CHART_HEIGHT = 220;
var PAD = { left: 44, right: 12, top: 12, bottom: 28 };
function formatValue(value, digits) {
  return value.toFixed(digits);
}
function formatTick(t, hours, locale) {
  const date = new Date(t);
  if (hours <= 24) return formatClock(date, locale);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
function Chart({ series, hours, digits }) {
  const t = messages2.useT();
  const locale = useLocale();
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return /* @__PURE__ */ jsx("p", { className: "sensor-detail__empty", children: t("noRecords") });
  const end = Date.now();
  const start = end - hours * 60 * 60 * 1e3;
  let min = Math.min(...all.map(([, v]) => v));
  let max = Math.max(...all.map(([, v]) => v));
  const margin = Math.max((max - min) * 0.15, max === min ? Math.abs(max) * 0.05 || 1 : 0);
  min -= margin;
  max += margin;
  const x = (t2) => PAD.left + (t2 - start) / (end - start) * (CHART_WIDTH - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - (v - min) / (max - min)) * (CHART_HEIGHT - PAD.top - PAD.bottom);
  const yTicks = [min + margin, (min + max) / 2, max - margin];
  const xTicks = [start, start + (end - start) / 2, end];
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className: "sensor-detail__chart",
      viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
      role: "img",
      "aria-label": t("trend", { range: t(hours <= 24 ? "range24h" : "range7d") }),
      children: [
        yTicks.map((v) => /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { className: "sensor-detail__grid", x1: PAD.left, x2: CHART_WIDTH - PAD.right, y1: y(v), y2: y(v) }),
          /* @__PURE__ */ jsx("text", { className: "sensor-detail__tick", x: PAD.left - 6, y: y(v) + 4, textAnchor: "end", children: formatValue(v, digits) })
        ] }, `y${v}`)),
        xTicks.map((tick, i) => /* @__PURE__ */ jsx(
          "text",
          {
            className: "sensor-detail__tick",
            x: x(tick),
            y: CHART_HEIGHT - 8,
            textAnchor: i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle",
            children: i === xTicks.length - 1 ? t("now") : formatTick(tick, hours, locale)
          },
          `x${tick}`
        )),
        series.map((s, index) => {
          const points = s.points.length > 0 ? [...s.points, [end, s.points[s.points.length - 1][1]]] : [];
          return /* @__PURE__ */ jsx(
            "polyline",
            {
              className: "sensor-detail__line",
              style: { stroke: COLORS[index % COLORS.length] },
              points: points.map(([t2, v]) => `${x(Math.max(t2, start)).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
            },
            s.entityId
          );
        })
      ]
    }
  );
}
function SensorDetail({
  apiBaseUrl,
  title,
  icon,
  sensors,
  digits,
  onClose
}) {
  const t = messages2.useT();
  const [hours, setHours] = useState(24);
  const [series, setSeries] = useState(null);
  const [error, setError] = useState(null);
  const ids = sensors.map((s) => s.entityId).join(",");
  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    setError(null);
    const params = new URLSearchParams({ entityIds: ids, hours: String(hours) });
    fetch(`${apiBaseUrl}/api/ext/home-assistant/history?${params}`).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? messages2.t("loadFailed", { status: res.status }));
      if (!cancelled) setSeries(body.series);
    }).catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, ids, hours]);
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ordered = series ? sensors.map((s) => series.find((x) => x.entityId === s.entityId)).filter((s) => !!s) : [];
  const statsFor = (entityId) => {
    const points = series?.find((s) => s.entityId === entityId)?.points ?? [];
    if (points.length === 0) return null;
    const values = points.map(([, v]) => v);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return createPortal(
    /* @__PURE__ */ jsx("div", { className: "widget-picker-overlay", onClick: onClose, children: /* @__PURE__ */ jsxs(
      "div",
      {
        className: "widget-picker sensor-detail",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": title,
        onClick: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "widget-picker__header", children: [
            /* @__PURE__ */ jsxs("h2", { className: "sensor-detail__title", children: [
              /* @__PURE__ */ jsx(Icon, { name: icon }),
              title
            ] }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "settings-panel__close", onClick: onClose, "aria-label": t("close"), children: /* @__PURE__ */ jsx(Icon, { name: "dismiss" }) })
          ] }),
          /* @__PURE__ */ jsx("ul", { className: "sensor-detail__list", children: sensors.map((sensor, index) => {
            const value = Number(sensor.state);
            const stats = statsFor(sensor.entityId);
            return /* @__PURE__ */ jsxs("li", { className: "sensor-detail__row", children: [
              /* @__PURE__ */ jsx("span", { className: "sensor-detail__dot", style: { background: COLORS[index % COLORS.length] } }),
              /* @__PURE__ */ jsx("span", { className: "sensor-detail__name", children: sensor.name }),
              /* @__PURE__ */ jsx("span", { className: "sensor-detail__range", children: stats && t("minMax", { min: formatValue(stats.min, digits), max: formatValue(stats.max, digits) }) }),
              /* @__PURE__ */ jsxs("span", { className: "sensor-detail__value", children: [
                Number.isFinite(value) ? formatValue(value, digits) : "\u2014",
                /* @__PURE__ */ jsx("small", { children: sensor.unit })
              ] })
            ] }, sensor.entityId);
          }) }),
          /* @__PURE__ */ jsx("div", { className: "sensor-detail__ranges", role: "radiogroup", "aria-label": t("period"), children: RANGES.map((range) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              role: "radio",
              "aria-checked": hours === range.hours,
              className: `home-chip${hours === range.hours ? " home-chip--on" : ""}`,
              onClick: () => setHours(range.hours),
              children: t(range.label)
            },
            range.hours
          )) }),
          error && /* @__PURE__ */ jsx("p", { className: "screen__error", children: error }),
          !error && !series && /* @__PURE__ */ jsx("p", { className: "sensor-detail__empty", children: t("loading") }),
          series && /* @__PURE__ */ jsx(Chart, { series: ordered, hours, digits }),
          series && /* @__PURE__ */ jsx("p", { className: "sensor-detail__note", children: t("note") })
        ]
      }
    ) }),
    document.body
  );
}

// extensions/home-assistant/src/HomeControlScreen.tsx
async function fetchOverview(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/overview`);
  if (!res.ok) throw new Error(messages3.t("apiError", { status: res.status }));
  return res.json();
}
async function callService2(apiBaseUrl, entityId, service, data) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, service, data })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? messages3.t("callFailed", { status: res.status }));
  }
}
var SENSOR_META = {
  temperature: { label: { ja: "\u5BA4\u6E29", en: "Temperature" }, icon: "temperature" },
  humidity: { label: { ja: "\u6E7F\u5EA6", en: "Humidity" }, icon: "drop" },
  carbon_dioxide: { label: "CO\u2082", icon: "molecule" },
  pm25: { label: "PM2.5", icon: "molecule" },
  illuminance: { label: { ja: "\u660E\u308B\u3055", en: "Brightness" }, icon: "weather-sunny" }
};
var HVAC_LABELS = {
  off: { ja: "\u505C\u6B62", en: "Off" },
  heat: { ja: "\u6696\u623F", en: "Heat" },
  cool: { ja: "\u51B7\u623F", en: "Cool" },
  heat_cool: { ja: "\u51B7\u6696\u623F", en: "Heat/Cool" },
  auto: { ja: "\u81EA\u52D5", en: "Auto" },
  dry: { ja: "\u9664\u6E7F", en: "Dry" },
  fan_only: { ja: "\u9001\u98A8", en: "Fan" }
};
var messages3 = defineMessages({
  ja: {
    apiError: "home assistant API error: {status}",
    callFailed: "\u64CD\u4F5C\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08{status}\uFF09",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    unreachable: "Home Assistant \u306B\u5C4A\u304D\u307E\u305B\u3093\u3002\u30B5\u30FC\u30D0\u30FC\u3068\u306E\u63A5\u7D9A\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002",
    notConfigured: "Home Assistant \u304C\u672A\u63A5\u7D9A\u3067\u3059\u3002\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u63A5\u7D9A\u8A2D\u5B9A \u2192 Home Assistant\u300D\u3067 URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044\u3002",
    otherRoom: "\u305D\u306E\u307B\u304B",
    allRooms: "\u3059\u3079\u3066\u306E\u90E8\u5C4B",
    roomPicker: "\u51FA\u3059\u90E8\u5C4B\uFF08\u3044\u307E\u306F{room}\uFF09",
    air: "\u90E8\u5C4B\u306E\u7A7A\u6C17",
    inArea: "{area}\u306E{label}",
    sensorAria: "{label} {value}\uFF08\u8A73\u3057\u304F\u898B\u308B\uFF09",
    locks: "\u9375",
    climate: "\u7A7A\u8ABF",
    toggles: "\u7167\u660E\u30FB\u30B9\u30A4\u30C3\u30C1",
    nothingHere: "\u3053\u306E\u90E8\u5C4B\u306B\u51FA\u305B\u308B\u3082\u306E\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
    locked: "\u65BD\u9320\u4E2D",
    unlocked: "\u89E3\u9320\u4E2D",
    locking: "\u65BD\u9320\u3057\u3066\u3044\u307E\u3059\u2026",
    unlocking: "\u89E3\u9320\u3057\u3066\u3044\u307E\u3059\u2026",
    jammed: "\u8A70\u307E\u3063\u3066\u3044\u307E\u3059",
    open: "\u958B\u3044\u3066\u3044\u307E\u3059",
    unknownState: "\u72B6\u614B\u4E0D\u660E",
    lock: "\u65BD\u9320",
    unlockConfirm: "\u3082\u3046\u4E00\u5EA6\u62BC\u3057\u3066\u89E3\u9320",
    unlock: "\u89E3\u9320",
    cannotUnlock: "\u3053\u306E\u753B\u9762\u304B\u3089\u306F\u89E3\u9320\u3067\u304D\u307E\u305B\u3093",
    turnOn: "{name}\u3092\u3064\u3051\u308B",
    turnOff: "{name}\u3092\u6B62\u3081\u308B",
    roomTemp: "\u5BA4\u6E29 {value}",
    lowerTemp: "\u8A2D\u5B9A\u6E29\u5EA6\u3092\u4E0B\u3052\u308B",
    raiseTemp: "\u8A2D\u5B9A\u6E29\u5EA6\u3092\u4E0A\u3052\u308B",
    hvacMode: "\u904B\u8EE2\u30E2\u30FC\u30C9",
    noResponse: "\u5FDC\u7B54\u306A\u3057",
    on: "\u30AA\u30F3",
    off: "\u30AA\u30D5",
    brightnessOf: "{name}\u306E\u660E\u308B\u3055"
  },
  en: {
    apiError: "home assistant API error: {status}",
    callFailed: "The action failed ({status})",
    loading: "Loading\u2026",
    unreachable: "Can't reach Home Assistant. Check the connection to the server.",
    notConfigured: "Home Assistant isn't connected. Enter the URL and token in Settings under Connections \u2192 Home Assistant.",
    otherRoom: "Other",
    allRooms: "All rooms",
    roomPicker: "Room to show (now: {room})",
    air: "Air",
    inArea: "{area} {label}",
    sensorAria: "{label} {value} (show details)",
    locks: "Locks",
    climate: "Climate",
    toggles: "Lights & switches",
    nothingHere: "Nothing to show in this room.",
    locked: "Locked",
    unlocked: "Unlocked",
    locking: "Locking\u2026",
    unlocking: "Unlocking\u2026",
    jammed: "Jammed",
    open: "Open",
    unknownState: "Unknown",
    lock: "Lock",
    unlockConfirm: "Press again to unlock",
    unlock: "Unlock",
    cannotUnlock: "Can't unlock from this screen",
    turnOn: "Turn on {name}",
    turnOff: "Turn off {name}",
    roomTemp: "Room {value}",
    lowerTemp: "Lower target temperature",
    raiseTemp: "Raise target temperature",
    hvacMode: "Mode",
    noResponse: "No response",
    on: "On",
    off: "Off",
    brightnessOf: "{name} brightness"
  }
});
function sensorTitle(area, label, t) {
  return area ? t("inArea", { area, label }) : label;
}
function sensorLevel(deviceClass, value) {
  if (value === null || !Number.isFinite(value)) return "ok";
  if (deviceClass === "carbon_dioxide") return value >= 1500 ? "hot" : value >= 1e3 ? "warm" : "ok";
  if (deviceClass === "humidity") return value < 30 || value > 70 ? "warm" : "ok";
  if (deviceClass === "pm25") return value >= 35 ? "hot" : value >= 15 ? "warm" : "ok";
  return "ok";
}
function formatSensorValue(entity) {
  const value = Number(entity.state);
  if (!Number.isFinite(value)) return entity.state === "unavailable" ? "\u2014" : entity.state;
  const digits = entity.deviceClass === "temperature" ? 1 : 0;
  return value.toFixed(digits);
}
function mergeSensors(sensors) {
  const groups = /* @__PURE__ */ new Map();
  for (const sensor of sensors) {
    const key = sensor.deviceClass ? `${sensor.deviceClass}:${sensor.unit ?? ""}` : sensor.entityId;
    groups.set(key, [...groups.get(key) ?? [], sensor]);
  }
  return [...groups.entries()].map(([key, members]) => {
    const values = members.map((m5) => Number(m5.state)).filter((v) => Number.isFinite(v));
    const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    return {
      key,
      deviceClass: members[0].deviceClass,
      sensors: members,
      unit: members[0].unit,
      average,
      level: sensorLevel(members[0].deviceClass, average)
    };
  });
}
function formatNumber(value, deviceClass) {
  return value.toFixed(deviceClass === "temperature" ? 1 : 0);
}
function formatMergedValue(merged) {
  if (merged.sensors.length === 1) return formatSensorValue(merged.sensors[0]);
  return merged.average === null ? "\u2014" : formatNumber(merged.average, merged.deviceClass);
}
function groupByArea(entities) {
  const groups = /* @__PURE__ */ new Map();
  for (const entity of entities) {
    const key = entity.area ?? "";
    groups.set(key, [...groups.get(key) ?? [], entity]);
  }
  return [...groups.entries()].sort(([a], [b]) => a === "" ? 1 : b === "" ? -1 : 0);
}
function HomeControlScreen({ ctx }) {
  const t = messages3.useT();
  const locale = useLocale();
  const { apiBaseUrl } = ctx;
  const { data, error, loading, refresh } = usePolledResource(() => fetchOverview(apiBaseUrl), 5e3);
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(null);
  const [room, setRoom] = useState(null);
  const [detail, setDetail] = useState(null);
  const run = async (entityId, service, data2) => {
    setBusy(entityId);
    setFailure(null);
    try {
      await callService2(apiBaseUrl, entityId, service, data2);
      await refresh();
      setTimeout(refresh, 1200);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };
  if (loading) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Home Control", children: t("loading") });
  }
  if (error || !data) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Home Control", children: /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("unreachable") }) });
  }
  if (!data.configured) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Home Control", children: /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("notConfigured") }) });
  }
  const all = [...data.sensors, ...data.locks, ...data.climates, ...data.toggles];
  const areas = [...new Set(all.map((e) => e.area ?? ""))].sort(
    (a, b) => a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ja")
  );
  const shownRoom = room !== null && areas.includes(room) ? room : null;
  const inRoom = (entities) => shownRoom === null ? entities : entities.filter((e) => (e.area ?? "") === shownRoom);
  const sensors = inRoom(data.sensors);
  const locks = inRoom(data.locks);
  const climates = inRoom(data.climates);
  const toggles = inRoom(data.toggles);
  const roomLabel = (area) => area || t("otherRoom");
  const roomPicker = areas.length > 1 ? /* @__PURE__ */ jsx(
    PillMenu,
    {
      label: shownRoom === null ? t("allRooms") : roomLabel(shownRoom),
      icon: "home",
      ariaLabel: t("roomPicker", { room: shownRoom === null ? t("allRooms") : roomLabel(shownRoom) }),
      items: [
        { id: "*", label: t("allRooms"), selected: shownRoom === null },
        ...areas.map((area) => ({ id: `room:${area}`, label: roomLabel(area), selected: shownRoom === area }))
      ],
      onSelect: (id) => setRoom(id === "*" ? null : id.slice("room:".length))
    }
  ) : void 0;
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: "Home Control", actions: roomPicker, children: [
    failure && /* @__PURE__ */ jsx("p", { className: "screen__error", role: "alert", children: failure }),
    /* @__PURE__ */ jsxs("div", { className: "screen__columns home-control__columns", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        sensors.length > 0 && /* @__PURE__ */ jsxs("section", { className: "screen__section home-section--air", children: [
          /* @__PURE__ */ jsx("h2", { className: "screen__section-title", children: t("air") }),
          groupByArea(sensors).map(([area, sensors2]) => /* @__PURE__ */ jsxs("div", { className: "home-control__area", children: [
            area && shownRoom === null && /* @__PURE__ */ jsx("h3", { className: "home-control__area-name", children: area }),
            /* @__PURE__ */ jsx("div", { className: "home-control__sensors", children: mergeSensors(sensors2).map((merged) => {
              const known = SENSOR_META[merged.deviceClass ?? ""];
              const meta = {
                label: known ? textFor(known.label, locale) : merged.sensors[0].name,
                icon: known?.icon ?? "unknown"
              };
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  className: `home-sensor home-sensor--${merged.level}`,
                  "aria-label": t("sensorAria", {
                    label: sensorTitle(area, meta.label, t),
                    value: `${formatMergedValue(merged)}${merged.unit ?? ""}`
                  }),
                  onClick: () => setDetail({ area, merged }),
                  children: [
                    /* @__PURE__ */ jsxs("span", { className: "home-sensor__label", children: [
                      /* @__PURE__ */ jsx(Icon, { name: meta.icon }),
                      meta.label
                    ] }),
                    /* @__PURE__ */ jsxs("span", { className: "home-sensor__value", children: [
                      formatMergedValue(merged),
                      /* @__PURE__ */ jsx("small", { children: merged.unit })
                    ] })
                  ]
                },
                merged.key
              );
            }) })
          ] }, area))
        ] }),
        locks.length > 0 && /* @__PURE__ */ jsxs("section", { className: "screen__section home-section--locks", children: [
          /* @__PURE__ */ jsx("h2", { className: "screen__section-title", children: t("locks") }),
          /* @__PURE__ */ jsx("div", { className: "home-control__locks", children: locks.map((lock) => /* @__PURE__ */ jsx(
            LockCard,
            {
              lock,
              canUnlock: data.canUnlock,
              busy: busy === lock.entityId,
              onLock: () => run(lock.entityId, "lock"),
              onUnlock: () => run(lock.entityId, "unlock")
            },
            lock.entityId
          )) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        climates.length > 0 && /* @__PURE__ */ jsxs("section", { className: "screen__section home-section--climate", children: [
          /* @__PURE__ */ jsx("h2", { className: "screen__section-title", children: t("climate") }),
          /* @__PURE__ */ jsx("div", { className: "home-control__climates", children: climates.map((climate) => /* @__PURE__ */ jsx(
            ClimateCard,
            {
              climate,
              busy: busy === climate.entityId,
              onCall: (service, payload) => run(climate.entityId, service, payload)
            },
            climate.entityId
          )) })
        ] }),
        toggles.length > 0 && /* @__PURE__ */ jsxs("section", { className: "screen__section home-section--toggles", children: [
          /* @__PURE__ */ jsx("h2", { className: "screen__section-title", children: t("toggles") }),
          groupByArea(toggles).map(([area, toggles2]) => /* @__PURE__ */ jsxs("div", { className: "home-control__area", children: [
            area && shownRoom === null && /* @__PURE__ */ jsx("h3", { className: "home-control__area-name", children: area }),
            /* @__PURE__ */ jsx("div", { className: "home-control__toggles", children: toggles2.map((toggle) => /* @__PURE__ */ jsx(
              ToggleTile,
              {
                toggle,
                busy: busy === toggle.entityId,
                onToggle: () => run(toggle.entityId, "toggle"),
                onBrightness: (pct) => run(toggle.entityId, "turn_on", { brightness_pct: pct })
              },
              toggle.entityId
            )) })
          ] }, area))
        ] })
      ] })
    ] }),
    sensors.length + locks.length + climates.length + toggles.length === 0 && /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("nothingHere") }),
    detail && /* @__PURE__ */ jsx(
      SensorDetail,
      {
        apiBaseUrl,
        title: sensorTitle(
          detail.area,
          SENSOR_META[detail.merged.deviceClass ?? ""] ? textFor(SENSOR_META[detail.merged.deviceClass ?? ""].label, locale) : detail.merged.sensors[0].name,
          t
        ),
        icon: (SENSOR_META[detail.merged.deviceClass ?? ""] ?? { icon: "unknown" }).icon,
        sensors: detail.merged.sensors,
        digits: detail.merged.deviceClass === "temperature" ? 1 : 0,
        onClose: () => setDetail(null)
      }
    )
  ] });
}
var UNLOCK_CONFIRM_MS = 4e3;
function LockCard({
  lock,
  canUnlock,
  busy,
  onLock,
  onUnlock
}) {
  const t = messages3.useT();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), UNLOCK_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);
  const locked = lock.state === "locked";
  const unlocked = lock.state === "unlocked" || lock.state === "open";
  const stateKey = ["locked", "unlocked", "locking", "unlocking", "jammed", "open"].find(
    (key) => key === lock.state
  );
  const stateLabel2 = t(stateKey ?? "unknownState");
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `home-lock${unlocked ? " home-lock--unlocked" : ""}${lock.state === "jammed" ? " home-lock--jammed" : ""}`,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "home-lock__status", children: [
          /* @__PURE__ */ jsx(Icon, { name: unlocked ? "lock-open" : "lock-closed", className: "home-lock__icon" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { className: "home-lock__name", children: lock.name }),
            /* @__PURE__ */ jsx("span", { className: "home-lock__state", children: stateLabel2 })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "home-lock__actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "home-button", disabled: busy || locked, onClick: onLock, children: t("lock") }),
          canUnlock ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `home-button${confirming ? " home-button--danger" : ""}`,
              disabled: busy || unlocked,
              onClick: () => {
                if (!confirming) return setConfirming(true);
                setConfirming(false);
                onUnlock();
              },
              children: confirming ? t("unlockConfirm") : t("unlock")
            }
          ) : /* @__PURE__ */ jsx("span", { className: "home-lock__note", children: t("cannotUnlock") })
        ] })
      ]
    }
  );
}
function ClimateCard({
  climate,
  busy,
  onCall
}) {
  const t = messages3.useT();
  const locale = useLocale();
  const step = climate.step ?? 0.5;
  const target = climate.targetTemperature;
  const off = climate.state === "off";
  const clamp = (value) => Math.min(climate.maxTemperature ?? 30, Math.max(climate.minTemperature ?? 16, Math.round(value / step) * step));
  const modes = climate.hvacModes.filter((mode) => mode !== "off");
  return /* @__PURE__ */ jsxs("div", { className: `home-climate${off ? " home-climate--off" : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "home-climate__head", children: [
      /* @__PURE__ */ jsxs("span", { className: "home-climate__name", children: [
        climate.name,
        climate.area && /* @__PURE__ */ jsx("small", { children: climate.area })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: `home-icon-button${off ? "" : " home-icon-button--on"}`,
          "aria-label": t(off ? "turnOn" : "turnOff", { name: climate.name }),
          "aria-pressed": !off,
          disabled: busy,
          onClick: () => onCall(off ? "turn_on" : "turn_off"),
          children: /* @__PURE__ */ jsx(Icon, { name: "power" })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "home-climate__temps", children: [
      /* @__PURE__ */ jsxs("span", { className: "home-climate__current", children: [
        t("roomTemp", { value: climate.currentTemperature ?? "\u2014" }),
        /* @__PURE__ */ jsx("small", { children: "\u2103" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "home-climate__target", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "home-icon-button",
            "aria-label": t("lowerTemp"),
            disabled: busy || off || target === null,
            onClick: () => target !== null && onCall("set_temperature", { temperature: clamp(target - step) }),
            children: /* @__PURE__ */ jsx(Icon, { name: "chevron-down" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "home-climate__target-value", children: [
          off ? "\u2014" : target ?? "\u2014",
          /* @__PURE__ */ jsx("small", { children: "\u2103" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "home-icon-button",
            "aria-label": t("raiseTemp"),
            disabled: busy || off || target === null,
            onClick: () => target !== null && onCall("set_temperature", { temperature: clamp(target + step) }),
            children: /* @__PURE__ */ jsx(Icon, { name: "chevron-up" })
          }
        )
      ] })
    ] }),
    modes.length > 0 && /* @__PURE__ */ jsx("div", { className: "home-climate__modes", role: "group", "aria-label": t("hvacMode"), children: modes.map((mode) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: `home-chip${climate.state === mode ? " home-chip--on" : ""}`,
        "aria-pressed": climate.state === mode,
        disabled: busy,
        onClick: () => onCall("set_hvac_mode", { hvac_mode: mode }),
        children: HVAC_LABELS[mode] ? textFor(HVAC_LABELS[mode], locale) : mode
      },
      mode
    )) })
  ] });
}
function ToggleTile({
  toggle,
  busy,
  onToggle,
  onBrightness
}) {
  const t = messages3.useT();
  const on = toggle.state === "on";
  const unavailable = toggle.state === "unavailable";
  const [draft, setDraft] = useState(null);
  const icon = toggle.domain === "light" ? "lightbulb" : toggle.domain === "fan" ? "arrow-sync" : "plug";
  return /* @__PURE__ */ jsxs("div", { className: `home-toggle${on ? " home-toggle--on" : ""}`, children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "home-toggle__button",
        "aria-pressed": on,
        disabled: busy || unavailable,
        onClick: onToggle,
        children: [
          /* @__PURE__ */ jsx(Icon, { name: icon, className: "home-toggle__icon" }),
          /* @__PURE__ */ jsx("span", { className: "home-toggle__name", children: toggle.name }),
          /* @__PURE__ */ jsx("span", { className: "home-toggle__state", children: unavailable ? t("noResponse") : on ? toggle.brightnessPct !== null ? `${toggle.brightnessPct}%` : t("on") : t("off") })
        ]
      }
    ),
    toggle.dimmable && on && /* @__PURE__ */ jsx(
      "input",
      {
        type: "range",
        className: "home-toggle__slider",
        min: 1,
        max: 100,
        value: draft ?? toggle.brightnessPct ?? 100,
        "aria-label": t("brightnessOf", { name: toggle.name }),
        onChange: (event) => setDraft(Number(event.target.value)),
        onPointerUp: () => {
          if (draft !== null) onBrightness(draft);
          setDraft(null);
        },
        onKeyUp: () => {
          if (draft !== null) onBrightness(draft);
          setDraft(null);
        }
      }
    )
  ] });
}

// extensions/home-assistant/src/SensorSettings.tsx
var CLASS_LABELS = {
  temperature: { ja: "\u5BA4\u6E29", en: "Temperature" },
  humidity: { ja: "\u6E7F\u5EA6", en: "Humidity" },
  carbon_dioxide: "CO\u2082",
  pm25: "PM2.5",
  illuminance: { ja: "\u660E\u308B\u3055", en: "Brightness" }
};
var messages4 = defineMessages({
  ja: {
    unreadable: "\u8AAD\u3081\u307E\u305B\u3093",
    loadFailed: "\u30BB\u30F3\u30B5\u30FC\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    changeFailed: "\u5909\u3048\u3089\u308C\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    title: "\u8A08\u6E2C\u306B\u4F7F\u3046\u30BB\u30F3\u30B5\u30FC",
    note: "\u5207\u3063\u305F\u30BB\u30F3\u30B5\u30FC\u306F\u3001Home Control \u753B\u9762\u30FB\u5BB6\u96FB\u64CD\u4F5C\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\uFF08\u5E73\u5747\u306E\u5024\uFF09\u30FB\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u4F7F\u3044\u307E\u305B\u3093\u3002\u58CA\u308C\u305F\u30BB\u30F3\u30B5\u30FC\u3084\u3001\u5916\u306B\u7F6E\u3044\u305F\u30BB\u30F3\u30B5\u30FC\u3092\u5916\u3059\u3068\u304D\u306B\u4F7F\u3044\u307E\u3059\u3002",
    loading: "\u30BB\u30F3\u30B5\u30FC\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    none: "\u6E29\u5EA6\u30FB\u6E7F\u5EA6\u30FBCO\u2082 \u306A\u3069\u306E\u30BB\u30F3\u30B5\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002",
    turnOff: "{name}\u3092\u5207\u308B",
    turnOn: "{name}\u3092\u5165\u308C\u308B"
  },
  en: {
    unreadable: "Unavailable",
    loadFailed: "Couldn't load sensors ({status})",
    changeFailed: "Couldn't change it ({status})",
    title: "Sensors used for readings",
    note: "Sensors you turn off aren't used on the Home Control screen, in the home controls widget (averages) or by the voice assistant. Use this to leave out broken sensors or ones placed outdoors.",
    loading: "Loading sensors\u2026",
    none: "No temperature, humidity, CO\u2082 or similar sensors found.",
    turnOff: "Turn off {name}",
    turnOn: "Turn on {name}"
  }
});
function formatState(sensor, t) {
  const value = Number(sensor.state);
  if (!Number.isFinite(value)) return sensor.state === "unavailable" ? t("unreadable") : sensor.state;
  return `${value.toFixed(sensor.deviceClass === "temperature" ? 1 : 0)}${sensor.unit ?? ""}`;
}
function SensorSettings({ ctx, isAdmin }) {
  const t = messages4.useT();
  const locale = useLocale();
  const url = `${ctx.apiBaseUrl}/api/ext/home-assistant/sensors`;
  const [sensors, setSensors] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? messages4.t("loadFailed", { status: res.status }));
      if (!body.configured) return setSensors([]);
      setSensors(body.sensors);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);
  const toggle = async (sensor, enabled) => {
    setError(null);
    setSensors((list) => list?.map((s) => s.entityId === sensor.entityId ? { ...s, enabled } : s) ?? null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: sensor.entityId, enabled })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? messages4.t("changeFailed", { status: res.status }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      void load();
    }
  };
  const groups = Object.keys(CLASS_LABELS).map((deviceClass) => [deviceClass, (sensors ?? []).filter((s) => s.deviceClass === deviceClass)]).filter(([, list]) => list.length > 0);
  return /* @__PURE__ */ jsxs("section", { className: "ha-sensor-settings", children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: t("title") }),
    /* @__PURE__ */ jsx(Note, { children: t("note") }),
    error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
    sensors === null && !error && /* @__PURE__ */ jsx(Note, { children: t("loading") }),
    sensors !== null && sensors.length === 0 && /* @__PURE__ */ jsx(Note, { children: t("none") }),
    groups.map(([deviceClass, list]) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: textFor(CLASS_LABELS[deviceClass], locale) }),
      /* @__PURE__ */ jsx(List, { children: list.map((sensor) => /* @__PURE__ */ jsx(
        ListItem,
        {
          title: sensor.name,
          detail: [sensor.area, formatState(sensor, t), sensor.entityId].filter(Boolean).join(" \xB7 "),
          off: !sensor.enabled,
          trailing: /* @__PURE__ */ jsx(
            ToggleSwitch,
            {
              checked: sensor.enabled,
              disabled: !isAdmin,
              label: t(sensor.enabled ? "turnOff" : "turnOn", { name: sensor.name }),
              onChange: (enabled) => void toggle(sensor, enabled)
            }
          )
        },
        sensor.entityId
      )) })
    ] }, deviceClass))
  ] });
}

// extensions/home-assistant/src/web.tsx
var web_default = defineWebExtension({
  widgets: [controls_widget_default],
  SettingsPanel: SensorSettings,
  screens: [
    {
      id: "home-control",
      label: "Home Control",
      ariaLabel: { ja: "\u30DB\u30FC\u30E0\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB", en: "Home Control" },
      icon: "lightbulb",
      order: 20,
      Component: HomeControlScreen
    }
  ]
});
export {
  web_default as default
};
