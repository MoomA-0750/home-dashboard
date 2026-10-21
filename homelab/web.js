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

// extensions/homelab/src/HostSettings.tsx
var TYPE_LABELS = {
  self: { ja: "\u3053\u306E\u6A5F\u68B0", en: "This machine" },
  ssh: "SSH",
  "node-exporter": "node_exporter",
  proxmox: "Proxmox VE",
  tcp: { ja: "\u5FDC\u7B54\u306E\u78BA\u8A8D\u3060\u3051", en: "Reachability only" }
};
var TYPE_NOTES = {
  self: {
    ja: "\u3053\u306E\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u304C\u52D5\u3044\u3066\u3044\u308B\u6A5F\u68B0\u306E\u3001CPU\u30FB\u30E1\u30E2\u30EA\u30FB\u30C7\u30A3\u30B9\u30AF\u30FB\u9023\u7D9A\u7A3C\u50CD\u6642\u9593\u3092\u8AAD\u307F\u307E\u3059\u3002\u4F55\u3082\u5165\u308C\u306A\u304F\u3066\u4F7F\u3048\u307E\u3059\u3002",
    en: "Reads CPU, memory, disk and uptime of the machine this dashboard runs on. Nothing to install."
  },
  ssh: {
    ja: "SSH \u3067\u3064\u306A\u3044\u3067\u3001/proc \u3068 df \u304B\u3089\u30EA\u30BD\u30FC\u30B9\u3092\u8AAD\u307F\u307E\u3059\uFF08Linux\uFF09\u3002\u76F8\u624B\u306B\u306F\u4F55\u3082\u5165\u308C\u305A\u3001\u4E0B\u306E1\u884C\u3092\u3001\u3064\u306A\u3050\u30E6\u30FC\u30B6\u30FC\u306E ~/.ssh/authorized_keys \u306B\u8DB3\u3059\u3060\u3051\u3067\u3059\u3002\u3053\u306E1\u884C\u306F\u30EA\u30BD\u30FC\u30B9\u3092\u8AAD\u3080\u30B3\u30DE\u30F3\u30C9\u3057\u304B\u52D5\u304B\u305B\u306A\u3044\u3088\u3046\u306B\u56FA\u5B9A\u3057\u3066\u3042\u308A\u307E\u3059\u3002\u30DB\u30B9\u30C8\u9375\u306F\u6307\u7D0B\u3067\u78BA\u304B\u3081\u307E\u3059\u3002\u7A7A\u306E\u307E\u307E\u300C\u63A5\u7D9A\u3092\u78BA\u304B\u3081\u308B\u300D\u3092\u62BC\u3059\u3068\u4ECA\u306E\u6307\u7D0B\u304C\u51FA\u307E\u3059\u3002\u76F8\u624B\u3067 ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub \u3092\u52D5\u304B\u3057\u3066\u3001\u540C\u3058\u304B\u3092\u78BA\u304B\u3081\u3066\u304B\u3089\u4F7F\u3063\u3066\u304F\u3060\u3055\u3044\u3002",
    en: 'Connects over SSH and reads resources from /proc and df (Linux). Nothing to install on the host: just add the line below to ~/.ssh/authorized_keys of the user you connect as. That line is locked to the command that reads resources. The host key is checked by fingerprint. Press "Test connection" with it empty to see the current fingerprint, then run ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub on the host and confirm they match before using it.'
  },
  "node-exporter": {
    ja: "\u76F8\u624B\u306E\u6A5F\u68B0\u306B node_exporter \u3092\u5165\u308C\u3066\u8AAD\u307F\u307E\u3059\uFF08Debian\u30FBUbuntu \u306A\u3089 apt install prometheus-node-exporter\uFF09\u3002URL \u306F http://<\u6A5F\u68B0>:9100/metrics \u3067\u3059\u3002",
    en: "Install node_exporter on the machine to read it (on Debian/Ubuntu: apt install prometheus-node-exporter). The URL is http://<machine>:9100/metrics."
  },
  proxmox: {
    ja: "Proxmox \u306E\u753B\u9762\u306E\u300C\u30C7\u30FC\u30BF\u30BB\u30F3\u30BF\u30FC \u2192 \u30A2\u30AF\u30BB\u30B9\u6A29\u9650 \u2192 API \u30C8\u30FC\u30AF\u30F3\u300D\u3067\u3001\u8AAD\u3080\u3060\u3051\u306E\u6A29\u9650\uFF08PVEAuditor\uFF09\u306E\u30C8\u30FC\u30AF\u30F3\u3092\u4F5C\u3063\u3066\u5165\u308C\u307E\u3059\u3002\u8A3C\u660E\u66F8\u306F Proxmox \u81EA\u8EAB\u306E\u767A\u884C\u306A\u306E\u3067\u6307\u7D0B\u3067\u78BA\u304B\u3081\u307E\u3059\u3002\u7A7A\u306E\u307E\u307E\u300C\u63A5\u7D9A\u3092\u78BA\u304B\u3081\u308B\u300D\u3092\u62BC\u3059\u3068\u4ECA\u306E\u6307\u7D0B\u304C\u51FA\u307E\u3059\u3002Proxmox \u306E\u753B\u9762\uFF08\u30CE\u30FC\u30C9 \u2192 \u30B7\u30B9\u30C6\u30E0 \u2192 \u8A3C\u660E\u66F8\uFF09\u306E\u6307\u7D0B\u3068\u540C\u3058\u304B\u3092\u78BA\u304B\u3081\u3066\u304B\u3089\u4F7F\u3063\u3066\u304F\u3060\u3055\u3044\u3002",
    en: `In Proxmox, create a read-only (PVEAuditor) token under Datacenter \u2192 Permissions \u2192 API Tokens and enter it here. Proxmox issues its own certificate, so it's checked by fingerprint. Press "Test connection" with it empty to see the current fingerprint, and confirm it matches the one in Proxmox (Node \u2192 System \u2192 Certificates) before using it.`
  },
  tcp: {
    ja: "\u30EA\u30BD\u30FC\u30B9\u306F\u8AAD\u307E\u305A\u3001\u6C7A\u3081\u305F\u53E3\uFF08SSH \u306E 22 \u306A\u3069\uFF09\u306B TCP \u3067\u3064\u306A\u304C\u308B\u304B\u3060\u3051\u3092\u898B\u307E\u3059\u3002",
    en: "Doesn't read resources; only checks whether a TCP connection to the given port (such as 22 for SSH) succeeds."
  }
};
var messages = defineMessages({
  ja: {
    loadFailed: "\u30DB\u30B9\u30C8\u3092\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    requestFailed: "\u3046\u307E\u304F\u3044\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    hosts: "\u30DB\u30B9\u30C8",
    adminOnly: "\u30DB\u30B9\u30C8\u3092\u767B\u9332\u3067\u304D\u308B\u306E\u306F\u7BA1\u7406\u8005\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3060\u3051\u3067\u3059\u3002",
    intro: "\u30DB\u30FC\u30E0\u30E9\u30DC\u306E\u30A6\u30A3\u30B8\u30A7\u30C3\u30C8\u306B\u51FA\u3059\u6A5F\u68B0\u3067\u3059\u3002\u4E0A\u304B\u3089\u9806\u306B\u51FA\u3057\u307E\u3059\u3002\u62BC\u3059\u3068\u8A2D\u5B9A\u3092\u958B\u304D\u307E\u3059\u3002",
    loading: "\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    addHost: "\u30DB\u30B9\u30C8\u3092\u8FFD\u52A0",
    type: "\u7A2E\u985E",
    name: "\u540D\u524D",
    namePlaceholder: "mooma-lpve \u306A\u3069",
    address: "\u5B9B\u5148\uFF08IP \u304B\u30DB\u30B9\u30C8\u540D\uFF09",
    port: "\u53E3\u306E\u756A\u53F7",
    username: "\u30E6\u30FC\u30B6\u30FC\u540D",
    hostKeyFingerprint: "\u30DB\u30B9\u30C8\u9375\u306E\u6307\u7D0B",
    tokenId: "API \u30C8\u30FC\u30AF\u30F3\u306E ID",
    tokenSecret: "API \u30C8\u30FC\u30AF\u30F3\u306E\u30B7\u30FC\u30AF\u30EC\u30C3\u30C8",
    secretSet: "\u8A2D\u5B9A\u6E08\u307F\uFF08\u5909\u3048\u308B\u3068\u304D\u3060\u3051\u5165\u529B\uFF09",
    certFingerprint: "\u8A3C\u660E\u66F8\u306E\u6307\u7D0B\uFF08SHA-256\uFF09",
    node: "\u30CE\u30FC\u30C9\uFF08\u7A7A\u306A\u3089\u6700\u521D\u306E\u30CE\u30FC\u30C9\uFF09",
    add: "\u8FFD\u52A0",
    save: "\u4FDD\u5B58",
    test: "\u63A5\u7D9A\u3092\u78BA\u304B\u3081\u308B",
    fingerprintSet: "\u6307\u7D0B\u3092\u5165\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u78BA\u304B\u3081\u3066\u304B\u3089\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044",
    useFingerprint: "\u3053\u306E\u6307\u7D0B\u3092\u4F7F\u3046",
    confirmDelete: "\u3082\u3046\u4E00\u5EA6\u62BC\u3057\u3066\u6D88\u3059",
    deleteHost: "\u3053\u306E\u30DB\u30B9\u30C8\u3092\u6D88\u3059",
    authorizedKeysLine: "\u76F8\u624B\u306E ~/.ssh/authorized_keys \u306B\u8DB3\u30591\u884C",
    copied: "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F",
    copy: "\u30B3\u30D4\u30FC"
  },
  en: {
    loadFailed: "Couldn't load hosts ({status})",
    requestFailed: "Something went wrong ({status})",
    hosts: "Hosts",
    adminOnly: "Only admin accounts can register hosts.",
    intro: "Machines shown in the homelab widget, in this order. Tap one to open its settings.",
    loading: "Loading\u2026",
    addHost: "Add host",
    type: "Type",
    name: "Name",
    namePlaceholder: "e.g. mooma-lpve",
    address: "Address (IP or host name)",
    port: "Port",
    username: "User name",
    hostKeyFingerprint: "Host key fingerprint",
    tokenId: "API token ID",
    tokenSecret: "API token secret",
    secretSet: "Set (enter only to change)",
    certFingerprint: "Certificate fingerprint (SHA-256)",
    node: "Node (empty for the first node)",
    add: "Add",
    save: "Save",
    test: "Test connection",
    fingerprintSet: "Fingerprint filled in. Test again before saving",
    useFingerprint: "Use this fingerprint",
    confirmDelete: "Press again to delete",
    deleteHost: "Delete this host",
    authorizedKeysLine: "Line to add to ~/.ssh/authorized_keys on the host",
    copied: "Copied",
    copy: "Copy"
  }
});
var emptyDraft = (type, locale) => ({
  name: type === "self" ? textFor(TYPE_LABELS.self, locale) : "",
  type,
  url: type === "node-exporter" ? "http://" : type === "proxmox" ? "https://" : "",
  port: type === "tcp" || type === "ssh" ? "22" : ""
});
var toDraft = (host) => ({ ...host, port: host.port ? String(host.port) : "", tokenSecret: "" });
function toBody(draft) {
  return { ...draft, port: draft.port ? Number(draft.port) : void 0 };
}
function HostSettings({ ctx, isAdmin }) {
  const t = messages.useT();
  const locale = useLocale();
  const base = `${ctx.apiBaseUrl}/api/ext/homelab`;
  const [hosts, setHosts] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${base}/hosts`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? messages.t("loadFailed", { status: res.status }));
      setHosts(body.hosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [base, isAdmin]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!isAdmin) {
    return /* @__PURE__ */ jsxs("section", { className: "homelab-settings", children: [
      /* @__PURE__ */ jsx(SectionTitle, { children: t("hosts") }),
      /* @__PURE__ */ jsx(Note, { children: t("adminOnly") })
    ] });
  }
  if (editing) {
    return /* @__PURE__ */ jsx(
      HostEditor,
      {
        base,
        draft: editing,
        onDone: () => {
          setEditing(null);
          void load();
        }
      }
    );
  }
  return /* @__PURE__ */ jsxs("section", { className: "homelab-settings", children: [
    /* @__PURE__ */ jsx(SectionTitle, { children: t("hosts") }),
    /* @__PURE__ */ jsx(Note, { children: t("intro") }),
    error && /* @__PURE__ */ jsx(Message, { tone: "error", children: error }),
    hosts === null && !error && /* @__PURE__ */ jsx(Note, { children: t("loading") }),
    hosts && hosts.length > 0 && /* @__PURE__ */ jsx(List, { children: hosts.map((host) => /* @__PURE__ */ jsx(
      ListItem,
      {
        title: host.name,
        detail: /* @__PURE__ */ jsxs(Fragment2, { children: [
          textFor(TYPE_LABELS[host.type], locale),
          host.type === "tcp" && ` \xB7 ${host.host}:${host.port}`,
          host.type === "ssh" && ` \xB7 ${host.username}@${host.host}`,
          (host.type === "node-exporter" || host.type === "proxmox") && host.url && ` \xB7 ${host.url}`
        ] }),
        onClick: () => setEditing(toDraft(host))
      },
      host.id
    )) }),
    /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(
      Button,
      {
        icon: "add",
        onClick: () => setEditing(emptyDraft(hosts?.some((h) => h.type === "self") ? "node-exporter" : "self", locale)),
        children: t("addHost")
      }
    ) })
  ] });
}
function HostEditor({ base, draft: initial, onDone }) {
  const t = messages.useT();
  const locale = useLocale();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [observedFingerprint, setObservedFingerprint] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const isNew = !draft.id;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const call = async (path, init) => {
    const res = await fetch(`${base}${path}`, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
    return body;
  };
  const json = (method, body) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isNew) await call("/hosts", json("POST", toBody(draft)));
      else await call(`/hosts/${draft.id}`, json("PUT", toBody(draft)));
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  };
  const test = async () => {
    setBusy(true);
    setMessage(null);
    setObservedFingerprint(null);
    try {
      const result = await call("/hosts-test", json("POST", toBody(draft)));
      setMessage({ ok: result.ok, text: result.message });
      if (result.fingerprint) setObservedFingerprint(result.fingerprint);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return setDeleting(true);
    setBusy(true);
    try {
      await call(`/hosts/${draft.id}`, { method: "DELETE" });
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  };
  const field = (label, key, options = {}) => /* @__PURE__ */ jsx(Field, { label, children: /* @__PURE__ */ jsx(
    "input",
    {
      type: options.secret ? "password" : "text",
      autoComplete: "off",
      spellCheck: false,
      placeholder: options.placeholder ?? "",
      value: String(draft[key] ?? ""),
      onChange: (e) => set({ [key]: e.target.value })
    }
  ) });
  return /* @__PURE__ */ jsxs("section", { className: "homelab-settings", children: [
    /* @__PURE__ */ jsx(BackButton, { label: t("hosts"), onClick: onDone }),
    /* @__PURE__ */ jsx(SectionTitle, { children: isNew ? t("addHost") : draft.name }),
    /* @__PURE__ */ jsxs("form", { className: "ui-group", onSubmit: save, children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "homelab-settings__fields", disabled: busy, children: [
        /* @__PURE__ */ jsx(Field, { label: t("type"), children: /* @__PURE__ */ jsx(
          "select",
          {
            value: draft.type,
            onChange: (e) => {
              const type = e.target.value;
              setDraft({
                ...emptyDraft(type, locale),
                id: draft.id,
                name: draft.name || emptyDraft(type, locale).name
              });
              setMessage(null);
              setObservedFingerprint(null);
            },
            children: Object.keys(TYPE_LABELS).map((type) => /* @__PURE__ */ jsx("option", { value: type, children: textFor(TYPE_LABELS[type], locale) }, type))
          }
        ) }),
        /* @__PURE__ */ jsx(Note, { children: textFor(TYPE_NOTES[draft.type], locale) }),
        field(t("name"), "name", { placeholder: t("namePlaceholder") }),
        draft.type === "tcp" && /* @__PURE__ */ jsxs(Fragment2, { children: [
          field(t("address"), "host", { placeholder: "192.168.0.4" }),
          field(t("port"), "port", { placeholder: "22" })
        ] }),
        draft.type === "ssh" && /* @__PURE__ */ jsxs(Fragment2, { children: [
          field(t("address"), "host", { placeholder: "192.168.0.4" }),
          field(t("port"), "port", { placeholder: "22" }),
          field(t("username"), "username", { placeholder: "monitor" }),
          field(t("hostKeyFingerprint"), "fingerprint", { placeholder: "SHA256:\u2026" }),
          /* @__PURE__ */ jsx(SshKeyHint, { base })
        ] }),
        draft.type === "node-exporter" && field("URL", "url", { placeholder: "http://192.168.0.10:9100/metrics" }),
        draft.type === "proxmox" && /* @__PURE__ */ jsxs(Fragment2, { children: [
          field("URL", "url", { placeholder: "https://192.168.0.4:8006" }),
          field(t("tokenId"), "tokenId", { placeholder: "root@pam!dashboard" }),
          field(t("tokenSecret"), "tokenSecret", {
            secret: true,
            placeholder: draft.hasTokenSecret ? t("secretSet") : ""
          }),
          field(t("certFingerprint"), "fingerprint", { placeholder: "AB:CD:\u2026" }),
          field(t("node"), "node", { placeholder: "mooma-lpve" })
        ] }),
        /* @__PURE__ */ jsxs(ButtonRow, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "primary", type: "submit", children: isNew ? t("add") : t("save") }),
          /* @__PURE__ */ jsx(Button, { onClick: () => void test(), children: t("test") })
        ] })
      ] }),
      message && /* @__PURE__ */ jsx(Message, { tone: message.ok ? "ok" : "error", children: message.text }),
      observedFingerprint && /* @__PURE__ */ jsxs("div", { className: "homelab-settings__fingerprint", children: [
        /* @__PURE__ */ jsx(CodeBlock, { children: observedFingerprint }),
        /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(
          Button,
          {
            onClick: () => {
              set({ fingerprint: observedFingerprint });
              setObservedFingerprint(null);
              setMessage({ ok: true, text: t("fingerprintSet") });
            },
            children: t("useFingerprint")
          }
        ) })
      ] })
    ] }),
    !isNew && /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(Button, { variant: "danger", disabled: busy, onClick: () => void remove(), children: deleting ? t("confirmDelete") : t("deleteHost") }) })
  ] });
}
function SshKeyHint({ base }) {
  const t = messages.useT();
  const [line, setLine] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch(`${base}/ssh-key`).then((res) => res.ok ? res.json() : null).then((body) => body && setLine(body.authorizedKeysLine)).catch(() => void 0);
  }, [base]);
  if (!line) return null;
  return /* @__PURE__ */ jsxs("div", { className: "homelab-settings__key", children: [
    /* @__PURE__ */ jsx(Field, { label: t("authorizedKeysLine"), children: /* @__PURE__ */ jsx(CodeBlock, { children: line }) }),
    /* @__PURE__ */ jsx(ButtonRow, { children: /* @__PURE__ */ jsx(
      Button,
      {
        onClick: () => void navigator.clipboard?.writeText(line).then(
          () => setCopied(true),
          () => void 0
        ),
        children: copied ? t("copied") : t("copy")
      }
    ) })
  ] });
}

// extensions/homelab/src/widget.tsx
var messages2 = defineMessages({
  ja: {
    apiError: "homelab status API error: {status}",
    daysHours: "{d}\u65E5 {h}\u6642\u9593",
    hoursMinutes: "{h}\u6642\u9593 {m}\u5206",
    minutes: "{m}\u5206",
    cores: "{n}\u30B3\u30A2",
    memory: "\u30E1\u30E2\u30EA",
    disk: "\u30C7\u30A3\u30B9\u30AF",
    uptime: "\u7A3C\u50CD {time}",
    guests: "VM\u30FB\u30B3\u30F3\u30C6\u30CA {running}/{total} \u7A3C\u50CD",
    title: "\u30DB\u30FC\u30E0\u30E9\u30DC\u7A3C\u50CD\u72B6\u6CC1",
    openDetail: "\u30DB\u30FC\u30E0\u30E9\u30DC\u7A3C\u50CD\u72B6\u6CC1\uFF08\u8A73\u3057\u304F\u898B\u308B\uFF09",
    latency: "\u5FDC\u7B54 {ms}ms",
    responding: "\u5FDC\u7B54\u3042\u308A",
    notResponding: "\u5FDC\u7B54\u306A\u3057",
    noHosts: "\u30DB\u30B9\u30C8\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 homelab\u300D\u3067\u767B\u9332\u3067\u304D\u307E\u3059\u3002",
    load: "\u30ED\u30FC\u30C9 {load}",
    memoryUsage: "\u30E1\u30E2\u30EA {used} / {total}",
    diskUsage: "\u30C7\u30A3\u30B9\u30AF {used} / {total}",
    factSeparator: "\u30FB",
    editHint: "\u30DB\u30B9\u30C8\u306E\u8FFD\u52A0\u30FB\u5909\u66F4\u306F\u3001\u8A2D\u5B9A\u753B\u9762\u306E\u300C\u62E1\u5F35\u6A5F\u80FD \u2192 homelab\u300D\u3067\u3067\u304D\u307E\u3059\u3002"
  },
  en: {
    apiError: "homelab status API error: {status}",
    daysHours: "{d}d {h}h",
    hoursMinutes: "{h}h {m}m",
    minutes: "{m}m",
    cores: (p) => p.n === 1 ? "1 core" : `${p.n} cores`,
    memory: "Memory",
    disk: "Disk",
    uptime: "Up {time}",
    guests: "VMs & containers {running}/{total} running",
    title: "Homelab status",
    openDetail: "Homelab status (show details)",
    latency: "Responds in {ms}ms",
    responding: "Responding",
    notResponding: "No response",
    noHosts: "No hosts yet. Add them in Settings under Extensions \u2192 homelab.",
    load: "Load {load}",
    memoryUsage: "Memory {used} / {total}",
    diskUsage: "Disk {used} / {total}",
    factSeparator: " \xB7 ",
    editHint: "Add or change hosts in Settings under Extensions \u2192 homelab."
  }
});
async function fetchStatus(apiBaseUrl) {
  const res = await fetch(`${apiBaseUrl}/api/ext/homelab/status`);
  if (!res.ok) throw new Error(messages2.t("apiError", { status: res.status }));
  return res.json();
}
function formatUptime(sec, t) {
  if (sec === null) return "\u2014";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor(sec % 86400 / 3600);
  const minutes = Math.floor(sec % 3600 / 60);
  if (days > 0) return t("daysHours", { d: days, h: hours });
  if (hours > 0) return t("hoursMinutes", { h: hours, m: minutes });
  return t("minutes", { m: minutes });
}
function formatBytes(bytes) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1e3) return `${(gib / 1024).toFixed(1)}TB`;
  return `${gib >= 100 ? gib.toFixed(0) : gib.toFixed(1)}GB`;
}
var ratio = (used, total) => used === null || !total ? null : Math.min(1, Math.max(0, used / total));
var levelOf = (value) => value === null ? "" : value >= 0.95 ? " homelab-usage--hot" : value >= 0.8 ? " homelab-usage--warm" : "";
var percent = (value) => value === null ? "\u2014" : `${Math.round(value * 100)}%`;
function usages(r, t) {
  return [
    { label: "CPU", value: r.cpu, detail: r.cores ? t("cores", { n: r.cores }) : void 0 },
    {
      label: t("memory"),
      value: ratio(r.memUsed, r.memTotal),
      detail: r.memUsed !== null && r.memTotal ? `${formatBytes(r.memUsed)} / ${formatBytes(r.memTotal)}` : void 0
    },
    {
      label: t("disk"),
      value: ratio(r.diskUsed, r.diskTotal),
      detail: r.diskUsed !== null && r.diskTotal ? `${formatBytes(r.diskUsed)} / ${formatBytes(r.diskTotal)}` : void 0
    }
  ];
}
function UsageBars({ resources }) {
  const t = messages2.useT();
  return /* @__PURE__ */ jsx("div", { className: "homelab-node__usage", children: usages(resources, t).map((u) => /* @__PURE__ */ jsxs("div", { className: `homelab-usage${levelOf(u.value)}`, title: u.detail, children: [
    /* @__PURE__ */ jsx("span", { className: "homelab-usage__label", children: u.label }),
    /* @__PURE__ */ jsx("span", { className: "homelab-usage__bar", "aria-hidden": "true", children: /* @__PURE__ */ jsx("span", { className: "homelab-usage__fill", style: { width: `${(u.value ?? 0) * 100}%` } }) }),
    /* @__PURE__ */ jsx("span", { className: "homelab-usage__value", children: percent(u.value) })
  ] }, u.label)) });
}
var Dot = ({ online }) => /* @__PURE__ */ jsx("span", { className: `widget-homelab__dot ${online ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}` });
function HomelabStatusView({ ctx, config, openDetail }) {
  const t = messages2.useT();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  const hosts = data?.hosts ?? [];
  if (hosts.length === 1 && hosts[0].resources) {
    const host = hosts[0];
    return /* @__PURE__ */ jsxs("button", { type: "button", className: "widget-card widget-homelab widget-homelab--single", onClick: openDetail, children: [
      /* @__PURE__ */ jsxs("span", { className: "homelab-node__head", children: [
        /* @__PURE__ */ jsx(Dot, { online: host.online }),
        /* @__PURE__ */ jsx("span", { className: "homelab-node__name", children: host.name }),
        /* @__PURE__ */ jsx("span", { className: "homelab-node__uptime", children: t("uptime", { time: formatUptime(host.resources.uptimeSec, t) }) })
      ] }),
      /* @__PURE__ */ jsx(UsageBars, { resources: host.resources }),
      host.guests && /* @__PURE__ */ jsx("span", { className: "homelab-node__guests", children: t("guests", { running: host.guests.running, total: host.guests.total }) })
    ] });
  }
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      className: "widget-card widget-homelab widget-homelab--list",
      onClick: openDetail,
      "aria-label": t("openDetail"),
      children: /* @__PURE__ */ jsxs("span", { className: "homelab-list", children: [
        /* @__PURE__ */ jsxs("span", { className: "homelab-list__head", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", { children: "CPU" }),
          /* @__PURE__ */ jsx("span", { children: t("memory") }),
          /* @__PURE__ */ jsx("span", { children: t("disk") })
        ] }),
        hosts.map((host) => /* @__PURE__ */ jsxs("span", { className: "homelab-list__row", children: [
          /* @__PURE__ */ jsxs("span", { className: "homelab-list__name", children: [
            /* @__PURE__ */ jsx(Dot, { online: host.online }),
            /* @__PURE__ */ jsx("span", { children: host.name })
          ] }),
          host.resources ? usages(host.resources, t).map((u) => /* @__PURE__ */ jsx("span", { className: `homelab-list__value${levelOf(u.value)}`, children: percent(u.value) }, u.label)) : /* @__PURE__ */ jsx("span", { className: "homelab-list__state", children: host.online ? host.latencyMs !== null ? t("latency", { ms: host.latencyMs }) : t("responding") : t("notResponding") })
        ] }, host.id))
      ] })
    }
  );
}
function HomelabStatusDetail({ ctx, config }) {
  const t = messages2.useT();
  const locale = useLocale();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  return /* @__PURE__ */ jsxs("div", { className: "widget-detail widget-homelab-detail", children: [
    /* @__PURE__ */ jsx("h2", { children: t("title") }),
    data && data.hosts.length === 0 && /* @__PURE__ */ jsx("p", { className: "homelab-detail__facts", children: t("noHosts") }),
    data?.hosts.map((host) => {
      const r = host.resources;
      return /* @__PURE__ */ jsxs("section", { className: "homelab-detail__node", children: [
        /* @__PURE__ */ jsxs("h3", { className: "homelab-node__head", children: [
          /* @__PURE__ */ jsx(Dot, { online: host.online }),
          /* @__PURE__ */ jsx("span", { className: "homelab-node__name", children: host.name }),
          /* @__PURE__ */ jsx("span", { className: "homelab-node__uptime", children: r ? t("uptime", { time: formatUptime(r.uptimeSec, t) }) : "" })
        ] }),
        r && /* @__PURE__ */ jsx(UsageBars, { resources: r }),
        /* @__PURE__ */ jsx("p", { className: "homelab-detail__facts", children: [
          textFor(TYPE_LABELS[host.type], locale),
          host.address,
          host.latencyMs !== null && t("latency", { ms: host.latencyMs }),
          r?.cores && t("cores", { n: r.cores }),
          r?.load1 !== null && r?.load1 !== void 0 && t("load", { load: r.load1.toFixed(2) }),
          r?.memTotal && t("memoryUsage", { used: formatBytes(r.memUsed ?? 0), total: formatBytes(r.memTotal) }),
          r?.diskTotal && t("diskUsage", { used: formatBytes(r.diskUsed ?? 0), total: formatBytes(r.diskTotal) }),
          host.guests && t("guests", { running: host.guests.running, total: host.guests.total })
        ].filter(Boolean).join(t("factSeparator")) }),
        host.error && /* @__PURE__ */ jsx("p", { className: "homelab-detail__error", children: host.error })
      ] }, host.id);
    }),
    data && data.hosts.length > 0 && /* @__PURE__ */ jsx("p", { className: "homelab-detail__note", children: t("editHint") })
  ] });
}
var widget_default = defineWidget({
  id: "homelab-status",
  name: { ja: "\u30DB\u30FC\u30E0\u30E9\u30DC\u7A3C\u50CD\u72B6\u6CC1", en: "Homelab status" },
  description: {
    ja: "\u767B\u9332\u3057\u305F\u6A5F\u68B0\u306E CPU\u30FB\u30E1\u30E2\u30EA\u30FB\u30C7\u30A3\u30B9\u30AF\u30FB\u9023\u7D9A\u7A3C\u50CD\u6642\u9593\u3092\u8868\u793A\u3057\u307E\u3059",
    en: "Shows CPU, memory, disk and uptime of the machines you register"
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1e3 },
  Component: HomelabStatusView,
  DetailComponent: HomelabStatusDetail
});

// extensions/homelab/src/web.tsx
var web_default = defineWebExtension({ widgets: [widget_default], SettingsPanel: HostSettings });
export {
  web_default as default
};
