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

// extensions/imessage/src/i18n.ts
var messages = defineMessages({
  ja: {
    requestFailed: "\u3046\u307E\u304F\u3044\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08{status}\uFF09",
    sendFailed: "\u9001\u308C\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u9001\u308B\u524D\u306B\u6B62\u307E\u308A\u307E\u3057\u305F\uFF09\u3002\u3082\u3046\u4E00\u5EA6\u9001\u308C\u307E\u3059",
    sendUnknown: "\u9001\u308C\u305F\u304B\u5206\u304B\u308A\u307E\u305B\u3093\u3002iPhone \u304B Mac \u306E\u300C\u30E1\u30C3\u30BB\u30FC\u30B8\u300D\u3067\u78BA\u304B\u3081\u3066\u304B\u3089\u3001\u5FC5\u8981\u306A\u3089\u9001\u308A\u76F4\u3057\u3066\u304F\u3060\u3055\u3044",
    sendDryRun: "imsg-web \u304C\u8A66\u3057\u306E\u8A2D\u5B9A\uFF08dry-run\uFF09\u306A\u306E\u3067\u3001\u5B9F\u969B\u306B\u306F\u9001\u3063\u3066\u3044\u307E\u305B\u3093",
    image: "\u753B\u50CF",
    audio: "\u9332\u97F3",
    video: "\u52D5\u753B",
    file: "\u30D5\u30A1\u30A4\u30EB",
    imagePreview: "\u753B\u50CF\uFF08\u7E2E\u5C0F\u7248\uFF09",
    viewOnDevice: "{kind}\uFF08iPhone \u304B Mac \u3067\u898B\u3089\u308C\u307E\u3059\uFF09",
    notAllowedTitle: "\u3053\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3067\u306F\u898B\u3089\u308C\u307E\u305B\u3093\u3002",
    notAllowedBody: "iMessage \u306E\u4F1A\u8A71\u306F\u3001\u7BA1\u7406\u8005\u304C\u8A31\u3057\u305F\u30A2\u30AB\u30A6\u30F3\u30C8\u306B\u3060\u3051\u51FA\u3057\u307E\u3059\u3002",
    notConfiguredTitle: "imsg-web \u306B\u3064\u306A\u3044\u3067\u3044\u307E\u305B\u3093\u3002",
    notConfiguredBody: "\u8A2D\u5B9A \u2192 \u62E1\u5F35\u6A5F\u80FD \u2192 iMessage \u306E\u63A5\u7D9A\u8A2D\u5B9A\u306B\u3001imsg-web \u306E URL\u30FB\u30C8\u30FC\u30AF\u30F3\u30FB\u8A3C\u660E\u66F8\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044\u3002",
    tooBig: "{names} \u306F\u5927\u304D\u3059\u304E\u307E\u3059\uFF089MB \u307E\u3067\uFF09",
    nameSeparator: "\u30FB",
    chooseChat: "\u4F1A\u8A71\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044",
    loading: "\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    readOnlyPlaceholder: "\u8AAD\u3080\u3060\u3051\u306E\u30C8\u30FC\u30AF\u30F3\u306A\u306E\u3067\u9001\u308C\u307E\u305B\u3093",
    messageTo: "{name}\u3078\u306E\u30E1\u30C3\u30BB\u30FC\u30B8",
    loadFailed: "\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
    noChats: "\u4F1A\u8A71\u306F\u3042\u308A\u307E\u305B\u3093",
    chats: "\u4F1A\u8A71",
    unread: "\u672A\u8AAD {n}",
    me: "\u81EA\u5206: ",
    dryRunStatus: "\u8A66\u3057\u306E\u8A2D\u5B9A\uFF08\u9001\u3063\u3066\u3082\u5B9F\u969B\u306B\u306F\u5C4A\u304D\u307E\u305B\u3093\uFF09",
    polling: "15\u79D2\u3054\u3068\u306B\u65B0\u7740\u3092\u898B\u3066\u3044\u307E\u3059",
    readOnlyPolling: "\u8AAD\u3080\u3060\u3051\uFF0815\u79D2\u3054\u3068\u306B\u65B0\u7740\u3092\u898B\u3066\u3044\u307E\u3059\uFF09",
    loadingHistory: "\u3084\u308A\u53D6\u308A\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026",
    noMessages: "\u3084\u308A\u53D6\u308A\u306F\u3042\u308A\u307E\u305B\u3093",
    composerLabel: "iMessage \u306E\u30E1\u30C3\u30BB\u30FC\u30B8",
    attach: "\u753B\u50CF\u306A\u3069\u3092\u6DFB\u3048\u308B"
  },
  en: {
    requestFailed: "Something went wrong ({status})",
    sendFailed: "Couldn't send (it stopped before sending). You can send it again",
    sendUnknown: "Not sure whether it was sent. Check Messages on your iPhone or Mac, and resend if needed",
    sendDryRun: "imsg-web is in dry-run mode, so nothing was actually sent",
    image: "Image",
    audio: "Audio",
    video: "Video",
    file: "File",
    imagePreview: "Image (preview)",
    viewOnDevice: "{kind} (view it on your iPhone or Mac)",
    notAllowedTitle: "This account can't view this.",
    notAllowedBody: "iMessage conversations are only shown to accounts an admin has allowed.",
    notConfiguredTitle: "Not connected to imsg-web.",
    notConfiguredBody: "Enter the imsg-web URL, token, and certificate in Settings \u2192 Extensions \u2192 iMessage connection settings.",
    tooBig: "{names} is too large (9 MB max)",
    nameSeparator: ", ",
    chooseChat: "Choose a conversation",
    loading: "Loading\u2026",
    readOnlyPlaceholder: "Read-only token; can't send",
    messageTo: "Message to {name}",
    loadFailed: "Couldn't load",
    noChats: "No conversations",
    chats: "Conversations",
    unread: "{n} unread",
    me: "You: ",
    dryRunStatus: "Dry-run mode (messages won't actually be delivered)",
    polling: "Checking for new messages every 15 seconds",
    readOnlyPolling: "Read-only (checking for new messages every 15 seconds)",
    loadingHistory: "Loading messages\u2026",
    noMessages: "No messages",
    composerLabel: "iMessage message",
    attach: "Attach images and more"
  }
});

// extensions/imessage/src/api.ts
var RequestError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
async function request(ctx, path, init) {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "imessage", path), {
    ...rest,
    headers: json !== void 0 ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== void 0 ? JSON.stringify(json) : rest.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(body.error ?? messages.t("requestFailed", { status: res.status }), res.status);
  return body;
}
var fetchStatus = (ctx) => request(ctx, "/status");
var fetchChats = async (ctx) => (await request(ctx, "/chats")).chats;
var fetchMessages = async (ctx, chatId) => (await request(ctx, `/chats/${encodeURIComponent(chatId)}/messages`)).messages;
var fileUrl = (ctx, kind, id) => extensionApiUrl(ctx, "imessage", `/${kind}/${encodeURIComponent(id)}`);
var upload = (ctx, file) => request(ctx, `/uploads?name=${encodeURIComponent(file.name)}`, {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream" },
  body: file
});
var send = (ctx, input) => request(ctx, "/send", { method: "POST", json: input });

// host-module:react/jsx-runtime
var m3 = globalThis.__homeDashboard?.modules?.["react/jsx-runtime"];
if (!m3) throw new Error("\u672C\u4F53\u306E react/jsx-runtime \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var jsx_runtime_default = m3.default ?? m3;
var { Fragment: Fragment2, jsx, jsxs } = m3;

// extensions/imessage/src/MessagesScreen.tsx
var POLL_MS = 15e3;
var MAX_FILE_BYTES = 9.5 * 1024 * 1024;
var MAX_FILES = 10;
var formatTime2 = (iso, locale) => formatClock(new Date(iso), locale);
var formatDay = (iso, locale) => formatPastDay(new Date(iso), locale) ?? formatTime2(iso, locale);
var formatDayTime = (iso, locale) => {
  const day = formatPastDay(new Date(iso), locale);
  return day ? `${day} ${formatTime2(iso, locale)}` : formatTime2(iso, locale);
};
var SEND_NOTICE = {
  sent: null,
  failed: "sendFailed",
  unknown: "sendUnknown",
  dry_run: "sendDryRun"
};
function ChatFaces({ ctx, chat }) {
  const photos = chat.faces.filter((f) => f !== null);
  if (chat.isGroup && photos.length > 1) {
    return /* @__PURE__ */ jsx(AvatarStack, { children: photos.slice(0, 3).map((id) => /* @__PURE__ */ jsx(Face, { ctx, id, name: chat.name, size: "large" }, id)) });
  }
  return /* @__PURE__ */ jsx(Face, { ctx, id: photos[0] ?? null, name: chat.name, size: "large" });
}
function Face({ ctx, id, name, size }) {
  return /* @__PURE__ */ jsx(Avatar, { src: id ? fileUrl(ctx, "avatars", id) : null, name, size });
}
function Attachment({ ctx, attachment }) {
  const t = messages.useT();
  if (attachment.id && attachment.kind === "image") {
    const src = fileUrl(ctx, "attachments", attachment.id);
    const alt = attachment.preview ? t("imagePreview") : t("image");
    if (!attachment.sticker) return /* @__PURE__ */ jsx(ChatImage, { src, alt });
    return /* @__PURE__ */ jsx("a", { className: "block", href: src, target: "_blank", rel: "noreferrer", children: /* @__PURE__ */ jsx("img", { className: "block max-h-30 max-w-30", src, alt, loading: "lazy" }) });
  }
  if (attachment.id && attachment.kind === "audio") {
    return /* @__PURE__ */ jsx("audio", { className: "w-75 max-w-full", controls: true, preload: "none", src: fileUrl(ctx, "attachments", attachment.id) });
  }
  return /* @__PURE__ */ jsx(
    ChatFile,
    {
      icon: attachment.kind === "image" ? "image" : attachment.kind === "video" ? "play" : attachment.kind === "audio" ? "mic" : "attach",
      name: t("viewOnDevice", { kind: t(attachment.kind) })
    }
  );
}
function safeLink(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? { href: parsed.href, hostname: parsed.hostname } : null;
  } catch {
    return null;
  }
}
function Bubble({ ctx, message, mine }) {
  const text = message.text.trim();
  const link = safeLink(message.link?.url);
  const hasBody = text || message.link || message.replyTo;
  return (
    // 1通の中身（画像・録音・吹き出し・リアクション）を縦に並べる。相手のものは ChatFrom の中なので幅いっぱい
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: cx(
          "flex min-w-0 flex-col gap-1 [&>*]:max-w-full",
          mine ? "max-w-4/5 items-end self-end" : "max-w-full items-start"
        ),
        children: [
          message.attachments.map((attachment, index) => /* @__PURE__ */ jsx(Attachment, { ctx, attachment }, attachment.id ?? index)),
          hasBody && /* @__PURE__ */ jsxs(ChatBubble, { mine, children: [
            message.replyTo && // 返信先の引用。吹き出しの中の上に、薄く1〜2行
            /* @__PURE__ */ jsxs("span", { className: "untrim mb-1 line-clamp-2 border-l-2 border-line pl-2.5 text-note leading-normal text-muted", children: [
              message.replyTo.sender ? `${message.replyTo.sender}: ` : "",
              message.replyTo.text,
              message.replyTo.trimmed && "\u2026"
            ] }),
            text,
            message.trimmed && "\u2026",
            link && /* @__PURE__ */ jsxs(
              "a",
              {
                className: "mt-1.5 flex flex-col gap-1 rounded-inner bg-tint/10 px-2.5 py-1.5 leading-tight text-current no-underline",
                href: link.href,
                target: "_blank",
                rel: "noreferrer",
                children: [
                  /* @__PURE__ */ jsx("span", { className: "untrim text-caption text-muted", children: message.link.siteName || link.hostname }),
                  message.link.title && /* @__PURE__ */ jsx("span", { className: "untrim text-label font-semibold", children: message.link.title })
                ]
              }
            )
          ] }),
          message.reactions.length > 0 && /* @__PURE__ */ jsx("span", { className: "untrim text-note leading-tight", title: message.reactions.flatMap((r) => r.senders).join("\u30FB"), children: message.reactions.map((r) => `${r.emoji}${r.count > 1 ? r.count : ""}`).join(" ") })
        ]
      }
    )
  );
}
function endsGroup(messages2, index) {
  const current = messages2[index];
  const next = messages2[index + 1];
  if (!next) return true;
  if (next.isFromMe !== current.isFromMe || next.sender !== current.sender) return true;
  if (!current.createdAt || !next.createdAt) return false;
  return Date.parse(next.createdAt) - Date.parse(current.createdAt) > 5 * 6e4;
}
function NotReady({ title, switcher, children }) {
  return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "\u30C1\u30E3\u30C3\u30C8", en: "Chat" }, actions: switcher, children: /* @__PURE__ */ jsxs(ScreenNotice, { tone: "error", children: [
    title,
    " ",
    children
  ] }) });
}
function MessagesScreen({ ctx, switcher }) {
  const t = messages.useT();
  const locale = useLocale();
  const status = usePolledResource(() => fetchStatus(ctx), 6e4);
  const allowed = status.data?.allowed === true;
  const configured = status.data?.configured === true;
  const chats = usePolledResource(() => fetchChats(ctx), POLL_MS, allowed && configured);
  const [selected, setSelected] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const chatList = chats.data ?? [];
  const chat = selected ? chatList.find((c) => c.id === selected.id) ?? null : null;
  const history = usePolledResource(
    async () => chat ? { chatId: chat.id, messages: await fetchMessages(ctx, chat.id) } : null,
    POLL_MS,
    Boolean(chat)
  );
  const messages2 = history.data && chat && history.data.chatId === chat.id ? history.data.messages : null;
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!selected && chatList.length > 0 && window.matchMedia("(min-width: 1101px)").matches) {
      setSelected({ id: chatList[0].id, name: chatList[0].name });
    }
  }, [selected, chatList]);
  useEffect(() => {
    if (!selected || chats.data === null || chat) return;
    const same = chatList.find((c) => c.name === selected.name);
    setSelected(same ? { id: same.id, name: same.name } : null);
  }, [selected, chat, chats.data, chatList]);
  useEffect(() => {
    if (chat) void history.refresh();
  }, [chat?.id]);
  useEffect(() => {
    if (history.error instanceof RequestError && history.error.status === 409) void chats.refresh();
  }, [history.error]);
  const lastId = messages2?.at(-1)?.id;
  if (status.data && !allowed) {
    return /* @__PURE__ */ jsx(NotReady, { title: t("notAllowedTitle"), switcher, children: t("notAllowedBody") });
  }
  if (status.data && !configured) {
    return /* @__PURE__ */ jsx(NotReady, { title: t("notConfiguredTitle"), switcher, children: t("notConfiguredBody") });
  }
  const canSend = status.data?.canSend === true;
  const ready = Boolean(chat) && canSend && !sending;
  const connectionError = status.data?.error ?? (chats.error instanceof Error ? chats.error.message : chats.error ? String(chats.error) : null);
  const openChat = (c) => {
    setSelected({ id: c.id, name: c.name });
    setListOpen(false);
    setNotice(null);
    setText("");
    setFiles([]);
  };
  const addFiles = (picked) => {
    const list2 = Array.from(picked ?? []);
    const tooBig = list2.filter((f) => f.size > MAX_FILE_BYTES);
    const next = [...files, ...list2.filter((f) => f.size <= MAX_FILE_BYTES)].slice(0, MAX_FILES);
    setFiles(next);
    setNotice(tooBig.length ? { tone: "error", text: t("tooBig", { names: tooBig.map((f) => f.name).join(t("nameSeparator")) }) } : null);
  };
  const handleSubmit = () => {
    const message = text.trim();
    if (!chat || !message && files.length === 0 || !ready) return;
    setSending(true);
    setNotice(null);
    void (async () => {
      try {
        const uploadIds = [];
        for (const file of files) uploadIds.push((await upload(ctx, file)).uploadId);
        const result = await send(ctx, { chatId: chat.id, ...message ? { text: message } : {}, uploadIds });
        const noteKey = SEND_NOTICE[result.state];
        const note = noteKey ? t(noteKey) : null;
        if (result.state !== "failed") {
          setText("");
          setFiles([]);
        }
        if (note) setNotice({ tone: result.state === "dry_run" ? "info" : "error", text: note });
        await Promise.all([history.refresh(), chats.refresh()]);
      } catch (err) {
        setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err) });
        if (err instanceof RequestError && err.status === 409) void chats.refresh();
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    })();
  };
  const placeholder = !chat ? t("chooseChat") : !status.data ? t("loading") : !canSend ? t("readOnlyPlaceholder") : t("messageTo", { name: chat.name });
  const list = chats.data === null ? /* @__PURE__ */ jsx(Note, { children: chats.error ? t("loadFailed") : t("loading") }) : chatList.length === 0 ? /* @__PURE__ */ jsx(Note, { children: t("noChats") }) : /* @__PURE__ */ jsx(List, { label: t("chats"), children: chatList.map((c) => {
    const unread = c.unreadCount ?? 0;
    const when = c.lastMessageAt ? formatDay(c.lastMessageAt, locale) : "";
    return /* @__PURE__ */ jsx(
      ListItem,
      {
        title: c.name,
        badge: [when, unread > 0 ? t("unread", { n: unread > 99 ? "99+" : unread }) : ""].filter(Boolean).join(t("nameSeparator")) || void 0,
        detail: c.preview ? `${c.preview.fromMe ? t("me") : ""}${c.preview.text}` : "\xA0",
        leading: /* @__PURE__ */ jsx(ChatFaces, { ctx, chat: c }),
        selected: c.id === chat?.id,
        onClick: () => openChat(c)
      },
      c.id
    );
  }) });
  return /* @__PURE__ */ jsx(ScreenFrame, { title: { ja: "\u30C1\u30E3\u30C3\u30C8", en: "Chat" }, actions: switcher, fill: true, children: /* @__PURE__ */ jsxs(ChatLayout, { list, listOpen, onCloseList: () => setListOpen(false), children: [
    /* @__PURE__ */ jsx(
      ChatHeader,
      {
        title: chat?.name ?? "iMessage",
        ok: !connectionError,
        status: connectionError ?? (status.data?.dryRun ? t("dryRunStatus") : canSend ? t("polling") : t("readOnlyPolling")),
        onOpenList: () => setListOpen(true)
      }
    ),
    /* @__PURE__ */ jsx(
      ChatLog,
      {
        scrollKey: `${chat?.id}:${lastId}`,
        empty: !chat ? t("chooseChat") : messages2 === null ? history.error instanceof Error ? history.error.message : t("loadingHistory") : messages2.length === 0 ? t("noMessages") : void 0,
        children: chat && messages2?.map((message, index) => {
          const mine = message.isFromMe;
          const previous = messages2[index - 1];
          const startsGroup = !previous || previous.isFromMe !== message.isFromMe || previous.sender !== message.sender;
          const last = endsGroup(messages2, index);
          return /* @__PURE__ */ jsxs(ChatRow, { mine, gap: last, children: [
            !mine && chat.isGroup && startsGroup && message.sender && /* @__PURE__ */ jsx("div", { className: "pl-10", children: /* @__PURE__ */ jsx(ChatMeta, { children: message.sender }) }),
            mine ? /* @__PURE__ */ jsx(Bubble, { ctx, message, mine: true }) : /* @__PURE__ */ jsx(ChatFrom, { avatar: last ? /* @__PURE__ */ jsx(Face, { ctx, id: message.avatarId, name: message.sender ?? chat.name }) : null, children: /* @__PURE__ */ jsx(Bubble, { ctx, message, mine: false }) }),
            last && message.createdAt && /* @__PURE__ */ jsx(ChatMeta, { children: formatDayTime(message.createdAt, locale) })
          ] }, message.id);
        })
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: fileRef,
        type: "file",
        accept: "image/*,audio/*,video/*",
        multiple: true,
        hidden: true,
        onChange: (event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }
      }
    ),
    /* @__PURE__ */ jsx(
      ChatComposer,
      {
        value: text,
        onChange: setText,
        onSubmit: handleSubmit,
        inputRef,
        label: t("composerLabel"),
        placeholder,
        disabled: !chat || !canSend,
        canSubmit: ready && Boolean(text.trim() || files.length > 0),
        submitWithoutText: files.length > 0,
        leading: /* @__PURE__ */ jsx(
          ChatIconButton,
          {
            icon: "attach",
            label: t("attach"),
            disabled: !ready || files.length >= MAX_FILES,
            onClick: () => fileRef.current?.click()
          }
        ),
        above: /* @__PURE__ */ jsxs(Fragment2, { children: [
          notice && /* @__PURE__ */ jsx(Message, { tone: notice.tone === "error" ? "error" : "ok", children: notice.text }),
          /* @__PURE__ */ jsx(ChatFileChips, { files, onRemove: (index) => setFiles(files.filter((_, i) => i !== index)) })
        ] })
      }
    )
  ] }) });
}

// extensions/imessage/src/web.tsx
var web_default = defineWebExtension({
  provides: { chat: { name: "iMessage", order: 20, Component: MessagesScreen } }
});
export {
  web_default as default
};
