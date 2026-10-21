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
    intro: "Google\u30FBiCloud \u306A\u3069\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u8DB3\u3059\u3068\u3001\u30AB\u30EC\u30F3\u30C0\u30FC\u3068\u30E1\u30FC\u30EB\u304C Calendar\u30FBMail \u306E\u753B\u9762\u3068\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u307E\u3059\u3002\u81EA\u5206\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306F\u81EA\u5206\u306B\u3060\u3051\u898B\u3048\u307E\u3059\u3002\u300C\u5BB6\u3067\u5171\u6709\u3059\u308B\u300D\u306B\u3057\u305F\u3082\u306E\u306F\u3001\u5BB6\u65CF\u3068\u97F3\u58F0\u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u306B\u3082\u898B\u3048\u307E\u3059\u3002",
    myAccounts: "\u81EA\u5206\u306E\u30A2\u30AB\u30A6\u30F3\u30C8",
    none: "\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
    sharedBadge: "\u5BB6\u3067\u5171\u6709",
    other: "\u305D\u306E\u307B\u304B",
    oauthUnavailable: "{providers}\u306F\u3001\u7BA1\u7406\u8005\u304C\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 \u30AB\u30EC\u30F3\u30C0\u30FC\u30FB\u30E1\u30FC\u30EB\u300D\u3067\u30ED\u30B0\u30A4\u30F3\u306E\u8A2D\u5B9A\u3092\u3059\u308B\u3068\u8DB3\u305B\u307E\u3059\u3002",
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
    useCalendarDetail: "Calendar \u753B\u9762\u30FB\u4E88\u5B9A\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u3059",
    useMail: "\u30E1\u30FC\u30EB\u3092\u4F7F\u3046",
    useMailDetail: "Mail \u753B\u9762\u30FB\u30E1\u30FC\u30EB\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u3059",
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
    oauthUnavailable: "{providers} can be added once an admin sets up sign-in in Extensions \u2192 Calendar & Mail.",
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
function AccountsPage({ ctx }) {
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
  }, [ctx]);
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
  const mine = accounts?.filter((a) => a.mine) ?? [];
  const others = accounts?.filter((a) => !a.mine) ?? [];
  const services = (a) => [a.services.calendar && t("calendar"), a.services.mail && t("mail")].filter(Boolean).join(t("serviceSeparator")) || t("notInUse");
  return /* @__PURE__ */ jsxs("div", { className: "accounts-page", children: [
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
      /* @__PURE__ */ jsx(Button, { icon: "add", disabled: !providers.google, onClick: () => void startOAuth(ctx, "google").catch((err) => setMessage({ ok: false, text: err.message })), children: "Google" }),
      /* @__PURE__ */ jsx(Button, { icon: "add", onClick: () => setView({ kind: "add", type: "icloud" }), children: "iCloud" }),
      /* @__PURE__ */ jsx(Button, { icon: "add", disabled: !providers.microsoft, onClick: () => void startOAuth(ctx, "microsoft").catch((err) => setMessage({ ok: false, text: err.message })), children: "Microsoft" }),
      /* @__PURE__ */ jsx(Button, { icon: "add", onClick: () => setView({ kind: "add", type: "other" }), children: t("other") })
    ] }),
    (!providers.google || !providers.microsoft) && /* @__PURE__ */ jsx(Note, { children: t("oauthUnavailable", {
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
  return /* @__PURE__ */ jsxs("form", { className: "accounts-page", onSubmit: (e) => void submit(e), children: [
    /* @__PURE__ */ jsx(BackButton, { label: t("internetAccounts"), onClick: onBack }),
    /* @__PURE__ */ jsx(SectionTitle, { children: kind === "icloud" ? t("addICloud") : t("addAccount") }),
    kind === "icloud" && /* @__PURE__ */ jsx(Note, { children: t("iCloudNote") }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "accounts-page__fields", disabled: busy, children: [
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
  return /* @__PURE__ */ jsxs("div", { className: "accounts-page", children: [
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
var fetchEvents = (ctx, from, to) => request2(
  ctx,
  `/events?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`
);
var createEvent = (ctx, input) => request2(ctx, "/events", { method: "POST", json: input });
var updateEvent = (ctx, id, input) => request2(ctx, `/events/${encodeURIComponent(id)}`, { method: "PUT", json: input });
var deleteEvent = (ctx, id) => request2(ctx, `/events/${encodeURIComponent(id)}`, { method: "DELETE" });
var pad = (n) => String(n).padStart(2, "0");
var WEEKDAYS = ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
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
  return `${date.getHours()}:${pad(date.getMinutes())}`;
}
function dayLabel(date, today = startOfDay(/* @__PURE__ */ new Date()), locale = getLocale()) {
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 864e5);
  const base = locale === "ja" ? `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})` : date.toLocaleDateString(intlLocale(locale), { weekday: "short", month: "short", day: "numeric" });
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
  return /* @__PURE__ */ jsxs("form", { className: "calendar-editor", onSubmit: submit, children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: event ? readOnly ? t("viewTitle") : t("editTitle") : t("addTitle") }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "calendar-editor__fields", disabled: busy || readOnly, children: [
        /* @__PURE__ */ jsx(Field, { label: t("name"), children: /* @__PURE__ */ jsx("input", { value: draft.title, maxLength: 200, autoFocus: !event, onChange: (e) => set({ title: e.target.value }) }) }),
        /* @__PURE__ */ jsx(Field, { label: t("calendar"), hint: event ? t("calendarHint") : void 0, children: /* @__PURE__ */ jsx("select", { value: draft.calendarId, onChange: (e) => set({ calendarId: e.target.value }), children: writable.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: t("calendarOption", { name: c.name, source: c.source }) }, c.id)) }) }),
        /* @__PURE__ */ jsx(Check, { checked: draft.allDay, onChange: (allDay) => set({ allDay }), children: t("allDay") }),
        /* @__PURE__ */ jsxs("div", { className: "calendar-editor__when", children: [
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

// extensions/accounts/src/calendar/CalendarScreen.tsx
var SPAN_DAYS = 14;
var messages4 = defineMessages({
  ja: {
    previous: "\u524D\u3078",
    today: "\u4ECA\u65E5",
    next: "\u6B21\u3078",
    addEvent: "\u4E88\u5B9A\u3092\u8DB3\u3059",
    noCalendars: "\u30AB\u30EC\u30F3\u30C0\u30FC\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067 Google\u30FBiCloud \u306A\u3069\u3092\u8DB3\u3059\u3068\u3001\u3053\u3053\u306B\u4E88\u5B9A\u304C\u51FA\u307E\u3059\u3002",
    noEvents: "\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093"
  },
  en: {
    previous: "Previous",
    today: "Today",
    next: "Next",
    addEvent: "Add event",
    noCalendars: "No calendars. Add Google, iCloud, or other accounts in Settings \u2192 Accounts \u2192 Internet Accounts to see events here.",
    noEvents: "No events"
  }
});
function CalendarScreen({ ctx }) {
  const t = messages4.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [anchor, setAnchor] = useState(() => startOfDay(/* @__PURE__ */ new Date()));
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState(null);
  const [errors, setErrors] = useState([]);
  const [failure, setFailure] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    try {
      const [cal, ev] = await Promise.all([fetchCalendars(ctx), fetchEvents(ctx, anchor, addDays(anchor, SPAN_DAYS))]);
      setCalendars(cal.calendars);
      setEvents(ev.events);
      const seen = /* @__PURE__ */ new Set();
      setErrors([...cal.errors, ...ev.errors].filter((e) => !seen.has(e.source) && seen.add(e.source)));
      setFailure(null);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  }, [ctx, anchor]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5 * 60 * 1e3);
    return () => clearInterval(timer);
  }, [load]);
  const colors = useMemo(() => new Map(calendars.map((c) => [c.id, c.color])), [calendars]);
  const names = useMemo(() => new Map(calendars.map((c) => [c.id, c.name])), [calendars]);
  const today = startOfDay(/* @__PURE__ */ new Date());
  const days = Array.from({ length: SPAN_DAYS }, (_, i) => addDays(anchor, i));
  const canWrite = calendars.some((c) => c.writable);
  const actions = /* @__PURE__ */ jsxs(ButtonRow, { children: [
    /* @__PURE__ */ jsx(Button, { icon: "chevron-left", onClick: () => setAnchor(addDays(anchor, -SPAN_DAYS)), children: t("previous") }),
    /* @__PURE__ */ jsx(Button, { onClick: () => setAnchor(today), children: t("today") }),
    /* @__PURE__ */ jsx(Button, { onClick: () => setAnchor(addDays(anchor, SPAN_DAYS)), children: t("next") }),
    canWrite && /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "add", onClick: () => setEditing({ event: null, day: anchor < today ? today : anchor }), children: t("addEvent") })
  ] });
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: "Calendar", actions, children: [
    failure && /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: failure }),
    errors.map((e) => /* @__PURE__ */ jsxs(ScreenNotice, { tone: "error", children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    editing && /* @__PURE__ */ jsx(
      EventEditor,
      {
        event: editing.event,
        calendars,
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
    events === null && !failure && /* @__PURE__ */ jsx(ScreenNotice, { children: tc("loading") }),
    events !== null && calendars.length === 0 && errors.length === 0 && /* @__PURE__ */ jsx(ScreenNotice, { children: t("noCalendars") }),
    events !== null && days.map((day) => {
      const onDay = events.filter((e) => eventOnDay(e, day));
      if (onDay.length === 0 && day.getTime() !== today.getTime()) return null;
      return /* @__PURE__ */ jsx(ScreenSection, { title: dayLabel(day, today, locale), className: "calendar-day", children: onDay.length === 0 ? /* @__PURE__ */ jsx(ScreenNotice, { children: t("noEvents") }) : /* @__PURE__ */ jsx(List, { label: dayLabel(day, today, locale), children: onDay.map((event) => /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx("span", { className: "calendar-dot", style: { background: colors.get(event.calendarId) ?? void 0 } }),
          title: event.title,
          detail: [eventTimeText(event, day, locale), event.location, names.get(event.calendarId)].filter(Boolean).join(" \xB7 "),
          onClick: () => setEditing({ event, day })
        },
        `${event.id}:${event.start}`
      )) }) }, day.getTime());
    })
  ] });
}

// extensions/accounts/src/calendar/widget.tsx
var messages5 = defineMessages({
  ja: {
    cardLabel: "\u4E88\u5B9A\uFF081\u9031\u9593\u5206\u3092\u958B\u304F\uFF09",
    loadFailed: "\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
    noCalendars: "\u8A2D\u5B9A\u306E\u300C\u30A2\u30AB\u30A6\u30F3\u30C8 \u2192 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8\u300D\u3067\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u8DB3\u3059\u3068\u3001\u4E88\u5B9A\u304C\u51FA\u307E\u3059",
    emptyTwoDays: "\u4ECA\u65E5\u3068\u660E\u65E5\u306E\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093",
    detailTitle: "\u3053\u308C\u304B\u3089\u306E\u4E88\u5B9A",
    emptyWeek: "1\u9031\u9593\u306E\u4E88\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093"
  },
  en: {
    cardLabel: "Events (open the week)",
    loadFailed: "Couldn't load",
    noCalendars: "Add a calendar in Settings \u2192 Accounts \u2192 Internet Accounts to see your events",
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
  const t = messages5.useT();
  const locale = useLocale();
  const { data, error } = useAgenda(ctx, 2, config.pollIntervalMs);
  const colors = useMemo(() => new Map(data?.calendars.map((c) => [c.id, c.color]) ?? []), [data]);
  const room = Math.max(3, size.h * 4 - 1);
  const groups = data ? upcoming(data.events, 2) : [];
  let left = room;
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "calendar-widget", onClick: openDetail, label: t("cardLabel"), children: [
    Boolean(error) && !data && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("loadFailed") }),
    data && data.calendars.length === 0 && /* @__PURE__ */ jsx(WidgetHint, { children: t("noCalendars") }),
    data && data.calendars.length > 0 && groups.length === 0 && /* @__PURE__ */ jsx("span", { className: "calendar-widget__empty", children: t("emptyTwoDays") }),
    groups.map(({ day, events }) => {
      if (left <= 0) return null;
      const shown = events.slice(0, left - 1);
      left -= shown.length + 1;
      return /* @__PURE__ */ jsxs("div", { className: "calendar-widget__day", children: [
        /* @__PURE__ */ jsx("span", { className: "calendar-widget__label", children: dayLabel(day, void 0, locale) }),
        shown.map((event) => /* @__PURE__ */ jsxs("span", { className: "calendar-widget__event", children: [
          /* @__PURE__ */ jsx("span", { className: "calendar-dot", style: { background: colors.get(event.calendarId) ?? void 0 } }),
          /* @__PURE__ */ jsx("span", { className: "calendar-widget__time", children: eventTimeText(event, day, locale) }),
          /* @__PURE__ */ jsx("span", { className: "calendar-widget__title", children: event.title })
        ] }, `${event.id}:${event.start}`))
      ] }, day.getTime());
    })
  ] });
}
function AgendaDetail({ ctx, config }) {
  const t = messages5.useT();
  const locale = useLocale();
  const { data } = useAgenda(ctx, 7, config.pollIntervalMs);
  const colors = new Map(data?.calendars.map((c) => [c.id, c.color]) ?? []);
  const names = new Map(data?.calendars.map((c) => [c.id, c.name]) ?? []);
  const groups = data ? upcoming(data.events, 7) : [];
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("detailTitle"), className: "calendar-detail", children: [
    data?.errors.map((e) => /* @__PURE__ */ jsxs(Note, { children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    data && groups.length === 0 && /* @__PURE__ */ jsx(Note, { children: t("emptyWeek") }),
    groups.map(({ day, events }) => /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h3", { className: "calendar-detail__day", children: dayLabel(day, void 0, locale) }),
      /* @__PURE__ */ jsx(List, { children: events.map((event) => /* @__PURE__ */ jsx(
        ListItem,
        {
          leading: /* @__PURE__ */ jsx("span", { className: "calendar-dot", style: { background: colors.get(event.calendarId) ?? void 0 } }),
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
  if (options.unread) params.set("unread", "true");
  return request3(ctx, `/messages?${params}`);
};
var fetchMessage = async (ctx, id) => (await request3(ctx, `/messages/${encodeURIComponent(id)}`)).message;
var setRead = (ctx, id, read) => request3(ctx, `/messages/${encodeURIComponent(id)}/read`, { method: "PUT", json: { read } });
var sendMail = (ctx, draft) => request3(ctx, "/send", { method: "POST", json: draft });
var messages6 = defineMessages({
  ja: { noSender: "\uFF08\u5DEE\u51FA\u4EBA\u306A\u3057\uFF09" },
  en: { noSender: "(No sender)" }
});
function mailDate(iso, locale = getLocale()) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = /* @__PURE__ */ new Date();
  if (date.toDateString() === now.toDateString()) return formatClock(date, locale);
  const sameYear = date.getFullYear() === now.getFullYear();
  if (locale !== "ja")
    return date.toLocaleDateString(intlLocale(locale), sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" });
  if (sameYear) return `${date.getMonth() + 1}/${date.getDate()}`;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
var senderName = (message, locale) => message.from?.name || message.from?.address || messages6.t("noSender", void 0, locale);

// extensions/accounts/src/mail/MailScreen.tsx
var screenMessages = defineMessages({
  ja: {
    allInboxes: "\u3059\u3079\u3066\u306E\u53D7\u4FE1\u7BB1",
    chooseInbox: "\u53D7\u4FE1\u7BB1\u3092\u9078\u3076",
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
    peopleSeparator: "\u3001",
    noBody: "\uFF08\u672C\u6587\u306A\u3057\uFF09",
    reply: "\u8FD4\u4FE1",
    markUnread: "\u672A\u8AAD\u306B\u623B\u3059",
    sent: "\u9001\u308A\u307E\u3057\u305F: {subject}",
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
    peopleSeparator: ", ",
    noBody: "(No message body)",
    reply: "Reply",
    markUnread: "Mark as unread",
    sent: "Sent: {subject}",
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
function MailScreen({ ctx }) {
  const t = screenMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [mailboxes, setMailboxes] = useState([]);
  const [mailbox, setMailbox] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [messages8, setMessages] = useState(null);
  const [errors, setErrors] = useState([]);
  const [failure, setFailure] = useState(null);
  const [pane, setPane] = useState(null);
  const [notice, setNotice] = useState(null);
  const load = useCallback(async () => {
    try {
      const [boxes, list] = await Promise.all([
        fetchMailboxes(ctx),
        fetchMessages(ctx, { mailbox: mailbox ?? void 0, unread: unreadOnly, limit: 40 })
      ]);
      setMailboxes(boxes.mailboxes);
      setMessages(list.messages);
      const seen = /* @__PURE__ */ new Set();
      setErrors([...boxes.errors, ...list.errors].filter((e) => !seen.has(e.source) && seen.add(e.source)));
      setFailure(null);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  }, [ctx, mailbox, unreadOnly]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2 * 60 * 1e3);
    return () => clearInterval(timer);
  }, [load]);
  const current = mailboxes.find((m4) => m4.id === mailbox) ?? null;
  const unreadTotal = mailboxes.reduce((sum, m4) => sum + m4.unread, 0);
  const actions = /* @__PURE__ */ jsxs(ButtonRow, { children: [
    /* @__PURE__ */ jsx(
      PillMenu,
      {
        label: current ? current.name : t("allInboxes"),
        icon: "inbox",
        ariaLabel: t("chooseInbox"),
        items: [
          { id: "", label: t("allInboxes"), detail: t("unreadCount", { n: unreadTotal }), selected: mailbox === null },
          ...mailboxes.map((m4) => ({ id: m4.id, label: m4.name, detail: t("unreadCount", { n: m4.unread }), selected: m4.id === mailbox }))
        ],
        onSelect: (id) => {
          setMailbox(id || null);
          setPane(null);
        }
      }
    ),
    /* @__PURE__ */ jsx(Button, { onClick: () => setUnreadOnly((v) => !v), "aria-pressed": unreadOnly, children: unreadOnly ? t("showAll") : t("unreadOnly") }),
    mailboxes.some((m4) => m4.canSend) && /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "compose", onClick: () => setPane({ kind: "compose", replyTo: null }), children: t("newMail") })
  ] });
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: "Mail", actions, children: [
    failure && /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: failure }),
    errors.map((e) => /* @__PURE__ */ jsxs(ScreenNotice, { tone: "error", children: [
      e.source,
      ": ",
      e.message
    ] }, e.source)),
    notice && /* @__PURE__ */ jsx(ScreenNotice, { children: notice }),
    messages8 !== null && mailboxes.length === 0 && errors.length === 0 && /* @__PURE__ */ jsx(ScreenNotice, { children: t("noInboxes") }),
    /* @__PURE__ */ jsxs("div", { className: `mail-layout${pane ? " mail-layout--open" : ""}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "mail-layout__list", children: [
        messages8 === null && !failure && /* @__PURE__ */ jsx(Note, { children: tc("loading") }),
        messages8 && messages8.length === 0 && mailboxes.length > 0 && /* @__PURE__ */ jsx(Note, { children: unreadOnly ? t("noUnreadMail") : t("noMail") }),
        messages8 && messages8.length > 0 && /* @__PURE__ */ jsx(List, { label: t("mail"), children: messages8.map((m4) => /* @__PURE__ */ jsx(
          ListItem,
          {
            title: m4.subject,
            badge: m4.unread ? t("unread") : void 0,
            detail: `${senderName(m4, locale)} \xB7 ${mailDate(m4.date, locale)}${m4.snippet ? ` \xB7 ${m4.snippet}` : ""}`,
            off: !m4.unread && unreadOnly,
            onClick: () => {
              setNotice(null);
              setPane({ kind: "read", id: m4.id });
            }
          },
          m4.id
        )) })
      ] }),
      pane && /* @__PURE__ */ jsx("div", { className: "mail-layout__pane", children: pane.kind === "read" ? /* @__PURE__ */ jsx(
        Reader,
        {
          ctx,
          id: pane.id,
          canReply: mailboxes.find((b) => b.id === messages8?.find((m4) => m4.id === pane.id)?.mailboxId)?.canSend ?? false,
          onClose: () => setPane(null),
          onReply: (message) => setPane({ kind: "compose", replyTo: message }),
          onChanged: () => void load()
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
            setNotice(text);
            void load();
          }
        }
      ) })
    ] })
  ] });
}
function Reader({
  ctx,
  id,
  canReply,
  onClose,
  onReply,
  onChanged
}) {
  const t = screenMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchMessage(ctx, id).then(async (m4) => {
      if (cancelled) return;
      setMessage(m4);
      if (m4.unread) {
        await setRead(ctx, id, true).catch(() => void 0);
        onChanged();
      }
    }).catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [ctx, id]);
  if (error) return /* @__PURE__ */ jsx(Message, { tone: "error", children: error });
  if (!message) return /* @__PURE__ */ jsx(Note, { children: tc("loading") });
  const people = (list) => list.map((a) => a.name || a.address).join(t("peopleSeparator"));
  return /* @__PURE__ */ jsxs("article", { className: "mail-reader", children: [
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
    /* @__PURE__ */ jsx(Group, { children: /* @__PURE__ */ jsx("div", { className: "mail-reader__body", children: message.text || t("noBody") }) }),
    /* @__PURE__ */ jsxs(ButtonRow, { children: [
      canReply && /* @__PURE__ */ jsx(Button, { variant: "primary", icon: "reply", onClick: () => onReply(message), children: t("reply") }),
      /* @__PURE__ */ jsx(
        Button,
        {
          onClick: () => void setRead(ctx, id, false).then(() => {
            onChanged();
            onClose();
          }).catch((err) => setError(err instanceof Error ? err.message : String(err))),
          children: t("markUnread")
        }
      ),
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
  return /* @__PURE__ */ jsxs("form", { className: "mail-composer", onSubmit: (e) => void submit(e), children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: replyTo ? t("reply") : t("newMail") }),
    /* @__PURE__ */ jsxs(Group, { children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "mail-composer__fields", disabled: busy, children: [
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
var messages7 = defineMessages({
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
    openMailScreen: "\u8AAD\u3080\u30FB\u8FD4\u4FE1\u3059\u308B\u306E\u306F\u3001\u30B5\u30A4\u30C9\u30D0\u30FC\u306E Mail \u753B\u9762\u3067\u3002"
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
  const t = messages7.useT();
  const locale = useLocale();
  const { data, error } = useUnread(ctx, config.compactLimit, config.pollIntervalMs);
  if (!data) {
    return /* @__PURE__ */ jsx(WidgetCard, { className: "widget-mail", children: error ? /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("loadFailed") }) : /* @__PURE__ */ jsx(WidgetHint, { children: t("checking") }) });
  }
  if (data.mailboxes.length === 0 && data.errors.length === 0) {
    return /* @__PURE__ */ jsx(WidgetCard, { className: "widget-mail", children: /* @__PURE__ */ jsx(WidgetHint, { children: t("noAccounts") }) });
  }
  return /* @__PURE__ */ jsxs(WidgetCard, { className: "widget-mail", onClick: openDetail, label: t("cardLabel", { n: data.unread }), children: [
    /* @__PURE__ */ jsxs("span", { className: "widget-mail__header", children: [
      /* @__PURE__ */ jsx(Icon, { name: "mail", className: "widget-mail__icon" }),
      /* @__PURE__ */ jsx("span", { className: "widget-mail__count", children: data.unread }),
      /* @__PURE__ */ jsx("span", { className: "widget-mail__label", children: t("unread") })
    ] }),
    data.errors.length > 0 && /* @__PURE__ */ jsx(WidgetHint, { tone: "error", children: t("cantRead", { sources: data.errors.map((e) => e.source).join(t("sourceSeparator")) }) }),
    /* @__PURE__ */ jsxs("ul", { className: "widget-mail__list", children: [
      data.messages.slice(0, config.compactLimit).map((m4) => /* @__PURE__ */ jsxs("li", { className: "widget-mail__item", children: [
        /* @__PURE__ */ jsx("span", { className: "widget-mail__from", children: senderName(m4, locale) }),
        /* @__PURE__ */ jsx("span", { className: "widget-mail__subject", children: m4.subject })
      ] }, m4.id)),
      data.messages.length === 0 && /* @__PURE__ */ jsx("li", { className: "widget-mail__empty", children: t("noUnreadShort") })
    ] })
  ] });
}
function MailInboxDetail({ ctx, config }) {
  const t = messages7.useT();
  const locale = useLocale();
  const { data } = useUnread(ctx, 20, config.pollIntervalMs);
  return /* @__PURE__ */ jsxs(DetailFrame, { title: t("detailTitle"), className: "widget-mail-detail", children: [
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
    { id: "calendar", label: "Calendar", ariaLabel: { ja: "\u30AB\u30EC\u30F3\u30C0\u30FC", en: "Calendar" }, icon: "calendar", order: 20, Component: CalendarScreen },
    { id: "mail", label: "Mail", ariaLabel: { ja: "\u30E1\u30FC\u30EB", en: "Mail" }, icon: "mail", order: 25, Component: MailScreen }
  ],
  settingsPages: [{ id: "internet", label: { ja: "\u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8", en: "Internet Accounts" }, icon: "globe", parent: "account", Component: AccountsPage }]
});
export {
  web_default as default
};
