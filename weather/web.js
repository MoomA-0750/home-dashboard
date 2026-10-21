// host-module:@home-dashboard/widget-sdk
var m = globalThis.__homeDashboard?.modules?.["@home-dashboard/widget-sdk"];
if (!m) throw new Error("\u672C\u4F53\u306E @home-dashboard/widget-sdk \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var widget_sdk_default = m.default ?? m;
var { Avatar, AvatarStack, BackButton, Badge, Button, ButtonLink, ButtonRow, ChatBubble, ChatComposer, ChatFrom, ChatHeader, ChatIconButton, ChatLayout, ChatLog, ChatMeta, ChatPending, ChatRow, Check, CodeBlock, DetailFrame, Dialog, FeatureProvidersContext, Field, Group, Icon, LOCALES, List, ListItem, LocaleContext, Message, Note, Notice, PillMenu, ScreenFrame, ScreenNotice, ScreenSection, SectionTitle, StatGrid, StatTile, ToggleSwitch, WidgetCard, WidgetHint, WidgetRegistry, defineMessages, defineWebExtension, defineWidget, extensionApiUrl, formatClock, formatPastDay, getLocale, intlLocale, setCurrentLocale, textFor, useFeatureProviders, useLocale, usePolledResource, usePolling, weatherConditionText, weatherIcon, widgetRegistry } = m;

// extensions/weather/src/i18n.ts
var messages = defineMessages({
  ja: {
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    fetchFailed: "\u53D6\u5F97\u5931\u6557",
    weatherIn: "{place}\u306E\u5929\u6C17",
    rainNextHours: "\u964D\u6C34\u78BA\u7387\uFF08\u4ECA\u5F8C{n}\u6642\u9593\uFF09",
    loadFailed: "\u5929\u6C17\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    place: "\u5834\u6240",
    placeAria: "\u5834\u6240\uFF08\u3044\u307E\u306F{place}\uFF09",
    homeLocation: "\u5BB6\u306E\u5730\u70B9",
    home: "\u5BB6",
    manage: "\u5834\u6240\u3092\u8FFD\u52A0\u30FB\u7BA1\u7406\u2026",
    loadingScreen: "\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    staleError: "\u8AAD\u307F\u76F4\u305B\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u524D\u306B\u8AAD\u3093\u3060\u5929\u6C17\u3092\u51FA\u3057\u3066\u3044\u307E\u3059\uFF09",
    highLow: "\u6700\u9AD8 {max} \xB7 \u6700\u4F4E {min}",
    feelsLike: "\u4F53\u611F {t}",
    now: "\u4ECA",
    hour: "{h}\u6642",
    daysForecast: "{n}\u65E5\u9593\u306E\u5929\u6C17",
    rainChance: "\u96E8 {p}%",
    rangeAria: "\u6700\u4F4E{min} \u6700\u9AD8{max}",
    today: "\u4ECA\u65E5",
    tomorrow: "\u660E\u65E5",
    weekday: "{d}\u66DC",
    uvIndex: "UV \u6307\u6570",
    todayMax: "\u4ECA\u65E5\u306E\u6700\u5927 {n}",
    sunrise: "\u65E5\u306E\u51FA",
    sunset: "\u65E5\u306E\u5165\u308A",
    sunriseAt: "\u65E5\u306E\u51FA {t}",
    sunsetAt: "\u65E5\u306E\u5165\u308A {t}",
    wind: "\u98A8",
    gust: "\u6700\u5927\u77AC\u9593 {n} m/s",
    windFrom: "{dir}\u306E\u98A8",
    precipToday: "\u964D\u6C34\u91CF\uFF08\u4ECA\u65E5\uFF09",
    precipTomorrow: "\u660E\u65E5 {mm} mm\u30FB{p}%",
    feelsLikeTitle: "\u4F53\u611F\u6E29\u5EA6",
    feelsSame: "\u5B9F\u969B\u306E\u6C17\u6E29\u3068\u307B\u307C\u540C\u3058",
    feelsWarmer: "\u6E7F\u5EA6\u306E\u305B\u3044\u3067\u3001\u5B9F\u969B\u3088\u308A\u6691\u304F\u611F\u3058\u307E\u3059",
    feelsColder: "\u98A8\u306E\u305B\u3044\u3067\u3001\u5B9F\u969B\u3088\u308A\u5BD2\u304F\u611F\u3058\u307E\u3059",
    humidity: "\u6E7F\u5EA6",
    dewPoint: "\u9732\u70B9 {t}",
    visibility: "\u8996\u7A0B",
    visClear: "\u9060\u304F\u307E\u3067\u898B\u901A\u305B\u308B",
    visPoor: "\u898B\u901A\u3057\u304C\u60AA\u3044",
    pressure: "\u6C17\u5727",
    cloudCover: "\u96F2\u306E\u91CF {n}%",
    airQuality: "\u5927\u6C17\u8CEA\uFF08US AQI\uFF09",
    uvLow: "\u5F31\u3044",
    uvModerate: "\u4E2D\u7A0B\u5EA6",
    uvHigh: "\u5F37\u3044",
    uvVeryHigh: "\u975E\u5E38\u306B\u5F37\u3044",
    uvExtreme: "\u6975\u7AEF\u306B\u5F37\u3044",
    aqiGood: "\u826F\u3044",
    aqiModerate: "\u666E\u901A",
    aqiSensitive: "\u654F\u611F\u306A\u4EBA\u306B\u306F\u826F\u304F\u306A\u3044",
    aqiUnhealthy: "\u826F\u304F\u306A\u3044",
    aqiVeryUnhealthy: "\u3068\u3066\u3082\u826F\u304F\u306A\u3044",
    aqiHazardous: "\u5371\u967A",
    // 場所を追加・管理
    requestFailed: "\u3046\u307E\u304F\u3044\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    noGeolocation: "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306F\u73FE\u5728\u5730\u3092\u4F7F\u3048\u307E\u305B\u3093",
    geoDenied: "\u4F4D\u7F6E\u60C5\u5831\u306E\u8A31\u53EF\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u30D6\u30E9\u30A6\u30B6\u306E\u8A2D\u5B9A\u3067\u3001\u3053\u306E\u30DA\u30FC\u30B8\u306B\u4F4D\u7F6E\u60C5\u5831\u3092\u8A31\u53EF\u3057\u3066\u304F\u3060\u3055\u3044",
    geoFailed: "\u73FE\u5728\u5730\u3092\u53D6\u308C\u307E\u305B\u3093\u3067\u3057\u305F",
    currentLocation: "\u73FE\u5728\u5730",
    manageTitle: "\u5834\u6240\u3092\u8FFD\u52A0\u30FB\u7BA1\u7406",
    searchByName: "\u5730\u540D\u3067\u63A2\u3059",
    searchPlaceholder: "\u4F8B: \u672D\u5E4C\u3001\u5927\u962A\u5E02\u3001London",
    searching: "\u63A2\u3057\u3066\u3044\u307E\u3059\u2026",
    search: "\u63A2\u3059",
    locating: "\u73FE\u5728\u5730\u3092\u8ABF\u3079\u3066\u3044\u307E\u3059\u2026",
    addHere: "\u73FE\u5728\u5730\u3092\u8FFD\u52A0",
    notFoundHint: "\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u300C\u5E02\u300D\u300C\u533A\u300D\u3092\u4ED8\u3051\u308B\u304B\u3001\u30ED\u30FC\u30DE\u5B57\u3067\u3082\u63A2\u3057\u3066\u307F\u3066\u304F\u3060\u3055\u3044\u3002",
    foundPlaces: "\u898B\u3064\u304B\u3063\u305F\u5834\u6240",
    add: "\u8FFD\u52A0",
    choosablePlaces: "\u9078\u3079\u308B\u5834\u6240",
    homeDetail: "\u5BB6\u306E\u5730\u70B9\uFF08\u62E1\u5F35\u6A5F\u80FD\u300C\u5929\u6C17\u300D\u306E\u63A5\u7D9A\u8A2D\u5B9A\u3067\u5909\u3048\u307E\u3059\uFF09",
    remove: "\u5916\u3059",
    osmNote: "\u73FE\u5728\u5730\u306F\u3001\u3053\u306E\u7AEF\u672B\u306E\u4F4D\u7F6E\u60C5\u5831\u304B\u3089\u53D6\u308A\u3001\u305D\u306E\u5730\u540D\u306F OpenStreetMap \u3067\u8ABF\u3079\u307E\u3059\u3002"
  },
  en: {
    loading: "Loading\u2026",
    fetchFailed: "Failed to load",
    weatherIn: "Weather in {place}",
    rainNextHours: (p) => `Chance of rain (next ${p.n} ${p.n === 1 ? "hour" : "hours"})`,
    loadFailed: "Couldn't load the weather ({status})",
    place: "Place",
    placeAria: "Place (now {place})",
    homeLocation: "Home location",
    home: "Home",
    manage: "Add or manage places\u2026",
    loadingScreen: "Loading\u2026",
    staleError: "Couldn't refresh (showing the last forecast)",
    highLow: "H {max} \xB7 L {min}",
    feelsLike: "Feels like {t}",
    now: "Now",
    hour: (p) => {
      const h = Number(p.h);
      return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
    },
    daysForecast: "{n}-day forecast",
    rainChance: "Rain {p}%",
    rangeAria: "Low {min}, high {max}",
    today: "Today",
    tomorrow: "Tomorrow",
    weekday: "{d}",
    uvIndex: "UV index",
    todayMax: "Today's max {n}",
    sunrise: "Sunrise",
    sunset: "Sunset",
    sunriseAt: "Sunrise {t}",
    sunsetAt: "Sunset {t}",
    wind: "Wind",
    gust: "Gusts {n} m/s",
    windFrom: "Wind from {dir}",
    precipToday: "Precipitation (today)",
    precipTomorrow: "Tomorrow {mm} mm \xB7 {p}%",
    feelsLikeTitle: "Feels like",
    feelsSame: "Similar to the actual temperature",
    feelsWarmer: "Humidity makes it feel warmer",
    feelsColder: "Wind makes it feel colder",
    humidity: "Humidity",
    dewPoint: "Dew point {t}",
    visibility: "Visibility",
    visClear: "Clear view",
    visPoor: "Poor visibility",
    pressure: "Pressure",
    cloudCover: "Cloud cover {n}%",
    airQuality: "Air quality (US AQI)",
    uvLow: "Low",
    uvModerate: "Moderate",
    uvHigh: "High",
    uvVeryHigh: "Very high",
    uvExtreme: "Extreme",
    aqiGood: "Good",
    aqiModerate: "Moderate",
    aqiSensitive: "Unhealthy for sensitive groups",
    aqiUnhealthy: "Unhealthy",
    aqiVeryUnhealthy: "Very unhealthy",
    aqiHazardous: "Hazardous",
    requestFailed: "Something went wrong ({status})",
    noGeolocation: "This browser can't use your location",
    geoDenied: "Location access isn't allowed. Allow location for this page in your browser settings",
    geoFailed: "Couldn't get your location",
    currentLocation: "Current location",
    manageTitle: "Add or manage places",
    searchByName: "Search by name",
    searchPlaceholder: "e.g. Sapporo, Osaka, London",
    searching: "Searching\u2026",
    search: "Search",
    locating: "Finding your location\u2026",
    addHere: "Add current location",
    notFoundHint: "Nothing found. Try another spelling or a nearby city.",
    foundPlaces: "Results",
    add: "Add",
    choosablePlaces: "Places",
    homeDetail: "Home location (change it in the Weather extension's connection settings)",
    remove: "Remove",
    osmNote: "Your current location comes from this device, and its name is looked up on OpenStreetMap."
  }
});
var WEEKDAYS = {
  ja: ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};
var weekdayName = (day, locale) => WEEKDAYS[locale][day];
var DIRECTIONS = {
  ja: ["\u5317", "\u5317\u5317\u6771", "\u5317\u6771", "\u6771\u5317\u6771", "\u6771", "\u6771\u5357\u6771", "\u5357\u6771", "\u5357\u5357\u6771", "\u5357", "\u5357\u5357\u897F", "\u5357\u897F", "\u897F\u5357\u897F", "\u897F", "\u897F\u5317\u897F", "\u5317\u897F", "\u5317\u5317\u897F"],
  en: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
};
var directionName = (degrees, locale) => DIRECTIONS[locale][Math.round(degrees / 22.5) % 16];
var conditionText = (code, ja, locale) => weatherConditionText(code, ja, locale);

// host-module:react/jsx-runtime
var m2 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m2) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m2.default ?? m2;
var { Fragment, jsx, jsxs } = m2;

// extensions/weather/src/widget.tsx
async function fetchWeather(apiBaseUrl) {
  const res = await fetch(extensionApiUrl({ apiBaseUrl }, "weather", "/current"));
  if (!res.ok) throw new Error(`weather API error: ${res.status}`);
  return res.json();
}
function WeatherView({ ctx, config, openDetail }) {
  const { data, error, loading } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);
  const t = messages.useT();
  const locale = useLocale();
  return /* @__PURE__ */ jsxs("button", { type: "button", className: "widget-card widget-weather", onClick: openDetail, children: [
    loading && !data && /* @__PURE__ */ jsx("span", { className: "widget-status", children: t("loading") }),
    Boolean(error) && /* @__PURE__ */ jsx("span", { className: "widget-status widget-status--error", children: t("fetchFailed") }),
    data && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Icon, { name: weatherIcon(data.current.code, data.current.isDay), className: "widget-weather__icon" }),
      /* @__PURE__ */ jsxs("span", { className: "widget-weather__temp", children: [
        Math.round(data.current.temperatureC),
        "\xB0C"
      ] }),
      /* @__PURE__ */ jsx("span", { className: "widget-weather__condition", children: conditionText(data.current.code, data.current.condition, locale) })
    ] })
  ] });
}
function WeatherDetail({ ctx, config }) {
  const { data } = usePolling(() => fetchWeather(ctx.apiBaseUrl), config.pollIntervalMs);
  const t = messages.useT();
  const locale = useLocale();
  if (!data) return /* @__PURE__ */ jsx("div", { className: "widget-detail", children: t("loading") });
  const maxProb = Math.max(1, ...data.hourly.map((h) => h.precipitationProbability));
  return /* @__PURE__ */ jsxs("div", { className: "widget-detail widget-weather-detail", children: [
    /* @__PURE__ */ jsx("h2", { children: t("weatherIn", { place: data.location.name }) }),
    /* @__PURE__ */ jsxs("div", { className: "widget-weather-detail__current", children: [
      /* @__PURE__ */ jsx(Icon, { name: weatherIcon(data.current.code, data.current.isDay), className: "widget-weather__icon" }),
      /* @__PURE__ */ jsxs("span", { className: "widget-weather__temp", children: [
        Math.round(data.current.temperatureC),
        "\xB0C"
      ] }),
      /* @__PURE__ */ jsx("span", { children: conditionText(data.current.code, data.current.condition, locale) })
    ] }),
    /* @__PURE__ */ jsx("h3", { children: t("rainNextHours", { n: data.hourly.length }) }),
    /* @__PURE__ */ jsx("div", { className: "widget-weather-detail__chart", children: data.hourly.map((h) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "widget-weather-detail__bar-wrap",
        title: `${h.time}: ${h.precipitationProbability}%`,
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "widget-weather-detail__bar",
              style: { height: `${h.precipitationProbability / maxProb * 100}%` }
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "widget-weather-detail__bar-label", children: new Date(h.time).getHours() })
        ]
      },
      h.time
    )) })
  ] });
}
var widget_default = defineWidget({
  id: "weather",
  name: { ja: "\u5929\u6C17", en: "Weather" },
  description: {
    ja: "\u63A5\u7D9A\u8A2D\u5B9A\u306E\u5730\u70B9\u306E\u3001\u4ECA\u306E\u5929\u6C17\u3068\u964D\u6C34\u78BA\u7387\u3092\u8868\u793A\u3057\u307E\u3059",
    en: "Shows the current weather and chance of rain for the location in the connection settings"
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 10 * 60 * 1e3 },
  Component: WeatherView,
  DetailComponent: WeatherDetail
});

// host-module:react
var m3 = globalThis.__homeDashboard?.modules?.["react"];
if (!m3) throw new Error("\u672C\u4F53\u306E react \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var react_default = m3.default ?? m3;
var { Children, Component, Fragment: Fragment2, Profiler, PureComponent, StrictMode, Suspense, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, act, cloneElement, createContext, createElement, createFactory, createRef, forwardRef, isValidElement, lazy, memo, startTransition, unstable_act, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, version } = m3;

// extensions/weather/src/PlacesPanel.tsx
async function request(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "weather", path), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body;
}
var fetchPlaces = async (ctx) => (await request(ctx, "/places")).places;
function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(messages.t("noGeolocation")));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(
        new Error(
          error.code === error.PERMISSION_DENIED ? messages.t("geoDenied") : messages.t("geoFailed")
        )
      );
    }, { enableHighAccuracy: false, timeout: 15e3, maximumAge: 10 * 60 * 1e3 });
  });
}
function PlacesPanel({
  ctx,
  places,
  onAdded,
  onRemoved,
  onClose
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const t = messages.useT();
  const run = async (kind, task) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };
  const add = (candidate) => run("add", async () => {
    const { place } = await request(ctx, "/places", { method: "POST", json: candidate });
    onAdded({ ...place, home: false });
  });
  const search = (event) => {
    event.preventDefault();
    void run("search", async () => {
      const { places: found } = await request(ctx, `/places/search?q=${encodeURIComponent(query)}`);
      setResults(found);
    });
  };
  const addHere = () => run("here", async () => {
    const position = await currentPosition();
    const { latitude: lat, longitude: lon } = position.coords;
    const { name } = await request(ctx, `/places/name?lat=${lat}&lon=${lon}`);
    const { place } = await request(ctx, "/places", {
      method: "POST",
      json: { name: name ?? t("currentLocation"), lat, lon }
    });
    onAdded({ ...place, home: false });
  });
  const remove = (id) => run("add", async () => {
    await request(ctx, `/places/${encodeURIComponent(id)}`, { method: "DELETE" });
    onRemoved(id);
  });
  return /* @__PURE__ */ jsxs(Dialog, { title: t("manageTitle"), onClose, children: [
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("form", { onSubmit: search, children: [
        /* @__PURE__ */ jsx(Field, { label: t("searchByName"), children: /* @__PURE__ */ jsx("input", { value: query, placeholder: t("searchPlaceholder"), maxLength: 60, onChange: (e) => setQuery(e.target.value) }) }),
        /* @__PURE__ */ jsxs(ButtonRow, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", icon: "globe", disabled: !query.trim() || busy !== null, children: busy === "search" ? t("searching") : t("search") }),
          /* @__PURE__ */ jsx(Button, { icon: "location", onClick: () => void addHere(), disabled: busy !== null, children: busy === "here" ? t("locating") : t("addHere") })
        ] })
      ] }),
      error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error })
    ] }),
    results !== null && (results.length === 0 ? /* @__PURE__ */ jsx(Note, { children: t("notFoundHint") }) : /* @__PURE__ */ jsx(List, { label: t("foundPlaces"), children: results.map((r) => /* @__PURE__ */ jsx(
      ListItem,
      {
        title: r.name,
        detail: r.detail || `${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}`,
        trailing: /* @__PURE__ */ jsx("span", { className: "weather-places__add", children: t("add") }),
        onClick: busy === null ? () => void add(r) : void 0
      },
      `${r.lat},${r.lon}`
    )) })),
    /* @__PURE__ */ jsx(List, { label: t("choosablePlaces"), children: places.map((p) => /* @__PURE__ */ jsx(
      ListItem,
      {
        title: p.name,
        detail: p.home ? t("homeDetail") : `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`,
        trailing: p.home ? void 0 : /* @__PURE__ */ jsx(Button, { variant: "danger", onClick: () => void remove(p.id), disabled: busy !== null, children: t("remove") })
      },
      p.id
    )) }),
    /* @__PURE__ */ jsx(Note, { children: t("osmNote") })
  ] });
}

// extensions/weather/src/WeatherScreen.tsx
var PLACE_KEY = "weather.place";
var MANAGE = "__manage";
function storedPlace() {
  try {
    return localStorage.getItem(PLACE_KEY) ?? "home";
  } catch {
    return "home";
  }
}
function storePlace(id) {
  try {
    localStorage.setItem(PLACE_KEY, id);
  } catch {
  }
}
var deg = (c) => `${Math.round(c)}\xB0`;
function dayName(date, index, t, locale) {
  if (index === 0) return t("today");
  if (index === 1) return t("tomorrow");
  const d = /* @__PURE__ */ new Date(`${date}T00:00:00`);
  return t("weekday", { d: weekdayName(d.getDay(), locale) });
}
function uvLevel(uv, t) {
  if (uv < 3) return t("uvLow");
  if (uv < 6) return t("uvModerate");
  if (uv < 8) return t("uvHigh");
  if (uv < 11) return t("uvVeryHigh");
  return t("uvExtreme");
}
function aqiLevel(aqi, t) {
  if (aqi <= 50) return t("aqiGood");
  if (aqi <= 100) return t("aqiModerate");
  if (aqi <= 150) return t("aqiSensitive");
  if (aqi <= 200) return t("aqiUnhealthy");
  if (aqi <= 300) return t("aqiVeryUnhealthy");
  return t("aqiHazardous");
}
var TEMP_HUES = [
  [0, 220],
  [8, 195],
  [15, 150],
  [22, 50],
  [30, 25],
  [36, 0]
];
function tempColor(c) {
  const [first] = TEMP_HUES;
  const last = TEMP_HUES[TEMP_HUES.length - 1];
  let hue = c <= first[0] ? first[1] : last[1];
  for (let i = 1; i < TEMP_HUES.length; i++) {
    const [t0, h0] = TEMP_HUES[i - 1];
    const [t1, h1] = TEMP_HUES[i];
    if (c > t0 && c <= t1) hue = h0 + (c - t0) / (t1 - t0) * (h1 - h0);
  }
  return `hsl(${Math.round(hue)} 85% 62%)`;
}
function Meter({ value, max, gradient }) {
  return /* @__PURE__ */ jsx("span", { className: "weather-meter", style: { background: gradient }, "aria-hidden": "true", children: /* @__PURE__ */ jsx("span", { className: "weather-dot", style: { left: `${Math.min(100, Math.max(0, value / max * 100))}%` } }) });
}
function WeatherScreen({ ctx }) {
  const [placeId, setPlaceId] = useState(storedPlace);
  const [places, setPlaces] = useState([]);
  const [managing, setManaging] = useState(false);
  const t = messages.useT();
  const locale = useLocale();
  const clock = (iso) => formatClock(new Date(iso), locale);
  useEffect(() => {
    fetchPlaces(ctx).then(setPlaces, () => void 0);
  }, [ctx]);
  const selected = places.find((p) => p.id === placeId) ?? places.find((p) => p.home);
  const shownId = selected?.id ?? "home";
  const { data, error, refresh } = usePolledResource(async () => {
    const res = await fetch(extensionApiUrl(ctx, "weather", `/forecast?place=${encodeURIComponent(shownId)}`));
    if (!res.ok) throw new Error(messages.t("loadFailed", { status: res.status }, getLocale()));
    return { placeId: shownId, forecast: await res.json() };
  }, 10 * 60 * 1e3);
  useEffect(() => {
    void refresh();
  }, [shownId, refresh]);
  const choose = (id) => {
    if (id === MANAGE) {
      setManaging(true);
      return;
    }
    setPlaceId(id);
    storePlace(id);
  };
  const actions = /* @__PURE__ */ jsx(
    PillMenu,
    {
      label: selected?.name ?? data?.forecast.location.name ?? t("place"),
      icon: "location",
      ariaLabel: t("placeAria", { place: selected?.name ?? t("homeLocation") }),
      items: [
        ...places.map((p) => ({ id: p.id, label: p.name, detail: p.home ? t("home") : void 0, selected: p.id === shownId })),
        { id: MANAGE, label: t("manage") }
      ],
      onSelect: choose,
      onOpen: () => void fetchPlaces(ctx).then(setPlaces, () => void 0)
    }
  );
  const panel = managing && /* @__PURE__ */ jsx(
    PlacesPanel,
    {
      ctx,
      places,
      onAdded: (place) => {
        setPlaces((list) => [...list, place]);
        choose(place.id);
        setManaging(false);
      },
      onRemoved: (id) => setPlaces((list) => list.filter((p) => p.id !== id)),
      onClose: () => setManaging(false)
    }
  );
  const shown = data?.placeId === shownId ? data.forecast : null;
  if (!shown)
    return /* @__PURE__ */ jsxs(ScreenFrame, { title: "Weather", actions, children: [
      panel,
      /* @__PURE__ */ jsx(ScreenNotice, { tone: error ? "error" : void 0, children: error ? String(error.message ?? error) : t("loadingScreen") })
    ] });
  const { current, hourly, daily, airQuality } = shown;
  const today = daily[0];
  const low = Math.min(...daily.map((d) => d.minC));
  const high = Math.max(...daily.map((d) => d.maxC));
  const span = Math.max(1, high - low);
  const direction = directionName(current.windDirection, locale);
  const sunrise = today && Date.now() < Date.parse(today.sunrise);
  const sunset = today && !sunrise && Date.now() < Date.parse(today.sunset);
  const feels = current.apparentC - current.temperatureC;
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: "Weather", actions, children: [
    panel,
    error ? /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: t("staleError") }) : null,
    /* @__PURE__ */ jsxs("div", { className: "weather-top", children: [
      /* @__PURE__ */ jsx(ScreenSection, { className: "weather-section", children: /* @__PURE__ */ jsxs(Group, { className: "weather-now", children: [
        /* @__PURE__ */ jsx(Icon, { name: weatherIcon(current.code, current.isDay), className: "weather-now__icon" }),
        /* @__PURE__ */ jsx("span", { className: "ui-stat__value", children: deg(current.temperatureC) }),
        /* @__PURE__ */ jsxs("span", { className: "weather-now__text", children: [
          /* @__PURE__ */ jsx("strong", { children: conditionText(current.code, current.condition, locale) }),
          today && /* @__PURE__ */ jsx("span", { children: t("highLow", { max: deg(today.maxC), min: deg(today.minC) }) }),
          /* @__PURE__ */ jsx("span", { children: t("feelsLike", { t: deg(current.apparentC) }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(ScreenSection, { className: "weather-section", children: /* @__PURE__ */ jsx(Group, { children: /* @__PURE__ */ jsx("ol", { className: "weather-hourly", children: hourly.map((hour, i) => /* @__PURE__ */ jsxs("li", { className: "weather-hourly__hour", children: [
        /* @__PURE__ */ jsx("span", { className: "weather-hourly__time", children: i === 0 ? t("now") : t("hour", { h: new Date(hour.time).getHours() }) }),
        /* @__PURE__ */ jsx(Icon, { name: weatherIcon(hour.code, hour.isDay), className: "weather-hourly__icon" }),
        /* @__PURE__ */ jsx("span", { className: "weather-rain", children: hour.precipitationProbability >= 20 ? `${hour.precipitationProbability}%` : "" }),
        /* @__PURE__ */ jsx("span", { className: "weather-hourly__temp", children: deg(hour.temperatureC) })
      ] }, hour.time)) }) }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "screen__columns", children: [
      /* @__PURE__ */ jsx(ScreenSection, { className: "weather-section", children: /* @__PURE__ */ jsx(List, { label: t("daysForecast", { n: daily.length }), children: daily.map((day, i) => /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx(Icon, { name: weatherIcon(day.code, true), className: "weather-daily__icon" }),
          title: dayName(day.date, i, t, locale),
          detail: [
            conditionText(day.code, day.condition, locale),
            day.precipitationProbability >= 20 ? t("rainChance", { p: day.precipitationProbability }) : null
          ].filter(Boolean).join(" \xB7 "),
          trailing: /* @__PURE__ */ jsxs("span", { className: "weather-range", "aria-label": t("rangeAria", { min: deg(day.minC), max: deg(day.maxC) }), children: [
            /* @__PURE__ */ jsx("span", { className: "weather-range__min", children: deg(day.minC) }),
            /* @__PURE__ */ jsxs("span", { className: "weather-range__bar", children: [
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: "weather-range__fill",
                  style: {
                    left: `${(day.minC - low) / span * 100}%`,
                    width: `${Math.max(4, (day.maxC - day.minC) / span * 100)}%`,
                    background: `linear-gradient(90deg, ${tempColor(day.minC)}, ${tempColor(day.maxC)})`
                  }
                }
              ),
              i === 0 && /* @__PURE__ */ jsx("span", { className: "weather-dot", style: { left: `${(current.temperatureC - low) / span * 100}%` } })
            ] }),
            /* @__PURE__ */ jsx("span", { children: deg(day.maxC) })
          ] })
        },
        day.date
      )) }) }),
      /* @__PURE__ */ jsx(ScreenSection, { className: "weather-section", children: /* @__PURE__ */ jsxs(StatGrid, { children: [
        /* @__PURE__ */ jsxs(StatTile, { icon: "uv", label: t("uvIndex"), value: Math.round(current.uvIndex), note: t("todayMax", { n: Math.round(today?.uvIndexMax ?? 0) }), children: [
          /* @__PURE__ */ jsx("span", { children: uvLevel(current.uvIndex, t) }),
          /* @__PURE__ */ jsx(Meter, { value: current.uvIndex, max: 11, gradient: "linear-gradient(90deg, #4ade80, #facc15, #fb923c, #f87171, #c084fc)" })
        ] }),
        today && /* @__PURE__ */ jsx(
          StatTile,
          {
            icon: "sunrise",
            label: sunrise || !sunset ? t("sunrise") : t("sunset"),
            value: clock(sunrise || !sunset ? sunrise ? today.sunrise : daily[1]?.sunrise ?? today.sunrise : today.sunset),
            note: sunrise || !sunset ? t("sunsetAt", { t: clock(today.sunset) }) : t("sunriseAt", { t: clock(today.sunrise) })
          }
        ),
        /* @__PURE__ */ jsx(StatTile, { icon: "wind", label: t("wind"), value: current.windSpeed.toFixed(1), unit: "m/s", note: t("gust", { n: current.windGust.toFixed(1) }), children: /* @__PURE__ */ jsxs("span", { className: "weather-wind", children: [
          /* @__PURE__ */ jsx("span", { className: "weather-wind__arrow", style: { transform: `rotate(${current.windDirection + 180}deg)` }, children: /* @__PURE__ */ jsx(Icon, { name: "arrow-up" }) }),
          t("windFrom", { dir: direction })
        ] }) }),
        /* @__PURE__ */ jsx(
          StatTile,
          {
            icon: "drop",
            label: t("precipToday"),
            value: (today?.precipitationSumMm ?? 0).toFixed(1),
            unit: "mm",
            note: daily[1] ? t("precipTomorrow", { mm: daily[1].precipitationSumMm.toFixed(1), p: daily[1].precipitationProbability }) : void 0
          }
        ),
        /* @__PURE__ */ jsx(
          StatTile,
          {
            icon: "temperature",
            label: t("feelsLikeTitle"),
            value: deg(current.apparentC),
            note: Math.abs(feels) < 1.5 ? t("feelsSame") : feels > 0 ? t("feelsWarmer") : t("feelsColder")
          }
        ),
        /* @__PURE__ */ jsx(StatTile, { icon: "drop", label: t("humidity"), value: Math.round(current.humidity), unit: "%", note: t("dewPoint", { t: deg(current.dewPointC) }) }),
        /* @__PURE__ */ jsx(
          StatTile,
          {
            icon: "eye",
            label: t("visibility"),
            value: current.visibilityM >= 1e4 ? Math.round(current.visibilityM / 1e3) : (current.visibilityM / 1e3).toFixed(1),
            unit: "km",
            note: current.visibilityM >= 1e4 ? t("visClear") : t("visPoor")
          }
        ),
        /* @__PURE__ */ jsx(StatTile, { icon: "gauge", label: t("pressure"), value: Math.round(current.pressureHpa), unit: "hPa", note: t("cloudCover", { n: Math.round(current.cloudCover) }) }),
        airQuality && /* @__PURE__ */ jsxs(
          StatTile,
          {
            icon: "leaf",
            label: t("airQuality"),
            value: airQuality.usAqi,
            note: airQuality.pm25 !== null ? `PM2.5 ${airQuality.pm25.toFixed(1)} \xB5g/m\xB3` : void 0,
            children: [
              /* @__PURE__ */ jsx("span", { children: aqiLevel(airQuality.usAqi, t) }),
              /* @__PURE__ */ jsx(
                Meter,
                {
                  value: airQuality.usAqi,
                  max: 300,
                  gradient: "linear-gradient(90deg, #4ade80, #facc15 17%, #fb923c 33%, #f87171 50%, #c084fc 67%, #9f1239)"
                }
              )
            ]
          }
        )
      ] }) })
    ] })
  ] });
}

// extensions/weather/src/web.tsx
var web_default = defineWebExtension({
  widgets: [widget_default],
  screens: [{ id: "weather", label: "Weather", ariaLabel: { ja: "\u5929\u6C17", en: "Weather" }, icon: "weather-partly-cloudy-day", order: 30, Component: WeatherScreen }]
});
export {
  web_default as default
};
