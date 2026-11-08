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

// extensions/claude-code/src/i18n.ts
var strings = defineMessages({
  ja: {
    requestFailed: "\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    screenTitle: "Claude Code",
    adminOnly: "Claude Code \u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u3001\u7BA1\u7406\u8005\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3060\u3051\u304C\u898B\u3089\u308C\u307E\u3059\u3002",
    noMachines: "\u6A5F\u68B0\u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
    noMachinesHint: "\u8A2D\u5B9A \u2192 \u62E1\u5F35\u6A5F\u80FD \u2192 Claude Code \u3067\u3001\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u898B\u308B\u6A5F\u68B0\u3092\u8DB3\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
    openSettings: "\u8A2D\u5B9A\u3092\u958B\u304F",
    loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
    sessions: "\u30BB\u30C3\u30B7\u30E7\u30F3",
    noSessions: "\u6700\u8FD1\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u3042\u308A\u307E\u305B\u3093",
    unreachable: "\u3064\u306A\u304C\u308A\u307E\u305B\u3093",
    viewOnly: "Herdr \u304C\u7121\u3044\u306E\u3067\u898B\u308B\u3060\u3051",
    herdrStopped: "Herdr \u304C\u52D5\u3044\u3066\u3044\u307E\u305B\u3093",
    newSession: "\u65B0\u3057\u3044\u30BB\u30C3\u30B7\u30E7\u30F3",
    pickSession: "\u5DE6\u306E\u4E00\u89A7\u304B\u3089\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044",
    status_idle: "\u5F85\u6A5F\u4E2D",
    status_working: "\u4F5C\u696D\u4E2D",
    status_blocked: "\u78BA\u8A8D\u5F85\u3061",
    status_done: "\u5B8C\u4E86",
    status_unknown: "\u72B6\u614B\u4E0D\u660E",
    status_stopped: "\u6B62\u307E\u3063\u3066\u3044\u308B",
    inHerdr: "Herdr \u306E {workspace}",
    olderMessages: "\u524D\u306E\u3084\u308A\u53D6\u308A\u3092\u8AAD\u3080",
    readingOlder: "\u8AAD\u3093\u3067\u3044\u307E\u3059\u2026",
    emptyLog: "\u307E\u3060\u3084\u308A\u53D6\u308A\u304C\u3042\u308A\u307E\u305B\u3093",
    prompt: "Claude \u306B\u6307\u793A\u3059\u308B",
    promptPlaceholder: "\u6307\u793A\u3092\u5165\u308C\u308B",
    promptViewOnly: "\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u306F Herdr \u3067\u52D5\u3044\u3066\u3044\u306A\u3044\u306E\u3067\u3001\u898B\u308B\u3060\u3051\u3067\u3059",
    promptBlocked: "\u78BA\u8A8D\u306E\u753B\u9762\u306B\u7B54\u3048\u3066\u304B\u3089\u9001\u308C\u307E\u3059",
    interrupt: "\u6B62\u3081\u308B\uFF08Esc\uFF09",
    sent: "\u9001\u308A\u307E\u3057\u305F",
    terminal: "\u7AEF\u672B\u306E\u753B\u9762",
    hideTerminal: "\u7AEF\u672B\u306E\u753B\u9762\u3092\u9589\u3058\u308B",
    focusInHerdr: "Herdr \u3067\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u958B\u304F",
    focused: "Herdr \u3067\u3053\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u958B\u304D\u307E\u3057\u305F",
    resume: "Herdr \u3067\u7D9A\u304D\u3092\u3059\u308B",
    resumed: "Herdr \u3067\u7D9A\u304D\u3092\u59CB\u3081\u307E\u3057\u305F",
    blockedTitle: "\u78BA\u8A8D\u3092\u5F85\u3063\u3066\u3044\u307E\u3059",
    blockedNote: "\u7AEF\u672B\u306B\u51FA\u3066\u3044\u308B\u78BA\u8A8D\u306E\u753B\u9762\u3067\u3059\u3002\u9078\u3076\u756A\u53F7\u3084\u30AD\u30FC\u3092\u62BC\u3057\u3066\u7B54\u3048\u307E\u3059\u3002",
    keysLabel: "\u30AD\u30FC\u3092\u9001\u308B",
    key_enter: "\u6C7A\u5B9A\uFF08Enter\uFF09",
    key_esc: "\u3084\u3081\u308B\uFF08Esc\uFF09",
    key_up: "\u4E0A\u3078",
    key_down: "\u4E0B\u3078",
    key_tab: "Tab",
    key_shiftTab: "\u30E2\u30FC\u30C9\u5207\u66FF\uFF08Shift+Tab\uFF09",
    choose: "{n} \u3092\u9078\u3076",
    you: "\u3042\u306A\u305F",
    thinking: "\u8003\u3048\u305F\u3053\u3068",
    running: "\u52D5\u304B\u3057\u3066\u3044\u307E\u3059",
    toolFailed: "\u5931\u6557",
    images: "\u753B\u50CF {n} \u679A",
    compacted: "\u3053\u3053\u307E\u3067\u306E\u4F1A\u8A71\u3092\u8981\u7D04\u3057\u307E\u3057\u305F",
    systemError: "\u30A8\u30E9\u30FC",
    showMore: "\u7D9A\u304D\u3092\u898B\u308B",
    showLess: "\u305F\u305F\u3080",
    input: "\u5165\u529B",
    output: "\u7D50\u679C",
    noOutput: "\uFF08\u51FA\u529B\u306A\u3057\uFF09",
    todoCount: "{n} \u4EF6",
    newTitle: "\u65B0\u3057\u3044\u30BB\u30C3\u30B7\u30E7\u30F3",
    newCwd: "\u30D5\u30A9\u30EB\u30C0",
    newCwdHint: "\u305D\u306E\u6A5F\u68B0\u306E\u30D5\u30A9\u30EB\u30C0\uFF08~/ \u304B\u3089\u66F8\u3051\u308B\uFF09",
    newWorkspace: "Herdr \u306E\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9",
    newWorkspaceCreate: "\u65B0\u3057\u3044\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\u3092\u4F5C\u308B",
    newStart: "\u59CB\u3081\u308B",
    starting: "\u59CB\u3081\u3066\u3044\u307E\u3059\u2026",
    started: "\u59CB\u3081\u307E\u3057\u305F",
    cancel: "\u3084\u3081\u308B",
    machine: "\u6A5F\u68B0",
    folder: "\u30D5\u30A9\u30EB\u30C0",
    branch: "\u30D6\u30E9\u30F3\u30C1",
    updated: "{time} \u306B\u66F4\u65B0",
    // 設定画面
    machinesTitle: "\u6A5F\u68B0",
    machinesNote: "\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u898B\u308B\u6A5F\u68B0\u3067\u3059\u3002\u3053\u306E\u6A5F\u68B0\uFF08Docker \u3067\u52D5\u304B\u3057\u3066\u3044\u308B\u3068\u304D\uFF09\u3082\u3001SSH \u3067\u8DB3\u3057\u307E\u3059\u3002",
    addMachine: "\u6A5F\u68B0\u3092\u8DB3\u3059",
    editMachine: "\u6A5F\u68B0\u3092\u5909\u3048\u308B",
    name: "\u540D\u524D",
    type: "\u7A2E\u985E",
    typeSsh: "SSH \u3067\u3064\u306A\u3050\u6A5F\u68B0",
    typeSelf: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u30B5\u30FC\u30D0\u30FC\u3068\u540C\u3058\u6A5F\u68B0\uFF08Docker \u306B\u5165\u308C\u305A\u306B\u52D5\u304B\u3057\u3066\u3044\u308B\u3068\u304D\uFF09",
    host: "\u5B9B\u5148",
    port: "\u53E3",
    username: "\u30E6\u30FC\u30B6\u30FC",
    fingerprint: "\u30DB\u30B9\u30C8\u9375\u306E\u6307\u7D0B",
    fingerprintHint: "\u7A7A\u306E\u307E\u307E\u300C\u63A5\u7D9A\u3092\u78BA\u304B\u3081\u308B\u300D\u3092\u62BC\u3059\u3068\u3001\u76F8\u624B\u306E\u6307\u7D0B\u304C\u51FA\u307E\u3059\uFF08ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub \u3068\u6BD4\u3079\u3066\u304B\u3089\u4F7F\u3046\uFF09",
    useFingerprint: "\u3053\u306E\u6307\u7D0B\u3092\u4F7F\u3046",
    save: "\u4FDD\u5B58",
    remove: "\u6D88\u3059",
    removeConfirm: "{name} \u3092\u6D88\u3057\u307E\u3059\u304B\uFF1F",
    test: "\u63A5\u7D9A\u3092\u78BA\u304B\u3081\u308B",
    testing: "\u78BA\u304B\u3081\u3066\u3044\u307E\u3059\u2026",
    saved: "\u4FDD\u5B58\u3057\u307E\u3057\u305F",
    setupTitle: "\u6A5F\u68B0\u306E\u5074\u306E\u6E96\u5099",
    setupStep1: "\u4EF2\u4ECB\u306E\u30B9\u30AF\u30EA\u30D7\u30C8\u3092\u4FDD\u5B58\u3057\u3066\u3001\u76F8\u624B\u306E\u6A5F\u68B0\u306E ~/.local/bin/{file} \u306B\u7F6E\u304D\u307E\u3059\uFF08python3 \u3067\u52D5\u304D\u307E\u3059\uFF09\u3002",
    setupStep2: "\u6B21\u306E1\u884C\u3092\u3001\u76F8\u624B\u306E\u6A5F\u68B0\u306E ~/.ssh/authorized_keys \u306B\u8DB3\u3057\u307E\u3059\u3002\u9375\u306F\u30B9\u30AF\u30EA\u30D7\u30C8\u3057\u304B\u52D5\u304B\u305B\u306A\u3044\u3088\u3046\u306B\u7E1B\u3063\u3066\u3042\u308A\u307E\u3059\u3002",
    setupStep3: "\u64CD\u4F5C\u3059\u308B\u306B\u306F\u3001\u76F8\u624B\u306E\u6A5F\u68B0\u3067 Herdr \u3092\u52D5\u304B\u3057\u3001Claude Code \u3092 Herdr \u306E\u4E2D\u3067\u52D5\u304B\u3057\u307E\u3059\uFF08\u7121\u3051\u308C\u3070\u898B\u308B\u3060\u3051\u306B\u306A\u308A\u307E\u3059\uFF09\u3002",
    saveScript: "\u30B9\u30AF\u30EA\u30D7\u30C8\u3092\u4FDD\u5B58",
    installCommand: "\u76F8\u624B\u306E\u6A5F\u68B0\u3067\u3001\u4FDD\u5B58\u3057\u305F\u30B9\u30AF\u30EA\u30D7\u30C8\u3092\u7F6E\u304F\u30B3\u30DE\u30F3\u30C9",
    machineSsh: "SSH \xB7 {user}@{host}",
    machineSelf: "\u3053\u306E\u30B5\u30FC\u30D0\u30FC\u306E\u6A5F\u68B0",
    copy: "\u5199\u3059",
    copied: "\u5199\u3057\u307E\u3057\u305F",
    fingerprintSet: "\u6307\u7D0B\u3092\u5165\u308C\u307E\u3057\u305F\u3002\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044"
  },
  en: {
    requestFailed: "Could not load ({status})",
    screenTitle: "Claude Code",
    adminOnly: "Only admin accounts can see Claude Code sessions.",
    noMachines: "No machines are registered.",
    noMachinesHint: "Add the machines to watch in Settings \u2192 Extensions \u2192 Claude Code.",
    openSettings: "Open settings",
    loading: "Loading\u2026",
    sessions: "Sessions",
    noSessions: "No recent sessions",
    unreachable: "Cannot connect",
    viewOnly: "View-only (no Herdr)",
    herdrStopped: "Herdr is not running",
    newSession: "New session",
    pickSession: "Choose a session from the list on the left",
    status_idle: "Idle",
    status_working: "Working",
    status_blocked: "Needs input",
    status_done: "Done",
    status_unknown: "Unknown",
    status_stopped: "Stopped",
    inHerdr: "Herdr {workspace}",
    olderMessages: "Load earlier messages",
    readingOlder: "Loading\u2026",
    emptyLog: "No messages yet",
    prompt: "Prompt Claude",
    promptPlaceholder: "Enter a prompt",
    promptViewOnly: "This session is not running in Herdr, so it is view-only",
    promptBlocked: "Answer the confirmation before sending",
    interrupt: "Interrupt (Esc)",
    sent: "Sent",
    terminal: "Terminal screen",
    hideTerminal: "Close terminal screen",
    focusInHerdr: "Open this session in Herdr",
    focused: "Opened this session in Herdr",
    resume: "Continue in Herdr",
    resumed: "Continued in Herdr",
    blockedTitle: "Waiting for confirmation",
    blockedNote: "This is the confirmation showing in the terminal. Answer with a number or a key.",
    keysLabel: "Send keys",
    key_enter: "Confirm (Enter)",
    key_esc: "Cancel (Esc)",
    key_up: "Up",
    key_down: "Down",
    key_tab: "Tab",
    key_shiftTab: "Switch mode (Shift+Tab)",
    choose: "Choose {n}",
    you: "You",
    thinking: "Thinking",
    running: "Running",
    toolFailed: "Failed",
    images: (p) => p.n === 1 ? "1 image" : `${p.n} images`,
    compacted: "The conversation so far was summarized",
    systemError: "Error",
    showMore: "Show more",
    showLess: "Show less",
    input: "Input",
    output: "Output",
    noOutput: "(no output)",
    todoCount: (p) => p.n === 1 ? "1 item" : `${p.n} items`,
    newTitle: "New session",
    newCwd: "Folder",
    newCwdHint: "A folder on that machine (you can start with ~/)",
    newWorkspace: "Herdr workspace",
    newWorkspaceCreate: "Create a new workspace",
    newStart: "Start",
    starting: "Starting\u2026",
    started: "Started",
    cancel: "Cancel",
    machine: "Machine",
    folder: "Folder",
    branch: "Branch",
    updated: "Updated {time}",
    machinesTitle: "Machines",
    machinesNote: "Machines whose sessions you can see. Add this machine over SSH too when the dashboard runs in Docker.",
    addMachine: "Add a machine",
    editMachine: "Edit machine",
    name: "Name",
    type: "Type",
    typeSsh: "Machine reached over SSH",
    typeSelf: "The machine running the dashboard server (when not running in Docker)",
    host: "Address",
    port: "Port",
    username: "User",
    fingerprint: "Host key fingerprint",
    fingerprintHint: `Leave it empty and press "Test connection" to see the machine's fingerprint (compare it with ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub before using it)`,
    useFingerprint: "Use this fingerprint",
    save: "Save",
    remove: "Remove",
    removeConfirm: "Remove {name}?",
    test: "Test connection",
    testing: "Testing\u2026",
    saved: "Saved",
    setupTitle: "Preparing the machine",
    setupStep1: "Save the bridge script and put it at ~/.local/bin/{file} on the machine (it runs with python3).",
    setupStep2: "Add this line to ~/.ssh/authorized_keys on the machine. The key is restricted so it can only run the script.",
    setupStep3: "To control sessions, run Herdr on the machine and run Claude Code inside Herdr (otherwise sessions are view-only).",
    saveScript: "Save script",
    installCommand: "Command to put the saved script in place on the machine",
    machineSsh: "SSH \xB7 {user}@{host}",
    machineSelf: "The server's machine",
    copy: "Copy",
    copied: "Copied",
    fingerprintSet: "Fingerprint filled in. Save to keep it"
  }
});

// extensions/claude-code/src/api.ts
var RequestError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
async function request(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "claude-code", path), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(body.error ?? strings.t("requestFailed", { status: res.status }), res.status);
  return body;
}
var query = (params) => Object.entries(params).filter(([, v]) => v !== void 0).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
var fetchOverview = (ctx) => request(ctx, "/overview");
var fetchLog = (ctx, machineId, sessionId, position = {}) => request(
  ctx,
  `/machines/${encodeURIComponent(machineId)}/log?${query({ session: sessionId, ...position })}`
);
var fetchScreen = (ctx, machineId, pane, lines = 60) => request(ctx, `/machines/${encodeURIComponent(machineId)}/screen?${query({ pane, lines })}`);
var runAction = (ctx, machineId, action) => request(ctx, `/machines/${encodeURIComponent(machineId)}/action`, {
  method: "POST",
  json: action
});
var fetchMachines = async (ctx) => (await request(ctx, "/machines")).machines;
var fetchSshKey = (ctx) => request(ctx, "/ssh-key");
var saveMachine = (ctx, machine) => machine.id ? request(ctx, `/machines/${encodeURIComponent(machine.id)}`, { method: "PUT", json: machine }) : request(ctx, "/machines", {
  method: "POST",
  json: machine
});
var deleteMachine = (ctx, id) => request(ctx, `/machines/${encodeURIComponent(id)}`, {
  method: "DELETE"
});
var testMachine = (ctx, machine) => request(ctx, "/machines-test", {
  method: "POST",
  json: machine
});
var bridgeUrl = (ctx) => extensionApiUrl(ctx, "claude-code", "/bridge");

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/claude-code/src/Markdown.tsx
var LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}
function parseBlocks(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+-]*)/);
    if (fence) {
      const close = fence[1];
      const body2 = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(close)) body2.push(lines[i++]);
      i++;
      blocks.push({ t: "code", lang: fence[2], text: body2.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ t: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body2 = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body2.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", text: body2.join("\n") });
      continue;
    }
    const item = line.match(LIST_RE);
    if (item) {
      const ordered = /\d/.test(item[2]);
      const indent = item[1].length;
      const items = [];
      while (i < lines.length) {
        const current = lines[i].match(LIST_RE);
        if (current && current[1].length <= indent && /\d/.test(current[2]) === ordered) {
          items.push(current[3]);
          i++;
        } else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length > 0) {
          items[items.length - 1] += `
${lines[i].replace(/^\s{0,4}/, "")}`;
          i++;
        } else break;
      }
      blocks.push({
        t: "list",
        ordered,
        start: ordered ? Number.parseInt(item[2], 10) || 1 : 1,
        items
      });
      continue;
    }
    const body = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s/.test(lines[i]) && !/^\s*(```|~~~)/.test(lines[i]) && !LIST_RE.test(lines[i]) && !/^\s*>/.test(lines[i]))
      body.push(lines[i++]);
    if (body.length === 0) body.push(lines[i++]);
    blocks.push({ t: "p", text: body.join("\n") });
  }
  return blocks;
}
var INLINE_RE = /(`+)([^`]+?)\1|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)<>]+)/g;
function safeHref(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
var linkClass = "text-accent-soft underline decoration-accent-soft/40 underline-offset-2 wrap-anywhere";
function Inline({ text }) {
  const out = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const [whole, , code, bold1, bold2, em, label, href, bare] = match;
    if (code !== void 0) {
      out.push(
        /* @__PURE__ */ jsx("code", { className: "rounded-nav bg-white/8 px-1.5 py-0.5 font-mono wrap-anywhere", children: code }, key++)
      );
    } else if (bold1 !== void 0 || bold2 !== void 0) {
      out.push(
        /* @__PURE__ */ jsx("strong", { className: "font-semibold", children: /* @__PURE__ */ jsx(Inline, { text: bold1 ?? bold2 ?? "" }) }, key++)
      );
    } else if (em !== void 0) {
      out.push(
        /* @__PURE__ */ jsx("em", { children: /* @__PURE__ */ jsx(Inline, { text: em }) }, key++)
      );
    } else if (label !== void 0 && href !== void 0) {
      const safe = safeHref(href);
      out.push(
        safe ? /* @__PURE__ */ jsx("a", { className: linkClass, href: safe, target: "_blank", rel: "noreferrer", children: label }, key++) : /* @__PURE__ */ jsx(Fragment, { children: label }, key++)
      );
    } else if (bare !== void 0) {
      const safe = safeHref(bare);
      out.push(
        safe ? /* @__PURE__ */ jsx("a", { className: linkClass, href: safe, target: "_blank", rel: "noreferrer", children: bare }, key++) : bare
      );
    } else out.push(whole);
    last = index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return /* @__PURE__ */ jsx(Fragment2, { children: out });
}
function Lines({ text }) {
  const lines = text.split("\n");
  return /* @__PURE__ */ jsx(Fragment2, { children: lines.map((line, index) => /* @__PURE__ */ jsxs(Fragment, { children: [
    index > 0 && /* @__PURE__ */ jsx("br", {}),
    /* @__PURE__ */ jsx(Inline, { text: line })
  ] }, index)) });
}
var HEADING_CLASS = {
  1: "text-title font-bold",
  2: "text-title font-semibold",
  3: "text-body font-semibold",
  4: "text-body font-semibold",
  5: "text-label font-semibold",
  6: "text-label font-semibold text-muted"
};
function CodePre({ children, className }) {
  return /* @__PURE__ */ jsx(
    "pre",
    {
      className: cx("untrim max-h-96 min-w-0 overflow-auto rounded-inner border border-glass-border bg-input px-3.5 py-2.5 font-mono text-caption leading-normal whitespace-pre text-text text-shadow-none", className),
      children
    }
  );
}
function Markdown({ text }) {
  const blocks = parseBlocks(text);
  return /* @__PURE__ */ jsx("div", { className: "untrim flex min-w-0 flex-col gap-3 text-body leading-normal wrap-anywhere", children: blocks.map((block, index) => {
    switch (block.t) {
      case "code":
        return /* @__PURE__ */ jsx(CodePre, { children: block.text }, index);
      case "heading":
        return /* @__PURE__ */ jsx("p", { className: HEADING_CLASS[block.level], role: "heading", "aria-level": block.level, children: /* @__PURE__ */ jsx(Inline, { text: block.text }) }, index);
      case "hr":
        return /* @__PURE__ */ jsx("hr", { className: "border-line" }, index);
      case "quote":
        return /* @__PURE__ */ jsx("blockquote", { className: "border-l-2 border-line pl-3 text-muted", children: /* @__PURE__ */ jsx(Lines, { text: block.text }) }, index);
      case "table":
        return /* @__PURE__ */ jsx("div", { className: "min-w-0 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "border-collapse text-label wrap-normal", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: block.head.map((cell, c) => /* @__PURE__ */ jsx("th", { className: "min-w-24 border-b border-line px-2.5 py-1.5 text-left font-semibold", children: /* @__PURE__ */ jsx(Inline, { text: cell }) }, c)) }) }),
          /* @__PURE__ */ jsx("tbody", { children: block.rows.map((row, r) => /* @__PURE__ */ jsx("tr", { children: row.map((cell, c) => /* @__PURE__ */ jsx("td", { className: "min-w-24 border-b border-line/60 px-2.5 py-1.5 align-top", children: /* @__PURE__ */ jsx(Inline, { text: cell }) }, c)) }, r)) })
        ] }) }, index);
      case "list": {
        const Tag = block.ordered ? "ol" : "ul";
        return /* @__PURE__ */ jsx(
          Tag,
          {
            start: block.ordered ? block.start : void 0,
            className: (block.ordered ? "list-decimal" : "list-disc") + " flex flex-col gap-1 pl-6 marker:text-muted",
            children: block.items.map((item, n) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Lines, { text: item }) }, n))
          },
          index
        );
      }
      case "p":
        return /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx(Lines, { text: block.text }) }, index);
    }
  }) });
}

// extensions/claude-code/src/Transcript.tsx
var str = (value) => typeof value === "string" ? value : "";
function shortPath(path, cwd) {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  return path;
}
function toolSummary(item, cwd) {
  const input = item.input ?? {};
  switch (item.name) {
    case "Bash":
      return str(input.command).split("\n")[0];
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return shortPath(str(input.file_path) || str(input.notebook_path), cwd);
    case "Grep":
    case "Glob":
      return [str(input.pattern), str(input.path) && shortPath(str(input.path), cwd)].filter(Boolean).join(" \xB7 ");
    case "WebFetch":
      return str(input.url);
    case "WebSearch":
      return str(input.query);
    case "Task":
    case "Agent":
      return str(input.description) || str(input.subagent_type);
    case "TodoWrite":
      return Array.isArray(input.todos) ? strings.t("todoCount", { n: input.todos.length }) : "";
    case "Skill":
      return str(input.skill);
    default: {
      const first = Object.values(input).find((v) => typeof v === "string" && v.trim());
      return typeof first === "string" ? first.split("\n")[0] : "";
    }
  }
}
function toolName(name) {
  const mcp = name.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/);
  return mcp ? `${mcp[1]} \xB7 ${mcp[2]}` : name;
}
function promptText(text) {
  const name = text.match(/<command-name>([^<]*)<\/command-name>/)?.[1];
  const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
  const output = text.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/)?.[1];
  if (name)
    return {
      text: `${name.startsWith("/") ? name : `/${name}`}${args ? ` ${args}` : ""}`,
      output: null
    };
  if (output !== void 0) return { text: "", output: output.trim() };
  return {
    text: text.replace(/<command-message>[\s\S]*?<\/command-message>\s*/g, "").trim(),
    output: null
  };
}
function Time({ ts }) {
  const locale = useLocale();
  if (!ts) return null;
  const date = new Date(ts);
  return /* @__PURE__ */ jsx(ChatMeta, { title: date.toLocaleString(), children: formatClock(date, locale) });
}
function Diff({ before, after }) {
  const lines = [
    ...before.split("\n").map((line) => ({ sign: "-", line })),
    ...after.split("\n").map((line) => ({ sign: "+", line }))
  ];
  return /* @__PURE__ */ jsx(CodePre, { children: lines.map(({ sign, line }, index) => /* @__PURE__ */ jsxs("span", { className: cx("block", sign === "-" ? "bg-danger/14" : "bg-ok/14"), children: [
    sign,
    " ",
    line
  ] }, index)) });
}
function ToolInput({ item }) {
  const t = strings.useT();
  const input = item.input ?? {};
  if (item.name === "Edit") return /* @__PURE__ */ jsx(Diff, { before: str(input.old_string), after: str(input.new_string) });
  if (item.name === "MultiEdit" && Array.isArray(input.edits)) {
    return /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2", children: input.edits.map((edit, index) => /* @__PURE__ */ jsx(Diff, { before: str(edit.old_string), after: str(edit.new_string) }, index)) });
  }
  if (item.name === "Write") return /* @__PURE__ */ jsx(CodePre, { children: str(input.content) });
  if (item.name === "Bash") return /* @__PURE__ */ jsx(CodePre, { children: str(input.command) });
  if (item.name === "TodoWrite" && Array.isArray(input.todos)) {
    return /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-1 text-label", children: input.todos.map((todo, index) => /* @__PURE__ */ jsxs(
      "li",
      {
        className: cx("flex items-start gap-2", todo.status === "completed" && "text-muted line-through"),
        children: [
          /* @__PURE__ */ jsx(
            Icon,
            {
              name: todo.status === "completed" ? "checkmark" : todo.status === "in_progress" ? "arrow-sync" : "chevron-right",
              className: "mt-0.5 size-rem-4 shrink-0"
            }
          ),
          /* @__PURE__ */ jsx("span", { children: str(todo.content) || str(todo.activeForm) })
        ]
      },
      index
    )) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx("span", { className: "text-caption font-medium text-muted", children: t("input") }),
    /* @__PURE__ */ jsx(CodePre, { children: JSON.stringify(input, null, 2) })
  ] });
}
function ToolRow({
  item,
  result,
  running,
  cwd
}) {
  const t = strings.useT();
  const [open, setOpen] = useState(false);
  const summary = toolSummary(item, cwd);
  const failed = result?.error === true;
  return /* @__PURE__ */ jsxs("li", { className: "flex min-w-0 flex-col gap-1.5", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "press-wide flex min-w-0 cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1 text-left text-label hover:bg-white/6",
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
        children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: cx(
                "size-2 shrink-0 rounded-full",
                failed ? "bg-danger" : result ? "bg-ok" : running ? "bg-warn" : "bg-muted opacity-60"
              ),
              "aria-label": failed ? t("toolFailed") : result ? void 0 : running ? t("running") : void 0
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "shrink-0 font-semibold", children: toolName(item.name) }),
          summary && /* @__PURE__ */ jsx("span", { className: "ellipsis min-w-0 flex-1 font-mono text-note text-muted", children: summary }),
          /* @__PURE__ */ jsx(Icon, { name: open ? "chevron-up" : "chevron-down", className: "ml-auto size-rem-4 shrink-0 opacity-50" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxs("div", { className: "ml-4.5 flex min-w-0 flex-col gap-2 border-l border-line pl-3", children: [
      /* @__PURE__ */ jsx(ToolInput, { item }),
      result && /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col gap-1", children: [
        /* @__PURE__ */ jsxs("span", { className: cx("text-caption font-medium", failed ? "text-danger" : "text-muted"), children: [
          failed ? t("toolFailed") : t("output"),
          result.images > 0 && ` \xB7 ${t("images", { n: result.images })}`
        ] }),
        /* @__PURE__ */ jsx(CodePre, { children: result.text || t("noOutput") })
      ] })
    ] })
  ] });
}
function Thinking({ text }) {
  const t = strings.useT();
  const [open, setOpen] = useState(false);
  return /* @__PURE__ */ jsxs("li", { className: "flex min-w-0 flex-col gap-1.5", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "press-wide flex cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1 text-left text-label text-muted italic hover:bg-white/6",
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
        children: [
          /* @__PURE__ */ jsx(Icon, { name: "sparkle", className: "size-rem-4 shrink-0" }),
          t("thinking"),
          /* @__PURE__ */ jsx(Icon, { name: open ? "chevron-up" : "chevron-down", className: "ml-auto size-rem-4 shrink-0 opacity-50" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx("p", { className: "ml-4.5 border-l border-line pl-3 text-label leading-normal whitespace-pre-wrap text-muted untrim", children: text })
  ] });
}
function Steps({ children }) {
  return /* @__PURE__ */ jsx("li", { className: "w-full min-w-0", children: /* @__PURE__ */ jsx("ol", { className: "flex min-w-0 list-none flex-col gap-0.5", children }) });
}
function Transcript({ items, cwd, working }) {
  const t = strings.useT();
  const results = /* @__PURE__ */ new Map();
  for (const item of items) if (item.k === "result") results.set(item.id, item);
  const lastToolIndex = items.reduce((last, item, index) => item.k === "tool" ? index : last, -1);
  const out = [];
  let steps = [];
  const flush = () => {
    if (steps.length > 0) out.push(/* @__PURE__ */ jsx(Steps, { children: steps }, `steps-${out.length}`));
    steps = [];
  };
  items.forEach((item, index) => {
    switch (item.k) {
      case "user": {
        flush();
        const prompt = promptText(item.text);
        if (prompt.output !== null) {
          out.push(
            /* @__PURE__ */ jsx("li", { className: "w-full min-w-0", children: /* @__PURE__ */ jsx(CodePre, { children: prompt.output || t("noOutput") }) }, item.id)
          );
          break;
        }
        out.push(
          /* @__PURE__ */ jsxs(ChatRow, { mine: true, gap: true, children: [
            /* @__PURE__ */ jsxs(ChatBubble, { mine: true, children: [
              prompt.text,
              item.images > 0 && /* @__PURE__ */ jsx("span", { className: "mt-1 block text-note text-muted", children: t("images", { n: item.images }) })
            ] }),
            /* @__PURE__ */ jsx(Time, { ts: item.ts })
          ] }, item.id)
        );
        break;
      }
      case "assistant":
        flush();
        out.push(
          /* @__PURE__ */ jsx("li", { className: "my-2 w-full min-w-0 px-2", children: /* @__PURE__ */ jsx(Markdown, { text: item.text }) }, item.id)
        );
        break;
      case "thinking":
        steps.push(/* @__PURE__ */ jsx(Thinking, { text: item.text }, item.id));
        break;
      case "tool":
        steps.push(
          /* @__PURE__ */ jsx(
            ToolRow,
            {
              item,
              result: results.get(item.id),
              running: working && index === lastToolIndex,
              cwd
            },
            item.id
          )
        );
        break;
      case "result":
        break;
      case "system":
        flush();
        out.push(
          /* @__PURE__ */ jsxs("li", { className: "my-2 flex items-center gap-3 text-caption text-muted", role: "separator", children: [
            /* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-line" }),
            item.subtype === "compact_boundary" ? t("compacted") : item.text || t("systemError"),
            /* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-line" })
          ] }, item.id)
        );
        break;
    }
  });
  flush();
  return /* @__PURE__ */ jsx(Fragment2, { children: out });
}

// extensions/claude-code/src/CodeScreen.tsx
var STATUS_RANK = {
  blocked: 0,
  working: 1,
  done: 2,
  idle: 3,
  unknown: 4
};
var STATUS_TONE = {
  blocked: "warn",
  working: "on",
  done: void 0,
  idle: "dim",
  unknown: "dim"
};
var basename = (path) => path ? path.replace(/\/+$/, "").split("/").pop() ?? path : "";
function entriesOf(machine) {
  const herdr = machine.herdr?.running === true;
  const workspaces = new Map((machine.herdr?.workspaces ?? []).map((w) => [w.id, w]));
  const agents = machine.herdr?.agents.filter((a) => a.kind === "claude") ?? [];
  const bySession = new Map(agents.filter((a) => a.sessionId).map((a) => [a.sessionId, a]));
  const sessions = new Map(machine.sessions.map((s) => [s.id, s]));
  const entries = [];
  const make = (session, agent) => ({
    key: `${machine.id}/${session?.id ?? agent?.pane}`,
    machineId: machine.id,
    machineName: machine.name,
    sessionId: session?.id ?? agent?.sessionId ?? null,
    title: session?.title || // 端末の題（Claude Code が会話の名前を付ける）。始めたばかりの「claude …」「Claude Code」は名前にしない
    (agent?.title && !/^(claude\b|Claude Code$)/.test(agent.title) ? agent.title : "") || session?.lastPrompt || basename(session?.cwd ?? agent?.cwd ?? null) || "Claude Code",
    cwd: session?.cwd ?? agent?.cwd ?? null,
    branch: session?.branch ?? null,
    mtime: session?.mtime ?? null,
    agent,
    workspace: agent ? workspaces.get(agent.workspace) ?? null : null,
    herdr
  });
  for (const agent of agents)
    entries.push(make(agent.sessionId ? sessions.get(agent.sessionId) ?? null : null, agent));
  for (const session of machine.sessions) if (!bySession.has(session.id)) entries.push(make(session, null));
  return entries.sort((a, b) => {
    if (a.agent && b.agent)
      return STATUS_RANK[a.agent.status] - STATUS_RANK[b.agent.status] || (b.mtime ?? 0) - (a.mtime ?? 0);
    if (a.agent || b.agent) return a.agent ? -1 : 1;
    return (b.mtime ?? 0) - (a.mtime ?? 0);
  });
}
var pickOf = (entry) => ({
  machineId: entry.machineId,
  sessionId: entry.sessionId,
  pane: entry.agent?.pane ?? null
});
function matches(pick, entry) {
  if (pick.machineId !== entry.machineId) return false;
  if (pick.sessionId && entry.sessionId) return pick.sessionId === entry.sessionId;
  return Boolean(pick.pane && entry.agent?.pane === pick.pane);
}
function useWhen() {
  const locale = useLocale();
  return (mtime) => {
    if (!mtime) return "";
    const date = new Date(mtime * 1e3);
    return formatPastDay(date, locale) ?? formatClock(date, locale);
  };
}
function StatusBadge({ status }) {
  const t = strings.useT();
  return /* @__PURE__ */ jsx(Badge, { tone: status === "stopped" ? "dim" : STATUS_TONE[status], children: t(`status_${status}`) });
}
function mergeItems(...lists) {
  const map = /* @__PURE__ */ new Map();
  for (const list of lists) for (const item of list) map.set(`${item.k}:${item.id}`, item);
  return [...map.values()];
}
function useSessionLog(ctx, entry, fast) {
  const sessionKey = entry && entry.sessionId ? `${entry.machineId}/${entry.sessionId}` : "";
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const loadTail = useCallback(async () => {
    if (!entry?.sessionId) return;
    try {
      const chunk = await fetchLog(ctx, entry.machineId, entry.sessionId, {
        limit: 160
      });
      setState(
        (prev) => prev?.sessionKey === sessionKey ? prev : {
          sessionKey,
          items: chunk.items,
          start: chunk.start,
          end: chunk.end,
          more: chunk.more
        }
      );
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [ctx, entry?.machineId, entry?.sessionId, sessionKey]);
  useEffect(() => {
    setState(null);
    setError(null);
    void loadTail();
  }, [sessionKey]);
  const pull = useCallback(async () => {
    const current = stateRef.current;
    if (!entry?.sessionId) return;
    if (!current || current.sessionKey !== sessionKey) return loadTail();
    const chunk = await fetchLog(ctx, entry.machineId, entry.sessionId, {
      from: current.end
    });
    setState(
      (prev) => prev && prev.sessionKey === sessionKey && prev.end === current.end ? {
        ...prev,
        items: chunk.items.length ? mergeItems(prev.items, chunk.items) : prev.items,
        end: chunk.end
      } : prev
    );
  }, [ctx, entry?.machineId, entry?.sessionId, sessionKey, loadTail]);
  usePolling(pull, fast ? 1500 : 5e3, Boolean(entry?.sessionId));
  const loadOlder = useCallback(async () => {
    const current = stateRef.current;
    if (!entry?.sessionId || !current || !current.more) return;
    setLoadingOlder(true);
    try {
      const chunk = await fetchLog(ctx, entry.machineId, entry.sessionId, {
        before: current.start,
        limit: 160
      });
      setState(
        (prev) => prev && prev.sessionKey === sessionKey ? {
          ...prev,
          items: mergeItems(chunk.items, prev.items),
          start: chunk.start,
          more: chunk.more
        } : prev
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  }, [ctx, entry?.machineId, entry?.sessionId, sessionKey]);
  return {
    state: state?.sessionKey === sessionKey ? state : null,
    error,
    loadOlder,
    loadingOlder,
    pull
  };
}
var CHOICES = ["1", "2", "3"];
function TerminalPanel({
  ctx,
  entry,
  blocked,
  onKeys,
  busy
}) {
  const t = strings.useT();
  const pane = entry.agent?.pane ?? "";
  const screen = usePolledResource(() => fetchScreen(ctx, entry.machineId, pane, 40), 1500, Boolean(pane));
  const text = (screen.data?.text ?? "").replace(/\s+$/, "");
  const preRef = useRef(null);
  useEffect(() => {
    const pre = preRef.current?.querySelector("pre");
    if (pre) pre.scrollTop = pre.scrollHeight;
  }, [text]);
  return /* @__PURE__ */ jsxs(Group, { children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: blocked ? t("blockedTitle") : t("terminal") }),
    blocked && /* @__PURE__ */ jsx(Note, { children: t("blockedNote") }),
    /* @__PURE__ */ jsx("div", { ref: preRef, className: "min-w-0", children: text ? /* @__PURE__ */ jsx(CodePre, { className: "max-h-80 whitespace-pre-wrap", children: text }) : /* @__PURE__ */ jsx(Note, { children: t("loading") }) }),
    /* @__PURE__ */ jsxs(ButtonRow, { children: [
      blocked && CHOICES.map((n) => /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => onKeys([n]), "aria-label": t("choose", { n }), children: n }, n)),
      /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => onKeys(["up"]), "aria-label": t("key_up"), icon: "chevron-up" }),
      /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => onKeys(["down"]), "aria-label": t("key_down"), icon: "chevron-down" }),
      /* @__PURE__ */ jsx(Button, { disabled: busy, variant: "primary", onClick: () => onKeys(["enter"]), children: t("key_enter") }),
      /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => onKeys(["esc"]), children: t("key_esc") }),
      /* @__PURE__ */ jsx(Button, { disabled: busy, onClick: () => onKeys(["shift+tab"]), children: t("key_shiftTab") })
    ] })
  ] });
}
function NewSessionDialog({
  ctx,
  machine,
  defaultCwd,
  onClose,
  onStarted
}) {
  const t = strings.useT();
  const [cwd, setCwd] = useState(defaultCwd);
  const [workspace, setWorkspace] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runAction(ctx, machine.id, {
        action: "start",
        cwd,
        workspace: workspace || void 0
      });
      onStarted(t("started"), result.pane ?? null);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsx(Dialog, { title: t("newTitle"), onClose, children: /* @__PURE__ */ jsxs(
    "form",
    {
      className: "fields flex flex-col gap-4",
      onSubmit: (event) => {
        event.preventDefault();
        void start();
      },
      children: [
        /* @__PURE__ */ jsx(Field, { label: t("machine"), children: /* @__PURE__ */ jsx("input", { value: machine.name, readOnly: true }) }),
        /* @__PURE__ */ jsx(Field, { label: t("newCwd"), hint: t("newCwdHint"), children: /* @__PURE__ */ jsx(
          "input",
          {
            value: cwd,
            onChange: (event) => setCwd(event.target.value),
            required: true,
            spellCheck: false,
            autoCapitalize: "off"
          }
        ) }),
        /* @__PURE__ */ jsx(Field, { label: t("newWorkspace"), children: /* @__PURE__ */ jsxs("select", { value: workspace, onChange: (event) => setWorkspace(event.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: t("newWorkspaceCreate") }),
          (machine.herdr?.workspaces ?? []).map((w) => /* @__PURE__ */ jsxs("option", { value: w.id, children: [
            w.number,
            ". ",
            w.label
          ] }, w.id))
        ] }) }),
        error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
        /* @__PURE__ */ jsxs(ButtonRow, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", disabled: busy || !cwd.trim(), children: busy ? t("starting") : t("newStart") }),
          /* @__PURE__ */ jsx(Button, { type: "button", onClick: onClose, children: t("cancel") })
        ] })
      ]
    }
  ) });
}
function CodeScreen({ ctx, account }) {
  const t = strings.useT();
  const when = useWhen();
  const admin = account.role === "admin";
  const overview = usePolledResource(() => fetchOverview(ctx), 4e3, admin, {
    cacheKey: "claude-code:overview"
  });
  const machines = overview.data?.machines ?? [];
  const entries = useMemo(() => machines.flatMap(entriesOf), [machines]);
  const [pick, setPick] = useState(null);
  const selectedKey = pick ? `${pick.machineId}/${pick.sessionId ?? pick.pane}` : null;
  const [listOpen, setListOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [newFor, setNewFor] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const selected = useMemo(() => {
    if (!pick) return null;
    return entries.find((e) => matches(pick, e)) ?? null;
  }, [entries, pick]);
  useEffect(() => {
    if (selected && pick && (selected.sessionId !== pick.sessionId || (selected.agent?.pane ?? null) !== pick.pane))
      setPick(pickOf(selected));
  }, [selected, pick]);
  useEffect(() => {
    if (!pick && entries.length > 0 && window.matchMedia("(min-width: 1101px)").matches) setPick(pickOf(entries[0]));
  }, [pick, entries]);
  useEffect(() => {
    setNotice(null);
    setTerminalOpen(false);
  }, [selectedKey]);
  const status = selected?.agent?.status ?? null;
  const live = Boolean(selected?.agent);
  const log = useSessionLog(ctx, selected, status === "working" || status === "blocked");
  const refreshSoon = () => {
    void overview.refresh();
    void log.pull().catch(() => void 0);
  };
  const act2 = async (fn, done) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice({ tone: "ok", text: done });
      refreshSoon();
      return true;
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!selected?.agent || !text.trim()) return;
    const pane = selected.agent.pane;
    const ok = await act2(() => runAction(ctx, selected.machineId, { action: "prompt", pane, text }));
    if (ok) setText("");
  };
  const sendKeys = (keys) => {
    if (!selected?.agent) return;
    const pane = selected.agent.pane;
    void act2(() => runAction(ctx, selected.machineId, { action: "keys", pane, keys }));
  };
  if (!admin) {
    return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "Claude Code", en: "Claude Code" }, children: /* @__PURE__ */ jsx(ScreenNotice, { tone: "error", children: t("adminOnly") }) });
  }
  if (overview.data && machines.length === 0) {
    return /* @__PURE__ */ jsxs(ScreenFrame, { title: { ja: "Claude Code", en: "Claude Code" }, children: [
      /* @__PURE__ */ jsxs(ScreenNotice, { children: [
        t("noMachines"),
        " ",
        t("noMachinesHint")
      ] }),
      /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: () => openSettings({ page: "extensions", extension: "claude-code" }), children: t("openSettings") }) })
    ] });
  }
  const loadError = overview.error instanceof Error ? overview.error.message : overview.error ? String(overview.error) : null;
  const list = !overview.data ? /* @__PURE__ */ jsx(Note, { children: loadError ?? t("loading") }) : machines.map((machine) => {
    const machineEntries = entries.filter((e) => e.machineId === machine.id);
    const herdr = machine.herdr?.running === true;
    return /* @__PURE__ */ jsxs("div", { className: "mb-4 flex flex-col gap-1.5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-2", children: [
        /* @__PURE__ */ jsx(SectionTitle, { children: machine.name }),
        !machine.ok ? /* @__PURE__ */ jsx(Badge, { tone: "warn", children: t("unreachable") }) : !machine.herdr ? /* @__PURE__ */ jsx(Badge, { tone: "dim", children: t("viewOnly") }) : !herdr ? /* @__PURE__ */ jsx(Badge, { tone: "warn", children: t("herdrStopped") }) : null,
        herdr && /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: "add",
            label: t("newSession"),
            title: t("newSession"),
            className: "ml-auto",
            onClick: () => setNewFor(machine)
          }
        )
      ] }),
      !machine.ok && machine.error && /* @__PURE__ */ jsx(Note, { children: machine.error }),
      machine.ok && machineEntries.length === 0 && /* @__PURE__ */ jsx(Note, { children: t("noSessions") }),
      /* @__PURE__ */ jsx(List, { label: machine.name, children: machineEntries.map((entry) => /* @__PURE__ */ jsx(
        ListItem,
        {
          title: entry.title,
          detail: [.../* @__PURE__ */ new Set([basename(entry.cwd), entry.agent ? entry.workspace?.label : when(entry.mtime)])].filter(Boolean).join(" \xB7 "),
          badge: entry.agent ? /* @__PURE__ */ jsx(StatusBadge, { status: entry.agent.status }) : void 0,
          selected: selected === entry,
          onClick: () => {
            setPick(pickOf(entry));
            setListOpen(false);
          }
        },
        entry.key
      )) })
    ] }, machine.id);
  });
  const blocked = status === "blocked";
  const working = status === "working";
  const header = selected ? /* @__PURE__ */ jsx(
    ChatHeader,
    {
      title: selected.title,
      ok: live,
      status: /* @__PURE__ */ jsxs(Fragment2, { children: [
        live && selected.agent ? t(`status_${selected.agent.status}`) : t("status_stopped"),
        " \xB7 ",
        selected.machineName,
        selected.cwd && /* @__PURE__ */ jsxs(Fragment2, { children: [
          " \xB7 ",
          /* @__PURE__ */ jsx("span", { title: selected.cwd, children: basename(selected.cwd) })
        ] }),
        selected.branch && ` \xB7 ${selected.branch}`
      ] }),
      onOpenList: () => setListOpen(true),
      actions: /* @__PURE__ */ jsxs(ButtonRow, { children: [
        live && /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: "desktop",
            label: terminalOpen ? t("hideTerminal") : t("terminal"),
            title: terminalOpen ? t("hideTerminal") : t("terminal"),
            selected: terminalOpen,
            glass: true,
            onClick: () => setTerminalOpen((v) => !v)
          }
        ),
        live && selected.agent && /* @__PURE__ */ jsx(
          IconButton,
          {
            icon: "grid",
            label: t("focusInHerdr"),
            title: t("focusInHerdr"),
            glass: true,
            disabled: busy,
            onClick: () => void act2(
              () => runAction(ctx, selected.machineId, {
                action: "focus",
                pane: selected.agent.pane
              }),
              t("focused")
            )
          }
        ),
        !live && selected.herdr && selected.sessionId && selected.cwd && /* @__PURE__ */ jsx(
          Button,
          {
            icon: "play",
            disabled: busy,
            onClick: () => void act2(async () => {
              const result = await runAction(ctx, selected.machineId, {
                action: "start",
                cwd: selected.cwd,
                resume: selected.sessionId
              });
              if (result.pane)
                setPick({
                  machineId: selected.machineId,
                  sessionId: selected.sessionId,
                  pane: result.pane
                });
            }, t("resumed")),
            children: t("resume")
          }
        )
      ] })
    }
  ) : null;
  const placeholder = !live ? t("promptViewOnly") : blocked ? t("promptBlocked") : t("promptPlaceholder");
  return /* @__PURE__ */ jsxs(ScreenFrame, { title: { ja: "Claude Code", en: "Claude Code" }, fill: true, children: [
    /* @__PURE__ */ jsx(
      ChatLayout,
      {
        list,
        listLabel: t("sessions"),
        listOpen: listOpen || !selected,
        onCloseList: () => setListOpen(false),
        canCloseList: Boolean(selected),
        children: !selected ? /* @__PURE__ */ jsx(ChatPending, { children: overview.data ? t("pickSession") : t("loading") }) : /* @__PURE__ */ jsxs(Fragment2, { children: [
          header,
          /* @__PURE__ */ jsxs(
            ChatLog,
            {
              scrollKey: `${selected.key}:${log.state?.items.length ?? 0}`,
              empty: !selected.sessionId ? void 0 : log.error && !log.state ? log.error : !log.state ? t("loading") : log.state.items.length === 0 ? t("emptyLog") : void 0,
              children: [
                log.state?.more && /* @__PURE__ */ jsx("li", { className: "self-center", children: /* @__PURE__ */ jsx(Button, { disabled: log.loadingOlder, onClick: () => void log.loadOlder(), children: log.loadingOlder ? t("readingOlder") : t("olderMessages") }) }),
                log.state && /* @__PURE__ */ jsx(Transcript, { items: log.state.items, cwd: selected.cwd, working })
              ]
            }
          ),
          live && (blocked || terminalOpen) && /* @__PURE__ */ jsx(TerminalPanel, { ctx, entry: selected, blocked, onKeys: sendKeys, busy }),
          /* @__PURE__ */ jsx(
            ChatComposer,
            {
              value: text,
              onChange: setText,
              onSubmit: () => void send(),
              placeholder,
              label: t("prompt"),
              disabled: !live || blocked,
              canSubmit: live && !blocked && !busy && Boolean(text.trim()),
              above: notice && /* @__PURE__ */ jsx(Message, { tone: notice.tone, children: notice.text }),
              stop: live && working && !text.trim() ? { label: t("interrupt"), onClick: () => sendKeys(["esc"]) } : void 0
            }
          )
        ] })
      }
    ),
    newFor && /* @__PURE__ */ jsx(
      NewSessionDialog,
      {
        ctx,
        machine: newFor,
        defaultCwd: selected?.machineId === newFor.id && selected.cwd ? selected.cwd : "~",
        onClose: () => setNewFor(null),
        onStarted: (message, pane) => {
          if (pane) setPick({ machineId: newFor.id, sessionId: null, pane });
          setNotice({ tone: "ok", text: message });
          void overview.refresh();
        }
      }
    )
  ] });
}

// extensions/claude-code/src/MachineSettings.tsx
var emptyDraft = () => ({
  name: "",
  type: "ssh",
  host: "",
  port: "22",
  username: "",
  fingerprint: ""
});
var toDraft = (m4) => ({
  ...m4,
  port: m4.port ? String(m4.port) : ""
});
var toBody = (d) => ({
  ...d,
  port: d.port ? Number(d.port) : void 0
});
function MachineSettings({ ctx, isAdmin }) {
  const t = strings.useT();
  const [machines, setMachines] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setMachines(await fetchMachines(ctx));
    } catch (err) {
      setError(err.message);
    }
  }, [ctx, isAdmin]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!isAdmin) {
    return /* @__PURE__ */ jsxs("section", { className: "mt-5 flex flex-col gap-3", children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("machinesTitle") }),
      /* @__PURE__ */ jsx(Note, { children: t("adminOnly") })
    ] });
  }
  if (editing) {
    return /* @__PURE__ */ jsx(
      MachineEditor,
      {
        ctx,
        draft: editing,
        onDone: () => {
          setEditing(null);
          void load();
        }
      }
    );
  }
  return /* @__PURE__ */ jsxs("section", { className: "mt-5 flex flex-col gap-3", children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: t("machinesTitle") }),
    /* @__PURE__ */ jsx(Note, { children: t("machinesNote") }),
    error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
    machines === null && !error && /* @__PURE__ */ jsx(Note, { children: t("loading") }),
    machines && machines.length > 0 && /* @__PURE__ */ jsx(List, { children: machines.map((machine) => /* @__PURE__ */ jsx(
      ListItem,
      {
        title: machine.name,
        detail: machine.type === "ssh" ? t("machineSsh", {
          user: machine.username ?? "",
          host: machine.host ?? ""
        }) : t("machineSelf"),
        onClick: () => setEditing(toDraft(machine))
      },
      machine.id
    )) }),
    /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(Button, { icon: "add", onClick: () => setEditing(emptyDraft()), children: t("addMachine") }) }),
    /* @__PURE__ */ jsx(SetupGuide, { ctx })
  ] });
}
function MachineEditor({ ctx, draft: initial, onDone }) {
  const t = strings.useT();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [observed, setObserved] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const isNew = !draft.id;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveMachine(ctx, toBody(draft));
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setMessage(null);
    setObserved(null);
    try {
      const result = await testMachine(ctx, toBody(draft));
      setMessage({ ok: result.ok, text: result.message });
      if (result.fingerprint) setObserved(result.fingerprint);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!draft.id) return;
    if (!deleting) return setDeleting(true);
    setBusy(true);
    try {
      await deleteMachine(ctx, draft.id);
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
      setBusy(false);
    }
  };
  const field = (label, key, placeholder = "", hint) => /* @__PURE__ */ jsx(Field, { label, hint, children: /* @__PURE__ */ jsx(
    "input",
    {
      type: "text",
      autoComplete: "off",
      spellCheck: false,
      autoCapitalize: "off",
      placeholder,
      value: String(draft[key] ?? ""),
      onChange: (e) => set({ [key]: e.target.value })
    }
  ) });
  return /* @__PURE__ */ jsxs("section", { className: "mt-5 flex flex-col gap-3", children: [
    /* @__PURE__ */ jsx(BackButton, { label: t("machinesTitle"), onClick: onDone }),
    /* @__PURE__ */ jsx(SectionTitle, { children: isNew ? t("addMachine") : draft.name }),
    /* @__PURE__ */ jsx(Group, { children: /* @__PURE__ */ jsxs("form", { onSubmit: save, children: [
      /* @__PURE__ */ jsxs("fieldset", { disabled: busy, children: [
        /* @__PURE__ */ jsx(Field, { label: t("type"), children: /* @__PURE__ */ jsxs(
          "select",
          {
            value: draft.type,
            onChange: (e) => {
              set({ type: e.target.value });
              setMessage(null);
              setObserved(null);
            },
            children: [
              /* @__PURE__ */ jsx("option", { value: "ssh", children: t("typeSsh") }),
              /* @__PURE__ */ jsx("option", { value: "self", children: t("typeSelf") })
            ]
          }
        ) }),
        field(t("name"), "name", "mooma-lpve"),
        draft.type === "ssh" && /* @__PURE__ */ jsxs(Fragment2, { children: [
          field(t("host"), "host", "192.168.1.10"),
          field(t("port"), "port", "22"),
          field(t("username"), "username", "mooma"),
          field(t("fingerprint"), "fingerprint", "SHA256:\u2026", t("fingerprintHint"))
        ] }),
        /* @__PURE__ */ jsxs(ButtonRow, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", children: t("save") }),
          /* @__PURE__ */ jsx(Button, { onClick: () => void test(), children: busy ? t("testing") : t("test") })
        ] })
      ] }),
      message && /* @__PURE__ */ jsx(Message, { tone: message.ok ? "ok" : "error", children: message.text }),
      observed && /* @__PURE__ */ jsxs("div", { className: "my-3 flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx(CodeBlock, { children: observed }),
        /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(
          Button,
          {
            onClick: () => {
              set({ fingerprint: observed });
              setObserved(null);
              setMessage({ ok: true, text: t("fingerprintSet") });
            },
            children: t("useFingerprint")
          }
        ) })
      ] })
    ] }) }),
    !isNew && /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(Button, { variant: "danger", disabled: busy, onClick: () => void remove(), children: deleting ? t("removeConfirm", { name: draft.name }) : t("remove") }) })
  ] });
}
function SetupGuide({ ctx }) {
  const t = strings.useT();
  const [key, setKey] = useState(null);
  const [copied, setCopied] = useState(null);
  useEffect(() => {
    fetchSshKey(ctx).then(setKey).catch(() => void 0);
  }, [ctx]);
  const copy = (id, value) => void navigator.clipboard?.writeText(value).then(
    () => setCopied(id),
    () => void 0
  );
  const install = key ? `mkdir -p ~/.local/bin ~/.ssh && mv ~/Downloads/${key.bridgeFile} ~/.local/bin/ && chmod 755 ~/.local/bin/${key.bridgeFile}` : "";
  return /* @__PURE__ */ jsxs(Group, { children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: t("setupTitle") }),
    /* @__PURE__ */ jsxs("ol", { className: "flex list-decimal flex-col gap-3 pl-5 text-label leading-normal", children: [
      /* @__PURE__ */ jsxs("li", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx("span", { children: t("setupStep1", {
          file: key?.bridgeFile ?? "hd-claude-bridge.py"
        }) }),
        /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(ButtonLink, { href: bridgeUrl(ctx), download: key?.bridgeFile ?? "hd-claude-bridge.py", children: t("saveScript") }) }),
        install && /* @__PURE__ */ jsx(Field, { label: t("installCommand"), children: /* @__PURE__ */ jsx(CodeBlock, { children: install }) })
      ] }),
      /* @__PURE__ */ jsxs("li", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx("span", { children: t("setupStep2") }),
        key && /* @__PURE__ */ jsxs(Fragment2, { children: [
          /* @__PURE__ */ jsx(CodeBlock, { children: key.authorizedKeysLine }),
          /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(Button, { onClick: () => copy("key", key.authorizedKeysLine), children: copied === "key" ? t("copied") : t("copy") }) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("li", { children: t("setupStep3") })
    ] })
  ] });
}

// extensions/claude-code/src/web.tsx
var web_default = defineWebExtension({
  screens: [
    {
      id: "sessions",
      label: { ja: "Claude Code", en: "Claude Code" },
      icon: "sparkle",
      order: 60,
      Component: CodeScreen
    }
  ],
  SettingsPanel: MachineSettings
});
export {
  web_default as default
};
