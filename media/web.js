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

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/media/src/Artwork.tsx
function Artwork({ url, className }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: cx(
        "grid aspect-square place-items-center overflow-hidden bg-white/8 [&_.fluent-icon]:size-1/3 [&_.fluent-icon]:opacity-50",
        className
      ),
      children: url ? /* @__PURE__ */ jsx("img", { src: url, alt: "", loading: "lazy", className: "size-full object-cover" }) : /* @__PURE__ */ jsx(Icon, { name: "music-note" })
    }
  );
}

// extensions/media/src/i18n.ts
var messages = defineMessages({
  ja: {
    loadFailed: "\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    actionFailed: "\u64CD\u4F5C\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08{status}\uFF09",
    noProviders: "\u97F3\u697D\u30A2\u30D7\u30EA\u306E\u62E1\u5F35\u6A5F\u80FD\uFF08wave\u30FBSpotify\uFF09\u304C\u5165\u3063\u3066\u3044\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD\u300D\u3067\u5165\u308C\u3066\u304F\u3060\u3055\u3044\u3002",
    providerAria: "\u97F3\u697D\u30A2\u30D7\u30EA\uFF08\u3044\u307E\u306F{name}\uFF09",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    notConnected: "{name} \u304C\u672A\u63A5\u7D9A\u3067\u3059\u3002\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 {name}\u300D\u3067\u63A5\u7D9A\u5148\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    nowPlaying: "\u518D\u751F\u4E2D",
    notPlaying: "\u518D\u751F\u3057\u3066\u3044\u307E\u305B\u3093",
    shuffle: "\u30B7\u30E3\u30C3\u30D5\u30EB",
    previous: "\u524D\u306E\u66F2",
    pause: "\u4E00\u6642\u505C\u6B62",
    play: "\u518D\u751F",
    next: "\u6B21\u306E\u66F2",
    repeatState: "\u30EA\u30D4\u30FC\u30C8\uFF08{state}\uFF09",
    repeatOne: "1\u66F2",
    repeatAll: "\u5168\u4F53",
    repeatOff: "\u30AA\u30D5",
    tabsAria: "\u8868\u793A\u3059\u308B\u5185\u5BB9",
    lyrics: "\u6B4C\u8A5E",
    playlists: "\u30D7\u30EC\u30A4\u30EA\u30B9\u30C8",
    suggestions: "\u304A\u3059\u3059\u3081",
    upNext: "\u6B21\u306B\u518D\u751F",
    skipTo: "{title}\u3078\u98DB\u3076",
    skipping: "\u98DB\u3093\u3067\u3044\u307E\u3059\u2026",
    lyricsIdle: "\u66F2\u3092\u518D\u751F\u3059\u308B\u3068\u3001\u3053\u3053\u306B\u6B4C\u8A5E\u304C\u51FA\u307E\u3059\u3002",
    lyricsFailed: "\u6B4C\u8A5E\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{error}\uFF09",
    lyricsSearching: "\u6B4C\u8A5E\u3092\u63A2\u3057\u3066\u3044\u307E\u3059\u2026",
    instrumental: "\u3053\u306E\u66F2\u306F\u6B4C\u306E\u7121\u3044\u66F2\u3067\u3059\u3002",
    lyricsNotFound: "\u3053\u306E\u66F2\u306E\u6B4C\u8A5E\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002",
    lyricsCredit: "\u6B4C\u8A5E: LRCLIB",
    noPlaylists: "\u30D7\u30EC\u30A4\u30EA\u30B9\u30C8\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
    viewPlaylist: "{name}\u306E\u66F2\u3092\u898B\u308B",
    playPlaylist: "{name}\u3092\u518D\u751F",
    trackCount: "{n}\u66F2",
    backToPlaylists: "\u30D7\u30EC\u30A4\u30EA\u30B9\u30C8",
    playFromStart: "\u6700\u521D\u304B\u3089\u518D\u751F",
    noSuggestions: "\u304A\u3059\u3059\u3081\u3092\u51FA\u305B\u308B\u6750\u6599\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
    enqueue: "{title}\u3092\u6B21\u306B\u518D\u751F\u3059\u308B\u66F2\u306B\u8DB3\u3059",
    deviceOffline: "\u3064\u306A\u304C\u3063\u3066\u3044\u307E\u305B\u3093",
    chooseDevice: "\u7AEF\u672B\u3092\u9078\u3076",
    deviceAria: "\u9CF4\u3089\u3059\u7AEF\u672B\uFF08\u3044\u307E\u306F{name}\uFF09",
    noDeviceSelected: "\u672A\u9078\u629E",
    noDevices: "\u7AEF\u672B\u304C\u3042\u308A\u307E\u305B\u3093",
    seekPosition: "\u518D\u751F\u4F4D\u7F6E",
    // ウィジェット
    noApps: "\u97F3\u697D\u30A2\u30D7\u30EA\u304C\u3042\u308A\u307E\u305B\u3093",
    noAppsHint: "\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD\u300D\u3067 wave \u304B Spotify \u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    unreachable: "{name} \u306B\u5C4A\u304D\u307E\u305B\u3093",
    notConnectedShort: "{name} \u304C\u672A\u63A5\u7D9A\u3067\u3059",
    notConnectedHint: "\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 {name}\u300D\u3067\u63A5\u7D9A\u5148\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044",
    player: "\u97F3\u697D\u30D7\u30EC\u30FC\u30E4\u30FC",
    repeat: "\u30EA\u30D4\u30FC\u30C8"
  },
  en: {
    loadFailed: "Couldn't load ({status})",
    actionFailed: "The action failed ({status})",
    noProviders: "No music app extension (wave or Spotify) is installed. Install one under Extensions in Settings.",
    providerAria: "Music app (now {name})",
    loading: "Loading\u2026",
    notConnected: "{name} isn't connected. Set it up in Settings under Extensions \u2192 {name}.",
    nowPlaying: "Now playing",
    notPlaying: "Not playing",
    shuffle: "Shuffle",
    previous: "Previous",
    pause: "Pause",
    play: "Play",
    next: "Next",
    repeatState: "Repeat ({state})",
    repeatOne: "one",
    repeatAll: "all",
    repeatOff: "off",
    tabsAria: "Content to show",
    lyrics: "Lyrics",
    playlists: "Playlists",
    suggestions: "For you",
    upNext: "Up next",
    skipTo: "Skip to {title}",
    skipping: "Skipping\u2026",
    lyricsIdle: "Play a song to see its lyrics here.",
    lyricsFailed: "Couldn't load lyrics ({error})",
    lyricsSearching: "Looking for lyrics\u2026",
    instrumental: "This song is instrumental.",
    lyricsNotFound: "No lyrics found for this song.",
    lyricsCredit: "Lyrics: LRCLIB",
    noPlaylists: "No playlists.",
    viewPlaylist: "View songs in {name}",
    playPlaylist: "Play {name}",
    trackCount: (p) => Number(p.n) === 1 ? "1 song" : `${p.n} songs`,
    backToPlaylists: "Playlists",
    playFromStart: "Play from start",
    noSuggestions: "Not enough listening history for suggestions yet.",
    enqueue: "Add {title} to up next",
    deviceOffline: "Offline",
    chooseDevice: "Choose device",
    deviceAria: "Playback device (now {name})",
    noDeviceSelected: "none",
    noDevices: "No devices",
    seekPosition: "Playback position",
    noApps: "No music apps",
    noAppsHint: "Install wave or Spotify under Extensions in Settings",
    unreachable: "Can't reach {name}",
    notConnectedShort: "{name} isn't connected",
    notConnectedHint: "Set it up in Settings under Extensions \u2192 {name}",
    player: "Music player",
    repeat: "Repeat"
  }
});

// extensions/media/src/providers.ts
var PROVIDER_STORAGE_KEY = "home-dashboard:media-provider";
var CHANGE_EVENT = "home-dashboard:media-provider-changed";
function readStoredProvider() {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY);
  } catch {
    return null;
  }
}
function useSelectedMusicProvider(providers) {
  const [selected, setSelected] = useState(readStoredProvider);
  useEffect(() => {
    const sync = () => setSelected(readStoredProvider());
    const onStorage = (event) => event.key === PROVIDER_STORAGE_KEY && sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const choose = useCallback((extensionId) => {
    setSelected(extensionId);
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, extensionId);
    } catch {
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [providers.find((p) => p.extensionId === selected) ?? providers[0] ?? null, choose];
}
function useMusicProviders() {
  const locale = useLocale();
  const providers = useFeatureProviders("music");
  return useMemo(() => providers.map((p) => ({ ...p, name: textFor(p.name, locale) })), [providers, locale]);
}

// extensions/media/src/MediaScreen.tsx
async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("loadFailed", { status: res.status }));
  return body;
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? messages.t("actionFailed", { status: res.status }));
  }
}
function formatTime2(ms) {
  if (ms === null || !Number.isFinite(ms)) return "--:--";
  const total = Math.max(0, Math.floor(ms / 1e3));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function usePlaybackPosition(playback, receivedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!playback?.isPlaying) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [playback?.isPlaying]);
  if (!playback || playback.progressMs === null) return null;
  const elapsed = playback.isPlaying ? Math.max(0, now - receivedAt) : 0;
  const position = playback.progressMs + elapsed;
  return playback.track?.durationMs ? Math.min(position, playback.track.durationMs) : position;
}
function MediaScreen({ ctx, account }) {
  const providers = useMusicProviders();
  const [provider, choose] = useSelectedMusicProvider(providers);
  const t = messages.useT();
  if (!provider) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, children: /* @__PURE__ */ jsx(ScreenNotice, { children: t("noProviders") }) });
  }
  return /* @__PURE__ */ jsx(
    MediaScreenBody,
    {
      ctx,
      account,
      provider,
      providers,
      onChooseProvider: choose
    },
    provider.extensionId
  );
}
function MediaScreenBody({ ctx, provider, providers, onChooseProvider }) {
  const apiBaseUrl = `${ctx.apiBaseUrl}/api/ext/media/providers/${provider.extensionId}`;
  const t = messages.useT();
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const playbackResource = usePolledResource(async () => {
    const playback2 = await getJson(`${apiBaseUrl}/playback`);
    setReceivedAt(Date.now());
    return playback2;
  }, 3e3);
  const playback = playbackResource.data;
  const position = usePlaybackPosition(playback, receivedAt);
  const [tab, setTab] = useState("lyrics");
  const [failure, setFailure] = useState(null);
  const act2 = async (work) => {
    setFailure(null);
    try {
      await work();
      await playbackResource.refresh();
      setTimeout(playbackResource.refresh, 800);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  };
  const control = (action, state) => act2(() => postJson(`${apiBaseUrl}/control`, { action, state }));
  const play = (target) => act2(() => postJson(`${apiBaseUrl}/play`, target));
  const enqueue = (trackUri) => act2(() => postJson(`${apiBaseUrl}/queue`, { trackUri }));
  const actions = /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2.5", children: [
    /* @__PURE__ */ jsx(
      PillMenu,
      {
        label: provider.name,
        icon: "music-note",
        ariaLabel: t("providerAria", { name: provider.name }),
        items: providers.map((p) => ({
          id: p.extensionId,
          label: p.name,
          selected: p.extensionId === provider.extensionId
        })),
        onSelect: onChooseProvider
      }
    ),
    playback?.configured && /* @__PURE__ */ jsx(
      DevicePill,
      {
        apiBaseUrl,
        currentName: playback.deviceName,
        onTransfer: (deviceId) => act2(() => postJson(`${apiBaseUrl}/transfer`, { deviceId }))
      }
    )
  ] });
  if (playbackResource.loading)
    return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, actions, children: t("loading") });
  if (playbackResource.error && !playback) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, actions, children: /* @__PURE__ */ jsx(ScreenNotice, { children: String(playbackResource.error.message ?? playbackResource.error) }) });
  }
  if (playback && !playback.configured) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, actions, children: /* @__PURE__ */ jsx(ScreenNotice, { children: t("notConnected", { name: provider.name }) }) });
  }
  const track = playback?.track ?? null;
  const duration = track?.durationMs ?? null;
  const canShuffle = playback?.capabilities?.shuffle ?? true;
  const canRepeat = playback?.capabilities?.repeat ?? true;
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, actions, children: [
    failure && /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: failure }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-10 tablet:flex-col tablet:items-stretch tablet:gap-6 wall:media-wall-height wall:items-stretch", children: [
      /* @__PURE__ */ jsxs(
        "section",
        {
          className: "sticky top-0 flex min-w-75 shrink basis-105 flex-col gap-4.5 tablet:static tablet:basis-auto wall:static wall:min-h-0 wall:grow-5 wall:basis-0 wall:flex-row wall:gap-8",
          "aria-label": t("nowPlaying"),
          children: [
            /* @__PURE__ */ jsx(
              Artwork,
              {
                url: track?.artUrl ?? null,
                className: "w-full rounded-inner shadow-widget tablet:mx-auto tablet:max-w-90 wall:h-full wall:w-auto wall:shrink-0"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col gap-4.5 wall:min-h-0 wall:flex-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col gap-2.5", children: [
                /* @__PURE__ */ jsx("span", { className: "ellipsis text-card font-semibold", children: track?.title ?? t("notPlaying") }),
                /* @__PURE__ */ jsx("span", { className: "ellipsis text-muted", children: track ? [track.artist, track.album].filter(Boolean).join(" \u2014 ") : "" })
              ] }),
              /* @__PURE__ */ jsx(
                SeekBar,
                {
                  position,
                  duration,
                  onSeek: (positionMs) => act2(() => postJson(`${apiBaseUrl}/seek`, { positionMs }))
                },
                track?.uri ?? "none"
              ),
              /* @__PURE__ */ jsxs("div", { className: cx("flex items-center", canShuffle && canRepeat ? "justify-between" : "justify-center gap-8"), children: [
                canShuffle && /* @__PURE__ */ jsx(
                  IconButton,
                  {
                    icon: "shuffle",
                    size: "lg",
                    label: t("shuffle"),
                    selected: playback?.shuffle ?? false,
                    onClick: () => control("shuffle", !playback?.shuffle)
                  }
                ),
                /* @__PURE__ */ jsx(IconButton, { icon: "previous", size: "lg", label: t("previous"), onClick: () => control("previous") }),
                /* @__PURE__ */ jsx(
                  IconButton,
                  {
                    icon: playback?.isPlaying ? "pause" : "play",
                    size: "lg",
                    selected: true,
                    "aria-pressed": void 0,
                    label: playback?.isPlaying ? t("pause") : t("play"),
                    className: "size-19 [&_.fluent-icon]:size-8.5",
                    onClick: () => control(playback?.isPlaying ? "pause" : "play")
                  }
                ),
                /* @__PURE__ */ jsx(IconButton, { icon: "next", size: "lg", label: t("next"), onClick: () => control("next") }),
                canRepeat && /* @__PURE__ */ jsxs("span", { className: "relative", children: [
                  /* @__PURE__ */ jsx(
                    IconButton,
                    {
                      icon: "repeat",
                      size: "lg",
                      selected: playback?.repeat !== "off",
                      label: t("repeatState", {
                        state: t(
                          playback?.repeat === "track" ? "repeatOne" : playback?.repeat === "context" ? "repeatAll" : "repeatOff"
                        )
                      }),
                      onClick: () => control(
                        "repeat",
                        playback?.repeat === "off" ? "context" : playback?.repeat === "context" ? "track" : "off"
                      )
                    }
                  ),
                  playback?.repeat === "track" && /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute right-1.5 bottom-1.5 text-micro font-bold text-on-fill", children: "1" })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                UpNext,
                {
                  apiBaseUrl,
                  trackUri: track?.uri ?? null,
                  onSkip: (index, trackUri) => act2(() => postJson(`${apiBaseUrl}/queue/skip`, { index, trackUri }))
                }
              )
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs("section", { className: "glass flex min-w-0 flex-1 flex-col rounded-card media-panel-height tablet:min-h-0 wall:h-full wall:min-h-0 wall:grow-4 wall:basis-0", children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "flex gap-1.5 border-b border-glass-border p-5 phone:overflow-x-auto",
            role: "tablist",
            "aria-label": t("tabsAria"),
            children: [
              ["lyrics", t("lyrics"), "lyrics"],
              ["playlists", t("playlists"), "music-note"],
              ["suggestions", t("suggestions"), "sparkle"]
            ].map(([id, label, icon]) => /* @__PURE__ */ jsx(
              Chip,
              {
                role: "tab",
                icon,
                selected: tab === id,
                "aria-pressed": void 0,
                "aria-selected": tab === id,
                className: "shrink-0 whitespace-nowrap phone:[&_.fluent-icon]:hidden",
                onClick: () => setTab(id),
                children: label
              },
              id
            ))
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "min-h-0 flex-1 p-6 *:animate-enter wall:overflow-y-auto", children: [
          tab === "lyrics" && /* @__PURE__ */ jsx(LyricsView, { apiBaseUrl, track, positionMs: position }),
          tab === "playlists" && /* @__PURE__ */ jsx(PlaylistsView, { apiBaseUrl, onPlay: play }),
          tab === "suggestions" && /* @__PURE__ */ jsx(
            SuggestionsView,
            {
              apiBaseUrl,
              trackUri: track?.uri ?? null,
              onPlay: play,
              onEnqueue: enqueue
            }
          )
        ] })
      ] })
    ] })
  ] });
}
function UpNext({
  apiBaseUrl,
  trackUri,
  onSkip
}) {
  const t = messages.useT();
  const [skipping, setSkipping] = useState(null);
  const { data, refresh } = usePolledResource(
    () => getJson(`${apiBaseUrl}/queue`),
    15e3
  );
  useEffect(() => {
    refresh();
  }, [trackUri, refresh]);
  const tracks = data?.tracks.slice(0, 5) ?? [];
  if (tracks.length === 0) return null;
  return /* @__PURE__ */ jsx(ScreenSection, { title: t("upNext"), className: "mt-2 mb-0 wall:min-h-0 wall:overflow-y-auto", children: /* @__PURE__ */ jsx(TrackList, { children: tracks.map((track, index) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
    TrackButton,
    {
      track,
      detail: skipping === index ? t("skipping") : void 0,
      pending: skipping === index,
      disabled: skipping !== null,
      "aria-label": t("skipTo", { title: track.title }),
      onClick: async () => {
        setSkipping(index);
        try {
          await onSkip(index, track.uri);
          await refresh();
        } finally {
          setSkipping(null);
        }
      }
    }
  ) }, `${track.uri}-${index}`)) }) });
}
function TrackList({ children }) {
  return /* @__PURE__ */ jsx("ol", { className: "flex flex-col gap-1", children });
}
function TrackButton({
  track,
  detail,
  time,
  pending,
  className,
  ...rest
}) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: cx(
        "press-wide flex min-h-15 w-full cursor-pointer items-center gap-3.5 rounded-inner px-2.5 py-1.5 text-left text-text",
        "hover:bg-white/8 disabled:cursor-progress",
        pending && "bg-tint/10",
        className
      ),
      ...rest,
      children: [
        /* @__PURE__ */ jsx(Artwork, { url: track.artUrl, className: "size-12 shrink-0 rounded-art" }),
        /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 flex-1 flex-col gap-1", children: [
          /* @__PURE__ */ jsx("span", { className: "ellipsis", children: track.title }),
          /* @__PURE__ */ jsx("span", { className: "ellipsis text-note font-medium text-muted", children: detail ?? track.artist })
        ] }),
        time && /* @__PURE__ */ jsx("span", { className: "text-note font-medium text-muted tabular-nums", children: time })
      ]
    }
  );
}
function activeLineIndex(lines, positionMs) {
  if (positionMs === null) return -1;
  let active = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if ((lines[i].timeMs ?? Infinity) <= positionMs) active = i;
    else break;
  }
  return active;
}
function LyricsView({
  apiBaseUrl,
  track,
  positionMs
}) {
  const t = messages.useT();
  const [lyrics, setLyrics] = useState(null);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const trackKey = track ? `${track.uri}` : null;
  useEffect(() => {
    setLyrics(null);
    setError(null);
    if (!track) return;
    let cancelled = false;
    const params = new URLSearchParams({ title: track.title, artist: track.artist });
    if (track.album) params.set("album", track.album);
    if (track.durationMs) params.set("durationMs", String(track.durationMs));
    let retryTimer;
    const load = (attempt) => getJson(`${apiBaseUrl}/lyrics?${params}`).then((result) => !cancelled && setLyrics(result)).catch((err) => {
      if (cancelled) return;
      if (attempt < 3) retryTimer = setTimeout(() => load(attempt + 1), 1e4 * (attempt + 1));
      else setError(err instanceof Error ? err.message : String(err));
    });
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [apiBaseUrl, trackKey]);
  const active = lyrics?.synced ? activeLineIndex(lyrics.lines, positionMs) : -1;
  useEffect(() => {
    if (active < 0) return;
    const list = listRef.current;
    const container = list?.parentElement;
    const element = list?.children[active];
    if (!container || !element) return;
    container.scrollTo({
      // 歌詞の枠（position: relative）が offsetParent なので、offsetTop は枠の中での位置
      top: element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2,
      behavior: scrollBehavior()
    });
  }, [active]);
  if (!track) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("lyricsIdle") });
  if (error) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("lyricsFailed", { error }) });
  if (!lyrics) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("lyricsSearching") });
  if (lyrics.instrumental) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("instrumental") });
  if (!lyrics.found) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("lyricsNotFound") });
  return /* @__PURE__ */ jsxs("div", { className: "relative lyrics-scroll wall:h-full wall:max-h-none", children: [
    /* @__PURE__ */ jsx("ol", { ref: listRef, className: "flex flex-col gap-4.5 lyrics-pad", children: lyrics.lines.map((line, index) => /* @__PURE__ */ jsx(
      "li",
      {
        className: cx(
          "text-card leading-normal font-semibold untrim",
          // 時刻付きの歌詞では、歌っている行だけを明るくし、ほかは控えめにする
          lyrics.synced && "origin-left transition duration-(--motion-slow) ease-standard",
          lyrics.synced && (index === active ? "scale-104" : index < active ? "text-text/55" : "text-text/40")
        ),
        children: line.text || "\u266A"
      },
      index
    )) }),
    /* @__PURE__ */ jsx("p", { className: "text-right text-micro text-muted", children: t("lyricsCredit") })
  ] });
}
function PlaylistsView({
  apiBaseUrl,
  onPlay
}) {
  const t = messages.useT();
  const { data, error } = usePolledResource(
    () => getJson(`${apiBaseUrl}/playlists`),
    5 * 60 * 1e3
  );
  const [open, setOpen] = useState(null);
  if (error) return /* @__PURE__ */ jsx(ScreenNotice, { children: error.message });
  if (!data) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("loading") });
  if (open)
    return /* @__PURE__ */ jsx(PlaylistTracks, { apiBaseUrl, playlist: open, onBack: () => setOpen(null), onPlay });
  if (data.playlists.length === 0) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("noPlaylists") });
  return /* @__PURE__ */ jsx("ul", { className: "grid media-tiles gap-4.5", children: data.playlists.map((playlist) => /* @__PURE__ */ jsxs("li", { className: "relative", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "press flex w-full cursor-pointer flex-col gap-2 text-left text-text",
        onClick: () => playlist.browsable ? setOpen(playlist) : onPlay({ contextUri: playlist.uri }),
        "aria-label": playlist.browsable ? t("viewPlaylist", { name: playlist.name }) : t("playPlaylist", { name: playlist.name }),
        children: [
          /* @__PURE__ */ jsx(Artwork, { url: playlist.artUrl, className: "w-full rounded-inner" }),
          /* @__PURE__ */ jsx("span", { className: "ellipsis font-semibold", children: playlist.name }),
          /* @__PURE__ */ jsx("span", { className: "text-caption font-medium text-muted untrim", children: [playlist.owner, playlist.trackCount !== null ? t("trackCount", { n: playlist.trackCount }) : null].filter(Boolean).join(" \xB7 ") })
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-end justify-end p-2.5", children: /* @__PURE__ */ jsx(
      IconButton,
      {
        icon: "play",
        size: "lg",
        selected: true,
        "aria-pressed": void 0,
        label: t("playPlaylist", { name: playlist.name }),
        className: "pointer-events-auto",
        onClick: () => onPlay({ contextUri: playlist.uri })
      }
    ) })
  ] }, playlist.id)) });
}
function PlaylistTracks({
  apiBaseUrl,
  playlist,
  onBack,
  onPlay
}) {
  const t = messages.useT();
  const { data, error } = usePolledResource(
    () => getJson(`${apiBaseUrl}/playlists/${encodeURIComponent(playlist.id)}/tracks`),
    5 * 60 * 1e3
  );
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(BackButton, { label: t("backToPlaylists"), onClick: onBack }),
    /* @__PURE__ */ jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-4", children: [
      /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 text-heading font-semibold", children: playlist.name }),
      /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "play", onClick: () => onPlay({ contextUri: playlist.uri }), children: t("playFromStart") })
    ] }),
    error !== null && /* @__PURE__ */ jsx(ScreenNotice, { children: error.message }),
    !data && !error && /* @__PURE__ */ jsx(ScreenNotice, { children: t("loading") }),
    /* @__PURE__ */ jsx(TrackList, { children: data?.tracks.map((track, index) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
      TrackButton,
      {
        track,
        time: formatTime2(track.durationMs),
        onClick: () => onPlay({ contextUri: playlist.uri, offsetUri: track.uri })
      }
    ) }, `${track.uri}-${index}`)) })
  ] });
}
function SuggestionsView({
  apiBaseUrl,
  trackUri,
  onPlay,
  onEnqueue
}) {
  const t = messages.useT();
  const { data, error, refresh } = usePolledResource(
    () => getJson(`${apiBaseUrl}/suggestions`),
    10 * 60 * 1e3
  );
  useEffect(() => {
    refresh();
  }, [trackUri, refresh]);
  if (error) return /* @__PURE__ */ jsx(ScreenNotice, { children: error.message });
  if (!data) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("loading") });
  if (data.groups.length === 0) return /* @__PURE__ */ jsx(ScreenNotice, { children: t("noSuggestions") });
  return /* @__PURE__ */ jsx("div", { children: data.groups.map((group) => /* @__PURE__ */ jsx(ScreenSection, { title: group.note ? `${group.title} \xB7 ${group.note}` : group.title, className: "mb-8 last:mb-0", children: /* @__PURE__ */ jsx(TrackList, { children: group.tracks.map((track) => /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2", children: [
    /* @__PURE__ */ jsx(TrackButton, { track, onClick: () => onPlay({ trackUri: track.uri }) }),
    /* @__PURE__ */ jsx(IconButton, { icon: "add", label: t("enqueue", { title: track.title }), onClick: () => onEnqueue(track.uri) })
  ] }, track.uri)) }) }, group.id)) });
}
function DevicePill({
  apiBaseUrl,
  currentName,
  onTransfer
}) {
  const t = messages.useT();
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState(null);
  const load = async () => {
    setError(null);
    try {
      setDevices((await getJson(`${apiBaseUrl}/devices`)).devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const items = (devices ?? []).slice().sort((a, b) => Number(b.online) - Number(a.online) || Number(b.active) - Number(a.active)).map((device) => ({
    id: device.id,
    label: device.name,
    detail: device.active ? t("nowPlaying") : device.online ? void 0 : t("deviceOffline"),
    selected: device.active,
    disabled: !device.online
  }));
  return /* @__PURE__ */ jsx(
    PillMenu,
    {
      label: currentName ?? t("chooseDevice"),
      icon: "speaker",
      ariaLabel: t("deviceAria", { name: currentName ?? t("noDeviceSelected") }),
      items,
      onSelect: onTransfer,
      onOpen: () => void load(),
      empty: error ?? (devices === null ? t("loading") : t("noDevices"))
    }
  );
}
var SEEK_KEY_STEP_MS = 5e3;
function SeekBar({
  position,
  duration,
  onSeek
}) {
  const t = messages.useT();
  const [preview, setPreview] = useState(null);
  const timer = useRef();
  const canSeek = duration !== null && duration > 0;
  const shown = preview ?? position;
  const commit = async (positionMs) => {
    clearTimeout(timer.current);
    setPreview(positionMs);
    try {
      await onSeek(positionMs);
    } finally {
      timer.current = setTimeout(() => setPreview(null), 1500);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(
      Slider,
      {
        value: shown ?? 0,
        max: duration ?? 0,
        keyStep: SEEK_KEY_STEP_MS,
        disabled: !canSeek,
        label: t("seekPosition"),
        valueText: `${formatTime2(shown)} / ${formatTime2(duration)}`,
        onInput: (value) => {
          clearTimeout(timer.current);
          setPreview(value);
        },
        onCommit: (value) => void commit(value)
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "mt-0.5 flex justify-between text-caption font-medium text-muted tabular-nums", children: [
      /* @__PURE__ */ jsx("span", { children: formatTime2(shown) }),
      /* @__PURE__ */ jsx("span", { children: formatTime2(duration) })
    ] })
  ] });
}

// extensions/media/src/MediaWidget.tsx
var TITLE = "ellipsis text-card font-semibold leading-tight";
function MediaWidgetView({ ctx, config }) {
  const providers = useMusicProviders();
  const [provider] = useSelectedMusicProvider(providers);
  const t = messages.useT();
  const base = provider ? `${ctx.apiBaseUrl}/api/ext/media/providers/${provider.extensionId}` : null;
  const { data, error, refresh } = usePolledResource(async () => {
    if (!base) return null;
    const res = await fetch(`${base}/playback`);
    if (!res.ok) throw new Error(`media API error: ${res.status}`);
    return res.json();
  }, config.pollIntervalMs);
  const control = useCallback(
    async (action, state) => {
      if (!base) return;
      await fetch(`${base}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, state })
      }).catch(() => void 0);
      await refresh();
      setTimeout(refresh, 800);
    },
    [base, refresh]
  );
  if (!provider) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      /* @__PURE__ */ jsx("p", { className: TITLE, children: t("noApps") }),
      /* @__PURE__ */ jsx(WidgetHint, { children: t("noAppsHint") })
    ] });
  }
  const providerLabel = /* @__PURE__ */ jsx("span", { className: "text-micro text-muted", children: provider.name });
  if (error && !data) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: TITLE, children: t("unreachable", { name: provider.name }) })
    ] });
  }
  if (data && !data.configured) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: TITLE, children: t("notConnectedShort", { name: provider.name }) }),
      /* @__PURE__ */ jsx(WidgetHint, { children: t("notConnectedHint", { name: provider.name }) })
    ] });
  }
  if (!data?.track) {
    return /* @__PURE__ */ jsxs(WidgetCard, { children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: TITLE, children: data ? t("notPlaying") : t("loading") })
    ] });
  }
  const canShuffle = data.capabilities?.shuffle ?? true;
  const canRepeat = data.capabilities?.repeat ?? true;
  const nextRepeat = data.repeat === "off" ? "context" : data.repeat === "context" ? "track" : "off";
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "flex-row items-center justify-between gap-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col gap-1", children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: TITLE, children: data.track.title }),
      /* @__PURE__ */ jsx("p", { className: "ellipsis text-small text-muted", children: data.track.artist }),
      /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-1", "aria-label": t("player"), children: [
        canShuffle && /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: "shuffle",
            label: t("shuffle"),
            selected: data.shuffle,
            className: cx(!data.shuffle && "text-muted"),
            onClick: () => void control("shuffle", !data.shuffle)
          }
        ),
        /* @__PURE__ */ jsx(IconButton, { icon: "previous", label: t("previous"), onClick: () => void control("previous") }),
        /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: data.isPlaying ? "pause" : "play",
            selected: true,
            "aria-pressed": void 0,
            label: data.isPlaying ? t("pause") : t("play"),
            onClick: () => void control(data.isPlaying ? "pause" : "play")
          }
        ),
        /* @__PURE__ */ jsx(IconButton, { icon: "next", label: t("next"), onClick: () => void control("next") }),
        canRepeat && /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: "repeat",
            label: t("repeat"),
            selected: data.repeat !== "off",
            className: cx(data.repeat === "off" && "text-muted"),
            onClick: () => void control("repeat", nextRepeat)
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(Artwork, { url: data.track.artUrl, className: "size-35 shrink-0 rounded-inner phone:size-23" })
  ] });
}
function MediaWidget(props) {
  const providers = useMusicProviders();
  const [provider] = useSelectedMusicProvider(providers);
  return /* @__PURE__ */ jsx(MediaWidgetView, { ...props }, provider?.extensionId ?? "none");
}
var mediaWidget = defineWidget({
  id: "media",
  name: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" },
  description: {
    ja: "Media \u753B\u9762\u3067\u9078\u3093\u3060\u97F3\u697D\u30A2\u30D7\u30EA\uFF08wave\u30FBSpotify\uFF09\u306E\u518D\u751F\u4E2D\u306E\u66F2\u3092\u8868\u793A\u3057\u3001\u518D\u751F\u64CD\u4F5C\u304C\u3067\u304D\u307E\u3059",
    en: "Shows the song playing in the music app chosen on the Media screen (wave or Spotify) and lets you control playback"
  },
  defaultSize: { w: 4, h: 1 },
  minSize: { w: 3, h: 1 },
  defaultConfig: { pollIntervalMs: 3e3 },
  Component: MediaWidget
});

// extensions/media/src/web.tsx
var web_default = defineWebExtension({
  widgets: [mediaWidget],
  screens: [{ id: "media", label: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, icon: "play", order: 10, Component: MediaScreen }]
});
export {
  web_default as default
};
