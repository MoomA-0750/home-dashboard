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

// extensions/accounts/src/webMessages.ts
var commonMessages = defineMessages({
  ja: {
    requestFailed: "\u3046\u307E\u304F\u3044\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    loading: "\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    cancel: "\u3084\u3081\u308B",
    close: "\u9589\u3058\u308B",
    save: "\u4FDD\u5B58",
    noSubject: "\uFF08\u4EF6\u540D\u306A\u3057\uFF09"
  },
  en: {
    requestFailed: "Something went wrong ({status})",
    loading: "Loading\u2026",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    noSubject: "(No subject)"
  }
});

// extensions/accounts/src/client.ts
async function request(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "accounts", path), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? commonMessages.t("requestFailed", { status: res.status }));
  return body;
}
var fetchProviders = (ctx) => request(ctx, "/providers");
var fetchAccounts = async (ctx) => (await request(ctx, "/accounts")).accounts;
var addAccount = async (ctx, input) => (await request(ctx, "/accounts", { method: "POST", json: input })).account;
var updateAccount = async (ctx, id, input) => (await request(ctx, `/accounts/${encodeURIComponent(id)}`, { method: "PATCH", json: input })).account;
var removeAccount = (ctx, id) => request(ctx, `/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
var testAccount = (ctx, id) => request(ctx, `/accounts/${encodeURIComponent(id)}/test`, { method: "POST" });
async function startOAuth(ctx, provider, accountId) {
  const query = accountId ? `?account=${encodeURIComponent(accountId)}` : "";
  const { url } = await request(ctx, `/oauth/${provider}/start${query}`);
  window.location.assign(url);
}
var providerLabels = defineMessages({
  ja: {
    google: "Google",
    microsoft: "Microsoft",
    icloud: "iCloud",
    imap: "\u30E1\u30FC\u30EB\uFF08IMAP\uFF09",
    caldav: "\u30AB\u30EC\u30F3\u30C0\u30FC\uFF08CalDAV\uFF09",
    ical: "\u516C\u958B\u30AB\u30EC\u30F3\u30C0\u30FC\uFF08iCal\uFF09"
  },
  en: {
    google: "Google",
    microsoft: "Microsoft",
    icloud: "iCloud",
    imap: "Mail (IMAP)",
    caldav: "Calendar (CalDAV)",
    ical: "Public calendar (iCal)"
  }
});
var providerLabel = (kind, locale) => providerLabels.t(kind, void 0, locale);

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/accounts/src/AccountsPage.tsx
var messages = defineMessages({
  ja: {
    added: "{label} \u3092\u8DB3\u3057\u307E\u3057\u305F",
    removed: "{label} \u3092\u5916\u3057\u307E\u3057\u305F",
    calendar: "\u30AB\u30EC\u30F3\u30C0\u30FC",
    mail: "\u30E1\u30FC\u30EB",
    serviceSeparator: "\u30FB",
    notInUse: "\u4F7F\u3063\u3066\u3044\u307E\u305B\u3093",
    intro: "Google\u30FBiCloud \u306A\u3069\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u8DB3\u3059\u3068\u3001\u30AB\u30EC\u30F3\u30C0\u30FC\u3068\u30E1\u30FC\u30EB\u304C\u300C\u30AB\u30EC\u30F3\u30C0\u30FC\u300D\u300C\u30E1\u30FC\u30EB\u300D\u306E\u753B\u9762\u3068\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u307E\u3059\u3002\u81EA\u5206\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306F\u81EA\u5206\u306B\u3060\u3051\u898B\u3048\u307E\u3059\u3002\u300C\u5BB6\u3067\u5171\u6709\u3059\u308B\u300D\u306B\u3057\u305F\u3082\u306E\u306F\u3001\u5BB6\u65CF\u3068\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u3082\u898B\u3048\u307E\u3059\u3002",
    myAccounts: "\u81EA\u5206\u306E\u30A2\u30AB\u30A6\u30F3\u30C8",
    none: "\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
    sharedBadge: "\u5BB6\u3067\u5171\u6709",
    other: "\u305D\u306E\u307B\u304B",
    oauthUnavailable: "{providers}\u306F\u3001\u30ED\u30B0\u30A4\u30F3\u306E\u8A2D\u5B9A\u304C\u307E\u3060\u3067\u3059\u3002\u62BC\u3059\u3068\u8A2D\u5B9A\uFF08\u62E1\u5F35\u6A5F\u80FD \u2192 \u30AB\u30EC\u30F3\u30C0\u30FC\u30FB\u30E1\u30FC\u30EB\uFF09\u3092\u958B\u304D\u307E\u3059\u3002",
    oauthUnavailableMember: "{providers}\u306F\u3001\u30ED\u30B0\u30A4\u30F3\u306E\u8A2D\u5B9A\u304C\u307E\u3060\u3067\u3059\u3002\u7BA1\u7406\u8005\u304C\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 \u30AB\u30EC\u30F3\u30C0\u30FC\u30FB\u30E1\u30FC\u30EB\u300D\u3067\u8A2D\u5B9A\u3059\u308B\u3068\u8DB3\u305B\u307E\u3059\u3002",
    needsSetup: "{provider}\uFF08\u30ED\u30B0\u30A4\u30F3\u306E\u8A2D\u5B9A\u304C\u307E\u3060\u3002\u62BC\u3059\u3068\u8A2D\u5B9A\u3092\u958B\u304F\uFF09",
    needsSetupMember: "{provider}\uFF08\u30ED\u30B0\u30A4\u30F3\u306E\u8A2D\u5B9A\u304C\u307E\u3060\u3002\u7BA1\u7406\u8005\u304C\u8A2D\u5B9A\u3059\u308B\u3068\u8DB3\u305B\u308B\uFF09",
    askAdmin: "{provider}\u306E\u30ED\u30B0\u30A4\u30F3\u306E\u8A2D\u5B9A\u306F\u7BA1\u7406\u8005\u304C\u3057\u307E\u3059\u3002\u7BA1\u7406\u8005\u306B\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 \u30AB\u30EC\u30F3\u30C0\u30FC\u30FB\u30E1\u30FC\u30EB\u300D\u3067\u306E\u8A2D\u5B9A\u3092\u983C\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
    providerSeparator: "\u30FB",
    sharedAccounts: "\u5BB6\u3067\u5171\u6709\u3055\u308C\u3066\u3044\u308B\u30A2\u30AB\u30A6\u30F3\u30C8",
    ownerOnly: "\u5909\u3048\u3089\u308C\u308B\u306E\u306F\u767B\u9332\u3057\u305F\u4EBA",
    internetAccounts: "\u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8",
    addICloud: "iCloud \u3092\u8DB3\u3059",
    addAccount: "\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u8DB3\u3059",
    iCloudNote: "Apple ID \u306E\u30DA\u30FC\u30B8\uFF08account.apple.com\uFF09\u306E\u300C\u30B5\u30A4\u30F3\u30A4\u30F3\u3068\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3 \u2192 App \u7528\u30D1\u30B9\u30EF\u30FC\u30C9\u300D\u3067\u4F5C\u3063\u305F\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u5165\u308C\u307E\u3059\uFF08Apple ID\u306E\u30D1\u30B9\u30EF\u30FC\u30C9\u305D\u306E\u3082\u306E\u306F\u4F7F\u3048\u307E\u305B\u3093\uFF09\u3002iCloud \u306E\u30E1\u30FC\u30EB\u3068\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u4F7F\u3044\u307E\u3059\u3002",
    kind: "\u7A2E\u985E",
    kindImap: "\u30E1\u30FC\u30EB\uFF08IMAP\u30FBSMTP\uFF09",
    kindCaldav: "\u30AB\u30EC\u30F3\u30C0\u30FC\uFF08CalDAV\uFF09",
    kindIcal: "\u516C\u958B\u30AB\u30EC\u30F3\u30C0\u30FC\uFF08iCal \u306E URL\u3002\u898B\u308B\u3060\u3051\uFF09",
    imapServer: "\u53D7\u4FE1\uFF08IMAP\uFF09\u306E\u30B5\u30FC\u30D0\u30FC",
    imapHint: "Gmail \u306A\u3089 imap.gmail.com\uFF08\u300C\u30A2\u30D7\u30EA\u30D1\u30B9\u30EF\u30FC\u30C9\u300D\u3092\u4F7F\u3046\uFF09",
    imapPort: "\u53D7\u4FE1\u306E\u30DD\u30FC\u30C8",
    smtpServer: "\u9001\u4FE1\uFF08SMTP\uFF09\u306E\u30B5\u30FC\u30D0\u30FC",
    smtpHint: "\u7A7A\u306A\u3089\u8AAD\u3080\u3060\u3051",
    smtpPort: "\u9001\u4FE1\u306E\u30DD\u30FC\u30C8",
    caldavUrl: "CalDAV \u306E URL",
    calendarUrl: "\u30AB\u30EC\u30F3\u30C0\u30FC\u306E URL",
    icalHint: "Google \u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u300CiCal \u5F62\u5F0F\u306E\u975E\u516C\u958B URL\u300D\u3084\u3001\u795D\u65E5\u306E\u30AB\u30EC\u30F3\u30C0\u30FC\u306A\u3069\uFF08webcal:// \u3082\u53EF\uFF09",
    appleId: "Apple ID\uFF08\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF09",
    username: "\u30E6\u30FC\u30B6\u30FC\u540D",
    appPassword: "App \u7528\u30D1\u30B9\u30EF\u30FC\u30C9",
    password: "\u30D1\u30B9\u30EF\u30FC\u30C9",
    labelOptional: "\u540D\u524D\uFF08\u7A7A\u306A\u3089\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF09",
    shareCheck: "\u5BB6\u3067\u5171\u6709\u3059\u308B\uFF08\u5BB6\u65CF\u3068\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u3082\u898B\u3048\u308B\uFF09",
    checking: "\u3064\u306A\u304C\u308B\u304B\u78BA\u304B\u3081\u3066\u3044\u307E\u3059\u2026",
    add: "\u8DB3\u3059",
    useCalendar: "\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u4F7F\u3046",
    useCalendarDetail: "\u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u753B\u9762\u30FB\u4E88\u5B9A\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u3059",
    useMail: "\u30E1\u30FC\u30EB\u3092\u4F7F\u3046",
    useMailDetail: "\u30E1\u30FC\u30EB\u306E\u753B\u9762\u30FB\u30E1\u30FC\u30EB\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u3059",
    share: "\u5BB6\u3067\u5171\u6709\u3059\u308B",
    shareDetail: "\u5BB6\u65CF\u3068\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u3082\u898B\u305B\u308B\uFF08\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306F\u4E88\u5B9A\u3092\u8DB3\u3057\u305F\u308A\u3001\u78BA\u304B\u3081\u3066\u304B\u3089\u30E1\u30FC\u30EB\u3092\u9001\u3063\u305F\u308A\u3067\u304D\u308B\uFF09",
    uses: "\u4F7F\u3046\u3082\u306E",
    name: "\u540D\u524D",
    passwordHint: "\u5909\u3048\u308B\u3068\u304D\u3060\u3051\u5165\u308C\u308B",
    changed: "\u5909\u3048\u307E\u3057\u305F",
    test: "\u3064\u306A\u304C\u308B\u304B\u78BA\u304B\u3081\u308B",
    reauth: "\u30ED\u30B0\u30A4\u30F3\u3057\u76F4\u3059",
    confirmRemove: "\u3082\u3046\u4E00\u5EA6\u62BC\u3057\u3066\u5916\u3059",
    remove: "\u3053\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u5916\u3059",
    oauthRemoveNote: "\u5916\u3057\u3066\u3082\u3001{provider} \u306E\u5074\u306E\u8A31\u3057\u306F\u6B8B\u308A\u307E\u3059\u3002\u6B62\u3081\u308B\u306A\u3089\u3001{provider}\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u300C\u30B5\u30FC\u30C9\u30D1\u30FC\u30C6\u30A3\u306E\u30A2\u30AF\u30BB\u30B9\u300D\u304B\u3089\u3082\u5916\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
  },
  en: {
    added: "Added {label}",
    removed: "Removed {label}",
    calendar: "Calendar",
    mail: "Mail",
    serviceSeparator: ", ",
    notInUse: "Not in use",
    intro: "Add accounts such as Google or iCloud to show their calendars and mail on the Calendar and Mail screens and widgets. Your accounts are visible only to you. Accounts set to \u201CShare with household\u201D are also visible to your family and the voice assistant.",
    myAccounts: "My accounts",
    none: "None yet.",
    sharedBadge: "Shared",
    other: "Other",
    oauthUnavailable: "Sign-in for {providers} isn't set up yet. Tap it to open the setup (Extensions \u2192 Calendar & Mail).",
    oauthUnavailableMember: "Sign-in for {providers} isn't set up yet. It can be added once an admin sets it up in Extensions \u2192 Calendar & Mail.",
    needsSetup: "{provider} (sign-in not set up; tap to open the setup)",
    needsSetupMember: "{provider} (sign-in not set up; an admin can set it up)",
    askAdmin: "An admin sets up sign-in for {provider}. Ask an admin to set it up in Extensions \u2192 Calendar & Mail.",
    providerSeparator: " and ",
    sharedAccounts: "Shared household accounts",
    ownerOnly: "Only the person who added it can change it",
    internetAccounts: "Internet Accounts",
    addICloud: "Add iCloud",
    addAccount: "Add account",
    iCloudNote: "Enter an app-specific password created on your Apple ID page (account.apple.com) under Sign-In and Security \u2192 App-Specific Passwords (your Apple ID password itself won't work). Uses iCloud Mail and Calendar.",
    kind: "Type",
    kindImap: "Mail (IMAP / SMTP)",
    kindCaldav: "Calendar (CalDAV)",
    kindIcal: "Public calendar (iCal URL, read-only)",
    imapServer: "Incoming (IMAP) server",
    imapHint: "For Gmail, imap.gmail.com (use an app password)",
    imapPort: "Incoming port",
    smtpServer: "Outgoing (SMTP) server",
    smtpHint: "Leave empty for read-only",
    smtpPort: "Outgoing port",
    caldavUrl: "CalDAV URL",
    calendarUrl: "Calendar URL",
    icalHint: "Such as Google Calendar's \u201CSecret address in iCal format\u201D or a holiday calendar (webcal:// works too)",
    appleId: "Apple ID (email address)",
    username: "Username",
    appPassword: "App-specific password",
    password: "Password",
    labelOptional: "Name (email address if empty)",
    shareCheck: "Share with household (visible to family and the voice assistant)",
    checking: "Checking the connection\u2026",
    add: "Add",
    useCalendar: "Use calendar",
    useCalendarDetail: "Show on the Calendar screen and events widget",
    useMail: "Use mail",
    useMailDetail: "Show on the Mail screen and mail widget",
    share: "Share with household",
    shareDetail: "Also show to family and the voice assistant (the voice assistant can add events and, after confirming, send mail)",
    uses: "Use for",
    name: "Name",
    passwordHint: "Enter only to change it",
    changed: "Saved",
    test: "Test connection",
    reauth: "Sign in again",
    confirmRemove: "Press again to remove",
    remove: "Remove this account",
    oauthRemoveNote: "Removing it here keeps the access granted on the {provider} side. To revoke it, also remove it under third-party access in your {provider} account."
  }
});
function AccountsPage({ ctx, account }) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [accounts, setAccounts] = useState(null);
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  const [view, setView] = useState({ kind: "list" });
  const [message, setMessage] = useState(null);
  const load = useCallback(async () => {
    try {
      const [list, available] = await Promise.all([fetchAccounts(ctx), fetchProviders(ctx)]);
      setAccounts(list);
      setProviders(available);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  }, [ctx.apiBaseUrl]);
  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    const error = params.get("error");
    if (added) setMessage({ ok: true, text: messages.t("added", { label: added }) });
    if (error) setMessage({ ok: false, text: error });
    if (params.has("settings")) window.history.replaceState(null, "", window.location.pathname);
  }, [load]);
  const done = (text) => {
    setMessage({ ok: true, text });
    setView({ kind: "list" });
    void load();
  };
  if (view.kind === "add")
    return /* @__PURE__ */ jsx(AddForm, { ctx, type: view.type, onBack: () => setView({ kind: "list" }), onAdded: (a) => done(t("added", { label: a.label })) });
  const opened = view.kind === "detail" ? accounts?.find((a) => a.id === view.id) : null;
  if (opened)
    return /* @__PURE__ */ jsx(
      AccountDetail,
      {
        ctx,
        account: opened,
        onBack: () => setView({ kind: "list" }),
        onChanged: () => void load(),
        onRemoved: () => done(t("removed", { label: opened.label }))
      }
    );
  const isAdmin = account.role === "admin";
  const oauthButton = (provider, label) => providers[provider] ? /* @__PURE__ */ jsx(Button, { icon: "add", onClick: () => void startOAuth(ctx, provider).catch((err) => setMessage({ ok: false, text: err.message })), children: label }) : /* @__PURE__ */ jsx(
    Button,
    {
      icon: "warning",
      className: "[&_.fluent-icon]:text-warn",
      "aria-label": t(isAdmin ? "needsSetup" : "needsSetupMember", { provider: label }),
      title: t(isAdmin ? "needsSetup" : "needsSetupMember", { provider: label }),
      onClick: () => isAdmin ? openSettings({ page: "extensions", extension: "accounts" }) : setMessage({ ok: false, text: t("askAdmin", { provider: label }) }),
      children: label
    }
  );
  const mine = accounts?.filter((a) => a.mine) ?? [];
  const others = accounts?.filter((a) => !a.mine) ?? [];
  const services = (a) => [a.services.calendar && t("calendar"), a.services.mail && t("mail")].filter(Boolean).join(t("serviceSeparator")) || t("notInUse");
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx(Note, { children: t("intro") }),
    message && /* @__PURE__ */ jsx(Message, { tone: message.ok ? "ok" : "error", children: message.text }),
    /* @__PURE__ */ jsx(SectionTitle, { children: t("myAccounts") }),
    accounts === null ? /* @__PURE__ */ jsx(Note, { children: tc("loading") }) : mine.length === 0 ? /* @__PURE__ */ jsx(Note, { children: t("none") }) : /* @__PURE__ */ jsx(List, { label: t("myAccounts"), children: mine.map((a) => /* @__PURE__ */ jsx(
      ListItem,
      {
        title: a.label,
        badge: a.shared ? t("sharedBadge") : void 0,
        detail: `${providerLabel(a.provider, locale)} \xB7 ${services(a)}`,
        onClick: () => {
          setMessage(null);
          setView({ kind: "detail", id: a.id });
        }
      },
      a.id
    )) }),
    /* @__PURE__ */ jsxs(ButtonRow, { children: [
      oauthButton("google", "Google"),
      /* @__PURE__ */ jsx(Button, { icon: "add", onClick: () => setView({ kind: "add", type: "icloud" }), children: "iCloud" }),
      oauthButton("microsoft", "Microsoft"),
      /* @__PURE__ */ jsx(Button, { icon: "add", onClick: () => setView({ kind: "add", type: "other" }), children: t("other") })
    ] }),
    (!providers.google || !providers.microsoft) && /* @__PURE__ */ jsx(Note, { children: t(isAdmin ? "oauthUnavailable" : "oauthUnavailableMember", {
      providers: [!providers.google && "Google", !providers.microsoft && "Microsoft"].filter(Boolean).join(t("providerSeparator"))
    }) }),
    others.length > 0 && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("sharedAccounts") }),
      /* @__PURE__ */ jsx(List, { label: t("sharedAccounts"), children: others.map((a) => /* @__PURE__ */ jsx(ListItem, { title: a.label, detail: `${providerLabel(a.provider, locale)} \xB7 ${services(a)} \xB7 ${t("ownerOnly")}` }, a.id)) })
    ] })
  ] });
}
function AddForm({
  ctx,
  type,
  onBack,
  onAdded
}) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const [kind, setKind] = useState(type === "icloud" ? "icloud" : "imap");
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const account = await addAccount(ctx, {
        provider: kind,
        label,
        username,
        password,
        shared,
        imap: kind === "imap" ? { host: imapHost, port: imapPort, secure: imapPort !== "143" } : void 0,
        smtp: kind === "imap" && smtpHost ? { host: smtpHost, port: smtpPort, secure: smtpPort === "465" } : void 0,
        calendarUrl: kind === "caldav" || kind === "ical" ? calendarUrl : void 0
      });
      onAdded(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs("form", { className: "flex flex-col gap-1", onSubmit: (e) => void submit(e), children: [
    /* @__PURE__ */ jsx(BackButton, { label: t("internetAccounts"), onClick: onBack }),
    /* @__PURE__ */ jsx(SectionTitle, { children: kind === "icloud" ? t("addICloud") : t("addAccount") }),
    kind === "icloud" && /* @__PURE__ */ jsx(Note, { children: t("iCloudNote") }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "m-0 border-0 p-0", disabled: busy, children: [
        type === "other" && /* @__PURE__ */ jsx(Field, { label: t("kind"), children: /* @__PURE__ */ jsxs("select", { value: kind, onChange: (e) => setKind(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "imap", children: t("kindImap") }),
          /* @__PURE__ */ jsx("option", { value: "caldav", children: t("kindCaldav") }),
          /* @__PURE__ */ jsx("option", { value: "ical", children: t("kindIcal") })
        ] }) }),
        kind === "imap" && /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(Field, { label: t("imapServer"), hint: t("imapHint"), children: /* @__PURE__ */ jsx("input", { value: imapHost, placeholder: "imap.example.com", onChange: (e) => setImapHost(e.target.value) }) }),
          /* @__PURE__ */ jsx(Field, { label: t("imapPort"), children: /* @__PURE__ */ jsx("input", { inputMode: "numeric", value: imapPort, onChange: (e) => setImapPort(e.target.value) }) }),
          /* @__PURE__ */ jsx(Field, { label: t("smtpServer"), hint: t("smtpHint"), children: /* @__PURE__ */ jsx("input", { value: smtpHost, placeholder: "smtp.example.com", onChange: (e) => setSmtpHost(e.target.value) }) }),
          /* @__PURE__ */ jsx(Field, { label: t("smtpPort"), children: /* @__PURE__ */ jsx("input", { inputMode: "numeric", value: smtpPort, onChange: (e) => setSmtpPort(e.target.value) }) })
        ] }),
        (kind === "caldav" || kind === "ical") && /* @__PURE__ */ jsx(
          Field,
          {
            label: kind === "caldav" ? t("caldavUrl") : t("calendarUrl"),
            hint: kind === "ical" ? t("icalHint") : void 0,
            children: /* @__PURE__ */ jsx("input", { value: calendarUrl, placeholder: "https://\u2026", onChange: (e) => setCalendarUrl(e.target.value) })
          }
        ),
        kind !== "ical" && /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(Field, { label: kind === "icloud" ? t("appleId") : t("username"), children: /* @__PURE__ */ jsx("input", { value: username, autoComplete: "off", spellCheck: false, onChange: (e) => setUsername(e.target.value) }) }),
          /* @__PURE__ */ jsx(Field, { label: kind === "icloud" ? t("appPassword") : t("password"), children: /* @__PURE__ */ jsx("input", { type: "password", value: password, autoComplete: "new-password", onChange: (e) => setPassword(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsx(Field, { label: t("labelOptional"), children: /* @__PURE__ */ jsx("input", { value: label, maxLength: 40, onChange: (e) => setLabel(e.target.value) }) }),
        /* @__PURE__ */ jsx(Check, { checked: shared, onChange: setShared, children: t("shareCheck") })
      ] }),
      error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
      /* @__PURE__ */ jsxs(ButtonRow, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", disabled: busy, children: busy ? t("checking") : t("add") }),
        /* @__PURE__ */ jsx(Button, { onClick: onBack, children: tc("cancel") })
      ] })
    ] })
  ] });
}
function AccountDetail({
  ctx,
  account,
  onBack,
  onChanged,
  onRemoved
}) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [label, setLabel] = useState(account.label);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [removing, setRemoving] = useState(false);
  const oauth = account.provider === "google" || account.provider === "microsoft";
  const run = async (work) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await work();
      if (text) setMessage({ ok: true, text });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  const patch = (input, text) => run(async () => {
    await updateAccount(ctx, account.id, input);
    return text;
  });
  const toggles = [
    ...account.supports.calendar ? [{ key: "calendar", title: t("useCalendar"), detail: t("useCalendarDetail"), checked: account.services.calendar }] : [],
    ...account.supports.mail ? [{ key: "mail", title: t("useMail"), detail: t("useMailDetail"), checked: account.services.mail }] : [],
    {
      key: "shared",
      title: t("share"),
      detail: t("shareDetail"),
      checked: account.shared
    }
  ];
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx(BackButton, { label: t("internetAccounts"), onClick: onBack }),
    /* @__PURE__ */ jsx(SectionTitle, { children: account.label }),
    /* @__PURE__ */ jsxs(Note, { children: [
      providerLabel(account.provider, locale),
      account.email && ` \xB7 ${account.email}`,
      account.username && account.username !== account.email && ` \xB7 ${account.username}`
    ] }),
    /* @__PURE__ */ jsx(List, { label: t("uses"), children: toggles.map((toggle) => /* @__PURE__ */ jsx(
      ListItem,
      {
        title: toggle.title,
        detail: toggle.detail,
        trailing: /* @__PURE__ */ jsx(
          ToggleSwitch,
          {
            checked: toggle.checked,
            disabled: busy,
            label: toggle.title,
            onChange: (on) => void patch(toggle.key === "shared" ? { shared: on } : { services: { ...account.services, [toggle.key]: on } })
          }
        )
      },
      toggle.key
    )) }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsx(Field, { label: t("name"), children: /* @__PURE__ */ jsx("input", { value: label, maxLength: 40, onChange: (e) => setLabel(e.target.value) }) }),
      account.username !== null && /* @__PURE__ */ jsx(Field, { label: t("password"), hint: t("passwordHint"), children: /* @__PURE__ */ jsx("input", { type: "password", value: password, autoComplete: "new-password", onChange: (e) => setPassword(e.target.value) }) }),
      /* @__PURE__ */ jsxs(ButtonRow, { children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "primary",
            disabled: busy || label === account.label && !password,
            onClick: () => void patch({ label, ...password ? { password } : {} }, t("changed")).then(() => setPassword("")),
            children: tc("save")
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            disabled: busy,
            onClick: () => void run(async () => {
              const result = await testAccount(ctx, account.id);
              if (!result.ok) throw new Error(result.message);
              return result.message;
            }),
            children: t("test")
          }
        ),
        oauth && /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => void startOAuth(ctx, account.provider, account.id), children: t("reauth") })
      ] })
    ] }),
    message && /* @__PURE__ */ jsx(Message, { tone: message.ok ? "ok" : "error", children: message.text }),
    /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "danger",
        disabled: busy,
        onClick: () => removing ? void run(async () => {
          await removeAccount(ctx, account.id);
          onRemoved();
        }) : setRemoving(true),
        children: removing ? t("confirmRemove") : t("remove")
      }
    ) }),
    oauth && /* @__PURE__ */ jsx(Note, { children: t("oauthRemoveNote", { provider: providerLabel(account.provider, locale) }) })
  ] });
}

// extensions/accounts/src/calendar/client.ts
async function request2(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "accounts", `/calendar${path}`), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? commonMessages.t("requestFailed", { status: res.status }));
  return body;
}
var fetchCalendars = (ctx) => request2(ctx, "/calendars");
var setCalendarEnabled = (ctx, id, enabled) => request2(ctx, `/calendars/${encodeURIComponent(id)}/enabled`, { method: "PUT", json: { enabled } });
var fetchEvents = (ctx, from, to) => request2(
  ctx,
  `/events?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`
);
var createEvent = (ctx, input) => request2(ctx, "/events", { method: "POST", json: input });
var updateEvent = (ctx, id, input) => request2(ctx, `/events/${encodeURIComponent(id)}`, { method: "PUT", json: input });
var deleteEvent = (ctx, id) => request2(ctx, `/events/${encodeURIComponent(id)}`, { method: "DELETE" });
var pad = (n) => String(n).padStart(2, "0");
var messages2 = defineMessages({
  ja: { today: "\u4ECA\u65E5 {day}", tomorrow: "\u660E\u65E5 {day}", allDay: "\u7D42\u65E5", range: "{start}\u301C{end}" },
  en: { today: "Today \xB7 {day}", tomorrow: "Tomorrow \xB7 {day}", allDay: "All day", range: "{start} \u2013 {end}" }
});
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function timeText(date) {
  return formatClock(date);
}
function dayLabel(date, today = startOfDay(/* @__PURE__ */ new Date()), locale = getLocale()) {
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 864e5);
  const base = formatDate(date, "monthDayWeekday", locale);
  if (diff === 0) return messages2.t("today", { day: base }, locale);
  if (diff === 1) return messages2.t("tomorrow", { day: base }, locale);
  return base;
}
function eventOnDay(event, day) {
  const key = dateKey(day);
  if (event.allDay) return event.start <= key && key < event.end;
  const start = new Date(event.start);
  const end = new Date(event.end);
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return start < dayEnd && end > dayStart;
}
function eventTimeText(event, day, locale = getLocale()) {
  if (event.allDay) return messages2.t("allDay", void 0, locale);
  const start = new Date(event.start);
  const end = new Date(event.end);
  const dayStart = startOfDay(day);
  const startText = start < dayStart ? "" : formatClock(start, locale);
  const endText = end > addDays(dayStart, 1) ? "" : formatClock(end, locale);
  return messages2.t("range", { start: startText, end: endText }, locale).trim();
}

// extensions/accounts/src/calendar/CalendarDot.tsx
function CalendarDot({ color }) {
  return /* @__PURE__ */ jsx("span", { className: "size-2.5 shrink-0 rounded-full bg-muted", style: { background: color ?? void 0 } });
}

// extensions/accounts/src/calendar/EventEditor.tsx
var messages3 = defineMessages({
  ja: {
    viewTitle: "\u4E88\u5B9A",
    editTitle: "\u4E88\u5B9A\u3092\u5909\u3048\u308B",
    addTitle: "\u4E88\u5B9A\u3092\u8DB3\u3059",
    name: "\u540D\u524D",
    calendar: "\u30AB\u30EC\u30F3\u30C0\u30FC",
    calendarHint: "\u307B\u304B\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306E\u30AB\u30EC\u30F3\u30C0\u30FC\u3078\u306F\u79FB\u305B\u307E\u305B\u3093",
    calendarOption: "{name}\uFF08{source}\uFF09",
    allDay: "\u7D42\u65E5",
    start: "\u59CB\u307E\u308A",
    time: "\u6642\u523B",
    endAllDay: "\u7D42\u308F\u308A\uFF08\u305D\u306E\u65E5\u307E\u3067\uFF09",
    end: "\u7D42\u308F\u308A",
    location: "\u5834\u6240",
    notes: "\u30E1\u30E2",
    recurring: "\u7E70\u308A\u8FD4\u3057\u306E\u4E88\u5B9A\u3067\u3059\u3002\u5909\u3048\u308B\u3068\u3001\u7E70\u308A\u8FD4\u3057\u5168\u4F53\u304C\u5909\u308F\u308B\u3053\u3068\u304C\u3042\u308A\u307E\u3059\u3002",
    saving: "\u4FDD\u5B58\u3057\u3066\u3044\u307E\u3059\u2026",
    confirmDelete: "\u3082\u3046\u4E00\u5EA6\u62BC\u3057\u3066\u6D88\u3059",
    delete: "\u6D88\u3059"
  },
  en: {
    viewTitle: "Event",
    editTitle: "Edit event",
    addTitle: "Add event",
    name: "Title",
    calendar: "Calendar",
    calendarHint: "Events can't be moved to another account's calendar",
    calendarOption: "{name} ({source})",
    allDay: "All day",
    start: "Starts",
    time: "Time",
    endAllDay: "Ends (through that day)",
    end: "Ends",
    location: "Location",
    notes: "Notes",
    recurring: "This is a recurring event. Changing it may change the whole series.",
    saving: "Saving\u2026",
    confirmDelete: "Press again to delete",
    delete: "Delete"
  }
});
function draftOf(event, calendars, day) {
  if (!event) {
    const start2 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.min((/* @__PURE__ */ new Date()).getHours() + 1, 23));
    return {
      calendarId: calendars.find((c) => c.writable)?.id ?? "",
      title: "",
      allDay: false,
      startDate: dateKey(start2),
      startTime: timeText(start2).padStart(5, "0"),
      endDate: dateKey(start2),
      endTime: timeText(new Date(start2.getTime() + 36e5)).padStart(5, "0"),
      location: "",
      description: ""
    };
  }
  if (event.allDay) {
    const lastDay = addDays(/* @__PURE__ */ new Date(`${event.end}T00:00:00`), -1);
    return {
      calendarId: event.calendarId,
      title: event.title,
      allDay: true,
      startDate: event.start,
      startTime: "09:00",
      endDate: dateKey(lastDay),
      endTime: "10:00",
      location: event.location ?? "",
      description: event.description ?? ""
    };
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  return {
    calendarId: event.calendarId,
    title: event.title,
    allDay: false,
    startDate: dateKey(start),
    startTime: timeText(start).padStart(5, "0"),
    endDate: dateKey(end),
    endTime: timeText(end).padStart(5, "0"),
    location: event.location ?? "",
    description: event.description ?? ""
  };
}
function inputOf(draft) {
  const base = {
    calendarId: draft.calendarId,
    title: draft.title,
    allDay: draft.allDay,
    location: draft.location || null,
    description: draft.description || null
  };
  if (draft.allDay)
    return { ...base, start: draft.startDate, end: dateKey(addDays(/* @__PURE__ */ new Date(`${draft.endDate}T00:00:00`), 1)) };
  return {
    ...base,
    start: (/* @__PURE__ */ new Date(`${draft.startDate}T${draft.startTime}`)).toISOString(),
    end: (/* @__PURE__ */ new Date(`${draft.endDate}T${draft.endTime}`)).toISOString()
  };
}
function EventEditor({
  event,
  calendars,
  day,
  onSave,
  onDelete,
  onClose
}) {
  const t = messages3.useT();
  const tc = commonMessages.useT();
  const [draft, setDraft] = useState(() => draftOf(event, calendars, day));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const calendar = calendars.find((c) => c.id === draft.calendarId);
  const readOnly = event !== null && calendar?.writable === false;
  const writable = calendars.filter((c) => c.writable || c.id === draft.calendarId);
  const run = async (work) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  const submit = (e) => {
    e.preventDefault();
    void run(() => onSave(inputOf(draft)));
  };
  return /* @__PURE__ */ jsxs("form", { className: "mb-6", onSubmit: submit, children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: event ? readOnly ? t("viewTitle") : t("editTitle") : t("addTitle") }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "m-0 border-0 p-0", disabled: busy || readOnly, children: [
        /* @__PURE__ */ jsx(Field, { label: t("name"), children: /* @__PURE__ */ jsx("input", { value: draft.title, maxLength: 200, autoFocus: !event, onChange: (e) => set({ title: e.target.value }) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("calendar"), hint: event ? t("calendarHint") : void 0, children: /* @__PURE__ */ jsx("select", { value: draft.calendarId, onChange: (e) => set({ calendarId: e.target.value }), children: writable.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: t("calendarOption", { name: c.name, source: c.source }) }, c.id)) }) }),
        /* @__PURE__ */ jsx(Check, { checked: draft.allDay, onChange: (allDay) => set({ allDay }), children: t("allDay") }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-x-3 *:min-w-0 *:flex-1 *:basis-36", children: [
          /* @__PURE__ */ jsx(Field, { label: t("start"), children: /* @__PURE__ */ jsx("input", { type: "date", value: draft.startDate, onChange: (e) => set({ startDate: e.target.value, endDate: e.target.value > draft.endDate ? e.target.value : draft.endDate }) }) }),
          !draft.allDay && /* @__PURE__ */ jsx(Field, { label: t("time"), children: /* @__PURE__ */ jsx("input", { type: "time", value: draft.startTime, onChange: (e) => set({ startTime: e.target.value }) }) }),
          /* @__PURE__ */ jsx(Field, { label: draft.allDay ? t("endAllDay") : t("end"), children: /* @__PURE__ */ jsx("input", { type: "date", value: draft.endDate, onChange: (e) => set({ endDate: e.target.value }) }) }),
          !draft.allDay && /* @__PURE__ */ jsx(Field, { label: t("time"), children: /* @__PURE__ */ jsx("input", { type: "time", value: draft.endTime, onChange: (e) => set({ endTime: e.target.value }) }) })
        ] }),
        /* @__PURE__ */ jsx(Field, { label: t("location"), children: /* @__PURE__ */ jsx("input", { value: draft.location, maxLength: 500, onChange: (e) => set({ location: e.target.value }) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("notes"), children: /* @__PURE__ */ jsx("textarea", { rows: 3, value: draft.description, maxLength: 5e3, onChange: (e) => set({ description: e.target.value }) }) }),
        event?.recurring && /* @__PURE__ */ jsx(Message, { children: t("recurring") })
      ] }),
      error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
      /* @__PURE__ */ jsxs(ButtonRow, { children: [
        !readOnly && /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", disabled: busy || !draft.title.trim() || !draft.calendarId, children: busy ? t("saving") : tc("save") }),
        /* @__PURE__ */ jsx(Button, { onClick: onClose, children: readOnly ? tc("close") : tc("cancel") }),
        event && !readOnly && /* @__PURE__ */ jsx(
          Button,
          {
            variant: "danger",
            disabled: busy,
            onClick: () => deleting ? void run(onDelete) : setDeleting(true),
            children: deleting ? t("confirmDelete") : t("delete")
          }
        )
      ] })
    ] })
  ] });
}

// extensions/accounts/src/calendar/MonthGrid.tsx
var messages4 = defineMessages({
  ja: { previousMonth: "\u524D\u306E\u6708", nextMonth: "\u6B21\u306E\u6708", hasEvents: "\u4E88\u5B9A\u3042\u308A" },
  en: { previousMonth: "Previous month", nextMonth: "Next month", hasEvents: "has events" }
});
var GRID_DAYS = 42;
function gridStart(month, display) {
  return startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1), display);
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function MonthGrid({
  month,
  selected,
  marked,
  onSelect,
  onMonth,
  compact = false
}) {
  const t = messages4.useT();
  const locale = useLocale();
  const display = useDisplay();
  const today = startOfDay(/* @__PURE__ */ new Date());
  const start = gridStart(month, display);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => addDays(start, i));
  const weekdays = days.slice(0, 7).map((day) => formatDate(day, "weekday", locale, display));
  const shift = (delta) => onMonth?.(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  return /* @__PURE__ */ jsxs("div", { className: cx("flex w-full min-w-0 flex-col", compact ? "gap-1" : "gap-2"), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: cx("font-semibold", compact ? "text-label" : "text-title"), children: formatDate(month, "monthYear", locale, display) }),
      onMonth && /* @__PURE__ */ jsxs("span", { className: "flex gap-1", children: [
        /* @__PURE__ */ jsx(IconButton, { icon: "chevron-left", label: t("previousMonth"), onClick: () => shift(-1) }),
        /* @__PURE__ */ jsx(IconButton, { icon: "chevron-right", label: t("nextMonth"), onClick: () => shift(1) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: cx("grid grid-cols-7", compact ? "auto-rows-fr gap-x-0.5 gap-y-0.5" : "gap-0.5"),
        role: "grid",
        "aria-label": formatDate(month, "monthYear", locale, display),
        children: [
          weekdays.map((name, i) => /* @__PURE__ */ jsx(
            "span",
            {
              className: cx("text-center text-muted", compact ? "text-micro" : "pb-1 text-caption font-medium"),
              role: "columnheader",
              children: name
            },
            `w${i}`
          )),
          days.map((day) => {
            const outside = day.getMonth() !== month.getMonth();
            const isToday = sameDay(day, today);
            const isSelected = selected ? sameDay(day, selected) : false;
            const hasEvents = marked?.(day) ?? false;
            const className = cx(
              "relative flex flex-col items-center justify-center gap-0.5 rounded-inner tabular-nums",
              compact ? "py-0.5 text-note" : "tap-lg",
              onSelect && "press cursor-pointer",
              onSelect && !isSelected && "hover:bg-tint/8",
              outside && "text-muted opacity-55",
              isSelected && "fill-bright"
            );
            const numberClass = cx(
              !isSelected && day.getDay() === 0 && "text-danger",
              !isSelected && day.getDay() === 6 && "text-accent-soft",
              isToday && "inline-flex items-center justify-center rounded-full font-bold ring-2 ring-accent ring-inset",
              isToday && (compact ? "size-5" : "size-7.5")
            );
            const label = `${formatDate(day, "monthDayWeekday", locale, display)}${hasEvents ? ` \xB7 ${t("hasEvents")}` : ""}`;
            const content = /* @__PURE__ */ jsxs(Fragment2, { children: [
              /* @__PURE__ */ jsx("span", { className: numberClass, children: day.getDate() }),
              hasEvents && /* @__PURE__ */ jsx("span", { className: "size-1.5 rounded-full bg-current opacity-80", "aria-hidden": "true" })
            ] });
            return onSelect ? /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                role: "gridcell",
                className,
                "aria-label": label,
                "aria-selected": isSelected,
                "aria-current": isToday ? "date" : void 0,
                onClick: () => onSelect(day),
                children: content
              },
              day.getTime()
            ) : /* @__PURE__ */ jsx("span", { role: "gridcell", className, "aria-label": label, "aria-current": isToday ? "date" : void 0, children: content }, day.getTime());
          })
        ]
      }
    )
  ] });
}

// extensions/accounts/src/swr.ts
var values = /* @__PURE__ */ new Map();
var loading = /* @__PURE__ */ new Map();
var MAX_ENTRIES = 300;
function peekCached(key) {
  return values.get(key)?.value;
}
function fetchCached(key, load, maxAgeMs = 0) {
  const hit = values.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return Promise.resolve(hit.value);
  const running = loading.get(key);
  if (running) return running;
  const task = load().then(
    (value) => {
      values.delete(key);
      values.set(key, { value, at: Date.now() });
      while (values.size > MAX_ENTRIES) values.delete(values.keys().next().value);
      return value;
    }
  );
  loading.set(key, task);
  void task.finally(() => loading.delete(key)).catch(() => void 0);
  return task;
}
function forgetCached(prefix) {
  for (const key of [...values.keys()]) if (key.startsWith(prefix)) values.delete(key);
}
function useCached(key, load, refreshMs) {
  const [state, setState] = useState(() => ({
    key,
    data: key ? peekCached(key) : void 0,
    error: null
  }));
  const loadRef = useRef(load);
  loadRef.current = load;
  let current = state;
  if (state.key !== key) {
    current = { key, data: key ? peekCached(key) : void 0, error: null };
    setState(current);
  }
  const reload = useCallback(async () => {
    if (!key) return;
    try {
      const data = await fetchCached(key, () => loadRef.current());
      setState((s) => s.key === key ? { key, data, error: null } : s);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setState((s) => s.key === key ? { ...s, error } : s);
    }
  }, [key]);
  useEffect(() => {
    void reload();
    if (!refreshMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [reload, refreshMs]);
  return { data: current.data, error: current.error, reload };
}

// extensions/accounts/src/calendar/CalendarScreen.tsx
var messages5 = defineMessages({
  ja: {
    today: "\u4ECA\u65E5",
    addEvent: "\u4E88\u5B9A\u3092\u8DB3\u3059",
    noCalendars: "\u30AB\u30EC\u30F3\u30C0\u30FC\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u672A\u8A2D\u5B9A\u3067\u3059\uFF08\u62BC\u3059\u3068\u8A2D\u5B9A\u3078\uFF09",
    noEvents: "\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093",
    calendars: "\u30AB\u30EC\u30F3\u30C0\u30FC",
    noCalendarList: "\u30AB\u30EC\u30F3\u30C0\u30FC\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093",
    toggle: "{name}\u3092\u51FA\u3059",
    onlyOwner: "\u5165\uFF0F\u5207\u306F\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u8DB3\u3057\u305F\u4EBA\u304C\u5909\u3048\u307E\u3059"
  },
  en: {
    today: "Today",
    addEvent: "Add event",
    noCalendars: "No calendar account yet (tap to set up)",
    noEvents: "No events",
    calendars: "Calendars",
    noCalendarList: "No calendars yet",
    toggle: "Show {name}",
    onlyOwner: "Only the person who added the account can change this"
  }
});
var eventsKey = (anchor) => `calendar:events:${anchor}`;
function CalendarScreen({ ctx }) {
  const t = messages5.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const display = useDisplay();
  const [month, setMonth] = useState(() => startOfDay(/* @__PURE__ */ new Date()));
  const [selected, setSelected] = useState(() => startOfDay(/* @__PURE__ */ new Date()));
  const anchor = gridStart(month, display);
  const anchorTime = anchor.getTime();
  const eventsFor = (start) => fetchEvents(ctx, new Date(start), addDays(new Date(start), GRID_DAYS));
  const calendarList = useCached("calendar:calendars", () => fetchCalendars(ctx), 5 * 60 * 1e3);
  const eventList = useCached(eventsKey(anchorTime), () => eventsFor(anchorTime), 5 * 60 * 1e3);
  const [toggled, setToggled] = useState(/* @__PURE__ */ new Map());
  const [failure, setFailure] = useState(null);
  const calendars = useMemo(
    () => (calendarList.data?.calendars ?? []).map((c) => toggled.has(c.id) ? { ...c, enabled: toggled.get(c.id) } : c),
    [calendarList.data, toggled]
  );
  const events = eventList.data?.events ?? null;
  const errors = useMemo(() => {
    const seen = /* @__PURE__ */ new Set();
    return [...calendarList.data?.errors ?? [], ...eventList.data?.errors ?? []].filter(
      (e) => !seen.has(e.source) && seen.add(e.source)
    );
  }, [calendarList.data, eventList.data]);
  const loadError = eventList.error ?? calendarList.error;
  const [editing, setEditing] = useState(null);
  const load = async () => {
    forgetCached("calendar:events:");
    forgetCached("calendar:calendars");
    await Promise.all([eventList.reload(), calendarList.reload()]);
  };
  useEffect(() => {
    if (!eventList.data) return;
    const timer = setTimeout(async () => {
      for (const delta of [1, -1]) {
        const next = gridStart(new Date(month.getFullYear(), month.getMonth() + delta, 1), display).getTime();
        await fetchCached(eventsKey(next), () => eventsFor(next), 5 * 60 * 1e3).catch(() => void 0);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [eventList.data]);
  const colors = useMemo(() => new Map(calendars.map((c) => [c.id, c.color])), [calendars]);
  const names = useMemo(() => new Map(calendars.map((c) => [c.id, c.name])), [calendars]);
  const today = startOfDay(/* @__PURE__ */ new Date());
  const enabledCalendars = calendars.filter((c) => c.enabled !== false);
  const canWrite = enabledCalendars.some((c) => c.writable);
  const bySource = useMemo(() => {
    const groups = /* @__PURE__ */ new Map();
    for (const c of calendars) groups.set(c.source, [...groups.get(c.source) ?? [], c]);
    return [...groups];
  }, [calendars]);
  const toggle = async (calendar, enabled) => {
    setToggled((m4) => new Map(m4).set(calendar.id, enabled));
    try {
      await setCalendarEnabled(ctx, calendar.id, enabled);
      await load();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
    setToggled((m4) => {
      const next = new Map(m4);
      next.delete(calendar.id);
      return next;
    });
  };
  const side = /* @__PURE__ */ jsxs(Fragment2, { children: [
    bySource.length === 0 && /* @__PURE__ */ jsx(ScreenNotice, { children: t("noCalendarList") }),
    bySource.map(([source, list]) => /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: source }),
      /* @__PURE__ */ jsx(List, { boxed: true, label: source, children: list.map((c) => /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx(CalendarDot, { color: c.color }),
          title: c.name,
          off: c.enabled === false,
          trailing: /* @__PURE__ */ jsx(
            ToggleSwitch,
            {
              checked: c.enabled !== false,
              disabled: !c.toggleable,
              label: t("toggle", { name: c.name }),
              onChange: (on) => void toggle(c, on)
            }
          )
        },
        c.id
      )) }),
      list.some((c) => !c.toggleable) && /* @__PURE__ */ jsx(Note, { children: t("onlyOwner") })
    ] }, source))
  ] });
  const onSelected = events?.filter((e) => eventOnDay(e, selected)) ?? [];
  const select = (day) => {
    setSelected(day);
    if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) setMonth(day);
  };
  const actions = /* @__PURE__ */ jsxs(ButtonRow, { children: [
    /* @__PURE__ */ jsx(Button, { onClick: () => select(today), children: t("today") }),
    canWrite && /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "add", onClick: () => setEditing({ event: null, day: selected }), children: t("addEvent") })
  ] });
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: { ja: "\u30AB\u30EC\u30F3\u30C0\u30FC", en: "Calendar" }, actions, children: [
    (failure ?? (events === null ? loadError : null)) && /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: failure ?? loadError }),
    errors.map((e) => /* @__PURE__ */ jsxs(ScreenNotice, { tone: "error", children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    editing && /* @__PURE__ */ jsx(
      EventEditor,
      {
        event: editing.event,
        calendars: enabledCalendars,
        day: editing.day,
        onClose: () => setEditing(null),
        onSave: async (input) => {
          if (editing.event) await updateEvent(ctx, editing.event.id, input);
          else await createEvent(ctx, input);
          setEditing(null);
          await load();
        },
        onDelete: async () => {
          if (editing.event) await deleteEvent(ctx, editing.event.id);
          setEditing(null);
          await load();
        }
      },
      editing.event?.id ?? "new"
    ),
    /* @__PURE__ */ jsxs(SideLayout, { side, sideLabel: t("calendars"), narrow: "below", children: [
      events !== null && calendars.length === 0 && errors.length === 0 && /* @__PURE__ */ jsx("div", { className: "mb-3", children: /* @__PURE__ */ jsx(
        Button,
        {
          icon: "warning",
          className: "max-w-full text-left whitespace-normal [&_.fluent-icon]:shrink-0 [&_.fluent-icon]:text-warn",
          onClick: () => openSettings({ page: "account" }),
          children: t("noCalendars")
        }
      ) }),
      /* @__PURE__ */ jsx(Group, { className: "mb-4", children: /* @__PURE__ */ jsx(
        MonthGrid,
        {
          month,
          selected,
          marked: (day) => events?.some((e) => eventOnDay(e, day)) ?? false,
          onSelect: select,
          onMonth: (next) => setMonth(next)
        }
      ) }),
      /* @__PURE__ */ jsx(ScreenSection, { title: dayLabel(selected, today, locale), children: events === null && !loadError ? /* @__PURE__ */ jsx(ScreenNotice, { children: tc("loading") }) : onSelected.length === 0 ? /* @__PURE__ */ jsx(ScreenNotice, { children: t("noEvents") }) : /* @__PURE__ */ jsx(List, { boxed: true, label: dayLabel(selected, today, locale), children: onSelected.map((event) => /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx(CalendarDot, { color: colors.get(event.calendarId) }),
          title: event.title,
          detail: [eventTimeText(event, selected, locale), event.location, names.get(event.calendarId)].filter(Boolean).join(" \xB7 "),
          onClick: () => setEditing({ event, day: selected })
        },
        `${event.id}:${event.start}`
      )) }) })
    ] })
  ] });
}

// extensions/accounts/src/calendar/widget.tsx
var messages6 = defineMessages({
  ja: {
    cardLabel: "\u4E88\u5B9A\uFF081\u9031\u9593\u5206\u3092\u958B\u304F\uFF09",
    loadFailed: "\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
    noCalendars: "\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u8DB3\u3059\u3068\u3001\u4E88\u5B9A\u304C\u51FA\u307E\u3059",
    noCalendarsShort: "\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u672A\u8A2D\u5B9A\uFF08\u8A2D\u5B9A \u2192 \u30A2\u30AB\u30A6\u30F3\u30C8\uFF09",
    emptyTwoDays: "\u4ECA\u65E5\u3068\u660E\u65E5\u306E\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093",
    detailTitle: "\u3053\u308C\u304B\u3089\u306E\u4E88\u5B9A",
    emptyWeek: "1\u9031\u9593\u306E\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093"
  },
  en: {
    cardLabel: "Events (open the week)",
    loadFailed: "Couldn't load",
    noCalendars: "Add a calendar in Settings \u2192 Accounts \u2192 Internet Accounts to see your events",
    noCalendarsShort: "No account yet (Settings \u2192 Accounts)",
    emptyTwoDays: "No events today or tomorrow",
    detailTitle: "Upcoming events",
    emptyWeek: "No events this week"
  }
});
function upcoming(events, days) {
  const today = startOfDay(/* @__PURE__ */ new Date());
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => addDays(today, i)).map((day) => ({
    day,
    events: events.filter((e) => eventOnDay(e, day) && (e.allDay || new Date(e.end).getTime() > now))
  })).filter((group) => group.events.length > 0);
}
function useAgenda(ctx, days, intervalMs) {
  return usePolling(async () => {
    const from = startOfDay(/* @__PURE__ */ new Date());
    const [calendars, events] = await Promise.all([fetchCalendars(ctx), fetchEvents(ctx, from, addDays(from, days))]);
    return { calendars: calendars.calendars, events: events.events, errors: [...calendars.errors, ...events.errors] };
  }, intervalMs);
}
function AgendaView({ ctx, config, size, openDetail }) {
  const t = messages6.useT();
  const locale = useLocale();
  const { data, error } = useAgenda(ctx, 2, config.pollIntervalMs);
  const colors = useMemo(() => new Map(data?.calendars.map((c) => [c.id, c.color]) ?? []), [data]);
  const room = Math.max(3, size.h * 4 - 1);
  const groups = data ? upcoming(data.events, 2) : [];
  let left = room;
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "justify-start gap-2.5", onClick: openDetail, label: t("cardLabel"), children: [
    Boolean(error) && !data && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("loadFailed") }),
    data && data.calendars.length === 0 && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx(MonthGrid, { month: /* @__PURE__ */ new Date(), compact: true }),
      /* @__PURE__ */ jsx(WidgetHint, { children: t("noCalendarsShort") })
    ] }),
    data && data.calendars.length > 0 && groups.length === 0 && /* @__PURE__ */ jsx("span", { className: "text-muted", children: t("emptyTwoDays") }),
    groups.map(({ day, events }) => {
      if (left <= 0) return null;
      const shown = events.slice(0, left - 1);
      left -= shown.length + 1;
      return /* @__PURE__ */ jsxs("div", { className: "flex w-full min-w-0 flex-col gap-1", children: [
        /* @__PURE__ */ jsx("span", { className: "text-note font-medium text-muted", children: dayLabel(day, void 0, locale) }),
        shown.map((event) => /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 items-center gap-2.5 text-body", children: [
          /* @__PURE__ */ jsx(CalendarDot, { color: colors.get(event.calendarId) }),
          /* @__PURE__ */ jsx("span", { className: "min-w-18 shrink-0 text-muted tabular-nums", children: eventTimeText(event, day, locale) }),
          /* @__PURE__ */ jsx("span", { className: "ellipsis", children: event.title })
        ] }, `${event.id}:${event.start}`))
      ] }, day.getTime());
    })
  ] });
}
function AgendaDetail({ ctx, config }) {
  const t = messages6.useT();
  const locale = useLocale();
  const { data } = useAgenda(ctx, 7, config.pollIntervalMs);
  const colors = new Map(data?.calendars.map((c) => [c.id, c.color]) ?? []);
  const names = new Map(data?.calendars.map((c) => [c.id, c.name]) ?? []);
  const groups = data ? upcoming(data.events, 7) : [];
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("detailTitle"), children: [
    data?.errors.map((e) => /* @__PURE__ */ jsxs(Note, { children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    data && data.calendars.length === 0 && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx(MonthGrid, { month: /* @__PURE__ */ new Date() }),
      /* @__PURE__ */ jsx(Note, { children: t("noCalendars") })
    ] }),
    data && data.calendars.length > 0 && groups.length === 0 && /* @__PURE__ */ jsx(Note, { children: t("emptyWeek") }),
    groups.map(({ day, events }) => /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: dayLabel(day, void 0, locale) }),
      /* @__PURE__ */ jsx(List, { children: events.map((event) => /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx(CalendarDot, { color: colors.get(event.calendarId) }),
          title: event.title,
          detail: [eventTimeText(event, day, locale), event.location, names.get(event.calendarId)].filter(Boolean).join(" \xB7 ")
        },
        `${event.id}:${event.start}`
      )) })
    ] }, day.getTime()))
  ] });
}
var agendaWidget = defineWidget({
  id: "calendar-agenda",
  name: { ja: "\u4E88\u5B9A", en: "Events" },
  description: {
    ja: "\u4ECA\u65E5\u3068\u660E\u65E5\u306E\u4E88\u5B9A\u3092\u51FA\u3057\u307E\u3059\uFF08\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067\u8DB3\u3057\u305F\u30AB\u30EC\u30F3\u30C0\u30FC\uFF09",
    en: "Shows today's and tomorrow's events (from calendars added in Settings \u2192 Accounts \u2192 Internet Accounts)"
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 5 * 60 * 1e3 },
  Component: AgendaView,
  DetailComponent: AgendaDetail
});

// extensions/accounts/src/mail/client.ts
async function request3(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "accounts", `/mail${path}`), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? commonMessages.t("requestFailed", { status: res.status }));
  return body;
}
var fetchMailboxes = (ctx) => request3(ctx, "/mailboxes");
var fetchMessages = (ctx, options) => {
  const params = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.mailbox) params.set("mailbox", options.mailbox);
  if (options.folder && options.folder !== "inbox") params.set("folder", options.folder);
  if (options.unread) params.set("unread", "true");
  return request3(ctx, `/messages?${params}`);
};
var fetchFolders = (ctx, mailbox) => request3(
  ctx,
  `/folders${mailbox ? `?${new URLSearchParams({ mailbox })}` : ""}`
);
var fetchMessage = async (ctx, id) => (await request3(ctx, `/messages/${encodeURIComponent(id)}`)).message;
var setRead = (ctx, id, read) => request3(ctx, `/messages/${encodeURIComponent(id)}/read`, { method: "PUT", json: { read } });
var moveMessage = (ctx, id, folder, from) => request3(ctx, `/messages/${encodeURIComponent(id)}/move`, { method: "POST", json: { folder, from } });
var sendMail = (ctx, draft) => request3(ctx, "/send", { method: "POST", json: draft });
var messages7 = defineMessages({
  ja: { noSender: "\uFF08\u5DEE\u51FA\u4EBA\u306A\u3057\uFF09" },
  en: { noSender: "(No sender)" }
});
function mailDate(iso, locale = getLocale()) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = /* @__PURE__ */ new Date();
  if (date.toDateString() === now.toDateString()) return formatClock(date, locale);
  const sameYear = date.getFullYear() === now.getFullYear();
  return formatDate(date, sameYear ? "monthDay" : "full", locale);
}
var senderName = (message, locale) => message.from?.name || message.from?.address || messages7.t("noSender", void 0, locale);

// extensions/accounts/src/mail/types.ts
var MAIL_FOLDERS = ["inbox", "sent", "drafts", "junk", "trash"];

// extensions/accounts/src/mail/MailFolders.tsx
var STAGGER_IN_MS = 35;
var STAGGER_OUT_MS = 22;
var STAGGER_TOTAL_MS = 240;
function FolderIcon({ icon }) {
  return /* @__PURE__ */ jsx("span", { className: "grid size-8 shrink-0 place-items-center rounded-nav bg-accent-soft/18 text-title", children: /* @__PURE__ */ jsx(Icon, { name: icon }) });
}
function staggers(count) {
  if (reducedMotion()) return { inMs: 0, outMs: 0 };
  const steps = Math.max(count - 1, 1);
  return { inMs: Math.min(STAGGER_IN_MS, STAGGER_TOTAL_MS / steps), outMs: Math.min(STAGGER_OUT_MS, STAGGER_TOTAL_MS / steps) };
}
var messages8 = defineMessages({
  ja: {
    folders: "\u30D5\u30A9\u30EB\u30C0\u30FC",
    mailboxFolders: "\u30E1\u30FC\u30EB\u30DC\u30C3\u30AF\u30B9",
    folder_inbox: "\u53D7\u4FE1\u7BB1",
    folder_sent: "\u9001\u4FE1\u6E08\u307F",
    folder_drafts: "\u4E0B\u66F8\u304D",
    folder_junk: "\u8FF7\u60D1\u30E1\u30FC\u30EB",
    folder_trash: "\u30B4\u30DF\u7BB1",
    expand: "{name}\u3092\u958B\u304F",
    collapse: "{name}\u3092\u9589\u3058\u308B"
  },
  en: {
    folders: "Folders",
    mailboxFolders: "Mailboxes",
    folder_inbox: "Inbox",
    folder_sent: "Sent",
    folder_drafts: "Drafts",
    folder_junk: "Junk",
    folder_trash: "Trash",
    expand: "Expand {name}",
    collapse: "Collapse {name}"
  }
});
var folderMessages = messages8;
var FOLDER_ICONS = {
  inbox: "inbox",
  sent: "send",
  drafts: "drafts",
  junk: "junk",
  trash: "delete"
};
function buildTree(folders) {
  const root = { name: "", folder: null, children: [], id: "" };
  for (const folder of folders) {
    let node = root;
    folder.path.forEach((name, depth) => {
      let child = node.children.find((c) => c.name === name);
      if (!child) {
        child = { name, folder: null, children: [], id: `${folder.mailboxId}/${folder.path.slice(0, depth + 1).join("/")}` };
        node.children.push(child);
      }
      node = child;
    });
    node.folder = folder;
  }
  return root.children;
}
var STORAGE_KEY = "home-dashboard:mail-open-folders";
function readOpen() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function MailFolders({
  folders,
  groupName,
  current,
  unreadInbox,
  onChoose
}) {
  const t = messages8.useT();
  const [open, setOpen] = useState(readOpen);
  const [closing, setClosing] = useState(/* @__PURE__ */ new Set());
  const [opened, setOpened] = useState(/* @__PURE__ */ new Set());
  const timers = useRef(/* @__PURE__ */ new Map());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const rootRef = useRef(null);
  const beforeOpen = useRef(null);
  const lifted = useRef(/* @__PURE__ */ new Map());
  const settle = useRef(null);
  const followingRows = (id) => {
    const root = rootRef.current;
    const node = root?.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    if (!root || !node) return [];
    return Array.from(root.querySelectorAll("[data-tree-row]")).filter(
      (el) => !node.contains(el) && Boolean(node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  };
  useLayoutEffect(() => {
    const opening = beforeOpen.current;
    if (opening) {
      beforeOpen.current = null;
      for (const [el, top] of opening.rows) {
        const delta = top - el.getBoundingClientRect().top;
        if (!delta || opening.durationMs === 0) continue;
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;
        void el.getBoundingClientRect();
        el.style.transition = `transform ${opening.durationMs}ms var(--ease-out)`;
        el.style.transform = "";
        setTimeout(() => el.style.transition = "", opening.durationMs);
      }
    }
    const rows = settle.current;
    if (rows) {
      settle.current = null;
      for (const el of rows) {
        el.style.transition = "none";
        el.style.transform = "";
        void el.getBoundingClientRect();
        el.style.transition = "";
      }
    }
  });
  const persist = (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
    }
  };
  const toggle = (id, childCount) => {
    const timer = timers.current.get(id);
    if (closing.has(id)) {
      clearTimeout(timer);
      timers.current.delete(id);
      for (const el of lifted.current.get(id) ?? []) {
        el.style.transition = `transform ${motionMs("base")}ms var(--ease-out)`;
        el.style.transform = "";
      }
      lifted.current.delete(id);
      setClosing((c) => new Set([...c].filter((x) => x !== id)));
      return;
    }
    if (!open.has(id)) {
      beforeOpen.current = {
        rows: new Map(followingRows(id).map((el) => [el, el.getBoundingClientRect().top])),
        durationMs: motionMs("slow")
      };
      setOpened((o) => new Set(o).add(id));
      const { inMs } = staggers(childCount);
      clearTimeout(timer);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setOpened((o) => new Set([...o].filter((x) => x !== id)));
        }, motionMs("slow") + inMs * Math.max(childCount - 1, 0))
      );
      const next = new Set(open).add(id);
      setOpen(next);
      persist(next);
      return;
    }
    setClosing((c) => new Set(c).add(id));
    const { outMs } = staggers(childCount);
    const total = motionMs("base") + outMs * Math.max(childCount - 1, 0);
    const node = rootRef.current?.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    const children = node?.querySelector(":scope > [data-tree-children]");
    if (children) {
      const height = children.getBoundingClientRect().height + parseFloat(getComputedStyle(children).marginTop);
      const rows = followingRows(id);
      for (const el of rows) {
        el.style.transition = `transform ${motionMs("base")}ms var(--ease-in) ${outMs * Math.max(childCount - 1, 0)}ms`;
        el.style.transform = `translateY(${-height}px)`;
      }
      lifted.current.set(id, rows);
    }
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        settle.current = [...settle.current ?? [], ...lifted.current.get(id) ?? []];
        lifted.current.delete(id);
        setClosing((c) => new Set([...c].filter((x) => x !== id)));
        setOpened((o) => new Set([...o].filter((x) => x !== id)));
        setOpen((current2) => {
          const next = new Set(current2);
          next.delete(id);
          persist(next);
          return next;
        });
      }, total)
    );
  };
  const groups = /* @__PURE__ */ new Map();
  for (const f of folders) groups.set(f.mailboxId, [...groups.get(f.mailboxId) ?? [], f]);
  const renderNodes = (nodes) => /* @__PURE__ */ jsx(List, { children: nodes.map((node, index) => {
    const isOpen = open.has(node.id) && !closing.has(node.id);
    const shown = open.has(node.id);
    const count = node.children.length;
    const { inMs, outMs } = staggers(count);
    const folder = node.folder;
    const selected = folder !== null && current.key === folder.id && current.mailboxId === folder.mailboxId;
    return /* @__PURE__ */ jsxs("li", { "data-node-id": node.id, style: { "--i": index }, children: [
      /* @__PURE__ */ jsx("ul", { "data-tree-row": true, children: /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx(FolderIcon, { icon: "mail" }),
          title: node.name,
          selected,
          chevron: false,
          onClick: () => folder ? onChoose({ key: folder.id, mailboxId: folder.mailboxId }) : toggle(node.id, count),
          trailing: node.children.length > 0 ? (
            // 開け閉めの矢印は、開くと下を向く。行の高さを変えないよう小さくし、外の余白を詰める
            /* @__PURE__ */ jsx(
              IconButton,
              {
                icon: "chevron-right",
                label: t(isOpen ? "collapse" : "expand", { name: node.name }),
                "aria-expanded": isOpen,
                className: cx(
                  "-my-1.5 -mr-1.5 size-8 text-muted hover:bg-tint/8",
                  "[&_.fluent-icon]:transition-transform [&_.fluent-icon]:duration-(--motion-fast) [&_.fluent-icon]:ease-standard",
                  isOpen && "[&_.fluent-icon]:rotate-90"
                ),
                onClick: (event) => {
                  event.stopPropagation();
                  toggle(node.id, count);
                }
              }
            )
          ) : void 0
        }
      ) }),
      shown && count > 0 && /* @__PURE__ */ jsx(
        "div",
        {
          "data-tree-children": true,
          className: cx(
            "mt-1.5 pl-5 [&>ul]:mb-0",
            opened.has(node.id) && "mail-tree-entering",
            closing.has(node.id) && "mail-tree-closing"
          ),
          style: { "--n": count, "--stagger-in": `${inMs}ms`, "--stagger-out": `${outMs}ms` },
          children: renderNodes(node.children)
        }
      )
    ] }, node.id);
  }) });
  return /* @__PURE__ */ jsxs("div", { ref: rootRef, children: [
    /* @__PURE__ */ jsx(List, { label: t("folders"), children: MAIL_FOLDERS.map((f) => /* @__PURE__ */ jsx(
      ListItem,
      {
        leading: /* @__PURE__ */ jsx(FolderIcon, { icon: FOLDER_ICONS[f] }),
        title: t(`folder_${f}`),
        badge: f === "inbox" && unreadInbox > 0 ? String(unreadInbox) : void 0,
        selected: current.key === f,
        chevron: false,
        onClick: () => onChoose({ key: f, mailboxId: null })
      },
      f
    )) }),
    [...groups].map(([mailboxId, list]) => /* @__PURE__ */ jsxs("section", { className: "[&>ul]:mb-0", children: [
      /* @__PURE__ */ jsx("div", { "data-tree-row": true, children: /* @__PURE__ */ jsx(SectionTitle, { children: groupName ? groupName(mailboxId) : t("mailboxFolders") }) }),
      renderNodes(buildTree(list))
    ] }, mailboxId))
  ] });
}

// extensions/accounts/src/mail/MailScreen.tsx
var screenMessages = defineMessages({
  ja: {
    allInboxes: "\u3059\u3079\u3066\u306E\u53D7\u4FE1\u7BB1",
    chooseInbox: "\u53D7\u4FE1\u7BB1\u3092\u9078\u3076",
    chooseFolder: "\u30D5\u30A9\u30EB\u30C0\u30FC\u3092\u9078\u3076",
    unreadCount: "\u672A\u8AAD {n}",
    showAll: "\u3059\u3079\u3066\u51FA\u3059",
    unreadOnly: "\u672A\u8AAD\u3060\u3051",
    newMail: "\u65B0\u3057\u3044\u30E1\u30FC\u30EB",
    noInboxes: "\u53D7\u4FE1\u7BB1\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067 Google\u30FBiCloud \u306A\u3069\u3092\u8DB3\u3059\u3068\u3001\u3053\u3053\u306B\u30E1\u30FC\u30EB\u304C\u51FA\u307E\u3059\u3002",
    noUnreadMail: "\u672A\u8AAD\u306E\u30E1\u30FC\u30EB\u306F\u3042\u308A\u307E\u305B\u3093",
    noMail: "\u30E1\u30FC\u30EB\u306F\u3042\u308A\u307E\u305B\u3093",
    mail: "\u30E1\u30FC\u30EB",
    unread: "\u672A\u8AAD",
    address: "\uFF08{address}\uFF09",
    to: " \xB7 \u5B9B\u5148: {people}",
    cc: " \xB7 CC: {people}",
    toPeople: "\u5B9B\u5148: {people}",
    peopleSeparator: "\u3001",
    noBody: "\uFF08\u672C\u6587\u306A\u3057\uFF09",
    reply: "\u8FD4\u4FE1",
    markUnread: "\u672A\u8AAD\u306B\u3059\u308B",
    markRead: "\u65E2\u8AAD\u306B\u3059\u308B",
    move: "\u79FB\u52D5",
    moveTo: "\u79FB\u3059\u5148\u3092\u9078\u3076",
    junk: "\u8FF7\u60D1\u30E1\u30FC\u30EB",
    notJunk: "\u8FF7\u60D1\u30E1\u30FC\u30EB\u3067\u306F\u306A\u3044",
    delete: "\u524A\u9664",
    restore: "\u53D7\u4FE1\u7BB1\u306B\u623B\u3059",
    select: "\u9078\u3076",
    selectDone: "\u3084\u3081\u308B",
    selectAll: "\u3059\u3079\u3066\u9078\u3076",
    selected: "{n}\u901A\u3092\u9078\u629E",
    choose: "{subject}\u3092\u9078\u3076",
    sent: "\u9001\u308A\u307E\u3057\u305F: {subject}",
    moved: "{n}\u901A\u3092\u300C{folder}\u300D\u3078\u79FB\u3057\u307E\u3057\u305F",
    markedRead: "{n}\u901A\u3092\u65E2\u8AAD\u306B\u3057\u307E\u3057\u305F",
    markedUnread: "{n}\u901A\u3092\u672A\u8AAD\u306B\u3057\u307E\u3057\u305F",
    from: "\u5DEE\u51FA\u4EBA",
    toLabel: "\u5B9B\u5148",
    toHint: "\u3044\u304F\u3064\u304B\u306A\u3089\u3001\u30AB\u30F3\u30DE\u3067\u533A\u5207\u308B",
    subject: "\u4EF6\u540D",
    body: "\u672C\u6587",
    confirm: "\u5B9B\u5148: {to} \u2014 \u3088\u3051\u308C\u3070\u3082\u3046\u4E00\u5EA6\u300C\u9001\u308B\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    sending: "\u9001\u3063\u3066\u3044\u307E\u3059\u2026",
    sendConfirmed: "\u9001\u308B\uFF08\u78BA\u304B\u3081\u305F\uFF09",
    send: "\u9001\u308B"
  },
  en: {
    allInboxes: "All inboxes",
    chooseInbox: "Choose inbox",
    chooseFolder: "Choose folder",
    unreadCount: "{n} unread",
    showAll: "Show all",
    unreadOnly: "Unread only",
    newMail: "New email",
    noInboxes: "No inboxes. Add Google, iCloud, or other accounts in Settings \u2192 Accounts \u2192 Internet Accounts to see mail here.",
    noUnreadMail: "No unread mail",
    noMail: "No mail",
    mail: "Mail",
    unread: "Unread",
    address: " ({address})",
    to: " \xB7 To: {people}",
    cc: " \xB7 CC: {people}",
    toPeople: "To: {people}",
    peopleSeparator: ", ",
    noBody: "(No message body)",
    reply: "Reply",
    markUnread: "Mark as unread",
    markRead: "Mark as read",
    move: "Move",
    moveTo: "Choose where to move",
    junk: "Junk",
    notJunk: "Not junk",
    delete: "Delete",
    restore: "Move to Inbox",
    select: "Select",
    selectDone: "Done",
    selectAll: "Select all",
    selected: "{n} selected",
    choose: "Select {subject}",
    sent: "Sent: {subject}",
    moved: "Moved {n} to \u201C{folder}\u201D",
    markedRead: "Marked {n} as read",
    markedUnread: "Marked {n} as unread",
    from: "From",
    toLabel: "To",
    toHint: "Separate multiple addresses with commas",
    subject: "Subject",
    body: "Message",
    confirm: "To: {to} \u2014 if this looks right, press \u201CSend\u201D again.",
    sending: "Sending\u2026",
    sendConfirmed: "Send (confirmed)",
    send: "Send"
  }
});
var LIST_LIMIT = 40;
var REFRESH_MS = 2 * 60 * 1e3;
var PREFETCH_MAX_AGE_MS = 5 * 60 * 1e3;
var PREFETCH_BODIES = 6;
var listKey = (target, folder, unread) => `mail:list:${target ?? "*"}:${folder}:${unread}`;
var messageKey = (id) => `mail:message:${id}`;
var NO_CHANGES = { gone: /* @__PURE__ */ new Set(), read: /* @__PURE__ */ new Map() };
function MailScreen({ ctx }) {
  const t = screenMessages.useT();
  const tf = folderMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [mailbox, setMailbox] = useState(null);
  const [folder, setFolder] = useState({ key: "inbox", mailboxId: null });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pane, setPane] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState(/* @__PURE__ */ new Set());
  const [local, setLocal] = useState(NO_CHANGES);
  const target = folder.mailboxId ?? mailbox;
  const boxes = useCached("mail:mailboxes", () => fetchMailboxes(ctx), REFRESH_MS);
  const folderList = useCached(`mail:folders:${mailbox ?? "*"}`, () => fetchFolders(ctx, mailbox));
  const readList = (key, unread) => fetchMessages(ctx, { mailbox: target ?? void 0, unread, limit: LIST_LIMIT, folder: key });
  const list = useCached(listKey(target, folder.key, unreadOnly), () => readList(folder.key, unreadOnly), REFRESH_MS);
  const mailboxes = boxes.data?.mailboxes ?? [];
  const folders = folderList.data?.folders ?? [];
  useEffect(() => setLocal(NO_CHANGES), [list.data]);
  useEffect(() => {
    const shown = list.data?.messages;
    if (!shown) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const tasks = [
        ...shown.slice(0, PREFETCH_BODIES).map((m4) => [messageKey(m4.id), () => fetchMessage(ctx, m4.id)]),
        ...MAIL_FOLDERS.filter((f) => f !== folder.key).map((f) => [
          listKey(target, f, false),
          () => readList(f, false)
        ])
      ];
      for (const [key, load] of tasks) {
        if (cancelled) return;
        await fetchCached(key, load, PREFETCH_MAX_AGE_MS).catch(() => void 0);
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [list.data]);
  const messages10 = list.data?.messages.filter((m4) => !local.gone.has(m4.id)).map((m4) => local.read.has(m4.id) ? { ...m4, unread: !local.read.get(m4.id) } : m4);
  const errors = useMemo(() => {
    const seen = /* @__PURE__ */ new Set();
    return [...boxes.data?.errors ?? [], ...list.data?.errors ?? []].filter((e) => !seen.has(e.source) && seen.add(e.source));
  }, [boxes.data, list.data]);
  const failure = list.error ?? boxes.error;
  const current = mailboxes.find((m4) => m4.id === mailbox) ?? null;
  const unreadTotal = mailboxes.reduce((sum, m4) => sum + m4.unread, 0);
  const mailboxName = (id) => mailboxes.find((m4) => m4.id === id)?.name ?? "";
  const folderName = (key) => MAIL_FOLDERS.includes(key) ? tf(`folder_${key}`) : folders.find((f) => f.id === key)?.path.join(" / ") ?? key;
  const outgoing = folder.key === "sent" || folder.key === "drafts";
  const people = (list2) => (list2 ?? []).map((a) => a.name || a.address).join(t("peopleSeparator"));
  const resetView = () => {
    setPane(null);
    setChosen(/* @__PURE__ */ new Set());
    setSelecting(false);
  };
  const chooseMailbox = (id) => {
    setMailbox(id);
    if (folder.mailboxId !== null) setFolder({ key: "inbox", mailboxId: null });
    resetView();
  };
  const chooseFolder = (next) => {
    setFolder(next);
    resetView();
  };
  const afterChange = () => {
    forgetCached("mail:list:");
    forgetCached("mail:mailboxes");
    void list.reload();
    void boxes.reload();
  };
  const markRead = async (ids, read, quiet = false) => {
    setLocal((l) => ({ ...l, read: new Map([...l.read, ...ids.map((id) => [id, read])]) }));
    try {
      await Promise.all(ids.map((id) => setRead(ctx, id, read)));
      ids.forEach((id) => forgetCached(messageKey(id)));
    } catch (err) {
      showSnackbar({ text: err instanceof Error ? err.message : String(err), tone: "error" });
      afterChange();
      return;
    }
    if (!quiet) showSnackbar(t(read ? "markedRead" : "markedUnread", { n: ids.length }));
    afterChange();
  };
  const move = async (ids, to) => {
    setLocal((l) => ({ ...l, gone: /* @__PURE__ */ new Set([...l.gone, ...ids]) }));
    if (pane?.kind === "read" && ids.includes(pane.id)) setPane(null);
    setChosen(/* @__PURE__ */ new Set());
    try {
      await Promise.all(ids.map((id) => moveMessage(ctx, id, to, folder.key)));
      showSnackbar(t("moved", { n: ids.length, folder: folderName(to) }));
    } catch (err) {
      showSnackbar({ text: err instanceof Error ? err.message : String(err), tone: "error" });
    }
    afterChange();
  };
  const moveTargets = (mailboxIds) => {
    const standard = ["inbox", "junk", "trash"].filter((f) => f !== folder.key).map((f) => ({ id: f, label: tf(`folder_${f}`) }));
    const one = new Set(mailboxIds).size === 1 ? mailboxIds[0] : null;
    const own = one ? folders.filter((f) => f.mailboxId === one && f.id !== folder.key).map((f) => ({ id: f.id, label: f.path.join(" / ") })) : [];
    return [...standard, ...own];
  };
  const mailboxOf = (id) => messages10?.find((m4) => m4.id === id)?.mailboxId ?? "";
  const actions = /* @__PURE__ */ jsxs(ButtonRow, { children: [
    /* @__PURE__ */ jsx(
      PillMenu,
      {
        label: current ? current.name : t("allInboxes"),
        icon: "mail",
        ariaLabel: t("chooseInbox"),
        items: [
          { id: "", label: t("allInboxes"), detail: t("unreadCount", { n: unreadTotal }), selected: mailbox === null },
          ...mailboxes.map((m4) => ({ id: m4.id, label: m4.name, detail: t("unreadCount", { n: m4.unread }), selected: m4.id === mailbox }))
        ],
        onSelect: (id) => chooseMailbox(id || null)
      }
    ),
    /* @__PURE__ */ jsx(NarrowOnly, { children: /* @__PURE__ */ jsx(
      PillMenu,
      {
        label: folderName(folder.key),
        icon: MAIL_FOLDERS.includes(folder.key) ? FOLDER_ICONS[folder.key] : "mail",
        ariaLabel: t("chooseFolder"),
        items: [
          ...MAIL_FOLDERS.map((f) => ({ id: f, label: tf(`folder_${f}`), selected: f === folder.key })),
          ...folders.map((f) => ({
            id: `${f.mailboxId}
${f.id}`,
            label: f.path.join(" / "),
            detail: mailbox === null ? mailboxName(f.mailboxId) : void 0,
            selected: folder.key === f.id && folder.mailboxId === f.mailboxId
          }))
        ],
        onSelect: (id) => {
          const [mailboxId, key] = id.includes("\n") ? id.split("\n") : [null, id];
          chooseFolder({ key, mailboxId });
        }
      }
    ) }),
    /* @__PURE__ */ jsx(Button, { onClick: () => setUnreadOnly((v) => !v), "aria-pressed": unreadOnly, children: unreadOnly ? t("showAll") : t("unreadOnly") }),
    messages10 && messages10.length > 0 && /* @__PURE__ */ jsx(
      Button,
      {
        "aria-pressed": selecting,
        onClick: () => {
          setSelecting((v) => !v);
          setChosen(/* @__PURE__ */ new Set());
        },
        children: selecting ? t("selectDone") : t("select")
      }
    ),
    mailboxes.some((m4) => m4.canSend) && /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "compose", onClick: () => setPane({ kind: "compose", replyTo: null }), children: t("newMail") })
  ] });
  const chosenIds = [...chosen];
  const opened = pane?.kind === "read" ? messages10?.find((m4) => m4.id === pane.id) ?? null : null;
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: { ja: "\u30E1\u30FC\u30EB", en: "Mail" }, actions, children: [
    failure && !list.data && /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: failure }),
    errors.map((e) => /* @__PURE__ */ jsxs(ScreenNotice, { tone: "error", children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    boxes.data && mailboxes.length === 0 && errors.length === 0 && /* @__PURE__ */ jsx(ScreenNotice, { children: t("noInboxes") }),
    /* @__PURE__ */ jsx(
      SideLayout,
      {
        sideLabel: tf("folders"),
        narrow: "hide",
        side: /* @__PURE__ */ jsx(
          MailFolders,
          {
            folders,
            groupName: mailbox === null ? mailboxName : null,
            current: folder,
            unreadInbox: current ? current.unread : unreadTotal,
            onChoose: chooseFolder
          }
        ),
        children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-6", children: [
          /* @__PURE__ */ jsxs("div", { className: cx("min-w-0 flex-1", pane && "hidden triple:block triple:flex-2"), children: [
            selecting && // 「選ぶ」のときの操作の帯（一覧の上）
            /* @__PURE__ */ jsxs("div", { className: "mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2", children: [
              /* @__PURE__ */ jsx("span", { className: "text-label text-muted", children: t("selected", { n: chosen.size }) }),
              /* @__PURE__ */ jsxs(ButtonRow, { children: [
                /* @__PURE__ */ jsx(Button, { onClick: () => setChosen(new Set(messages10?.map((m4) => m4.id))), children: t("selectAll") }),
                /* @__PURE__ */ jsx(Button, { disabled: chosen.size === 0, onClick: () => void markRead(chosenIds, true), children: t("markRead") }),
                /* @__PURE__ */ jsx(Button, { disabled: chosen.size === 0, onClick: () => void markRead(chosenIds, false), children: t("markUnread") }),
                chosen.size > 0 && /* @__PURE__ */ jsx(
                  PillMenu,
                  {
                    label: t("move"),
                    icon: "inbox",
                    ariaLabel: t("moveTo"),
                    items: moveTargets(chosenIds.map(mailboxOf)),
                    onSelect: (id) => void move(chosenIds, id)
                  }
                ),
                /* @__PURE__ */ jsx(
                  Button,
                  {
                    icon: "delete",
                    disabled: chosen.size === 0,
                    onClick: () => void move(chosenIds, folder.key === "trash" ? "inbox" : "trash"),
                    children: folder.key === "trash" ? t("restore") : t("delete")
                  }
                )
              ] })
            ] }),
            !messages10 && !failure && /* @__PURE__ */ jsx(Note, { children: tc("loading") }),
            messages10 && messages10.length === 0 && mailboxes.length > 0 && /* @__PURE__ */ jsx(Note, { children: unreadOnly ? t("noUnreadMail") : t("noMail") }),
            messages10 && messages10.length > 0 && /* @__PURE__ */ jsx(List, { boxed: true, label: t("mail"), children: messages10.map((m4) => {
              const isChosen = chosen.has(m4.id);
              return /* @__PURE__ */ jsx(
                ListItem,
                {
                  leading: selecting ? (
                    // 「選ぶ」のときの丸いチェック
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: cx(
                          "grid size-5.5 shrink-0 place-items-center rounded-full border-2 text-body",
                          isChosen ? "fill-bright" : "border-muted"
                        ),
                        role: "checkbox",
                        "aria-checked": isChosen,
                        "aria-label": t("choose", { subject: m4.subject }),
                        children: isChosen && /* @__PURE__ */ jsx(Icon, { name: "checkmark" })
                      }
                    )
                  ) : (
                    // 未読の印。既読は同じ幅の空きにして、件名の頭をそろえる
                    /* @__PURE__ */ jsx("span", { className: cx("size-2 shrink-0 rounded-full", m4.unread && "bg-accent"), "aria-hidden": "true" })
                  ),
                  title: m4.subject,
                  badge: m4.unread ? t("unread") : void 0,
                  detail: `${outgoing && m4.to?.length ? t("toPeople", { people: people(m4.to) }) : senderName(m4, locale)} \xB7 ${mailDate(m4.date, locale)}${m4.snippet ? ` \xB7 ${m4.snippet}` : ""}`,
                  selected: selecting ? isChosen : pane?.kind === "read" && pane.id === m4.id,
                  chevron: !selecting,
                  onClick: () => {
                    if (selecting) {
                      const next = new Set(chosen);
                      if (next.has(m4.id)) next.delete(m4.id);
                      else next.add(m4.id);
                      setChosen(next);
                      return;
                    }
                    setPane({ kind: "read", id: m4.id });
                  }
                },
                m4.id
              );
            }) })
          ] }),
          pane && /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1 triple:flex-3", children: pane.kind === "read" ? /* @__PURE__ */ jsx(
            Reader,
            {
              ctx,
              id: pane.id,
              unread: opened?.unread ?? false,
              folder: folder.key,
              canReply: mailboxes.find((b) => b.id === opened?.mailboxId)?.canSend ?? false,
              moveTargets: moveTargets([opened?.mailboxId ?? ""]),
              onClose: () => setPane(null),
              onReply: (message) => setPane({ kind: "compose", replyTo: message }),
              onRead: (read, quiet) => void markRead([pane.id], read, quiet),
              onMove: (to) => void move([pane.id], to)
            },
            pane.id
          ) : /* @__PURE__ */ jsx(
            Composer,
            {
              ctx,
              mailboxes: mailboxes.filter((m4) => m4.canSend),
              preferred: pane.replyTo?.mailboxId ?? mailbox,
              replyTo: pane.replyTo,
              onClose: () => setPane(null),
              onSent: (text) => {
                setPane(null);
                showSnackbar(text);
                afterChange();
              }
            }
          ) })
        ] })
      }
    )
  ] });
}
function Reader({
  ctx,
  id,
  unread,
  folder,
  canReply,
  moveTargets,
  onClose,
  onReply,
  onRead,
  onMove
}) {
  const t = screenMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const { data: message, error } = useCached(messageKey(id), () => fetchMessage(ctx, id));
  const [markedRead, setMarkedRead] = useState(false);
  useEffect(() => {
    if (!message || markedRead) return;
    setMarkedRead(true);
    if (message.unread && unread) onRead(true, true);
  }, [message]);
  if (error && !message) return /* @__PURE__ */ jsx(Message, { tone: "error", children: error });
  if (!message) return /* @__PURE__ */ jsx(Note, { children: tc("loading") });
  const people = (list) => list.map((a) => a.name || a.address).join(t("peopleSeparator"));
  return /* @__PURE__ */ jsxs("article", { children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: message.subject }),
    /* @__PURE__ */ jsxs(Note, { children: [
      senderName(message, locale),
      message.from?.name && message.from.address ? t("address", { address: message.from.address }) : "",
      " \xB7",
      " ",
      mailDate(message.date, locale),
      message.to.length > 0 && t("to", { people: people(message.to) }),
      message.cc.length > 0 && t("cc", { people: people(message.cc) })
    ] }),
    /* @__PURE__ */ jsx(Group, { children: /* @__PURE__ */ jsx("div", { className: "reader-scroll leading-normal whitespace-pre-wrap untrim wrap-anywhere", children: message.text || t("noBody") }) }),
    /* @__PURE__ */ jsxs(ButtonRow, { children: [
      canReply && /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "reply", onClick: () => onReply(message), children: t("reply") }),
      /* @__PURE__ */ jsx(Button, { onClick: () => onRead(unread), children: unread ? t("markRead") : t("markUnread") }),
      moveTargets.length > 0 && /* @__PURE__ */ jsx(
        PillMenu,
        {
          label: t("move"),
          icon: "inbox",
          ariaLabel: t("moveTo"),
          items: moveTargets,
          onSelect: (to) => onMove(to)
        }
      ),
      folder !== "sent" && folder !== "drafts" && folder !== "trash" && /* @__PURE__ */ jsx(Button, { icon: "junk", onClick: () => onMove(folder === "junk" ? "inbox" : "junk"), children: folder === "junk" ? t("notJunk") : t("junk") }),
      /* @__PURE__ */ jsx(Button, { icon: "delete", onClick: () => onMove(folder === "trash" ? "inbox" : "trash"), children: folder === "trash" ? t("restore") : t("delete") }),
      /* @__PURE__ */ jsx(Button, { onClick: onClose, children: tc("close") })
    ] })
  ] });
}
function Composer({
  ctx,
  mailboxes,
  preferred,
  replyTo,
  onClose,
  onSent
}) {
  const t = screenMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [from, setFrom] = useState(() => mailboxes.some((m4) => m4.id === preferred) ? preferred : mailboxes[0]?.id ?? "");
  const [to, setTo] = useState(replyTo?.from?.address ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo ? /^re:/i.test(replyTo.subject) ? replyTo.subject : `Re: ${replyTo.subject}` : "");
  const quoted = replyTo ? `

${mailDate(replyTo.date, locale)} ${senderName(replyTo, locale)}:
${replyTo.text.split("\n").slice(0, 40).map((line) => `> ${line}`).join("\n")}` : "";
  const [text, setText] = useState(quoted);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const split = (value) => value.split(/[,、\s]+/).filter(Boolean);
  const submit = async (event) => {
    event.preventDefault();
    if (!confirming) return setConfirming(true);
    setBusy(true);
    setError(null);
    try {
      await sendMail(ctx, { mailboxId: from, to: split(to), cc: split(cc), subject, text, replyTo: replyTo?.id ?? null });
      onSent(t("sent", { subject: subject || tc("noSubject") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirming(false);
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs("form", { onSubmit: (e) => void submit(e), children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: replyTo ? t("reply") : t("newMail") }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "m-0 border-0 p-0", disabled: busy, children: [
        /* @__PURE__ */ jsx(Field, { label: t("from"), children: /* @__PURE__ */ jsx("select", { value: from, onChange: (e) => setFrom(e.target.value), disabled: Boolean(replyTo), children: mailboxes.map((m4) => /* @__PURE__ */ jsxs("option", { value: m4.id, children: [
          m4.name,
          m4.address && m4.address !== m4.name ? t("address", { address: m4.address }) : ""
        ] }, m4.id)) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("toLabel"), hint: t("toHint"), children: /* @__PURE__ */ jsx("input", { type: "email", multiple: true, value: to, autoFocus: !replyTo, onChange: (e) => setTo(e.target.value) }) }),
        /* @__PURE__ */ jsx(Field, { label: "CC", children: /* @__PURE__ */ jsx("input", { type: "email", multiple: true, value: cc, onChange: (e) => setCc(e.target.value) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("subject"), children: /* @__PURE__ */ jsx("input", { value: subject, maxLength: 500, onChange: (e) => setSubject(e.target.value) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("body"), children: /* @__PURE__ */ jsx("textarea", { rows: 10, value: text, autoFocus: Boolean(replyTo), onChange: (e) => setText(e.target.value) }) })
      ] }),
      confirming && /* @__PURE__ */ jsx(Message, { children: t("confirm", { to: split(to).join(t("peopleSeparator")) }) }),
      error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
      /* @__PURE__ */ jsxs(ButtonRow, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", icon: "send", disabled: busy || !from || !to.trim() || !text.trim(), children: busy ? t("sending") : confirming ? t("sendConfirmed") : t("send") }),
        /* @__PURE__ */ jsx(Button, { onClick: onClose, children: tc("cancel") })
      ] })
    ] })
  ] });
}

// extensions/accounts/src/mail/widget.tsx
var messages9 = defineMessages({
  ja: {
    loadFailed: "\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
    checking: "\u78BA\u304B\u3081\u3066\u3044\u307E\u3059\u2026",
    noAccounts: "\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067\u30E1\u30FC\u30EB\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u8DB3\u3059\u3068\u3001\u672A\u8AAD\u304C\u51FA\u307E\u3059",
    cardLabel: "\u672A\u8AAD {n}\u901A\uFF08\u4E00\u89A7\u3092\u958B\u304F\uFF09",
    unread: "\u672A\u8AAD",
    cantRead: "{sources}\u3092\u8AAD\u3081\u307E\u305B\u3093",
    sourceSeparator: "\u30FB",
    noUnreadShort: "\u672A\u8AAD\u306A\u3057",
    detailTitle: "\u672A\u8AAD\u306E\u30E1\u30FC\u30EB",
    mailboxUnread: "{name}: \u672A\u8AAD {n}\u901A",
    noUnread: "\u672A\u8AAD\u306F\u3042\u308A\u307E\u305B\u3093",
    openMailScreen: "\u8AAD\u3080\u30FB\u8FD4\u4FE1\u3059\u308B\u306E\u306F\u3001\u30B5\u30A4\u30C9\u30D0\u30FC\u306E\u300C\u30E1\u30FC\u30EB\u300D\u306E\u753B\u9762\u3067\u3002"
  },
  en: {
    loadFailed: "Couldn't load",
    checking: "Checking\u2026",
    noAccounts: "Add a mail account in Settings \u2192 Accounts \u2192 Internet Accounts to see unread mail",
    cardLabel: (p) => `${p.n} unread (open the list)`,
    unread: "Unread",
    cantRead: "Can't read {sources}",
    sourceSeparator: ", ",
    noUnreadShort: "No unread mail",
    detailTitle: "Unread mail",
    mailboxUnread: "{name}: {n} unread",
    noUnread: "No unread mail",
    openMailScreen: "To read or reply, use the Mail screen in the sidebar."
  }
});
function useUnread(ctx, limit, intervalMs) {
  return usePolling(async () => {
    const [boxes, list] = await Promise.all([fetchMailboxes(ctx), fetchMessages(ctx, { unread: true, limit })]);
    return {
      mailboxes: boxes.mailboxes,
      unread: boxes.mailboxes.reduce((sum, m4) => sum + m4.unread, 0),
      messages: list.messages,
      errors: [...boxes.errors, ...list.errors]
    };
  }, intervalMs);
}
function MailInboxView({ ctx, config, openDetail }) {
  const t = messages9.useT();
  const locale = useLocale();
  const { data, error } = useUnread(ctx, config.compactLimit, config.pollIntervalMs);
  if (!data) {
    return /* @__PURE__ */ jsx(WidgetCard, { children: error ? /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("loadFailed") }) : /* @__PURE__ */ jsx(WidgetHint, { children: t("checking") }) });
  }
  if (data.mailboxes.length === 0 && data.errors.length === 0) {
    return /* @__PURE__ */ jsx(WidgetCard, { children: /* @__PURE__ */ jsx(WidgetHint, { children: t("noAccounts") }) });
  }
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "items-stretch justify-start gap-1.5", onClick: openDetail, label: t("cardLabel", { n: data.unread }), children: [
    /* @__PURE__ */ jsxs("span", { className: "flex items-baseline gap-1.5", children: [
      /* @__PURE__ */ jsx(Icon, { name: "mail", className: "size-5.5 self-center text-muted" }),
      /* @__PURE__ */ jsx("span", { className: "text-stat leading-none font-semibold tabular-nums", children: data.unread }),
      /* @__PURE__ */ jsx("span", { className: "text-caption font-medium text-muted", children: t("unread") })
    ] }),
    data.errors.length > 0 && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("cantRead", { sources: data.errors.map((e) => e.source).join(t("sourceSeparator")) }) }),
    /* @__PURE__ */ jsxs("ul", { className: "flex flex-col gap-1", children: [
      data.messages.slice(0, config.compactLimit).map((m4) => /* @__PURE__ */ jsxs("li", { className: "flex gap-2 text-note", children: [
        /* @__PURE__ */ jsx("span", { className: "ellipsis w-24 shrink-0 text-muted", children: senderName(m4, locale) }),
        /* @__PURE__ */ jsx("span", { className: "ellipsis min-w-0 flex-1", children: m4.subject })
      ] }, m4.id)),
      data.messages.length === 0 && /* @__PURE__ */ jsx("li", { className: "text-note font-medium text-muted", children: t("noUnreadShort") })
    ] })
  ] });
}
function MailInboxDetail({ ctx, config }) {
  const t = messages9.useT();
  const locale = useLocale();
  const { data } = useUnread(ctx, 20, config.pollIntervalMs);
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("detailTitle"), children: [
    data?.mailboxes.map((m4) => /* @__PURE__ */ jsx(Note, { children: t("mailboxUnread", { name: m4.name, n: m4.unread }) }, m4.id)),
    data?.errors.map((e) => /* @__PURE__ */ jsxs(Note, { children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    data && data.messages.length === 0 && /* @__PURE__ */ jsx(Note, { children: t("noUnread") }),
    data && data.messages.length > 0 && /* @__PURE__ */ jsx(List, { label: t("detailTitle"), children: data.messages.map((m4) => /* @__PURE__ */ jsx(ListItem, { title: m4.subject, detail: `${senderName(m4, locale)} \xB7 ${mailDate(m4.date, locale)}` }, m4.id)) }),
    /* @__PURE__ */ jsx(Note, { children: t("openMailScreen") })
  ] });
}
var mailWidget = defineWidget({
  id: "mail-inbox",
  name: { ja: "\u30E1\u30FC\u30EB", en: "Mail" },
  description: {
    ja: "\u672A\u8AAD\u306E\u6570\u3068\u3001\u65B0\u3057\u3044\u672A\u8AAD\u306E\u5DEE\u51FA\u4EBA\u30FB\u4EF6\u540D\u3092\u51FA\u3057\u307E\u3059\uFF08\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067\u8DB3\u3057\u305F\u30E1\u30FC\u30EB\uFF09",
    en: "Shows the unread count and the sender and subject of new unread mail (from accounts added in Settings \u2192 Accounts \u2192 Internet Accounts)"
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 2 * 60 * 1e3, compactLimit: 3 },
  Component: MailInboxView,
  DetailComponent: MailInboxDetail
});

// extensions/accounts/src/web.tsx
var web_default = defineWebExtension({
  widgets: [agendaWidget, mailWidget],
  screens: [
    { id: "calendar", label: { ja: "\u30AB\u30EC\u30F3\u30C0\u30FC", en: "Calendar" }, icon: "calendar", order: 20, Component: CalendarScreen },
    { id: "mail", label: { ja: "\u30E1\u30FC\u30EB", en: "Mail" }, icon: "mail", order: 25, Component: MailScreen }
  ],
  settingsPages: [{ id: "internet", label: { ja: "\u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8", en: "Internet Accounts" }, icon: "globe", parent: "account", Component: AccountsPage }]
});
export {
  web_default as default
};
