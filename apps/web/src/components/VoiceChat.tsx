import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AvatarStack,
  Button,
  ChatAttachments,
  ChatBubble,
  ChatComposer,
  ChatFile,
  ChatFileChips,
  ChatFrom,
  ChatHeader,
  ChatIconButton,
  ChatImage,
  ChatLayout,
  ChatLog,
  ChatMeta,
  ChatPending,
  ChatRow,
  defineMessages,
  formatClock,
  formatDate,
  formatPastDay,
  List,
  ListItem,
  Message,
  Note,
  ScreenFrame,
  useLocale,
  type Locale,
} from "@home-dashboard/widget-sdk";
import {
  ACTIVE_VOICE_STATES,
  uploadVoiceAttachment,
  voiceAttachmentUrl,
  type VoiceAskTarget,
  type VoiceAttachmentRef,
  type VoicePersona,
  type VoicePersonas,
  type VoiceSnapshot,
} from "../lib/useVoiceAssistant";
import type { ConversationSummary, VoiceChatSession } from "../lib/voiceConversations";
import { PersonaIcon } from "./PersonaIcon";

const messages = defineMessages({
  ja: {
    listening: "聞いています…",
    transcribing: "聞き取っています…",
    thinking: "考えています…",
    untitled: "（文字の無いやり取り）",
    noConversations: "まだ会話はありません",
    conversations: "会話",
    conversationDetail: "{day}・{n}件",
    newConversation: "新しい会話",
    newConversationTitle: "新しい会話（前のやり取りを引き継がずに始める）",
    ready: "話しかけられます",
    agentDown: "音声エージェントが起動していません",
    otherConversations: "ほかの会話",
    answeredElsewhere: "ほかの会話で{name}が答えました",
    quoted: "「{text}」",
    loadingTurns: "やり取りを読み込んでいます…",
    newConversationEmpty: "新しい会話です",
    metaTitle: "{name}・{time}",
    cancelled: "・中止",
    error: "・エラー",
    inputLabel: "音声アシスタントへのメッセージ",
    attach: "ファイルを添える（画像・PDF・テキスト）",
    tooMany: "添えられるのは{n}つまでです",
    uploading: "ファイルを送っています…",
    image: "添えた画像 {name}",
    placeholderTo: "{name}にメッセージ",
    placeholderMention: "（@でほかのキャラクター）",
    placeholder: "メッセージ",
    stopReply: "返答を止める",
    mentionList: "呼びかけるキャラクター",
  },
  en: {
    listening: "Listening…",
    transcribing: "Transcribing…",
    thinking: "Thinking…",
    untitled: "(No text)",
    noConversations: "No conversations yet",
    conversations: "Conversations",
    conversationDetail: (p) => `${p.day} · ${p.n} ${p.n === 1 ? "message" : "messages"}`,
    newConversation: "New conversation",
    newConversationTitle: "New conversation (starts fresh, without earlier messages)",
    ready: "Ready to talk",
    agentDown: "The voice agent isn't running",
    otherConversations: "Other conversations",
    answeredElsewhere: "{name} replied in another conversation",
    quoted: "“{text}”",
    loadingTurns: "Loading messages…",
    newConversationEmpty: "This is a new conversation",
    metaTitle: "{name} · {time}",
    cancelled: " · Cancelled",
    error: " · Error",
    inputLabel: "Message to the voice assistant",
    attach: "Attach files (images, PDFs, text)",
    tooMany: "You can attach up to {n} files",
    uploading: "Sending files…",
    image: "Attached image {name}",
    placeholderTo: "Message {name}",
    placeholderMention: " (@ for other characters)",
    placeholder: "Message",
    stopReply: "Stop reply",
    mentionList: "Characters to address",
  },
});

type Translate = ReturnType<typeof messages.useT>;

const LIVE_STATUS: Partial<Record<VoiceSnapshot["state"], "listening" | "transcribing" | "thinking">> = {
  listening: "listening",
  transcribing: "transcribing",
  thinking: "thinking",
};

interface VoiceChatProps {
  /** チャットアプリ（音声アシスタント・iMessage など）の切り替え。見出しの右に置く */
  switcher: ReactNode;
  snapshot: VoiceSnapshot | null;
  personas: VoicePersonas | null;
  /** 会話の一覧と、選んでいる会話のやり取り */
  session: VoiceChatSession;
  apiBaseUrl: string;
  /** attachmentIds は先に置いた添付（uploadVoiceAttachment） */
  onAskText: (text: string, target: VoiceAskTarget, attachmentIds: string[]) => Promise<void>;
  onCancel: () => void;
}

const MAX_FILES = 5;
// 選べるファイル（サーバーが中身で確かめる。画像・PDF・テキスト）
const FILE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/*,.md,.csv,.json,.yaml,.yml,.log";

/** 1通に添えたファイル。画像はそのまま、ほかは名前（押すと保存） */
function TurnAttachments({ apiBaseUrl, attachments, label }: { apiBaseUrl: string; attachments?: VoiceAttachmentRef[]; label: (name: string) => string }) {
  if (!attachments?.length) return null;
  return (
    <ChatAttachments mine>
      {attachments.map((a) =>
        a.type.startsWith("image/") ? (
          <ChatImage key={a.id} src={voiceAttachmentUrl(apiBaseUrl, a.id)} alt={label(a.name)} />
        ) : (
          <ChatFile key={a.id} name={a.name} href={voiceAttachmentUrl(apiBaseUrl, a.id)} />
        ),
      )}
    </ChatAttachments>
  );
}

/** 会話の一覧の時刻。今日なら時刻、それより前は日（昨日・N日前・日付）だけ */
function formatDay(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return formatPastDay(date, locale) ?? formatClock(date, locale);
}

/** 会話の中の時刻。今日なら時刻、それより前は日と時刻 */
function formatDayTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const day = formatPastDay(date, locale);
  return day ? `${day} ${formatClock(date, locale)}` : formatClock(date, locale);
}

/** 押さえたときに出す、略さない日時 */
function formatFull(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return `${formatDate(date, "fullWeekday", locale)} ${formatClock(date, locale)}`;
}

// 入力欄の最後にある書きかけの「@名前」（全角の＠も）
const MENTION_DRAFT = /[@＠]([^\s@＠]*)$/;

/** 書きかけの「@」に続けられるキャラクター（表示名か ID の先頭が合うもの） */
function mentionCandidates(text: string, personas: VoicePersona[]): VoicePersona[] {
  const match = MENTION_DRAFT.exec(text);
  if (!match) return [];
  const typed = match[1].toLowerCase();
  return personas.filter((p) => p.name.toLowerCase().startsWith(typed) || p.id.startsWith(typed));
}

function conversationLabel(conversation: ConversationSummary, t: Translate): string {
  return conversation.title || t("untitled");
}

/**
 * Chat 画面の、音声アシスタントとのチャット。文字かこの端末のマイクで話しかけ、返答は文字で流れてくる（チャットでは声を鳴らさない）。
 * 画面は本体の部品（ScreenFrame・List・widget-sdk の Chat）で組み、チャットアプリ（iMessage など）と同じ形にする。
 *
 * 会話は Claude Code の会話ごとに分かれていて、一覧から前の会話に戻ったり、新しい会話を始めたりできる。
 * 答えるのは既定のキャラクターで、1通だけほかのキャラクターに答えてほしいときは「@カリン」と書く。
 * ウェイクワードで話したやり取りも、そのときの会話の記録として一覧に並ぶ。
 */
export function VoiceChat({ switcher, snapshot, personas, session, apiBaseUrl, onAskText, onCancel }: VoiceChatProps) {
  const t = messages.useT();
  const locale = useLocale();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  // 送ったばかりの添付（記録に残るまで、進行中のやり取りに出す）
  const [sentAttachments, setSentAttachments] = useState<VoiceAttachmentRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const connected = Boolean(snapshot?.connected);
  const active = Boolean(snapshot && ACTIVE_VOICE_STATES.includes(snapshot.state));
  // 話しかけられるのは入っているキャラクターだけ（切ったキャラクターの過去のやり取りの名前・アイコンは、全員の一覧から引く）
  const allCharacters = personas?.personas ?? [];
  const characters = allCharacters.filter((p) => p.enabled);
  const persona = characters.find((p) => p.id === personas?.defaultPersonaId) ?? characters[0];
  const records = session.records;
  const conversation = session.conversations.find((c) => c.id === session.conversationId);
  const target: VoiceAskTarget = { personaId: persona?.id, conversationId: session.conversationId };
  const ready = connected && Boolean(session.conversationId);
  // 記録に残る前の、進行中（または失敗した）やり取り。この会話のものだけ出す
  const live =
    snapshot?.turnId &&
    snapshot.conversationId === session.conversationId &&
    !records.some((record) => record.id === snapshot.turnId) &&
    (active || snapshot.state === "error")
      ? snapshot
      : null;
  const mentions = mentionCandidates(text, characters);
  // 記録にだけ残っていて今はいないキャラクターは、名前の頭文字で出す
  const personaFor = (ref: { id: string; name: string }) => allCharacters.find((p) => p.id === ref.id) ?? ref;
  const icon = (ref: { id: string; name: string }, size?: "small" | "medium") => (
    <PersonaIcon apiBaseUrl={apiBaseUrl} persona={personaFor(ref)} size={size} />
  );

  useEffect(() => setMentionIndex(0), [mentions.length]);

  // 送ったやり取りが記録に残ったら、記録の方に添付が出る
  const lastRecordId = records.at(-1)?.id;
  useEffect(() => setSentAttachments([]), [lastRecordId, session.conversationId]);

  const run = async (task: () => Promise<void>) => {
    setSending(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = () => {
    const message = text.trim();
    if ((!message && files.length === 0) || sending) return;
    void run(async () => {
      const uploaded: VoiceAttachmentRef[] = [];
      setUploading(files.length > 0);
      try {
        for (const file of files) uploaded.push(await uploadVoiceAttachment(apiBaseUrl, file));
      } finally {
        setUploading(false);
      }
      setSentAttachments(uploaded);
      await onAskText(message, target, uploaded.map((a) => a.id));
      setText("");
      setFiles([]);
    });
  };

  const addFiles = (picked: FileList | null) => {
    const next = [...files, ...Array.from(picked ?? [])];
    setError(next.length > MAX_FILES ? t("tooMany", { n: MAX_FILES }) : null);
    setFiles(next.slice(0, MAX_FILES));
  };

  /** 書きかけの「@」をキャラクターの名前で埋める */
  const completeMention = (candidate: VoicePersona) => {
    setText((current) => current.replace(MENTION_DRAFT, `@${candidate.name} `));
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (mentions.length === 0 || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setMentionIndex((index) => (index + step + mentions.length) % mentions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      completeMention(mentions[Math.min(mentionIndex, mentions.length - 1)]);
    } else if (event.key === "Escape") {
      setText((current) => `${current} `);
    }
  };

  const openConversation = (id: string) => {
    session.select(id);
    setListOpen(false);
    setError(null);
  };

  const startNew = () => {
    session.startNew();
    setListOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const lastRecord = records.at(-1);

  const list = (
    <>
      {session.conversations.length === 0 ? (
        <Note>{t("noConversations")}</Note>
      ) : (
        <List label={t("conversations")}>
          {session.conversations.map((c) => (
            <ListItem
              key={c.id}
              title={conversationLabel(c, t)}
              detail={t("conversationDetail", { day: formatDay(c.updatedAt, locale), n: c.turns })}
              leading={<AvatarStack>{c.personas.map((p) => <PersonaIcon key={p.id} apiBaseUrl={apiBaseUrl} persona={personaFor(p)} />)}</AvatarStack>}
              selected={c.id === session.conversationId}
              off={active && c.id !== session.conversationId}
              onClick={active && c.id !== session.conversationId ? undefined : () => openConversation(c.id)}
            />
          ))}
        </List>
      )}
    </>
  );

  return (
    <ScreenFrame title={{ ja: "チャット", en: "Chat" }} actions={switcher} fill>
      <ChatLayout list={list} listOpen={listOpen} onCloseList={() => setListOpen(false)}>
        <ChatHeader
          title={conversation ? conversationLabel(conversation, t) : t("newConversation")}
          status={connected ? t("ready") : t("agentDown")}
          ok={connected}
          onOpenList={() => setListOpen(true)}
          actions={
            <ChatIconButton
              icon="compose"
              label={t("newConversation")}
              title={t("newConversationTitle")}
              disabled={active}
              onClick={startNew}
            />
          }
        />

        {session.elsewhere && session.elsewhere.conversationId && (
          <List label={t("otherConversations")}>
            <ListItem
              title={t("answeredElsewhere", { name: session.elsewhere.persona.name })}
              detail={t("quoted", { text: session.elsewhere.input.text })}
              onClick={() => openConversation(session.elsewhere!.conversationId!)}
            />
          </List>
        )}

        <ChatLog
          scrollKey={`${session.conversationId}:${lastRecord?.id}:${live?.transcript}:${live?.response}:${live?.state}`}
          empty={records.length === 0 && !live ? (conversation ? t("loadingTurns") : t("newConversationEmpty")) : undefined}
        >
          {records.map((record, index) => (
            <ChatRow key={record.id ?? `${record.at}-${index}`} gap>
              <TurnAttachments apiBaseUrl={apiBaseUrl} attachments={record.input.attachments} label={(name) => t("image", { name })} />
              {record.input.text.trim() && <ChatBubble mine>{record.input.text.trim()}</ChatBubble>}
              {record.output.text && (
                <ChatFrom avatar={icon(record.persona)}>
                  <ChatBubble>{record.output.text.trim()}</ChatBubble>
                </ChatFrom>
              )}
              <ChatMeta title={t("metaTitle", { name: record.persona.name, time: formatFull(record.at, locale) })}>
                {formatDayTime(record.at, locale)}
                {record.status === "cancelled" && t("cancelled")}
                {record.status === "error" && t("error")}
              </ChatMeta>
            </ChatRow>
          ))}
          {live && (
            <ChatRow>
              <TurnAttachments apiBaseUrl={apiBaseUrl} attachments={sentAttachments} label={(name) => t("image", { name })} />
              {live.transcript && (
                <ChatBubble mine>{live.transcript.trim()}</ChatBubble>
              )}
              {live.response?.trim() ? (
                <ChatFrom avatar={live.personaId ? icon({ id: live.personaId, name: live.personaName ?? "" }) : null}>
                  {/* 返答の途中の文は改行から始まることがある。吹き出しは改行をそのまま出すので、前後の改行を落とす */}
                  <ChatBubble>{live.response.trim()}</ChatBubble>
                </ChatFrom>
              ) : (
                LIVE_STATUS[live.state] && <ChatPending>{t(LIVE_STATUS[live.state]!)}</ChatPending>
              )}
              {live.state === "error" && live.error && <Message tone="error">{live.error}</Message>}
            </ChatRow>
          )}
        </ChatLog>

        <input
          ref={fileRef}
          type="file"
          accept={FILE_ACCEPT}
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
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          label={t("inputLabel")}
          placeholder={
            persona ? `${t("placeholderTo", { name: persona.name })}${characters.length > 1 ? t("placeholderMention") : ""}` : t("placeholder")
          }
          disabled={!ready}
          canSubmit={ready && !sending && Boolean(text.trim() || files.length > 0)}
          submitWithoutText={files.length > 0}
          leading={
            <ChatIconButton
              icon="attach"
              label={t("attach")}
              disabled={!ready || sending || files.length >= MAX_FILES}
              onClick={() => fileRef.current?.click()}
            />
          }
          stop={active ? { label: t("stopReply"), onClick: onCancel } : undefined}
          above={
            <>
              {error && <Message tone="error">{error}</Message>}
              {uploading && <Note>{t("uploading")}</Note>}
              <ChatFileChips files={files} onRemove={(index) => setFiles(files.filter((_, i) => i !== index))} />
              {mentions.length > 0 && (
                <div className="ui-button-row" role="listbox" aria-label={t("mentionList")}>
                  {mentions.map((p, index) => (
                    <Button
                      key={p.id}
                      role="option"
                      aria-selected={index === mentionIndex}
                      variant={index === mentionIndex ? "primary" : "default"}
                      // 入力欄からフォーカスを外さずに選べるように
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => completeMention(p)}
                    >
                      {icon(p, "small")}@{p.name}
                    </Button>
                  ))}
                </div>
              )}
            </>
          }
        />
      </ChatLayout>
    </ScreenFrame>
  );
}
