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
    backToPlaylists: "\u2190 \u30D7\u30EC\u30A4\u30EA\u30B9\u30C8",
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
    backToPlaylists: "\u2190 Playlists",
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

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

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
function formatTime(ms) {
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
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Media", children: /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("noProviders") }) });
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
  const actions = /* @__PURE__ */ jsxs("div", { className: "media__pickers", children: [
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
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Media", actions, children: t("loading") });
  if (playbackResource.error && !playback) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Media", actions, children: /* @__PURE__ */ jsx("p", { className: "screen__notice", children: String(playbackResource.error.message ?? playbackResource.error) }) });
  }
  if (playback && !playback.configured) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: "Media", actions, children: /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("notConnected", { name: provider.name }) }) });
  }
  const track = playback?.track ?? null;
  const duration = track?.durationMs ?? null;
  const canShuffle = playback?.capabilities?.shuffle ?? true;
  const canRepeat = playback?.capabilities?.repeat ?? true;
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: "Media", actions, children: [
    failure && /* @__PURE__ */ jsx("p", { className: "screen__error", role: "alert", children: failure }),
    /* @__PURE__ */ jsxs("div", { className: "media", children: [
      /* @__PURE__ */ jsxs("section", { className: "media__now", "aria-label": t("nowPlaying"), children: [
        /* @__PURE__ */ jsx("div", { className: "media__art", children: track?.artUrl ? /* @__PURE__ */ jsx("img", { src: track.artUrl, alt: "" }) : /* @__PURE__ */ jsx(Icon, { name: "music-note" }) }),
        /* @__PURE__ */ jsxs("div", { className: "media__meta", children: [
          /* @__PURE__ */ jsx("span", { className: "media__title", children: track?.title ?? t("notPlaying") }),
          /* @__PURE__ */ jsx("span", { className: "media__artist", children: track ? [track.artist, track.album].filter(Boolean).join(" \u2014 ") : "" })
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
        /* @__PURE__ */ jsxs("div", { className: `media__controls${canShuffle && canRepeat ? "" : " media__controls--basic"}`, children: [
          canShuffle && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: `home-icon-button${playback?.shuffle ? " home-icon-button--on" : ""}`,
              "aria-label": t("shuffle"),
              "aria-pressed": playback?.shuffle ?? false,
              onClick: () => control("shuffle", !playback?.shuffle),
              children: /* @__PURE__ */ jsx(Icon, { name: "shuffle" })
            }
          ),
          /* @__PURE__ */ jsx("button", { type: "button", className: "home-icon-button", "aria-label": t("previous"), onClick: () => control("previous"), children: /* @__PURE__ */ jsx(Icon, { name: "previous" }) }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "media__play",
              "aria-label": playback?.isPlaying ? t("pause") : t("play"),
              onClick: () => control(playback?.isPlaying ? "pause" : "play"),
              children: /* @__PURE__ */ jsx(Icon, { name: playback?.isPlaying ? "pause" : "play" })
            }
          ),
          /* @__PURE__ */ jsx("button", { type: "button", className: "home-icon-button", "aria-label": t("next"), onClick: () => control("next"), children: /* @__PURE__ */ jsx(Icon, { name: "next" }) }),
          canRepeat && /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `home-icon-button${playback?.repeat !== "off" ? " home-icon-button--on" : ""}`,
              "aria-label": t("repeatState", {
                state: t(playback?.repeat === "track" ? "repeatOne" : playback?.repeat === "context" ? "repeatAll" : "repeatOff")
              }),
              onClick: () => control(
                "repeat",
                playback?.repeat === "off" ? "context" : playback?.repeat === "context" ? "track" : "off"
              ),
              children: [
                /* @__PURE__ */ jsx(Icon, { name: "repeat" }),
                playback?.repeat === "track" && /* @__PURE__ */ jsx("span", { className: "media__repeat-one", children: "1" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          UpNext,
          {
            apiBaseUrl,
            trackUri: track?.uri ?? null,
            onSkip: (index, trackUri) => act2(() => postJson(`${apiBaseUrl}/queue/skip`, { index, trackUri }))
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "media__panel", children: [
        /* @__PURE__ */ jsx("div", { className: "media__tabs", role: "tablist", "aria-label": t("tabsAria"), children: [
          ["lyrics", t("lyrics"), "lyrics"],
          ["playlists", t("playlists"), "music-note"],
          ["suggestions", t("suggestions"), "sparkle"]
        ].map(([id, label, icon]) => /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": tab === id,
            className: `media__tab${tab === id ? " media__tab--active" : ""}`,
            onClick: () => setTab(id),
            children: [
              /* @__PURE__ */ jsx(Icon, { name: icon }),
              label
            ]
          },
          id
        )) }),
        /* @__PURE__ */ jsxs("div", { className: "media__tab-body", children: [
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
  return /* @__PURE__ */ jsxs("div", { className: "media__up-next", children: [
    /* @__PURE__ */ jsx("h2", { className: "screen__section-title", children: t("upNext") }),
    /* @__PURE__ */ jsx("ol", { className: "media__track-list", children: tracks.map((track, index) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: `media__track${skipping === index ? " media__track--pending" : ""}`,
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
        },
        children: [
          /* @__PURE__ */ jsx(TrackArt, { track }),
          /* @__PURE__ */ jsxs("span", { className: "media__track-text", children: [
            /* @__PURE__ */ jsx("span", { className: "media__track-title", children: track.title }),
            /* @__PURE__ */ jsx("span", { className: "media__track-artist", children: skipping === index ? t("skipping") : track.artist })
          ] })
        ]
      }
    ) }, `${track.uri}-${index}`)) })
  ] });
}
function TrackArt({ track }) {
  return /* @__PURE__ */ jsx("span", { className: "media__track-art", children: track.artUrl ? /* @__PURE__ */ jsx("img", { src: track.artUrl, alt: "", loading: "lazy" }) : /* @__PURE__ */ jsx(Icon, { name: "music-note" }) });
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
      behavior: "smooth"
    });
  }, [active]);
  if (!track) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("lyricsIdle") });
  if (error) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("lyricsFailed", { error }) });
  if (!lyrics) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("lyricsSearching") });
  if (lyrics.instrumental) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("instrumental") });
  if (!lyrics.found) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("lyricsNotFound") });
  return /* @__PURE__ */ jsxs("div", { className: "media__lyrics", children: [
    /* @__PURE__ */ jsx("ol", { ref: listRef, className: `media__lyrics-lines${lyrics.synced ? " media__lyrics-lines--synced" : ""}`, children: lyrics.lines.map((line, index) => /* @__PURE__ */ jsx(
      "li",
      {
        className: index === active ? "media__lyric media__lyric--active" : index < active ? "media__lyric media__lyric--past" : "media__lyric",
        children: line.text || "\u266A"
      },
      index
    )) }),
    /* @__PURE__ */ jsx("p", { className: "media__credit", children: t("lyricsCredit") })
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
  if (error) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: error.message });
  if (!data) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("loading") });
  if (open)
    return /* @__PURE__ */ jsx(PlaylistTracks, { apiBaseUrl, playlist: open, onBack: () => setOpen(null), onPlay });
  if (data.playlists.length === 0) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("noPlaylists") });
  return /* @__PURE__ */ jsx("ul", { className: "media__playlists", children: data.playlists.map((playlist) => /* @__PURE__ */ jsxs("li", { className: "media__playlist", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "media__playlist-open",
        onClick: () => playlist.browsable ? setOpen(playlist) : onPlay({ contextUri: playlist.uri }),
        "aria-label": playlist.browsable ? t("viewPlaylist", { name: playlist.name }) : t("playPlaylist", { name: playlist.name }),
        children: [
          /* @__PURE__ */ jsx("span", { className: "media__playlist-art", children: playlist.artUrl ? /* @__PURE__ */ jsx("img", { src: playlist.artUrl, alt: "", loading: "lazy" }) : /* @__PURE__ */ jsx(Icon, { name: "music-note" }) }),
          /* @__PURE__ */ jsx("span", { className: "media__playlist-name", children: playlist.name }),
          /* @__PURE__ */ jsx("span", { className: "media__playlist-meta", children: [playlist.owner, playlist.trackCount !== null ? t("trackCount", { n: playlist.trackCount }) : null].filter(Boolean).join(" \xB7 ") })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "media__playlist-play",
        "aria-label": t("playPlaylist", { name: playlist.name }),
        onClick: () => onPlay({ contextUri: playlist.uri }),
        children: /* @__PURE__ */ jsx(Icon, { name: "play" })
      }
    )
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
  return /* @__PURE__ */ jsxs("div", { className: "media__playlist-detail", children: [
    /* @__PURE__ */ jsxs("div", { className: "media__playlist-head", children: [
      /* @__PURE__ */ jsx("button", { type: "button", className: "home-button home-button--ghost", onClick: onBack, children: t("backToPlaylists") }),
      /* @__PURE__ */ jsx("span", { className: "media__playlist-title", children: playlist.name }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "home-button home-button--primary",
          onClick: () => onPlay({ contextUri: playlist.uri }),
          children: t("playFromStart")
        }
      )
    ] }),
    error !== null && /* @__PURE__ */ jsx("p", { className: "screen__notice", children: error.message }),
    !data && !error && /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("loading") }),
    /* @__PURE__ */ jsx("ol", { className: "media__track-list", children: data?.tracks.map((track, index) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "media__track",
        onClick: () => onPlay({ contextUri: playlist.uri, offsetUri: track.uri }),
        children: [
          /* @__PURE__ */ jsx(TrackArt, { track }),
          /* @__PURE__ */ jsxs("span", { className: "media__track-text", children: [
            /* @__PURE__ */ jsx("span", { className: "media__track-title", children: track.title }),
            /* @__PURE__ */ jsx("span", { className: "media__track-artist", children: track.artist })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "media__track-time", children: formatTime(track.durationMs) })
        ]
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
  if (error) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: error.message });
  if (!data) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("loading") });
  if (data.groups.length === 0) return /* @__PURE__ */ jsx("p", { className: "screen__notice", children: t("noSuggestions") });
  return /* @__PURE__ */ jsx("div", { className: "media__suggestions", children: data.groups.map((group) => /* @__PURE__ */ jsxs("section", { className: "media__suggestion-group", children: [
    /* @__PURE__ */ jsxs("h2", { className: "screen__section-title", children: [
      group.title,
      group.note && /* @__PURE__ */ jsxs("small", { children: [
        " \xB7 ",
        group.note
      ] })
    ] }),
    /* @__PURE__ */ jsx("ol", { className: "media__track-list", children: group.tracks.map((track) => /* @__PURE__ */ jsxs("li", { className: "media__track-row", children: [
      /* @__PURE__ */ jsxs("button", { type: "button", className: "media__track", onClick: () => onPlay({ trackUri: track.uri }), children: [
        /* @__PURE__ */ jsx(TrackArt, { track }),
        /* @__PURE__ */ jsxs("span", { className: "media__track-text", children: [
          /* @__PURE__ */ jsx("span", { className: "media__track-title", children: track.title }),
          /* @__PURE__ */ jsx("span", { className: "media__track-artist", children: track.artist })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "home-icon-button media__enqueue",
          "aria-label": t("enqueue", { title: track.title }),
          onClick: () => onEnqueue(track.uri),
          children: /* @__PURE__ */ jsx(Icon, { name: "add" })
        }
      )
    ] }, track.uri)) })
  ] }, group.id)) });
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
  const barRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const dragging = useRef(false);
  const canSeek = duration !== null && duration > 0;
  const shown = preview ?? position;
  const ratio = canSeek && shown !== null ? Math.min(1, Math.max(0, shown / duration)) : 0;
  const positionAt = (clientX) => {
    const rect = barRef.current.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * (duration ?? 0));
  };
  const commit = async (positionMs) => {
    setPreview(positionMs);
    try {
      await onSeek(positionMs);
    } finally {
      setTimeout(() => !dragging.current && setPreview(null), 1500);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "media__progress", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        ref: barRef,
        className: `media__seek${canSeek ? "" : " media__seek--disabled"}`,
        role: "slider",
        tabIndex: canSeek ? 0 : -1,
        "aria-label": t("seekPosition"),
        "aria-valuemin": 0,
        "aria-valuemax": duration ?? 0,
        "aria-valuenow": shown ?? 0,
        "aria-valuetext": `${formatTime(shown)} / ${formatTime(duration)}`,
        "aria-disabled": !canSeek,
        onPointerDown: (event) => {
          if (!canSeek) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = true;
          setPreview(positionAt(event.clientX));
        },
        onPointerMove: (event) => {
          if (dragging.current) setPreview(positionAt(event.clientX));
        },
        onPointerUp: (event) => {
          if (!dragging.current) return;
          dragging.current = false;
          void commit(positionAt(event.clientX));
        },
        onPointerCancel: () => {
          dragging.current = false;
          setPreview(null);
        },
        onKeyDown: (event) => {
          if (!canSeek || shown === null) return;
          const step = event.key === "ArrowRight" ? SEEK_KEY_STEP_MS : event.key === "ArrowLeft" ? -SEEK_KEY_STEP_MS : 0;
          if (!step) return;
          event.preventDefault();
          void commit(Math.min(duration, Math.max(0, shown + step)));
        },
        children: [
          /* @__PURE__ */ jsx("div", { className: "media__seek-track", children: /* @__PURE__ */ jsx("span", { className: "media__seek-fill", style: { width: `${ratio * 100}%` } }) }),
          /* @__PURE__ */ jsx("span", { className: "media__seek-thumb", style: { left: `${ratio * 100}%` } })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "media__times", children: [
      /* @__PURE__ */ jsx("span", { children: formatTime(shown) }),
      /* @__PURE__ */ jsx("span", { children: formatTime(duration) })
    ] })
  ] });
}

// extensions/media/src/MediaWidget.tsx
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
    return /* @__PURE__ */ jsx("div", { className: "widget-card widget-media widget-media--idle", children: /* @__PURE__ */ jsxs("div", { className: "widget-media__meta", children: [
      /* @__PURE__ */ jsx("p", { className: "widget-media__title", children: t("noApps") }),
      /* @__PURE__ */ jsx("span", { className: "widget-hint", children: t("noAppsHint") })
    ] }) });
  }
  const providerLabel = /* @__PURE__ */ jsx("span", { className: "widget-media__provider", children: provider.name });
  if (error && !data) {
    return /* @__PURE__ */ jsx("div", { className: "widget-card widget-media widget-media--idle", children: /* @__PURE__ */ jsxs("div", { className: "widget-media__meta", children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: "widget-media__title", children: t("unreachable", { name: provider.name }) })
    ] }) });
  }
  if (data && !data.configured) {
    return /* @__PURE__ */ jsx("div", { className: "widget-card widget-media widget-media--idle", children: /* @__PURE__ */ jsxs("div", { className: "widget-media__meta", children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: "widget-media__title", children: t("notConnectedShort", { name: provider.name }) }),
      /* @__PURE__ */ jsx("span", { className: "widget-hint", children: t("notConnectedHint", { name: provider.name }) })
    ] }) });
  }
  if (!data?.track) {
    return /* @__PURE__ */ jsx("div", { className: "widget-card widget-media widget-media--idle", children: /* @__PURE__ */ jsxs("div", { className: "widget-media__meta", children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: "widget-media__title", children: data ? t("notPlaying") : t("loading") })
    ] }) });
  }
  const canShuffle = data.capabilities?.shuffle ?? true;
  const canRepeat = data.capabilities?.repeat ?? true;
  const nextRepeat = data.repeat === "off" ? "context" : data.repeat === "context" ? "track" : "off";
  return /* @__PURE__ */ jsxs("div", { className: "widget-card widget-media", children: [
    /* @__PURE__ */ jsxs("div", { className: "widget-media__meta", children: [
      providerLabel,
      /* @__PURE__ */ jsx("p", { className: "widget-media__title", children: data.track.title }),
      /* @__PURE__ */ jsx("p", { className: "widget-media__artist muted", children: data.track.artist }),
      /* @__PURE__ */ jsxs("div", { className: "widget-media__controls", "aria-label": t("player"), children: [
        canShuffle && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: `widget-media__toggle${data.shuffle ? " widget-media__toggle--on" : ""}`,
            "aria-label": t("shuffle"),
            "aria-pressed": data.shuffle,
            onClick: () => void control("shuffle", !data.shuffle),
            children: /* @__PURE__ */ jsx(Icon, { name: "shuffle" })
          }
        ),
        /* @__PURE__ */ jsx("button", { type: "button", "aria-label": t("previous"), onClick: () => void control("previous"), children: /* @__PURE__ */ jsx(Icon, { name: "previous" }) }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "widget-media__play",
            "aria-label": data.isPlaying ? t("pause") : t("play"),
            onClick: () => void control(data.isPlaying ? "pause" : "play"),
            children: /* @__PURE__ */ jsx(Icon, { name: data.isPlaying ? "pause" : "play" })
          }
        ),
        /* @__PURE__ */ jsx("button", { type: "button", "aria-label": t("next"), onClick: () => void control("next"), children: /* @__PURE__ */ jsx(Icon, { name: "next" }) }),
        canRepeat && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: `widget-media__toggle${data.repeat !== "off" ? " widget-media__toggle--on" : ""}`,
            "aria-label": t("repeat"),
            "aria-pressed": data.repeat !== "off",
            onClick: () => void control("repeat", nextRepeat),
            children: /* @__PURE__ */ jsx(Icon, { name: "repeat" })
          }
        )
      ] })
    ] }),
    data.track.artUrl ? /* @__PURE__ */ jsx("img", { className: "widget-media__art", src: data.track.artUrl, alt: "" }) : /* @__PURE__ */ jsx("div", { className: "widget-media__art widget-media__art--placeholder", "aria-hidden": "true", children: data.track.title.slice(0, 1) })
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
  screens: [{ id: "media", label: "Media", ariaLabel: { ja: "\u30E1\u30C7\u30A3\u30A2", en: "Media" }, icon: "play", order: 10, Component: MediaScreen }]
});
export {
  web_default as default
};
