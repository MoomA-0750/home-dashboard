import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button,
  ButtonRow,
  cx,
  defineMessages,
  Field,
  Group,
  Icon,
  List,
  ListItem,
  Message,
  NarrowOnly,
  Note,
  PillMenu,
  ScreenFrame,
  ScreenNotice,
  SectionTitle,
  SideLayout,
  showSnackbar,
  useLocale,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import {
  fetchFolders,
  fetchMailboxes,
  fetchMessage,
  fetchMessages,
  mailDate,
  moveMessage,
  senderName,
  sendMail,
  setRead,
} from "./client";
import { FOLDER_ICONS, folderMessages, MailFolders, type FolderChoice } from "./MailFolders";
import { MAIL_FOLDERS, type FolderKey, type Mailbox, type MailFolder, type MailMessage, type MailSummary, type SourceError } from "./types";
import { fetchCached, forgetCached, useCached } from "../swr";
import { commonMessages } from "../webMessages";

/**
 * Mail 画面。右上でアカウント（受信箱）を選び、左の欄でフォルダー（受信箱・送信済み・迷惑メールなど）と自分で作った
 * メールボックス（ツリー）を選ぶ。狭い画面ではフォルダーも右上のメニューで。右にメールの一覧。開いたメール（返信・既読と未読・
 * 移動・迷惑メール・削除）は、とても広い画面では一覧の右に、そうでなければ一覧の代わりに出す。「選ぶ」で何通かまとめて操作する。
 * 開いたメールは既読にする。送るのは、送る前にもう一度押して確かめてから。
 *
 * 読んだものは画面でも覚えておき（../swr）、開き直したとき・フォルダーを戻したときはすぐ出して裏で読み直す。
 * 一覧が出たら、ほかのフォルダーと上の方のメールの本文を、1つずつ裏で先読みする
 */

const screenMessages = defineMessages({
  ja: {
    allInboxes: "すべての受信箱",
    chooseInbox: "受信箱を選ぶ",
    chooseFolder: "フォルダーを選ぶ",
    unreadCount: "未読 {n}",
    showAll: "すべて出す",
    unreadOnly: "未読だけ",
    newMail: "新しいメール",
    noInboxes: "受信箱がありません。設定の「アカウント → インターネットアカウント」で Google・iCloud などを足すと、ここにメールが出ます。",
    noUnreadMail: "未読のメールはありません",
    noMail: "メールはありません",
    mail: "メール",
    unread: "未読",
    address: "（{address}）",
    to: " · 宛先: {people}",
    cc: " · CC: {people}",
    toPeople: "宛先: {people}",
    peopleSeparator: "、",
    noBody: "（本文なし）",
    reply: "返信",
    markUnread: "未読にする",
    markRead: "既読にする",
    move: "移動",
    moveTo: "移す先を選ぶ",
    junk: "迷惑メール",
    notJunk: "迷惑メールではない",
    delete: "削除",
    restore: "受信箱に戻す",
    select: "選ぶ",
    selectDone: "やめる",
    selectAll: "すべて選ぶ",
    selected: "{n}通を選択",
    choose: "{subject}を選ぶ",
    sent: "送りました: {subject}",
    moved: "{n}通を「{folder}」へ移しました",
    markedRead: "{n}通を既読にしました",
    markedUnread: "{n}通を未読にしました",
    from: "差出人",
    toLabel: "宛先",
    toHint: "いくつかなら、カンマで区切る",
    subject: "件名",
    body: "本文",
    confirm: "宛先: {to} — よければもう一度「送る」を押してください。",
    sending: "送っています…",
    sendConfirmed: "送る（確かめた）",
    send: "送る",
  },
  en: {
    allInboxes: "All inboxes",
    chooseInbox: "Choose inbox",
    chooseFolder: "Choose folder",
    unreadCount: "{n} unread",
    showAll: "Show all",
    unreadOnly: "Unread only",
    newMail: "New email",
    noInboxes: "No inboxes. Add Google, iCloud, or other accounts in Settings → Accounts → Internet Accounts to see mail here.",
    noUnreadMail: "No unread mail",
    noMail: "No mail",
    mail: "Mail",
    unread: "Unread",
    address: " ({address})",
    to: " · To: {people}",
    cc: " · CC: {people}",
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
    moved: "Moved {n} to “{folder}”",
    markedRead: "Marked {n} as read",
    markedUnread: "Marked {n} as unread",
    from: "From",
    toLabel: "To",
    toHint: "Separate multiple addresses with commas",
    subject: "Subject",
    body: "Message",
    confirm: "To: {to} — if this looks right, press “Send” again.",
    sending: "Sending…",
    sendConfirmed: "Send (confirmed)",
    send: "Send",
  },
});

const LIST_LIMIT = 40;
const REFRESH_MS = 2 * 60 * 1000;
// 先読みしたものは、この間はもう一度読まない
const PREFETCH_MAX_AGE_MS = 5 * 60 * 1000;
// 先読みする本文の数（上から）
const PREFETCH_BODIES = 6;

const listKey = (target: string | null, folder: FolderKey, unread: boolean) => `mail:list:${target ?? "*"}:${folder}:${unread}`;
const messageKey = (id: string) => `mail:message:${id}`;

type Pane = { kind: "read"; id: string } | { kind: "compose"; replyTo: MailMessage | null } | null;

/** 操作をすぐ見せる（読み直しが届くまで）。移したメールは隠し、既読・未読は塗り替える */
interface LocalChanges {
  gone: Set<string>;
  read: Map<string, boolean>;
}
const NO_CHANGES: LocalChanges = { gone: new Set(), read: new Map() };

export function MailScreen({ ctx }: ScreenProps) {
  const t = screenMessages.useT();
  const tf = folderMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [mailbox, setMailbox] = useState<string | null>(null);
  // 読むフォルダー。自分で作ったメールボックスなら、そのアカウント（すべての受信箱から選んだときも、そのアカウントだけを読む）
  const [folder, setFolder] = useState<FolderChoice>({ key: "inbox", mailboxId: null });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pane, setPane] = useState<Pane>(null);
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [local, setLocal] = useState<LocalChanges>(NO_CHANGES);

  const target = folder.mailboxId ?? mailbox;
  const boxes = useCached("mail:mailboxes", () => fetchMailboxes(ctx), REFRESH_MS);
  const folderList = useCached(`mail:folders:${mailbox ?? "*"}`, () => fetchFolders(ctx, mailbox));
  const readList = (key: FolderKey, unread: boolean) =>
    fetchMessages(ctx, { mailbox: target ?? undefined, unread, limit: LIST_LIMIT, folder: key });
  const list = useCached(listKey(target, folder.key, unreadOnly), () => readList(folder.key, unreadOnly), REFRESH_MS);

  const mailboxes: Mailbox[] = boxes.data?.mailboxes ?? [];
  const folders = folderList.data?.folders ?? [];
  // 新しい一覧が届いたら、すぐ見せていた操作の結果はそちらに任せる
  useEffect(() => setLocal(NO_CHANGES), [list.data]);

  // 一覧が出たら、ほかのフォルダーと上の方のメールの本文を、1つずつ裏で先読みする（外のサービスへ一度にたくさん頼まない）
  useEffect(() => {
    const shown = list.data?.messages;
    if (!shown) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const tasks: [string, () => Promise<unknown>][] = [
        ...shown.slice(0, PREFETCH_BODIES).map((m): [string, () => Promise<unknown>] => [messageKey(m.id), () => fetchMessage(ctx, m.id)]),
        ...MAIL_FOLDERS.filter((f) => f !== folder.key).map((f): [string, () => Promise<unknown>] => [
          listKey(target, f, false),
          () => readList(f, false),
        ]),
      ];
      for (const [key, load] of tasks) {
        if (cancelled) return;
        // 覚えていれば読まずに次へ。失敗しても次へ
        await fetchCached(key, load, PREFETCH_MAX_AGE_MS).catch(() => undefined);
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  const messages = list.data?.messages
    .filter((m) => !local.gone.has(m.id))
    .map((m) => (local.read.has(m.id) ? { ...m, unread: !local.read.get(m.id) } : m));
  const errors = useMemo(() => {
    const seen = new Set<string>();
    return [...(boxes.data?.errors ?? []), ...(list.data?.errors ?? [])].filter((e: SourceError) => !seen.has(e.source) && seen.add(e.source));
  }, [boxes.data, list.data]);
  const failure = list.error ?? boxes.error;

  const current = mailboxes.find((m) => m.id === mailbox) ?? null;
  const unreadTotal = mailboxes.reduce((sum, m) => sum + m.unread, 0);
  const mailboxName = (id: string) => mailboxes.find((m) => m.id === id)?.name ?? "";
  const folderName = (key: FolderKey) =>
    (MAIL_FOLDERS as string[]).includes(key) ? tf(`folder_${key as MailFolder}`) : (folders.find((f) => f.id === key)?.path.join(" / ") ?? key);
  // 送信済み・下書きでは、差出人（自分）の代わりに宛先を出す
  const outgoing = folder.key === "sent" || folder.key === "drafts";
  const people = (list: MailSummary["to"]) => (list ?? []).map((a) => a.name || a.address).join(t("peopleSeparator"));

  const resetView = () => {
    setPane(null);
    setChosen(new Set());
    setSelecting(false);
  };
  const chooseMailbox = (id: string | null) => {
    setMailbox(id);
    // 自分で作ったメールボックスはアカウントごとなので、アカウントを変えたら受信箱に戻す
    if (folder.mailboxId !== null) setFolder({ key: "inbox", mailboxId: null });
    resetView();
  };
  const chooseFolder = (next: FolderChoice) => {
    setFolder(next);
    resetView();
  };

  /** 変えたあと: 覚えた一覧と未読の数を捨てて読み直す（今の一覧は、新しいものが届くまで出したまま） */
  const afterChange = () => {
    forgetCached("mail:list:");
    forgetCached("mail:mailboxes");
    void list.reload();
    void boxes.reload();
  };

  /** quiet: 開いたときに自分で既読にする分は知らせない */
  const markRead = async (ids: string[], read: boolean, quiet = false) => {
    setLocal((l) => ({ ...l, read: new Map([...l.read, ...ids.map((id): [string, boolean] => [id, read])]) }));
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

  const move = async (ids: string[], to: FolderKey) => {
    setLocal((l) => ({ ...l, gone: new Set([...l.gone, ...ids]) }));
    if (pane?.kind === "read" && ids.includes(pane.id)) setPane(null);
    setChosen(new Set());
    try {
      await Promise.all(ids.map((id) => moveMessage(ctx, id, to, folder.key)));
      showSnackbar(t("moved", { n: ids.length, folder: folderName(to) }));
    } catch (err) {
      showSnackbar({ text: err instanceof Error ? err.message : String(err), tone: "error" });
    }
    afterChange();
  };

  /** 移せる先（今のフォルダーを除く）。自分で作ったメールボックスは、同じアカウントのメールだけのときに出す */
  const moveTargets = (mailboxIds: string[]) => {
    const standard = (["inbox", "junk", "trash"] as MailFolder[])
      .filter((f) => f !== folder.key)
      .map((f) => ({ id: f as string, label: tf(`folder_${f}`) }));
    const one = new Set(mailboxIds).size === 1 ? mailboxIds[0] : null;
    const own = one
      ? folders.filter((f) => f.mailboxId === one && f.id !== folder.key).map((f) => ({ id: f.id, label: f.path.join(" / ") }))
      : [];
    return [...standard, ...own];
  };
  const mailboxOf = (id: string) => messages?.find((m) => m.id === id)?.mailboxId ?? "";

  const actions = (
    <ButtonRow>
      <PillMenu
        label={current ? current.name : t("allInboxes")}
        icon="mail"
        ariaLabel={t("chooseInbox")}
        items={[
          { id: "", label: t("allInboxes"), detail: t("unreadCount", { n: unreadTotal }), selected: mailbox === null },
          ...mailboxes.map((m) => ({ id: m.id, label: m.name, detail: t("unreadCount", { n: m.unread }), selected: m.id === mailbox })),
        ]}
        onSelect={(id) => chooseMailbox(id || null)}
      />
      <NarrowOnly>
        <PillMenu
          label={folderName(folder.key)}
          icon={(MAIL_FOLDERS as string[]).includes(folder.key) ? FOLDER_ICONS[folder.key as MailFolder] : "mail"}
          ariaLabel={t("chooseFolder")}
          items={[
            ...MAIL_FOLDERS.map((f) => ({ id: f, label: tf(`folder_${f}`), selected: f === folder.key })),
            ...folders.map((f) => ({
              id: `${f.mailboxId}\n${f.id}`,
              label: f.path.join(" / "),
              detail: mailbox === null ? mailboxName(f.mailboxId) : undefined,
              selected: folder.key === f.id && folder.mailboxId === f.mailboxId,
            })),
          ]}
          onSelect={(id) => {
            const [mailboxId, key] = id.includes("\n") ? id.split("\n") : [null, id];
            chooseFolder({ key: key as FolderKey, mailboxId });
          }}
        />
      </NarrowOnly>
      <Button onClick={() => setUnreadOnly((v) => !v)} aria-pressed={unreadOnly}>
        {unreadOnly ? t("showAll") : t("unreadOnly")}
      </Button>
      {messages && messages.length > 0 && (
        <Button
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((v) => !v);
            setChosen(new Set());
          }}
        >
          {selecting ? t("selectDone") : t("select")}
        </Button>
      )}
      {mailboxes.some((m) => m.canSend) && (
        <Button variant="primary" icon="compose" onClick={() => setPane({ kind: "compose", replyTo: null })}>
          {t("newMail")}
        </Button>
      )}
    </ButtonRow>
  );

  const chosenIds = [...chosen];
  const opened = pane?.kind === "read" ? messages?.find((m) => m.id === pane.id) ?? null : null;

  return (
    <ScreenFrame title={{ ja: "メール", en: "Mail" }} actions={actions}>
      {failure && !list.data && <ScreenNotice tone="error">{failure}</ScreenNotice>}
      {errors.map((e) => (
        <ScreenNotice key={e.source} tone="error">
          {e.source}: {e.message}
        </ScreenNotice>
      ))}
      {boxes.data && mailboxes.length === 0 && errors.length === 0 && <ScreenNotice>{t("noInboxes")}</ScreenNotice>}
      <SideLayout
        sideLabel={tf("folders")}
        narrow="hide"
        side={
          <MailFolders
            folders={folders}
            groupName={mailbox === null ? mailboxName : null}
            current={folder}
            unreadInbox={current ? current.unread : unreadTotal}
            onChoose={chooseFolder}
          />
        }
      >
        {/*
          右の欄。とても広い画面（triple:）では一覧の右に開いたメール、そうでなければ開いたメールが一覧の代わりに出る
        */}
        <div className="flex items-start gap-6">
          <div className={cx("min-w-0 flex-1", pane && "hidden triple:block triple:flex-2")}>
            {selecting && (
              // 「選ぶ」のときの操作の帯（一覧の上）
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="text-label text-muted">{t("selected", { n: chosen.size })}</span>
                <ButtonRow>
                  <Button onClick={() => setChosen(new Set(messages?.map((m) => m.id)))}>{t("selectAll")}</Button>
                  <Button disabled={chosen.size === 0} onClick={() => void markRead(chosenIds, true)}>
                    {t("markRead")}
                  </Button>
                  <Button disabled={chosen.size === 0} onClick={() => void markRead(chosenIds, false)}>
                    {t("markUnread")}
                  </Button>
                  {chosen.size > 0 && (
                    <PillMenu
                      label={t("move")}
                      icon="inbox"
                      ariaLabel={t("moveTo")}
                      items={moveTargets(chosenIds.map(mailboxOf))}
                      onSelect={(id) => void move(chosenIds, id as FolderKey)}
                    />
                  )}
                  <Button
                    icon="delete"
                    disabled={chosen.size === 0}
                    onClick={() => void move(chosenIds, folder.key === "trash" ? "inbox" : "trash")}
                  >
                    {folder.key === "trash" ? t("restore") : t("delete")}
                  </Button>
                </ButtonRow>
              </div>
            )}
            {!messages && !failure && <Note>{tc("loading")}</Note>}
            {messages && messages.length === 0 && mailboxes.length > 0 && <Note>{unreadOnly ? t("noUnreadMail") : t("noMail")}</Note>}
            {messages && messages.length > 0 && (
              <List boxed label={t("mail")}>
                {messages.map((m) => {
                  const isChosen = chosen.has(m.id);
                  return (
                    <ListItem
                      key={m.id}
                      leading={
                        selecting ? (
                          // 「選ぶ」のときの丸いチェック
                          <span
                            className={cx(
                              "grid size-5.5 shrink-0 place-items-center rounded-full border-2 text-body",
                              isChosen ? "fill-bright" : "border-muted",
                            )}
                            role="checkbox"
                            aria-checked={isChosen}
                            aria-label={t("choose", { subject: m.subject })}
                          >
                            {isChosen && <Icon name="checkmark" />}
                          </span>
                        ) : (
                          // 未読の印。既読は同じ幅の空きにして、件名の頭をそろえる
                          <span className={cx("size-2 shrink-0 rounded-full", m.unread && "bg-accent")} aria-hidden="true" />
                        )
                      }
                      title={m.subject}
                      badge={m.unread ? t("unread") : undefined}
                      detail={`${outgoing && m.to?.length ? t("toPeople", { people: people(m.to) }) : senderName(m, locale)} · ${mailDate(m.date, locale)}${m.snippet ? ` · ${m.snippet}` : ""}`}
                      selected={selecting ? isChosen : pane?.kind === "read" && pane.id === m.id}
                      chevron={!selecting}
                      onClick={() => {
                        if (selecting) {
                          const next = new Set(chosen);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          setChosen(next);
                          return;
                        }
                        setPane({ kind: "read", id: m.id });
                      }}
                    />
                  );
                })}
              </List>
            )}
          </div>
          {pane && (
            <div className="min-w-0 flex-1 triple:flex-3">
              {pane.kind === "read" ? (
                <Reader
                  key={pane.id}
                  ctx={ctx}
                  id={pane.id}
                  unread={opened?.unread ?? false}
                  folder={folder.key}
                  canReply={mailboxes.find((b) => b.id === opened?.mailboxId)?.canSend ?? false}
                  moveTargets={moveTargets([opened?.mailboxId ?? ""])}
                  onClose={() => setPane(null)}
                  onReply={(message) => setPane({ kind: "compose", replyTo: message })}
                  onRead={(read, quiet) => void markRead([pane.id], read, quiet)}
                  onMove={(to) => void move([pane.id], to)}
                />
              ) : (
                <Composer
                  ctx={ctx}
                  mailboxes={mailboxes.filter((m) => m.canSend)}
                  preferred={pane.replyTo?.mailboxId ?? mailbox}
                  replyTo={pane.replyTo}
                  onClose={() => setPane(null)}
                  onSent={(text) => {
                    setPane(null);
                    showSnackbar(text);
                    afterChange();
                  }}
                />
              )}
            </div>
          )}
        </div>
      </SideLayout>
    </ScreenFrame>
  );
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
  onMove,
}: {
  ctx: ScreenProps["ctx"];
  id: string;
  /** 一覧での未読（操作をすぐ映したもの） */
  unread: boolean;
  folder: FolderKey;
  canReply: boolean;
  moveTargets: { id: string; label: string }[];
  onClose: () => void;
  onReply: (message: MailMessage) => void;
  onRead: (read: boolean, quiet?: boolean) => void;
  onMove: (to: FolderKey) => void;
}) {
  const t = screenMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  // 先読みしてあれば、すぐ出る
  const { data: message, error } = useCached(messageKey(id), () => fetchMessage(ctx, id));
  const [markedRead, setMarkedRead] = useState(false);

  // 開いたら既読にする（1度だけ）
  useEffect(() => {
    if (!message || markedRead) return;
    setMarkedRead(true);
    if (message.unread && unread) onRead(true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (error && !message) return <Message tone="error">{error}</Message>;
  if (!message) return <Note>{tc("loading")}</Note>;
  const people = (list: MailMessage["to"]) => list.map((a) => a.name || a.address).join(t("peopleSeparator"));
  return (
    <article>
      <SectionTitle>{message.subject}</SectionTitle>
      <Note>
        {senderName(message, locale)}
        {message.from?.name && message.from.address ? t("address", { address: message.from.address }) : ""} ·{" "}
        {mailDate(message.date, locale)}
        {message.to.length > 0 && t("to", { people: people(message.to) })}
        {message.cc.length > 0 && t("cc", { people: people(message.cc) })}
      </Note>
      <Group>
        <div className="reader-scroll leading-normal whitespace-pre-wrap untrim wrap-anywhere">{message.text || t("noBody")}</div>
      </Group>
      <ButtonRow>
        {canReply && (
          <Button variant="primary" icon="reply" onClick={() => onReply(message)}>
            {t("reply")}
          </Button>
        )}
        <Button onClick={() => onRead(unread)}>{unread ? t("markRead") : t("markUnread")}</Button>
        {moveTargets.length > 0 && (
          <PillMenu
            label={t("move")}
            icon="inbox"
            ariaLabel={t("moveTo")}
            items={moveTargets}
            onSelect={(to) => onMove(to as FolderKey)}
          />
        )}
        {folder !== "sent" && folder !== "drafts" && folder !== "trash" && (
          <Button icon="junk" onClick={() => onMove(folder === "junk" ? "inbox" : "junk")}>
            {folder === "junk" ? t("notJunk") : t("junk")}
          </Button>
        )}
        <Button icon="delete" onClick={() => onMove(folder === "trash" ? "inbox" : "trash")}>
          {folder === "trash" ? t("restore") : t("delete")}
        </Button>
        <Button onClick={onClose}>{tc("close")}</Button>
      </ButtonRow>
    </article>
  );
}

function Composer({
  ctx,
  mailboxes,
  preferred,
  replyTo,
  onClose,
  onSent,
}: {
  ctx: ScreenProps["ctx"];
  mailboxes: Mailbox[];
  preferred: string | null;
  replyTo: MailMessage | null;
  onClose: () => void;
  onSent: (notice: string) => void;
}) {
  const t = screenMessages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [from, setFrom] = useState(() => (mailboxes.some((m) => m.id === preferred) ? preferred! : (mailboxes[0]?.id ?? "")));
  const [to, setTo] = useState(replyTo?.from?.address ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo ? (/^re:/i.test(replyTo.subject) ? replyTo.subject : `Re: ${replyTo.subject}`) : "");
  const quoted = replyTo
    ? `\n\n${mailDate(replyTo.date, locale)} ${senderName(replyTo, locale)}:\n${replyTo.text
        .split("\n")
        .slice(0, 40)
        .map((line) => `> ${line}`)
        .join("\n")}`
    : "";
  const [text, setText] = useState(quoted);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const split = (value: string) => value.split(/[,、\s]+/).filter(Boolean);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // 送るのは、もう一度押して確かめてから
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

  return (
    <form onSubmit={(e) => void submit(e)}>
      <SectionTitle>{replyTo ? t("reply") : t("newMail")}</SectionTitle>
      <Group>
        <fieldset className="m-0 border-0 p-0" disabled={busy}>
          <Field label={t("from")}>
            <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={Boolean(replyTo)}>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.address && m.address !== m.name ? t("address", { address: m.address }) : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("toLabel")} hint={t("toHint")}>
            <input type="email" multiple value={to} autoFocus={!replyTo} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="CC">
            <input type="email" multiple value={cc} onChange={(e) => setCc(e.target.value)} />
          </Field>
          <Field label={t("subject")}>
            <input value={subject} maxLength={500} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label={t("body")}>
            <textarea rows={10} value={text} autoFocus={Boolean(replyTo)} onChange={(e) => setText(e.target.value)} />
          </Field>
        </fieldset>
        {confirming && <Message>{t("confirm", { to: split(to).join(t("peopleSeparator")) })}</Message>}
        {error && <Message tone="error">{error}</Message>}
        <ButtonRow>
          <Button variant="primary" type="submit" icon="send" disabled={busy || !from || !to.trim() || !text.trim()}>
            {busy ? t("sending") : confirming ? t("sendConfirmed") : t("send")}
          </Button>
          <Button onClick={onClose}>{tc("cancel")}</Button>
        </ButtonRow>
      </Group>
    </form>
  );
}
