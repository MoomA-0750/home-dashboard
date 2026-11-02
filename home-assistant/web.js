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

// extensions/home-assistant/src/homeTypes.ts
var TILE_SIZES = ["2x1", "2x2", "4x2", "4x4"];
var DEFAULT_SIZE = "2x2";
var TILE_COLORS = ["#ffecb3", "#ffd6a5", "#ffc4c4", "#f5c2e7", "#d9c8ff", "#c6dcff", "#b8ecf5", "#c8f0d0", "#e9f5b5", "#f2f2f2"];
var DEFAULT_COLORS = {
  toggle: "#ffecb3",
  climate: "#b8ecf5",
  lock: "#c8f0d0"
};
async function fetchLayout(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/layout`);
  if (!res.ok) throw new Error(`layout ${res.status}`);
  return await res.json();
}
async function saveLayout(apiBaseUrl, layout) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout)
  });
  if (!res.ok) throw new Error(`layout ${res.status}`);
  return await res.json();
}
function orderTiles(tiles, order) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return tiles.map((tile, index) => ({ tile, index })).sort((a, b) => {
    const ra = rank.get(a.tile.entity.entityId) ?? order.length + a.index;
    const rb = rank.get(b.tile.entity.entityId) ?? order.length + b.index;
    return ra - rb;
  }).map(({ tile }) => tile);
}
function moveId(ids, id, target) {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
function textOn(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
  return luminance > 0.4 ? "#2b2200" : "#ffffff";
}
function sizeOf(size) {
  const [w, h] = size.split("x").map(Number);
  return { w, h };
}
function gridMetrics(width) {
  const cols = width >= 1240 ? 12 : width >= 980 ? 10 : width >= 720 ? 8 : width >= 520 ? 6 : 4;
  return { cols, gap: width >= 980 ? 14 : width >= 520 ? 12 : 10 };
}
function packTiles(sizes, cols) {
  const used = /* @__PURE__ */ new Set();
  const free = (col, row, w, h) => {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) if (used.has(`${c}:${r}`)) return false;
    return true;
  };
  return sizes.map((size) => {
    const { h } = sizeOf(size);
    const w = Math.min(sizeOf(size).w, cols);
    for (let band = 0; ; band++) {
      for (let col = 0; col + w <= cols; col++) {
        for (const row of h === 1 ? [band * 2, band * 2 + 1] : [band * 2]) {
          if (!free(col, row, w, h)) continue;
          for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) used.add(`${c}:${r}`);
          return { col, row, w };
        }
      }
    }
  });
}

// extensions/home-assistant/src/units.ts
function localizeState(entity) {
  const value = Number(entity.state);
  if (entity.state === "" || !Number.isFinite(value)) return { ...entity, unit: convertReading(0, entity.unit).unit };
  const converted = convertReading(value, entity.unit);
  return { ...entity, state: String(Math.round(converted.value * 100) / 100), unit: converted.unit };
}
function localizeReading(reading) {
  const converted = convertReading(reading.value, reading.unit);
  return { ...reading, value: converted.value, unit: converted.unit };
}
function localizeSeries(series) {
  const unit = convertReading(0, series.unit).unit;
  return { ...series, unit, points: series.points.map(([t, v]) => [t, convertReading(v, series.unit).value]) };
}

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/home-assistant/src/controls-widget.tsx
var ON_COLORS = { "--tile-color": DEFAULT_COLORS.toggle, "--tile-ink": textOn(DEFAULT_COLORS.toggle) };
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
  const body = await res.json();
  return { ...body, readings: (body.readings ?? []).map(localizeReading) };
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
  return (
    // Home Control のタイルと同じ見た目（オフはガラス、オンはタイルの色）。角はカードの丸みから余白を引いたもの
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: cx(
          "glass home-tile-state press untrim flex min-h-0 cursor-pointer flex-col items-start justify-between gap-1 overflow-hidden rounded-inner px-3.5 py-2.5 text-left text-text",
          "disabled:cursor-not-allowed disabled:opacity-55"
        ),
        style: ON_COLORS,
        "data-state": on ? "on" : void 0,
        disabled: !service,
        onClick: () => onToggle(entity),
        "aria-label": `${entity.name}\uFF08${stateLabel(entity.state, locale)}\uFF09`,
        title: service ? stateLabel(entity.state, locale) : t("disabled"),
        children: [
          /* @__PURE__ */ jsx(Icon, { name: entityIcon(entity), className: "size-5 flex-none" }),
          /* @__PURE__ */ jsx("span", { className: "ellipsis max-w-full flex-none text-note font-semibold", children: entity.name })
        ]
      }
    )
  );
}
function HaControlsView({ ctx, config }) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error, entities, loading, toggle, failure } = useEntityControl(ctx.apiBaseUrl, config.pollIntervalMs);
  if (!loading && data && !data.configured) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      t("notConnected"),
      /* @__PURE__ */ jsx(WidgetHint, { children: t("notConnectedHint") })
    ] });
  }
  const shown = chosenEntities(entities, config.entityIds);
  const readings = chosenReadings(data?.readings ?? [], config.readings);
  return (
    // 左に室温・湿度など、右に選んだ家電のボタン
    /* @__PURE__ */ jsxs(WidgetCard, { className: "flex-row items-center justify-start gap-5", children: [
      readings.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-none flex-col justify-center gap-2", children: readings.map((reading) => {
        const meta = READING_META[reading.deviceClass];
        return /* @__PURE__ */ jsxs(
          "span",
          {
            className: "flex items-center gap-2 text-muted [&_.fluent-icon]:size-5",
            title: t("readingAverage", { label: textFor(meta.label, locale), n: reading.count }),
            children: [
              /* @__PURE__ */ jsx(Icon, { name: meta.icon }),
              /* @__PURE__ */ jsxs("span", { className: "text-heading font-semibold text-text tabular-nums", children: [
                reading.value.toFixed(meta.digits),
                /* @__PURE__ */ jsx("small", { className: "ml-0.5 text-note font-medium text-muted", children: reading.unit })
              ] })
            ]
          },
          reading.deviceClass
        );
      }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 min-w-0 flex-auto flex-col gap-2 self-stretch", children: [
        loading && !data && /* @__PURE__ */ jsx(WidgetHint, { children: t("loading") }),
        Boolean(error) && !data && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("unreachable") }),
        failure && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: failure }),
        data && shown.length === 0 && /* @__PURE__ */ jsx(WidgetHint, { children: t("chooseHint") }),
        /* @__PURE__ */ jsx("div", { className: "ha-controls-grid grid min-h-0 w-full flex-auto gap-2.5", children: shown.map((e) => /* @__PURE__ */ jsx(
          EntityButton,
          {
            entity: e,
            allowUnlock: data?.allowUnlock ?? false,
            onToggle: (entity) => toggle(entity, data?.allowUnlock ?? false)
          },
          e.entityId
        )) })
      ] })
    ] })
  );
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
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: t("readingsTitle") }),
    /* @__PURE__ */ jsx(Note, { children: t("readingsNote") }),
    /* @__PURE__ */ jsx(List, { children: Object.entries(READING_META).map(([deviceClass, meta]) => /* @__PURE__ */ jsx(
      ListItem,
      {
        leading: /* @__PURE__ */ jsx(Icon, { name: meta.icon, className: "size-5.5 flex-none" }),
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
          leading: /* @__PURE__ */ jsx(Icon, { name: entityIcon(entity), className: "size-5.5 flex-none" }),
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
    minMax: "{min}\u301C{max}",
    period: "\u671F\u9593",
    loading: "\u8A18\u9332\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    note: "\u540D\u524D\u306E\u4E0B\u306E\u300C\u301C\u300D\u306E\u5024\u306F\u3001\u3053\u306E\u671F\u9593\u306E\u6700\u4F4E\u3068\u6700\u9AD8\u3067\u3059\u3002"
  },
  en: {
    range24h: "24 hours",
    range7d: "7 days",
    noRecords: "No records for this period.",
    trend: "Trend over {range}",
    now: "Now",
    loadFailed: "Couldn't load records ({status})",
    minMax: "{min}\u2013{max}",
    period: "Period",
    loading: "Loading records\u2026",
    note: "The range under each name is the lowest and highest value in this period."
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
  if (all.length === 0) return /* @__PURE__ */ jsx(Note, { children: t("noRecords") });
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
      className: "block h-auto w-full",
      viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
      role: "img",
      "aria-label": t("trend", { range: t(hours <= 24 ? "range24h" : "range7d") }),
      children: [
        yTicks.map((v) => /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx("line", { className: "stroke-white/10", strokeWidth: 1, x1: PAD.left, x2: CHART_WIDTH - PAD.right, y1: y(v), y2: y(v) }),
          /* @__PURE__ */ jsx("text", { className: "fill-muted text-micro", x: PAD.left - 6, y: y(v) + 4, textAnchor: "end", children: formatValue(v, digits) })
        ] }, `y${v}`)),
        xTicks.map((tick, i) => /* @__PURE__ */ jsx(
          "text",
          {
            className: "fill-muted text-micro",
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
              fill: "none",
              stroke: COLORS[index % COLORS.length],
              strokeWidth: 2.5,
              strokeLinejoin: "round",
              strokeLinecap: "round",
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
      if (!cancelled) setSeries(body.series.map(localizeSeries));
    }).catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, ids, hours]);
  const ordered = series ? sensors.map((s) => series.find((x) => x.entityId === s.entityId)).filter((s) => !!s) : [];
  const statsFor = (entityId) => {
    const points = series?.find((s) => s.entityId === entityId)?.points ?? [];
    if (points.length === 0) return null;
    const values = points.map(([, v]) => v);
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  return /* @__PURE__ */ jsx(Dialog, { title, onClose, size: "wide", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsx(List, { boxed: true, children: sensors.map((sensor, index) => {
      const value = Number(sensor.state);
      const stats = statsFor(sensor.entityId);
      return /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx("span", { className: "size-2.5 flex-none rounded-full", style: { background: COLORS[index % COLORS.length] } }),
          title: sensor.name,
          detail: stats ? t("minMax", { min: formatValue(stats.min, digits), max: formatValue(stats.max, digits) }) : void 0,
          trailing: /* @__PURE__ */ jsxs("span", { className: "text-heading font-semibold whitespace-nowrap tabular-nums", children: [
            Number.isFinite(value) ? formatValue(value, digits) : "\u2014",
            /* @__PURE__ */ jsx("small", { className: "ml-0.5 text-caption font-normal text-muted", children: sensor.unit })
          ] })
        },
        sensor.entityId
      );
    }) }),
    /* @__PURE__ */ jsx("div", { className: "flex gap-2", role: "group", "aria-label": t("period"), children: RANGES.map((range) => /* @__PURE__ */ jsx(Chip, { selected: hours === range.hours, onClick: () => setHours(range.hours), children: t(range.label) }, range.hours)) }),
    error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
    !error && !series && /* @__PURE__ */ jsx(Note, { children: t("loading") }),
    series && /* @__PURE__ */ jsx(Chart, { series: ordered, hours, digits }),
    series && /* @__PURE__ */ jsx(Note, { children: t("note") })
  ] }) });
}

// extensions/home-assistant/src/tiles.tsx
var tileMessages = defineMessages({
  ja: {
    locked: "\u65BD\u9320\u4E2D",
    unlocked: "\u89E3\u9320\u4E2D",
    locking: "\u65BD\u9320\u3057\u3066\u3044\u307E\u3059\u2026",
    unlocking: "\u89E3\u9320\u3057\u3066\u3044\u307E\u3059\u2026",
    jammed: "\u8A70\u307E\u3063\u3066\u3044\u307E\u3059",
    open: "\u958B\u3044\u3066\u3044\u307E\u3059",
    unknownState: "\u72B6\u614B\u4E0D\u660E",
    lock: "\u65BD\u9320",
    unlockConfirm: "\u3082\u3046\u4E00\u5EA6\u62BC\u3057\u3066\u89E3\u9320",
    unlockConfirmShort: "\u3082\u3046\u4E00\u5EA6",
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
    brightnessOf: "{name}\u306E\u660E\u308B\u3055",
    details: "{name}\u306E\u8A73\u7D30"
  },
  en: {
    locked: "Locked",
    unlocked: "Unlocked",
    locking: "Locking\u2026",
    unlocking: "Unlocking\u2026",
    jammed: "Jammed",
    open: "Open",
    unknownState: "Unknown",
    lock: "Lock",
    unlockConfirm: "Press again to unlock",
    unlockConfirmShort: "Again",
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
    brightnessOf: "{name} brightness",
    details: "{name} details"
  }
});
var HVAC_LABELS = {
  off: { ja: "\u505C\u6B62", en: "Off" },
  heat: { ja: "\u6696\u623F", en: "Heat" },
  cool: { ja: "\u51B7\u623F", en: "Cool" },
  heat_cool: { ja: "\u51B7\u6696\u623F", en: "Heat/Cool" },
  auto: { ja: "\u81EA\u52D5", en: "Auto" },
  dry: { ja: "\u9664\u6E7F", en: "Dry" },
  fan_only: { ja: "\u9001\u98A8", en: "Fan" }
};
function toggleIcon(toggle) {
  return toggle.domain === "light" ? "lightbulb" : toggle.domain === "fan" ? "arrow-sync" : "plug";
}
function lockStateLabel(lock, t) {
  const key = ["locked", "unlocked", "locking", "unlocking", "jammed", "open"].find((k) => k === lock.state);
  return t(key ?? "unknownState");
}
function toggleStateLabel(toggle, t) {
  if (toggle.state === "unavailable") return t("noResponse");
  if (toggle.state !== "on") return t("off");
  return toggle.brightnessPct !== null ? `${toggle.brightnessPct}%` : t("on");
}
function tileIsOn(tile) {
  if (tile.kind === "toggle") return tile.entity.state === "on";
  if (tile.kind === "climate") return tile.entity.state !== "off" && tile.entity.state !== "unavailable";
  return false;
}
var SIZE_CLASSES = {
  "2x1": {
    frame: "flex-row items-center",
    main: "flex-row items-center justify-start gap-2.5 py-0 pr-1 pl-3.5",
    icon: "size-6",
    text: "gap-0.5",
    name: "text-fit-small",
    state: "text-fit-caption",
    actions: "p-0 pr-1",
    action: "flex-none",
    more: "static mr-2 flex-none"
  },
  "2x2": { frame: "", main: "", icon: "", text: "", name: "", state: "", actions: "", action: "", more: "" },
  "4x2": { frame: "", main: "", icon: "", text: "", name: "", state: "", actions: "", action: "", more: "" },
  "4x4": { frame: "", main: "px-6.5 py-6", icon: "size-11", text: "", name: "text-fit-title", state: "", actions: "", action: "", more: "" }
};
var MAIN = "flex min-h-0 w-full flex-1 flex-col items-start justify-between gap-1.5 border-0 bg-transparent px-4.5 py-4 text-left text-current";
var MAIN_STATIC = "flex-initial justify-start";
var ON_TILE_BUTTON = "text-current hover:bg-current/10 focus-visible:bg-current/10";
var ON_TILE_SELECTED = "aria-pressed:bg-(--tile-ink) aria-pressed:text-(--tile-color)";
var MIN_FIT = 0.7;
function useFitText(tile, key) {
  useLayoutEffect(() => {
    if (!tile) return;
    const fit = () => {
      const overflows = () => Array.from(tile.querySelectorAll("[data-tile-main]")).some(
        (main) => main.scrollHeight > main.clientHeight + 1 || main.scrollWidth > main.clientWidth + 1
      );
      let scale = 1;
      tile.style.setProperty("--fit", "1");
      while (overflows() && scale > MIN_FIT) {
        scale = Math.round((scale - 0.05) * 100) / 100;
        tile.style.setProperty("--fit", String(scale));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(tile);
    return () => observer.disconnect();
  }, [tile, key]);
}
function TileText({ size, icon, iconClass, name, state }) {
  const sz = SIZE_CLASSES[size];
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx(Icon, { name: icon, className: cx("size-7 flex-none", sz.icon, iconClass) }),
    /* @__PURE__ */ jsxs("span", { className: cx("flex max-w-full min-w-0 flex-col gap-1", sz.text), children: [
      /* @__PURE__ */ jsx("span", { className: cx("text-fit-body leading-tight font-semibold wrap-anywhere", sz.name), children: name }),
      /* @__PURE__ */ jsx("span", { className: cx("text-fit-note leading-tight wrap-anywhere opacity-75", sz.state), children: state })
    ] })
  ] });
}
function TileFrame({
  tile,
  size,
  color,
  place,
  editOverlay,
  onDetail,
  state,
  children
}) {
  const t = tileMessages.useT();
  const [box, setBox] = useState(null);
  useFitText(box, `${size}:${tile.entity.name}:${tile.entity.state}`);
  const { w, h } = sizeOf(size);
  const tint = color ?? DEFAULT_COLORS[tile.kind];
  const style = {
    gridColumn: place ? `${place.col + 1} / span ${place.w}` : `span ${w}`,
    gridRow: place ? `${place.row + 1} / span ${h}` : `span ${h}`,
    "--tile-color": tint,
    "--tile-ink": textOn(tint)
  };
  return (
    // タイルの大きさはます目で決まり、中身（明るさのバーの有無など）では変わらない
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: cx(
          "glass home-tile-radius home-tile-state change @container relative flex min-h-0 min-w-0 flex-col justify-between overflow-hidden",
          SIZE_CLASSES[size].frame
        ),
        style,
        ref: setBox,
        "data-tile-id": tile.entity.entityId,
        "data-state": tileIsOn(tile) ? "on" : state,
        children: [
          children,
          !editOverlay && // 詳細を開く「>」（右上。2x1 は右端）
          /* @__PURE__ */ jsx(
            IconButton,
            {
              icon: "chevron-right",
              label: t("details", { name: tile.entity.name }),
              className: cx("absolute top-2 right-2 z-1", ON_TILE_BUTTON, SIZE_CLASSES[size].more),
              onClick: onDetail
            }
          ),
          editOverlay
        ]
      }
    )
  );
}
function ToggleTile({
  toggle,
  busy,
  onToggle,
  onBrightness,
  ...frame
}) {
  const t = tileMessages.useT();
  const on = toggle.state === "on";
  const [draft, setDraft] = useState(null);
  const showSlider = frame.size !== "2x1" && toggle.dimmable && on;
  return /* @__PURE__ */ jsxs(TileFrame, { ...frame, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: cx(MAIN, "cursor-pointer disabled:cursor-default disabled:opacity-60", SIZE_CLASSES[frame.size].main),
        "data-tile-main": true,
        "aria-pressed": on,
        disabled: busy || toggle.state === "unavailable",
        onClick: onToggle,
        children: /* @__PURE__ */ jsx(TileText, { size: frame.size, icon: toggleIcon(toggle), name: toggle.name, state: toggleStateLabel(toggle, t) })
      }
    ),
    showSlider && // 明るさのバー。点いているときはタイルの地の上なので、文字の色に寄せる（home-tile-state が色を決める）
    /* @__PURE__ */ jsx(
      Slider,
      {
        className: "mx-4.5 mb-3.5 flex-none",
        value: draft ?? toggle.brightnessPct ?? 100,
        min: 1,
        max: 100,
        step: 1,
        label: t("brightnessOf", { name: toggle.name }),
        valueText: `${draft ?? toggle.brightnessPct ?? 100}%`,
        onInput: setDraft,
        onCommit: (value) => {
          onBrightness(value);
          setDraft(null);
        }
      }
    )
  ] });
}
var UNLOCK_CONFIRM_MS = 4e3;
function useUnlockConfirm(onUnlock) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), UNLOCK_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);
  const press = () => {
    if (!confirming) return setConfirming(true);
    setConfirming(false);
    onUnlock();
  };
  return { confirming, press };
}
function LockTile({
  lock,
  canUnlock,
  busy,
  onLock,
  onUnlock,
  ...frame
}) {
  const t = tileMessages.useT();
  const { confirming, press } = useUnlockConfirm(onUnlock);
  const unlocked = lock.state === "unlocked" || lock.state === "open";
  const wide = frame.size === "4x2" || frame.size === "4x4";
  const short = frame.size === "2x1";
  const sz = SIZE_CLASSES[frame.size];
  const lockButton = /* @__PURE__ */ jsx(Button, { size: "lg", className: cx("flex-1 px-3", sz.action), disabled: busy || lock.state === "locked", onClick: onLock, children: t("lock") });
  const unlockButton = canUnlock ? /* @__PURE__ */ jsx(
    Button,
    {
      size: "lg",
      variant: confirming ? "danger" : "default",
      className: cx("flex-1 px-3", sz.action),
      disabled: busy || unlocked,
      onClick: press,
      children: confirming ? t(short ? "unlockConfirmShort" : "unlockConfirm") : t("unlock")
    }
  ) : null;
  return (
    // 鍵: 解錠中は注意の色、詰まったら赤い縁。施錠中はアイコンをタイルの色にする
    /* @__PURE__ */ jsxs(TileFrame, { ...frame, state: lock.state === "jammed" ? "error" : unlocked ? "alert" : void 0, children: [
      /* @__PURE__ */ jsx("div", { className: cx(MAIN, MAIN_STATIC, sz.main), "data-tile-main": true, children: /* @__PURE__ */ jsx(
        TileText,
        {
          size: frame.size,
          icon: unlocked ? "lock-open" : "lock-closed",
          iconClass: unlocked ? "text-warn" : "text-(--tile-color)",
          name: lock.name,
          state: lockStateLabel(lock, t)
        }
      ) }),
      /* @__PURE__ */ jsx("div", { className: cx("flex flex-none gap-2 px-3.5 pb-3.5", sz.actions), children: wide ? /* @__PURE__ */ jsxs(Fragment2, { children: [
        lockButton,
        unlockButton ?? /* @__PURE__ */ jsx("span", { className: "text-note opacity-75", children: t("cannotUnlock") })
      ] }) : unlocked || !unlockButton ? lockButton : unlockButton })
    ] })
  );
}
function climateClamp(climate, value) {
  const step = climate.step ?? 0.5;
  return Math.min(climate.maxTemperature ?? 30, Math.max(climate.minTemperature ?? 16, Math.round(value / step) * step));
}
function TargetControl({
  climate,
  busy,
  onCall,
  onTile
}) {
  const t = tileMessages.useT();
  const step = climate.step ?? 0.5;
  const target = climate.targetTemperature;
  const off = climate.state === "off";
  const disabled = busy || off || target === null;
  const buttonClass2 = cx("size-10", onTile && ON_TILE_BUTTON);
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
    /* @__PURE__ */ jsx(
      IconButton,
      {
        icon: "chevron-down",
        label: t("lowerTemp"),
        className: buttonClass2,
        disabled,
        onClick: () => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target - step) })
      }
    ),
    /* @__PURE__ */ jsxs("span", { className: "home-target-value", children: [
      off ? "\u2014" : target ?? "\u2014",
      /* @__PURE__ */ jsx("small", { children: "\u2103" })
    ] }),
    /* @__PURE__ */ jsx(
      IconButton,
      {
        icon: "chevron-up",
        label: t("raiseTemp"),
        className: buttonClass2,
        disabled,
        onClick: () => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target + step) })
      }
    )
  ] });
}
function ModeChips({
  climate,
  modes,
  busy,
  label,
  modeLabel,
  onCall,
  className,
  chipClass
}) {
  return /* @__PURE__ */ jsx("div", { className: cx("flex flex-wrap gap-2", className), role: "group", "aria-label": label, children: modes.map((mode) => /* @__PURE__ */ jsx(
    Chip,
    {
      selected: climate.state === mode,
      className: chipClass,
      disabled: busy,
      onClick: () => onCall("set_hvac_mode", { hvac_mode: mode }),
      children: modeLabel(mode)
    },
    mode
  )) });
}
function ClimateTile({
  climate,
  busy,
  onCall,
  modeLabel,
  ...frame
}) {
  const t = tileMessages.useT();
  const off = climate.state === "off";
  const short = frame.size === "2x1";
  const wide = frame.size === "4x2" || frame.size === "4x4";
  const modes = climate.hvacModes.filter((mode) => mode !== "off");
  const sz = SIZE_CLASSES[frame.size];
  const power = /* @__PURE__ */ jsx(
    IconButton,
    {
      icon: "power",
      size: "lg",
      selected: !off,
      label: t(off ? "turnOn" : "turnOff", { name: climate.name }),
      className: cx(!short && "absolute top-2 right-14 z-1", ON_TILE_SELECTED),
      disabled: busy,
      onClick: () => onCall(off ? "turn_on" : "turn_off")
    }
  );
  return /* @__PURE__ */ jsxs(TileFrame, { ...frame, children: [
    /* @__PURE__ */ jsx("div", { className: cx(MAIN, MAIN_STATIC, sz.main), "data-tile-main": true, children: /* @__PURE__ */ jsx(
      TileText,
      {
        size: frame.size,
        icon: "temperature",
        name: climate.name,
        state: /* @__PURE__ */ jsxs(Fragment2, { children: [
          off ? t("off") : modeLabel(climate.state),
          " \xB7 ",
          t("roomTemp", { value: climate.currentTemperature ?? "\u2014" }),
          "\u2103"
        ] })
      }
    ) }),
    short ? /* @__PURE__ */ jsx("div", { className: cx("flex flex-none gap-2 px-3.5 pb-3.5", sz.actions), children: power }) : (
      // 下に設定温度。広いタイルは、その右に運転モードを並べる（入りきらなければ折り返す）。
      // 4x2 でもスマホのように幅が足りないときは運転モードを出さない（電源と重なるため。詳細で変える）
      /* @__PURE__ */ jsxs("div", { className: "flex flex-none items-center gap-3 px-3 pb-3", children: [
        power,
        /* @__PURE__ */ jsx(TargetControl, { climate, busy, onCall, onTile: !off }),
        wide && modes.length > 0 && /* @__PURE__ */ jsx(
          ModeChips,
          {
            climate,
            modes,
            busy,
            label: t("hvacMode"),
            modeLabel,
            onCall,
            className: "hidden min-w-0 flex-1 justify-end gap-1.5 @tile:flex",
            chipClass: ON_TILE_SELECTED
          }
        )
      ] })
    )
  ] });
}

// extensions/home-assistant/src/TileDetail.tsx
var messages3 = defineMessages({
  ja: {
    power: "\u96FB\u6E90",
    turnOn: "\u3064\u3051\u308B",
    turnOff: "\u6D88\u3059",
    brightness: "\u660E\u308B\u3055 {value}%",
    lightColor: "\u7167\u660E\u306E\u8272",
    hueOf: "\u8272\u76F8 {value}\xB0",
    white: "\u767D\u306E\u8272",
    kelvin: "{value} K",
    warm: "\u6696\u304B\u3044",
    cool: "\u6DBC\u3057\u3044",
    setColor: "{name}\u306B\u3059\u308B",
    size: "\u30BF\u30A4\u30EB\u306E\u5927\u304D\u3055",
    tileColor: "\u30BF\u30A4\u30EB\u306E\u8272",
    tileColorNote: "\u3064\u3051\u3066\u3044\u308B\u3068\u304D\u30FB\u52D5\u3044\u3066\u3044\u308B\u3068\u304D\u306E\u30BF\u30A4\u30EB\u306E\u5730\u306E\u8272\u3067\u3059\u3002\u5168\u90E8\u306E\u7AEF\u672B\u3067\u540C\u3058\u306B\u306A\u308A\u307E\u3059\u3002",
    defaultColor: "\u65E2\u5B9A\u306E\u8272",
    color: "\u8272 {value}",
    target: "\u8A2D\u5B9A\u6E29\u5EA6",
    roomTemp: "\u5BA4\u6E29 {value}\u2103",
    mode: "\u904B\u8EE2\u30E2\u30FC\u30C9",
    lockState: "\u72B6\u614B"
  },
  en: {
    power: "Power",
    turnOn: "Turn on",
    turnOff: "Turn off",
    brightness: "Brightness {value}%",
    lightColor: "Light color",
    hueOf: "Hue {value}\xB0",
    white: "White",
    kelvin: "{value} K",
    warm: "Warm",
    cool: "Cool",
    setColor: "Set to {name}",
    size: "Tile size",
    tileColor: "Tile color",
    tileColorNote: "The tile's background while it's on or running. The same on every device.",
    defaultColor: "Default color",
    color: "Color {value}",
    target: "Target temperature",
    roomTemp: "Room {value}\u2103",
    mode: "Mode",
    lockState: "State"
  }
});
var HUES = [0, 25, 45, 60, 90, 130, 170, 195, 220, 250, 280, 320];
var SATURATION = 85;
var hueCss = (hue, saturation = SATURATION) => `hsl(${hue} ${saturation}% 60%)`;
var SIZE_SHAPES = {
  "2x1": "h-2 w-4",
  "2x2": "size-3",
  "4x2": "h-2.5 w-5",
  "4x4": "size-4"
};
function Row({ title, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: title }),
    children
  ] });
}
function Swatch({
  color,
  selected,
  label,
  disabled,
  onClick
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      className: cx(
        "press grid size-10.5 cursor-pointer place-items-center rounded-full border-2 border-white/25 bg-(--swatch) p-0 text-black/80",
        "outline-offset-2 aria-pressed:outline-3 aria-pressed:outline-text disabled:cursor-default disabled:opacity-50 [&_.fluent-icon]:size-5"
      ),
      style: { "--swatch": color },
      "aria-pressed": selected,
      "aria-label": label,
      disabled,
      onClick,
      children: selected && /* @__PURE__ */ jsx(Icon, { name: "checkmark" })
    }
  );
}
function Hero({ control, state, hint }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
    control,
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsx("span", { className: "text-title font-semibold", children: state }),
      hint && /* @__PURE__ */ jsx("span", { className: "text-note text-muted", children: hint })
    ] })
  ] });
}
function TileDetail({ tile, size, color, canUnlock, busy, modeLabel, onCall, onLayout, onClose }) {
  const t = messages3.useT();
  const current = color ?? DEFAULT_COLORS[tile.kind];
  return /* @__PURE__ */ jsx(Dialog, { title: tile.entity.name, onClose, children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5", children: [
    tile.kind === "toggle" && /* @__PURE__ */ jsx(ToggleControls, { toggle: tile.entity, busy, onCall }),
    tile.kind === "lock" && /* @__PURE__ */ jsx(LockControls, { lock: tile.entity, canUnlock, busy, onCall }),
    tile.kind === "climate" && /* @__PURE__ */ jsx(ClimateControls, { climate: tile.entity, busy, modeLabel, onCall }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 border-t border-line pt-5", children: [
      /* @__PURE__ */ jsx(Row, { title: t("size"), children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", role: "group", "aria-label": t("size"), children: TILE_SIZES.map((option) => /* @__PURE__ */ jsxs(Chip, { selected: size === option, onClick: () => onLayout({ size: option }), children: [
        /* @__PURE__ */ jsx("span", { className: cx("inline-block border-2 border-current", SIZE_SHAPES[option]), "aria-hidden": "true" }),
        option.replace("x", "\xD7")
      ] }, option)) }) }),
      /* @__PURE__ */ jsxs(Row, { title: t("tileColor"), children: [
        /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2.5", role: "group", "aria-label": t("tileColor"), children: TILE_COLORS.map((swatch) => /* @__PURE__ */ jsx(
          Swatch,
          {
            color: swatch,
            selected: current === swatch,
            label: swatch === DEFAULT_COLORS[tile.kind] ? t("defaultColor") : t("color", { value: swatch }),
            onClick: () => onLayout({ color: swatch === DEFAULT_COLORS[tile.kind] ? null : swatch })
          },
          swatch
        )) }),
        /* @__PURE__ */ jsx(Note, { children: t("tileColorNote") })
      ] })
    ] })
  ] }) });
}
function ToggleControls({ toggle, busy, onCall }) {
  const t = messages3.useT();
  const tt = tileMessages.useT();
  const on = toggle.state === "on";
  const [brightness, setBrightness] = useState(null);
  const minK = toggle.minKelvin ?? 2e3;
  const maxK = toggle.maxKelvin ?? 6500;
  const [kelvin, setKelvin] = useState(null);
  const shownKelvin = kelvin ?? toggle.colorTempKelvin ?? Math.round((minK + maxK) / 2);
  const hue = toggle.hsColor?.[0] ?? null;
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx(
      Hero,
      {
        control: /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: toggleIcon(toggle),
            size: "lg",
            selected: on,
            label: on ? t("turnOff") : t("turnOn"),
            disabled: busy || toggle.state === "unavailable",
            onClick: () => onCall(on ? "turn_off" : "turn_on")
          }
        ),
        state: toggleStateLabel(toggle, tt),
        hint: on ? t("turnOff") : t("turnOn")
      }
    ),
    toggle.dimmable && /* @__PURE__ */ jsx(Row, { title: t("brightness", { value: brightness ?? toggle.brightnessPct ?? 0 }), children: /* @__PURE__ */ jsx(
      Slider,
      {
        value: brightness ?? toggle.brightnessPct ?? 100,
        min: 1,
        max: 100,
        step: 1,
        disabled: busy,
        label: tt("brightnessOf", { name: toggle.name }),
        valueText: `${brightness ?? toggle.brightnessPct ?? 100}%`,
        onInput: setBrightness,
        onCommit: (value) => {
          onCall("turn_on", { brightness_pct: value });
          setBrightness(null);
        }
      }
    ) }),
    toggle.colorable && /* @__PURE__ */ jsx(Row, { title: t("lightColor"), children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2.5", role: "group", "aria-label": t("lightColor"), children: HUES.map((option) => {
      const selected = hue !== null && Math.abs(hue - option) < 8 && (toggle.hsColor?.[1] ?? 0) > 40;
      return /* @__PURE__ */ jsx(
        Swatch,
        {
          color: hueCss(option),
          selected,
          label: t("setColor", { name: t("hueOf", { value: option }) }),
          disabled: busy,
          onClick: () => onCall("turn_on", { hs_color: [option, SATURATION] })
        },
        option
      );
    }) }) }),
    toggle.colorTemp && /* @__PURE__ */ jsx(Row, { title: `${t("white")} \xB7 ${t("kelvin", { value: shownKelvin })}`, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5", children: [
      /* @__PURE__ */ jsx("small", { className: "text-caption text-muted", children: t("warm") }),
      /* @__PURE__ */ jsx(
        Slider,
        {
          className: "flex-1",
          value: shownKelvin,
          min: minK,
          max: maxK,
          step: 50,
          disabled: busy,
          label: t("white"),
          valueText: t("kelvin", { value: shownKelvin }),
          onInput: setKelvin,
          onCommit: (value) => {
            onCall("turn_on", { color_temp_kelvin: Math.round(value) });
            setKelvin(null);
          }
        }
      ),
      /* @__PURE__ */ jsx("small", { className: "text-caption text-muted", children: t("cool") })
    ] }) })
  ] });
}
function LockControls({
  lock,
  canUnlock,
  busy,
  onCall
}) {
  const tt = tileMessages.useT();
  const { confirming, press } = useUnlockConfirm(() => onCall("unlock"));
  const unlocked = lock.state === "unlocked" || lock.state === "open";
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx(
      Hero,
      {
        control: /* @__PURE__ */ jsx(Icon, { name: unlocked ? "lock-open" : "lock-closed", className: cx("size-8", unlocked ? "text-warn" : "text-ok") }),
        state: lockStateLabel(lock, tt)
      }
    ),
    /* @__PURE__ */ jsxs(ButtonRow, { children: [
      /* @__PURE__ */ jsx(Button, { size: "lg", disabled: busy || lock.state === "locked", onClick: () => onCall("lock"), children: tt("lock") }),
      canUnlock && /* @__PURE__ */ jsx(Button, { size: "lg", variant: confirming ? "danger" : "default", disabled: busy || unlocked, onClick: press, children: confirming ? tt("unlockConfirm") : tt("unlock") })
    ] }),
    !canUnlock && /* @__PURE__ */ jsx(Note, { children: tt("cannotUnlock") })
  ] });
}
function ClimateControls({
  climate,
  busy,
  modeLabel,
  onCall
}) {
  const t = messages3.useT();
  const tt = tileMessages.useT();
  const off = climate.state === "off";
  return /* @__PURE__ */ jsxs(Fragment2, { children: [
    /* @__PURE__ */ jsx(
      Hero,
      {
        control: /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: "power",
            size: "lg",
            selected: !off,
            label: tt(off ? "turnOn" : "turnOff", { name: climate.name }),
            disabled: busy,
            onClick: () => onCall(off ? "turn_on" : "turn_off")
          }
        ),
        state: off ? tt("off") : modeLabel(climate.state),
        hint: t("roomTemp", { value: climate.currentTemperature ?? "\u2014" })
      }
    ),
    /* @__PURE__ */ jsx(Row, { title: t("target"), children: /* @__PURE__ */ jsx(TargetControl, { climate, busy, onCall }) }),
    climate.hvacModes.length > 0 && /* @__PURE__ */ jsx(Row, { title: t("mode"), children: /* @__PURE__ */ jsx(ModeChips, { climate, modes: climate.hvacModes, busy, label: t("mode"), modeLabel, onCall }) })
  ] });
}

// extensions/home-assistant/src/HomeControlScreen.tsx
async function fetchOverview(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/overview`);
  if (!res.ok) throw new Error(messages4.t("apiError", { status: res.status }));
  const overview = await res.json();
  return { ...overview, sensors: (overview.sensors ?? []).map(localizeState) };
}
async function callService2(apiBaseUrl, entityId, service, data) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, service, data })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? messages4.t("callFailed", { status: res.status }));
  }
}
var SENSOR_META = {
  temperature: { label: { ja: "\u5BA4\u6E29", en: "Temperature" }, icon: "temperature" },
  humidity: { label: { ja: "\u6E7F\u5EA6", en: "Humidity" }, icon: "drop" },
  carbon_dioxide: { label: "CO\u2082", icon: "molecule" },
  pm25: { label: "PM2.5", icon: "molecule" },
  illuminance: { label: { ja: "\u660E\u308B\u3055", en: "Brightness" }, icon: "weather-sunny" }
};
var messages4 = defineMessages({
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
    nothingHere: "\u3053\u306E\u90E8\u5C4B\u306B\u51FA\u305B\u308B\u3082\u306E\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
    arrange: "\u4E26\u3079\u66FF\u3048",
    done: "\u5B8C\u4E86",
    arrangeHint: "\u30BF\u30A4\u30EB\u3092\u62BC\u3057\u3066\u9078\u3073\u3001\u5927\u304D\u3055\u3092\u5909\u3048\u307E\u3059\u3002\u5F15\u304F\u3068\u4E26\u3079\u66FF\u3048\u3089\u308C\u307E\u3059\u3002",
    size: "\u5927\u304D\u3055",
    sizeOf: "{name}\u306E\u5927\u304D\u3055",
    moveBefore: "\u524D\u3078",
    moveAfter: "\u5F8C\u308D\u3078",
    openDetail: "\u8A73\u7D30",
    saveFailed: "\u4E26\u3073\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{error}\uFF09"
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
    nothingHere: "Nothing to show in this room.",
    arrange: "Arrange",
    done: "Done",
    arrangeHint: "Tap a tile to select it and change its size. Drag to reorder.",
    size: "Size",
    sizeOf: "Size of {name}",
    moveBefore: "Earlier",
    moveAfter: "Later",
    openDetail: "Details",
    saveFailed: "Couldn't save the layout ({error})"
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
    const values = members.map((m4) => Number(m4.state)).filter((v) => Number.isFinite(v));
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
function groupByArea(items, areaOf) {
  const groups = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = areaOf(item) ?? "";
    groups.set(key, [...groups.get(key) ?? [], item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a === "" ? 1 : b === "" ? -1 : 0);
}
var SCREEN_TITLE = { ja: "\u30DB\u30FC\u30E0\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB", en: "Home Control" };
var DRAG_THRESHOLD_PX = 8;
function HomeControlScreen({ ctx }) {
  const t = messages4.useT();
  const locale = useLocale();
  const { apiBaseUrl } = ctx;
  const { data, error, loading, refresh } = usePolledResource(() => fetchOverview(apiBaseUrl), 5e3, true, {
    cacheKey: "home-assistant:overview"
  });
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(null);
  const [room, setRoom] = useState(null);
  const [sensorDetail, setSensorDetail] = useState(null);
  const [tileDetail, setTileDetail] = useState(null);
  const [layout, setLayout] = useState({ order: [], tiles: {} });
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null);
  const drag = useRef(null);
  const [tilesBox, setTilesBox] = useState(null);
  const [gridWidth, setGridWidth] = useState(0);
  useLayoutEffect(() => {
    if (!tilesBox) return;
    setGridWidth(tilesBox.clientWidth);
    const observer = new ResizeObserver(() => setGridWidth(tilesBox.clientWidth));
    observer.observe(tilesBox);
    return () => observer.disconnect();
  }, [tilesBox]);
  useEffect(() => {
    fetchLayout(apiBaseUrl).then(setLayout).catch(() => void 0);
  }, [apiBaseUrl]);
  const run = async (entityId, service, payload) => {
    setBusy(entityId);
    setFailure(null);
    try {
      await callService2(apiBaseUrl, entityId, service, payload);
      await refresh();
      setTimeout(refresh, 1200);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };
  const persist = async (next) => {
    setLayout(next);
    try {
      setLayout(await saveLayout(apiBaseUrl, next));
    } catch (err) {
      setFailure(t("saveFailed", { error: err instanceof Error ? err.message : String(err) }));
    }
  };
  if (loading)
    return /* @__PURE__ */ jsx(ScreenFrame, { title: SCREEN_TITLE, children: /* @__PURE__ */ jsx(ScreenNotice, { children: t("loading") }) });
  if (error || !data) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: SCREEN_TITLE, children: /* @__PURE__ */ jsx(ScreenNotice, { children: t("unreachable") }) });
  }
  if (!data.configured) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: SCREEN_TITLE, children: /* @__PURE__ */ jsx(ScreenNotice, { children: t("notConfigured") }) });
  }
  const all = [...data.sensors, ...data.locks, ...data.climates, ...data.toggles];
  const areas = [...new Set(all.map((e) => e.area ?? ""))].sort(
    (a, b) => a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ja")
  );
  const shownRoom = room !== null && areas.includes(room) ? room : null;
  const inRoom = (entity) => shownRoom === null || (entity.area ?? "") === shownRoom;
  const roomLabel = (area) => area || t("otherRoom");
  const allTiles = orderTiles(
    [
      ...data.locks.map((entity) => ({ kind: "lock", entity })),
      ...data.climates.map((entity) => ({ kind: "climate", entity })),
      ...data.toggles.map((entity) => ({ kind: "toggle", entity }))
    ],
    layout.order
  );
  const allIds = allTiles.map((tile) => tile.entity.entityId);
  const tiles = allTiles.filter((tile) => inRoom(tile.entity));
  const sensors = data.sensors.filter(inRoom);
  const sizeFor = (id) => layout.tiles[id]?.size ?? DEFAULT_SIZE;
  const modeLabel = (mode) => HVAC_LABELS[mode] ? textFor(HVAC_LABELS[mode], locale) : mode;
  const setTile = (id, patch) => {
    const current = { ...layout.tiles[id] };
    if (patch.size) current.size = patch.size;
    if (patch.color === null) delete current.color;
    else if (patch.color) current.color = patch.color;
    void persist({ order: allIds, tiles: { ...layout.tiles, [id]: current } });
  };
  const moveBy = (id, delta) => {
    const tile = tiles.find((x) => x.entity.entityId === id);
    if (!tile) return;
    const neighbors = tiles.filter((x) => (x.entity.area ?? "") === (tile.entity.area ?? "")).map((x) => x.entity.entityId);
    const target = neighbors[neighbors.indexOf(id) + delta];
    if (target) void persist({ ...layout, order: moveId(allIds, id, target) });
  };
  const onEditPointerDown = (id) => (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, x: event.clientX, y: event.clientY, moved: false };
  };
  const onEditPointerMove = (event) => {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-tile-id]");
    const target = under?.dataset.tileId;
    const from = event.currentTarget.closest("[data-area]")?.dataset.area;
    if (!target || target === current.id || under?.closest("[data-area]")?.dataset.area !== from) return;
    setLayout((prev) => ({ ...prev, order: moveId(orderTiles(allTiles, prev.order).map((x) => x.entity.entityId), current.id, target) }));
  };
  const onEditPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (current.moved) void persist({ ...layout, order: orderTiles(allTiles, layout.order).map((x) => x.entity.entityId) });
    else setSelected((prev) => prev === current.id ? null : current.id);
  };
  const metrics = gridMetrics(gridWidth);
  const renderTile = (tile, place) => {
    const id = tile.entity.entityId;
    const frame = {
      tile,
      place,
      size: sizeFor(id),
      color: layout.tiles[id]?.color,
      onDetail: () => setTileDetail(id),
      editOverlay: editing ? (
        // 並べ替えの間は、タイルの上に重ねて押せなくする（押すと選ぶ、引くと並べ替える）
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: cx(
              "home-tile-radius absolute inset-0 z-2 flex cursor-grab touch-none items-start justify-between border-2 border-dashed border-white/40 bg-black/20 px-3 py-2.5 font-semibold text-white select-none",
              "aria-pressed:border-3 aria-pressed:border-solid aria-pressed:border-fill aria-pressed:bg-black/10 [&_.fluent-icon]:size-5.5"
            ),
            role: "button",
            tabIndex: 0,
            "aria-pressed": selected === id,
            "aria-label": tile.entity.name,
            onPointerDown: onEditPointerDown(id),
            onPointerMove: onEditPointerMove,
            onPointerUp: onEditPointerUp,
            onPointerCancel: () => drag.current = null,
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") setSelected((prev) => prev === id ? null : id);
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") moveBy(id, -1);
              if (event.key === "ArrowRight" || event.key === "ArrowDown") moveBy(id, 1);
            },
            children: [
              /* @__PURE__ */ jsx(Icon, { name: "grip" }),
              /* @__PURE__ */ jsx("span", { children: sizeFor(id).replace("x", "\xD7") })
            ]
          }
        )
      ) : void 0
    };
    if (tile.kind === "toggle") {
      return /* @__PURE__ */ jsx(
        ToggleTile,
        {
          ...frame,
          toggle: tile.entity,
          busy: busy === id,
          onToggle: () => run(id, "toggle"),
          onBrightness: (pct) => run(id, "turn_on", { brightness_pct: pct })
        },
        id
      );
    }
    if (tile.kind === "lock") {
      return /* @__PURE__ */ jsx(
        LockTile,
        {
          ...frame,
          lock: tile.entity,
          canUnlock: data.canUnlock,
          busy: busy === id,
          onLock: () => run(id, "lock"),
          onUnlock: () => run(id, "unlock")
        },
        id
      );
    }
    return /* @__PURE__ */ jsx(
      ClimateTile,
      {
        ...frame,
        climate: tile.entity,
        busy: busy === id,
        modeLabel,
        onCall: (service, payload) => run(id, service, payload)
      },
      id
    );
  };
  const selectedTile = editing ? tiles.find((tile) => tile.entity.entityId === selected) : void 0;
  const detailTile = allTiles.find((tile) => tile.entity.entityId === tileDetail);
  const actions = /* @__PURE__ */ jsxs(ButtonRow, { children: [
    areas.length > 1 && /* @__PURE__ */ jsx(
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
    ),
    allTiles.length > 0 && /* @__PURE__ */ jsx(
      Button,
      {
        variant: editing ? "primary" : "default",
        icon: editing ? "checkmark" : "grid",
        "aria-pressed": editing,
        onClick: () => {
          setEditing((prev) => !prev);
          setSelected(null);
        },
        children: editing ? t("done") : t("arrange")
      }
    )
  ] });
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: SCREEN_TITLE, actions, children: [
    failure && /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: failure }),
    /* @__PURE__ */ jsxs("div", { className: cx("flex gap-5", sensors.length > 0 ? "home-control-split" : "flex-col"), children: [
      sensors.length > 0 && /* @__PURE__ */ jsx("section", { className: "home-sensors-column flex flex-wrap gap-x-8 gap-y-1.5", "aria-label": t("air"), children: groupByArea(sensors, (s) => s.area).flatMap(
        ([area, group]) => mergeSensors(group).map((merged) => {
          const known = SENSOR_META[merged.deviceClass ?? ""];
          const label = known ? textFor(known.label, locale) : merged.sensors[0].name;
          const shownLabel = shownRoom === null ? sensorTitle(area, label, t) : label;
          const value = formatMergedValue(merged);
          return /* @__PURE__ */ jsx(
            StatTile,
            {
              bare: true,
              className: "flex-none [&>:first-child]:whitespace-nowrap",
              icon: known?.icon ?? "unknown",
              label: shownLabel,
              value,
              unit: merged.unit ?? void 0,
              tone: merged.level === "ok" ? void 0 : merged.level,
              ariaLabel: t("sensorAria", { label: sensorTitle(area, label, t), value: `${value}${merged.unit ?? ""}` }),
              onClick: () => setSensorDetail({ area, merged })
            },
            `${area}:${merged.key}`
          );
        })
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "@container flex min-w-0 flex-col gap-5", ref: setTilesBox, children: [
        editing && /* @__PURE__ */ jsx("div", { className: "glass flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-group px-4 py-3", role: "toolbar", "aria-label": t("arrange"), children: selectedTile ? /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx("span", { className: "font-semibold", children: selectedTile.entity.name }),
          /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", role: "group", "aria-label": t("sizeOf", { name: selectedTile.entity.name }), children: TILE_SIZES.map((size) => /* @__PURE__ */ jsx(
            Chip,
            {
              selected: sizeFor(selectedTile.entity.entityId) === size,
              onClick: () => setTile(selectedTile.entity.entityId, { size }),
              children: size.replace("x", "\xD7")
            },
            size
          )) }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-1.5", children: [
            /* @__PURE__ */ jsx(Chip, { icon: "chevron-left", onClick: () => moveBy(selectedTile.entity.entityId, -1), children: t("moveBefore") }),
            /* @__PURE__ */ jsxs(Chip, { onClick: () => moveBy(selectedTile.entity.entityId, 1), children: [
              t("moveAfter"),
              /* @__PURE__ */ jsx(Icon, { name: "chevron-right" })
            ] }),
            /* @__PURE__ */ jsx(Chip, { onClick: () => setTileDetail(selectedTile.entity.entityId), children: t("openDetail") })
          ] })
        ] }) : /* @__PURE__ */ jsx("span", { className: "text-small text-muted", children: t("arrangeHint") }) }),
        groupByArea(tiles, (tile) => tile.entity.area).map(([area, group]) => /* @__PURE__ */ jsxs("section", { children: [
          shownRoom === null && areas.length > 1 && /* @__PURE__ */ jsx(SectionTitle, { children: roomLabel(area) }),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "home-grid",
              "data-area": area,
              style: { "--cols": metrics.cols, "--gap": `${metrics.gap}px` },
              children: (() => {
                const places = packTiles(
                  group.map((tile) => sizeFor(tile.entity.entityId)),
                  metrics.cols
                );
                return group.map((tile, index) => renderTile(tile, places[index]));
              })()
            }
          )
        ] }, area))
      ] })
    ] }),
    sensors.length + tiles.length === 0 && /* @__PURE__ */ jsx(ScreenNotice, { children: t("nothingHere") }),
    sensorDetail && /* @__PURE__ */ jsx(
      SensorDetail,
      {
        apiBaseUrl,
        title: sensorTitle(
          sensorDetail.area,
          SENSOR_META[sensorDetail.merged.deviceClass ?? ""] ? textFor(SENSOR_META[sensorDetail.merged.deviceClass ?? ""].label, locale) : sensorDetail.merged.sensors[0].name,
          t
        ),
        sensors: sensorDetail.merged.sensors,
        digits: sensorDetail.merged.deviceClass === "temperature" ? 1 : 0,
        onClose: () => setSensorDetail(null)
      }
    ),
    detailTile && /* @__PURE__ */ jsx(
      TileDetail,
      {
        tile: detailTile,
        size: sizeFor(detailTile.entity.entityId),
        color: layout.tiles[detailTile.entity.entityId]?.color,
        canUnlock: data.canUnlock,
        busy: busy === detailTile.entity.entityId,
        modeLabel,
        onCall: (service, payload) => run(detailTile.entity.entityId, service, payload),
        onLayout: (patch) => setTile(detailTile.entity.entityId, patch),
        onClose: () => setTileDetail(null)
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
var messages5 = defineMessages({
  ja: {
    unreadable: "\u8AAD\u3081\u307E\u305B\u3093",
    loadFailed: "\u30BB\u30F3\u30B5\u30FC\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    changeFailed: "\u5909\u3048\u3089\u308C\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    title: "\u8A08\u6E2C\u306B\u4F7F\u3046\u30BB\u30F3\u30B5\u30FC",
    note: "\u5207\u3063\u305F\u30BB\u30F3\u30B5\u30FC\u306F\u3001\u30DB\u30FC\u30E0\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB\u306E\u753B\u9762\u30FB\u5BB6\u96FB\u64CD\u4F5C\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\uFF08\u5E73\u5747\u306E\u5024\uFF09\u30FB\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u4F7F\u3044\u307E\u305B\u3093\u3002\u58CA\u308C\u305F\u30BB\u30F3\u30B5\u30FC\u3084\u3001\u5916\u306B\u7F6E\u3044\u305F\u30BB\u30F3\u30B5\u30FC\u3092\u5916\u3059\u3068\u304D\u306B\u4F7F\u3044\u307E\u3059\u3002",
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
  const t = messages5.useT();
  const locale = useLocale();
  const url = `${ctx.apiBaseUrl}/api/ext/home-assistant/sensors`;
  const [sensors, setSensors] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? messages5.t("loadFailed", { status: res.status }));
      if (!body.configured) return setSensors([]);
      setSensors(body.sensors.map(localizeState));
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
        throw new Error(body.error ?? messages5.t("changeFailed", { status: res.status }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      void load();
    }
  };
  const groups = Object.keys(CLASS_LABELS).map((deviceClass) => [deviceClass, (sensors ?? []).filter((s) => s.deviceClass === deviceClass)]).filter(([, list]) => list.length > 0);
  return /* @__PURE__ */ jsxs("section", { className: "mt-5 flex flex-col gap-2.5", children: [
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
function SettingsPanel(props) {
  return /* @__PURE__ */ jsx(SensorSettings, { ...props });
}
var web_default = defineWebExtension({
  widgets: [controls_widget_default],
  SettingsPanel,
  screens: [
    {
      id: "home-control",
      label: { ja: "\u30DB\u30FC\u30E0\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB", en: "Home Control" },
      icon: "lightbulb",
      order: 20,
      Component: HomeControlScreen
    }
  ]
});
export {
  web_default as default
};
