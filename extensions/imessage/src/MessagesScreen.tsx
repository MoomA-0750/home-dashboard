import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Avatar,
  AvatarStack,
  ChatBubble,
  ChatComposer,
  ChatFileChips,
  ChatFrom,
  ChatHeader,
  ChatIconButton,
  ChatLayout,
  ChatLog,
  ChatMeta,
  ChatRow,
  formatClock,
  formatPastDay,
  Icon,
  List,
  ListItem,
  Message,
  Note,
  ScreenFrame,
  ScreenNotice,
  useLocale,
  usePolledResource,
  type ChatAppProps,
  type Locale,
} from "@home-dashboard/widget-sdk";
import { fetchChats, fetchMessages, fetchStatus, fileUrl, RequestError, send, upload } from "./api";
import { messages as strings } from "./i18n";
import type { AttachmentView, ChatView, MessageView, SendResult } from "./types";

/**
 * iMessage のチャット。本体の Chat 画面の中に、チャットアプリ（機能の口「chat」）として出る。画面は本体の部品（ScreenFrame・List・widget-sdk の Chat）で組み、音声アシスタントのチャットと同じ形にする（左に会話の一覧、右にやり取り）。
 * 新着は知らせが来ないので、一覧と開いている会話を15秒ごとに読み直す。
 * imsg-web の id は再起動で変わるので覚えておかない（開いている会話は、読み直したら名前で探し直す）。
 * 送った結果が「分からない」（unknown）ときは、送り直さずにそのまま伝える
 */

const POLL_MS = 15_000;
// ダッシュボードのサーバーが受け取れる大きさ（本体の拡張機能の道は 10MB まで）
const MAX_FILE_BYTES = 9.5 * 1024 * 1024;
const MAX_FILES = 10;

const formatTime = (iso: string, locale: Locale) => formatClock(new Date(iso), locale);

/** 今日でない日の言い方（本体の Chat と同じ）。昨日・6日前までは「N日前」、それより前は日付 */
const formatDay = (iso: string, locale: Locale) => formatPastDay(new Date(iso), locale) ?? formatTime(iso, locale);
const formatDayTime = (iso: string, locale: Locale) => {
  const day = formatPastDay(new Date(iso), locale);
  return day ? `${day} ${formatTime(iso, locale)}` : formatTime(iso, locale);
};

const SEND_NOTICE: Record<SendResult["state"], "sendFailed" | "sendUnknown" | "sendDryRun" | null> = {
  sent: null,
  failed: "sendFailed",
  unknown: "sendUnknown",
  dry_run: "sendDryRun",
};

type Ctx = ChatAppProps["ctx"];

/** 一覧の会話の顔。グループは写真のある人を3人まで重ねて出す（写真が1人以下なら、その人か会話の名前の頭文字） */
function ChatFaces({ ctx, chat }: { ctx: Ctx; chat: ChatView }) {
  const photos = chat.faces.filter((f): f is string => f !== null);
  if (chat.isGroup && photos.length > 1) {
    return (
      <AvatarStack>
        {photos.slice(0, 3).map((id) => (
          <Face key={id} ctx={ctx} id={id} name={chat.name} size="large" />
        ))}
      </AvatarStack>
    );
  }
  return <Face ctx={ctx} id={photos[0] ?? null} name={chat.name} size="large" />;
}

/** 顔写真。無ければ名前の頭文字 */
function Face({ ctx, id, name, size }: { ctx: Ctx; id: string | null; name: string; size?: "medium" | "large" }) {
  return <Avatar src={id ? fileUrl(ctx, "avatars", id) : null} name={name} size={size} />;
}

function Attachment({ ctx, attachment }: { ctx: Ctx; attachment: AttachmentView }) {
  const t = strings.useT();
  if (attachment.id && attachment.kind === "image") {
    const src = fileUrl(ctx, "attachments", attachment.id);
    return (
      <a className={`imsg-image${attachment.sticker ? " imsg-image--sticker" : ""}`} href={src} target="_blank" rel="noreferrer">
        <img src={src} alt={attachment.preview ? t("imagePreview") : t("image")} loading="lazy" />
      </a>
    );
  }
  if (attachment.id && attachment.kind === "audio") {
    return <audio className="imsg-audio" controls preload="none" src={fileUrl(ctx, "attachments", attachment.id)} />;
  }
  return (
    <span className="imsg-file">
      <Icon name={attachment.kind === "image" ? "image" : attachment.kind === "video" ? "play" : attachment.kind === "audio" ? "mic" : "attach"} />
      {t("viewOnDevice", { kind: t(attachment.kind) })}
    </span>
  );
}

/** 相手のメッセージに付いたリンク。http(s) だけを開けるようにする（javascript: などは載せない。読めない URL で落ちない） */
function safeLink(url: string | undefined): { href: string; hostname: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? { href: parsed.href, hostname: parsed.hostname } : null;
  } catch {
    return null;
  }
}

function Bubble({ ctx, message, mine }: { ctx: Ctx; message: MessageView; mine: boolean }) {
  const text = message.text.trim();
  const link = safeLink(message.link?.url);
  const hasBody = text || message.link || message.replyTo;
  return (
    <div className={`imsg-message${mine ? " imsg-message--mine" : ""}`}>
      {message.attachments.map((attachment, index) => (
        <Attachment key={attachment.id ?? index} ctx={ctx} attachment={attachment} />
      ))}
      {hasBody && (
        <ChatBubble mine={mine}>
          {message.replyTo && (
            <span className="imsg-quote">
              {message.replyTo.sender ? `${message.replyTo.sender}: ` : ""}
              {message.replyTo.text}
              {message.replyTo.trimmed && "…"}
            </span>
          )}
          {text}
          {message.trimmed && "…"}
          {link && (
            <a className="imsg-link" href={link.href} target="_blank" rel="noreferrer">
              <span className="imsg-link__site">{message.link!.siteName || link.hostname}</span>
              {message.link!.title && <span className="imsg-link__title">{message.link!.title}</span>}
            </a>
          )}
        </ChatBubble>
      )}
      {message.reactions.length > 0 && (
        <span className="imsg-reactions" title={message.reactions.flatMap((r) => r.senders).join("・")}>
          {message.reactions.map((r) => `${r.emoji}${r.count > 1 ? r.count : ""}`).join(" ")}
        </span>
      )}
    </div>
  );
}

/** 時刻を出すのは、まとまりの最後（次が別の人か、5分より後）だけ */
function endsGroup(messages: MessageView[], index: number): boolean {
  const current = messages[index];
  const next = messages[index + 1];
  if (!next) return true;
  if (next.isFromMe !== current.isFromMe || next.sender !== current.sender) return true;
  if (!current.createdAt || !next.createdAt) return false;
  return Date.parse(next.createdAt) - Date.parse(current.createdAt) > 5 * 60_000;
}

function NotReady({ title, switcher, children }: { title: string; switcher: ReactNode; children: ReactNode }) {
  return (
    <ScreenFrame title={{ ja: "チャット", en: "Chat" }} actions={switcher}>
      <ScreenNotice tone="error">
        {title} {children}
      </ScreenNotice>
    </ScreenFrame>
  );
}

export function MessagesScreen({ ctx, switcher }: ChatAppProps) {
  const t = strings.useT();
  const locale = useLocale();
  const status = usePolledResource(() => fetchStatus(ctx), 60_000);
  const allowed = status.data?.allowed === true;
  const configured = status.data?.configured === true;
  const chats = usePolledResource(() => fetchChats(ctx), POLL_MS, allowed && configured);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const chatList = chats.data ?? [];
  const chat = selected ? (chatList.find((c) => c.id === selected.id) ?? null) : null;

  const history = usePolledResource(
    async () => (chat ? { chatId: chat.id, messages: await fetchMessages(ctx, chat.id) } : null),
    POLL_MS,
    Boolean(chat),
  );
  // 前の会話のやり取りを一瞬でも出さない
  const messages = history.data && chat && history.data.chatId === chat.id ? history.data.messages : null;

  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 広い画面では、最初は一覧のいちばん上の会話を開いておく
  useEffect(() => {
    if (!selected && chatList.length > 0 && window.matchMedia("(min-width: 1101px)").matches) {
      setSelected({ id: chatList[0].id, name: chatList[0].name });
    }
  }, [selected, chatList]);

  // id が変わった（imsg-web が再起動した）ら、同じ名前の会話を開き直す
  useEffect(() => {
    if (!selected || chats.data === null || chat) return;
    const same = chatList.find((c) => c.name === selected.name);
    setSelected(same ? { id: same.id, name: same.name } : null);
  }, [selected, chat, chats.data, chatList]);

  useEffect(() => {
    if (chat) void history.refresh();
    // 会話を開いたときだけ読む（そのあとは15秒ごと）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  // 古い id で読んだ（409）ら、一覧から読み直す
  useEffect(() => {
    if (history.error instanceof RequestError && history.error.status === 409) void chats.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.error]);

  const lastId = messages?.at(-1)?.id;

  if (status.data && !allowed) {
    return <NotReady title={t("notAllowedTitle")} switcher={switcher}>{t("notAllowedBody")}</NotReady>;
  }
  if (status.data && !configured) {
    return (
      <NotReady title={t("notConfiguredTitle")} switcher={switcher}>
        {t("notConfiguredBody")}
      </NotReady>
    );
  }

  const canSend = status.data?.canSend === true;
  const ready = Boolean(chat) && canSend && !sending;
  const connectionError =
    status.data?.error ?? (chats.error instanceof Error ? chats.error.message : chats.error ? String(chats.error) : null);

  const openChat = (c: ChatView) => {
    setSelected({ id: c.id, name: c.name });
    setListOpen(false);
    setNotice(null);
    setText("");
    setFiles([]);
  };

  const addFiles = (picked: FileList | null) => {
    const list = Array.from(picked ?? []);
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES);
    const next = [...files, ...list.filter((f) => f.size <= MAX_FILE_BYTES)].slice(0, MAX_FILES);
    setFiles(next);
    setNotice(tooBig.length ? { tone: "error", text: t("tooBig", { names: tooBig.map((f) => f.name).join(t("nameSeparator")) }) } : null);
  };

  const handleSubmit = () => {
    const message = text.trim();
    if (!chat || (!message && files.length === 0) || !ready) return;
    setSending(true);
    setNotice(null);
    void (async () => {
      try {
        const uploadIds: string[] = [];
        for (const file of files) uploadIds.push((await upload(ctx, file)).uploadId);
        const result = await send(ctx, { chatId: chat.id, ...(message ? { text: message } : {}), uploadIds });
        const noteKey = SEND_NOTICE[result.state];
        const note = noteKey ? t(noteKey) : null;
        // 送れた・分からない・試しのときは、同じものを二重に送らないよう入力を空にする（失敗のときだけ残す）
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

  const placeholder = !chat
    ? t("chooseChat")
    : !status.data
      ? t("loading")
      : !canSend
        ? t("readOnlyPlaceholder")
        : t("messageTo", { name: chat.name });

  const list =
    chats.data === null ? (
      <Note>{chats.error ? t("loadFailed") : t("loading")}</Note>
    ) : chatList.length === 0 ? (
      <Note>{t("noChats")}</Note>
    ) : (
      <List label={t("chats")}>
        {chatList.map((c) => {
          const unread = c.unreadCount ?? 0;
          const when = c.lastMessageAt ? formatDay(c.lastMessageAt, locale) : "";
          return (
            <ListItem
              key={c.id}
              title={c.name}
              badge={[when, unread > 0 ? t("unread", { n: unread > 99 ? "99+" : unread }) : ""].filter(Boolean).join(t("nameSeparator")) || undefined}
              detail={c.preview ? `${c.preview.fromMe ? t("me") : ""}${c.preview.text}` : "\u00a0"}
              leading={<ChatFaces ctx={ctx} chat={c} />}
              selected={c.id === chat?.id}
              onClick={() => openChat(c)}
            />
          );
        })}
      </List>
    );

  return (
    <ScreenFrame title={{ ja: "チャット", en: "Chat" }} actions={switcher} fill>
      <ChatLayout list={list} listOpen={listOpen} onCloseList={() => setListOpen(false)}>
        <ChatHeader
          title={chat?.name ?? "iMessage"}
          ok={!connectionError}
          status={
            connectionError ??
            (status.data?.dryRun
              ? t("dryRunStatus")
              : canSend
                ? t("polling")
                : t("readOnlyPolling"))
          }
          onOpenList={() => setListOpen(true)}
        />

        <ChatLog
          scrollKey={`${chat?.id}:${lastId}`}
          empty={
            !chat
              ? t("chooseChat")
              : messages === null
                ? history.error instanceof Error
                  ? history.error.message
                  : t("loadingHistory")
                : messages.length === 0
                  ? t("noMessages")
                  : undefined
          }
        >
          {chat &&
            messages?.map((message, index) => {
              const mine = message.isFromMe;
              const previous = messages[index - 1];
              const startsGroup = !previous || previous.isFromMe !== message.isFromMe || previous.sender !== message.sender;
              const last = endsGroup(messages, index);
              return (
                <ChatRow key={message.id} mine={mine} gap={last}>
                  {!mine && chat.isGroup && startsGroup && message.sender && (
                    <span className="ui-chat__meta ui-chat__meta--indent">{message.sender}</span>
                  )}
                  {mine ? (
                    <Bubble ctx={ctx} message={message} mine />
                  ) : (
                    <ChatFrom avatar={last ? <Face ctx={ctx} id={message.avatarId} name={message.sender ?? chat.name} /> : null}>
                      <Bubble ctx={ctx} message={message} mine={false} />
                    </ChatFrom>
                  )}
                  {last && message.createdAt && <ChatMeta>{formatDayTime(message.createdAt, locale)}</ChatMeta>}
                </ChatRow>
              );
            })}
        </ChatLog>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <ChatComposer
          value={text}
          onChange={setText}
          onSubmit={handleSubmit}
          inputRef={inputRef}
          label={t("composerLabel")}
          placeholder={placeholder}
          disabled={!chat || !canSend}
          canSubmit={ready && Boolean(text.trim() || files.length > 0)}
          submitWithoutText={files.length > 0}
          leading={
            <ChatIconButton
              icon="attach"
              label={t("attach")}
              disabled={!ready || files.length >= MAX_FILES}
              onClick={() => fileRef.current?.click()}
            />
          }
          above={
            <>
              {notice && <Message tone={notice.tone === "error" ? "error" : "ok"}>{notice.text}</Message>}
              <ChatFileChips files={files} onRemove={(index) => setFiles(files.filter((_, i) => i !== index))} />
            </>
          }
        />
      </ChatLayout>
    </ScreenFrame>
  );
}
