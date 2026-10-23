import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Icon, type IconName } from "./Icon";
import { BackButton, Button } from "./ui";
import { defineMessages } from "./i18n";

const messages = defineMessages({
  ja: {
    conversationList: "会話の一覧",
    backToChat: "やり取りに戻る",
    send: "送信",
    filesToSend: "送るファイル",
    removeFile: "{name} を外す",
  },
  en: {
    conversationList: "Conversations",
    backToChat: "Back to chat",
    send: "Send",
    filesToSend: "Files to send",
    removeFile: "Remove {name}",
  },
});

/**
 * チャットの画面を組む部品（本体の Chat 画面の、音声アシスタントとチャットアプリ（iMessage など）が同じ形になるように）。
 * 画面の枠は ScreenFrame（fill を付ける）、会話の一覧は List・ListItem（selected）、そのほかの文・ボタンも本体の部品を使い、
 * ここではチャットにしか無いもの（一覧とやり取りの並べ方・見出し・吹き出し・入力欄）だけを持つ。見た目は本体の theme.css の ui-chat-*。
 *
 *   <ScreenFrame title="Chat" actions={switcher} fill>
 *     <ChatLayout list={<List>…</List>} listOpen={listOpen} onCloseList={() => setListOpen(false)}>
 *       <ChatHeader title="山田 花子" status="15秒ごとに新着を見ています" ok onOpenList={() => setListOpen(true)} />
 *       <ChatLog scrollKey={lastId}>
 *         <ChatRow mine><ChatBubble mine>やあ</ChatBubble><ChatMeta mine>12:00</ChatMeta></ChatRow>
 *       </ChatLog>
 *       <ChatComposer value={text} onChange={setText} onSubmit={send} placeholder="メッセージ" />
 *     </ChatLayout>
 *   </ScreenFrame>
 */

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** 丸い顔（写真か、無ければ名前の頭文字）。hue を渡すと頭文字の丸をその色にする */
export function Avatar({
  src,
  name,
  size = "medium",
  hue,
}: {
  src?: string | null;
  name: string;
  size?: "small" | "medium" | "large";
  hue?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const className = `ui-avatar ui-avatar--${size}`;
  if (src && failed !== src) {
    return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailed(src)} />;
  }
  return (
    <span
      className={cx(className, "ui-avatar--initial", hue !== undefined && "ui-avatar--colored")}
      style={hue !== undefined ? ({ "--avatar-hue": hue } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {Array.from(name.trim())[0] ?? "?"}
    </span>
  );
}

/** 何人かの顔を少し重ねて並べる（一覧の行の左など） */
export function AvatarStack({ children }: { children: ReactNode }) {
  return (
    <span className="ui-avatar-stack" aria-hidden="true">
      {children}
    </span>
  );
}

/**
 * 左に会話の一覧、右にやり取り。狭い画面ではどちらか一方だけを出し、listOpen で一覧に切り替える
 * （一覧の上の「戻る」で onCloseList）
 */
export function ChatLayout({
  list,
  listLabel,
  listOpen,
  onCloseList,
  children,
}: {
  list: ReactNode;
  listLabel?: string;
  listOpen: boolean;
  onCloseList: () => void;
  children: ReactNode;
}) {
  const t = messages.useT();
  return (
    <div className={cx("ui-chat", listOpen && "ui-chat--list-open")}>
      <section className="ui-chat__list" aria-label={listLabel ?? t("conversationList")}>
        <div className="ui-chat__back">
          <BackButton label={t("backToChat")} onClick={onCloseList} />
        </div>
        {list}
      </section>
      <section className="ui-chat__main">{children}</section>
    </div>
  );
}

/** やり取りの上の見出し（相手の名前と、つながりの状態）。狭い画面では左に一覧へのボタンを出す */
export function ChatHeader({
  title,
  status,
  ok,
  onOpenList,
  actions,
}: {
  title: ReactNode;
  status?: ReactNode;
  /** つながっているか（状態の丸の色） */
  ok?: boolean;
  onOpenList: () => void;
  actions?: ReactNode;
}) {
  const t = messages.useT();
  return (
    <header className="ui-chat__header">
      <Button className="ui-chat__icon-button ui-chat__list-button" aria-label={t("conversationList")} onClick={onOpenList}>
        <Icon name="history" />
      </Button>
      <div className="ui-chat__title">
        <h2>{title}</h2>
        {status && (
          <p className="ui-chat__status">
            <span className={cx("status-dot", ok && "status-dot--ok")} aria-hidden="true" />
            {status}
          </p>
        )}
      </div>
      {actions}
    </header>
  );
}

/** やり取りの並び。scrollKey（最後のやり取りの id など）が変わったら、いちばん下まで送る */
export function ChatLog({ scrollKey, empty, children }: { scrollKey?: unknown; empty?: ReactNode; children?: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollKey]);
  return (
    <ol ref={ref} className="ui-chat__log" aria-live="polite">
      {empty ? <li className="ui-chat__empty">{empty}</li> : children}
    </ol>
  );
}

/** やり取りの1行（またはひとまとまり）。mine なら右に寄せる */
export function ChatRow({ mine, gap, children }: { mine?: boolean; gap?: boolean; children: ReactNode }) {
  return <li className={cx("ui-chat__row", mine && "ui-chat__row--mine", gap && "ui-chat__row--gap")}>{children}</li>;
}

/** 相手の吹き出しの左に顔を置く（avatar が null なら、顔の幅だけ空ける） */
export function ChatFrom({ avatar, children }: { avatar: ReactNode | null; children: ReactNode }) {
  return (
    <div className="ui-chat__from">
      {avatar ?? <span className="ui-chat__avatar-space" aria-hidden="true" />}
      <div className="ui-chat__from-body">{children}</div>
    </div>
  );
}

/** 吹き出し。mine は自分（右・薄い水色）、それ以外は相手（左） */
export function ChatBubble({ mine, children }: { mine?: boolean; children: ReactNode }) {
  return <div className={cx("ui-chat__bubble", mine ? "ui-chat__bubble--mine" : "ui-chat__bubble--theirs")}>{children}</div>;
}

/** 吹き出しの下の小さな文（時刻・送った人・状態） */
export function ChatMeta({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <span className="ui-chat__meta" title={title}>
      {children}
    </span>
  );
}

/** 1通に添えた画像・ファイル（ChatImage・ChatFile）を並べる。mine は自分（右に寄せる） */
export function ChatAttachments({ mine, children }: { mine?: boolean; children: ReactNode }) {
  return <div className={cx("ui-chat__attachments", mine && "ui-chat__attachments--mine")}>{children}</div>;
}

/** やり取りに添えた画像。押すと元の大きさで開く */
export function ChatImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a className="ui-chat__image" href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={alt} loading="lazy" />
    </a>
  );
}

/** やり取りに添えた、画像でないファイル。href があれば押して開く・保存する */
export function ChatFile({ name, href, icon = "attach" }: { name: string; href?: string; icon?: IconName }) {
  const body = (
    <>
      <Icon name={icon} />
      <span className="ui-chat__file-name">{name}</span>
    </>
  );
  return href ? (
    <a className="ui-chat__file" href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <span className="ui-chat__file">{body}</span>
  );
}

/** 送る前のファイルの並び（入力欄の上の above に置く）。押すと外す */
export function ChatFileChips({ files, onRemove }: { files: { name: string }[]; onRemove: (index: number) => void }) {
  const t = messages.useT();
  if (files.length === 0) return null;
  return (
    <div className="ui-button-row" aria-label={t("filesToSend")}>
      {files.map((file, index) => (
        <button
          key={`${file.name}-${index}`}
          type="button"
          className="ui-button ui-chat__file-chip"
          aria-label={t("removeFile", { name: file.name })}
          onClick={() => onRemove(index)}
        >
          <span className="ui-chat__file-name">{file.name}</span>
          <Icon name="dismiss" />
        </button>
      ))}
    </div>
  );
}

/** 返事を待っているあいだなどの、吹き出しの代わりの小さな文 */
export function ChatPending({ children }: { children: ReactNode }) {
  return <p className="ui-chat__pending">{children}</p>;
}

/** 入力欄の左に置く、アイコンだけの丸いボタン（マイク・添付など）。on で押している（録音中など）の色 */
export function ChatIconButton({
  icon,
  label,
  on,
  title,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  on?: boolean;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className={cx("ui-chat__icon-button", on && "ui-chat__icon-button--on")}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </Button>
  );
}

/**
 * ピル型の入力欄（1行）。送るボタンは文字を入れてから欄の中の右端に出る。leading に ChatIconButton（マイク・添付）、
 * above に入力欄の上に出すもの（エラー・添えたファイル）。stop を渡すと、送るボタンの代わりに止めるボタンを出す（返事の途中など）。
 * 文字が無くても送れるとき（画像だけなど）は submitWithoutText を渡す
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  disabled,
  canSubmit,
  leading,
  above,
  stop,
  submitWithoutText,
  inputRef,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  /** 入力欄を使えない */
  disabled?: boolean;
  /** 送るボタンを押せる */
  canSubmit: boolean;
  leading?: ReactNode;
  above?: ReactNode;
  stop?: { label: string; onClick: () => void };
  /** 文字が無くても送るボタンを出す（添えたファイルがあるときなど） */
  submitWithoutText?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = messages.useT();
  const showSend = Boolean(value.trim()) || Boolean(submitWithoutText);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };
  return (
    <div className="ui-chat__composer">
      {above}
      <form className="ui-chat__form" onSubmit={submit}>
        {leading}
        <div className={stop || showSend ? "ui-chat__field ui-chat__field--button" : "ui-chat__field"}>
          <input
            ref={inputRef}
            type="text"
            className="ui-chat__input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={label}
            disabled={disabled}
            enterKeyHint="send"
          />
          {/* 止めるボタンは返事の途中だけ、送るボタンは文字を入れてからだけ、欄の中の右端に出す */}
          {stop ? (
            <button type="button" className="ui-chat__send" aria-label={stop.label} onClick={stop.onClick}>
              <Icon name="stop" />
            </button>
          ) : (
            showSend && (
              <button type="submit" className="ui-chat__send" aria-label={t("send")} disabled={!canSubmit}>
                <Icon name="send" />
              </button>
            )
          )}
        </div>
      </form>
    </div>
  );
}
