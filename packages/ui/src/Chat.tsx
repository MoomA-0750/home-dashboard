import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";
import { BackButton, Button, IconButton, ListNoChevron, StatusDot } from "./ui";
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
 * ここではチャットにしか無いもの（一覧とやり取りの並べ方・見出し・吹き出し・入力欄）だけを持つ。見た目は部品が Tailwind のクラスで持つ。
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

const AVATAR_SIZES = {
  small: "size-rem-5 text-micro",
  medium: "size-rem-8 text-small",
  large: "size-rem-10 text-title",
  xlarge: "size-rem-24 text-heading",
} as const;

/** 丸い顔（写真か、無ければ名前の頭文字）。hue を渡すと頭文字の丸をその色にする */
export function Avatar({
  src,
  name,
  size = "medium",
  hue,
}: {
  src?: string | null;
  name: string;
  size?: "small" | "medium" | "large" | "xlarge";
  hue?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const className = cx(
    "inline-grid flex-none place-items-center rounded-full bg-white/8 object-cover ring-1 ring-glass-border",
    AVATAR_SIZES[size],
  );
  if (src && failed !== src) {
    return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailed(src)} />;
  }
  return (
    <span
      className={cx(className, "font-bold leading-none text-muted", hue !== undefined && "avatar-hue")}
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
    <span className="flex flex-none -space-x-2.5" aria-hidden="true">
      {children}
    </span>
  );
}

/**
 * 左に会話の一覧、右にやり取り。狭い画面（1100px 以下）ではどちらか一方だけを出し、listOpen で一覧に切り替える
 * （一覧の上の「戻る」で onCloseList）。一覧の行は押すとやり取りが開くだけなので、右の矢印は出さない
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
    <div className="grid min-h-0 flex-1 grid-cols-chat gap-6 narrow:grid-cols-1">
      {/* 一覧は自分で送る。選んだ行の影・文字の影が送りの枠で切れないよう、余白を取って同じだけ外へ広げる */}
      <section
        className={cx(
          "shadow-room-x shadow-room-b halo-room-t flex min-h-0 min-w-0 flex-col overflow-y-auto *:shrink-0",
          listOpen ? "narrow:flex" : "narrow:hidden",
        )}
        aria-label={listLabel ?? t("conversationList")}
      >
        <div className={listOpen ? "hidden narrow:block" : "hidden"}>
          <BackButton label={t("backToChat")} onClick={onCloseList} />
        </div>
        <ListNoChevron>{list}</ListNoChevron>
      </section>
      <section className={cx("flex min-h-0 min-w-0 flex-col", listOpen && "narrow:hidden")}>{children}</section>
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
    <header className="flex items-center gap-3 border-b border-line pb-3">
      <IconButton icon="history" label={t("conversationList")} glass className="hidden narrow:grid" onClick={onOpenList} />
      <div className="min-w-0 flex-1">
        {/* 1行に収め、入りきらなければ … で切る（文字の影が切れないよう余白を取る） */}
        <h2 className="halo-room ellipsis text-title font-semibold">{title}</h2>
        {status && (
          <p className="mt-1.5 flex items-center gap-2 text-note text-muted">
            <StatusDot ok={ok} />
            {status}
          </p>
        )}
      </div>
      {actions}
    </header>
  );
}

/** やり取りの並び。scrollKey（最後のやり取りの id など）が変わったら、いちばん下まで送る。新しく出た最後の1つは下から上がる */
export function ChatLog({ scrollKey, empty, children }: { scrollKey?: unknown; empty?: ReactNode; children?: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollKey]);
  return (
    <ol
      ref={ref}
      // 端に並ぶ顔の縁取りや吹き出しの影が、送りの枠で切れないよう余白を取る
      className="shadow-room-x flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto pt-4 pb-8 [&>:last-child]:animate-enter"
      aria-live="polite"
    >
      {empty ? <li className="m-auto text-label text-muted">{empty}</li> : children}
    </ol>
  );
}

/** やり取りの1行（またはひとまとまり）。mine なら右に寄せる。gap はひとまとまり（同じ人の続き）の最後のあとを空ける */
export function ChatRow({ mine, gap, children }: { mine?: boolean; gap?: boolean; children: ReactNode }) {
  return (
    <li className={cx("chat-row flex min-w-0 flex-col gap-1", mine ? "items-end" : "items-start", gap && "mb-3")}>{children}</li>
  );
}

/** 相手の吹き出しの左に顔を置く（avatar が null なら、顔の幅だけ空ける） */
export function ChatFrom({ avatar, children }: { avatar: ReactNode | null; children: ReactNode }) {
  return (
    <div className="flex max-w-17/20 min-w-0 items-end gap-2" data-chat-from="">
      {avatar ?? <span className="w-8 flex-none" aria-hidden="true" />}
      <div className="flex min-w-0 flex-col items-start gap-1 *:max-w-full">{children}</div>
    </div>
  );
}

/** 吹き出し。mine は自分（右・薄い水色を重ねたガラス）、それ以外は相手（左・ガラス） */
export function ChatBubble({ mine, children }: { mine?: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        "max-w-17/20 rounded-inner px-3.5 py-2.5 text-body leading-normal whitespace-pre-line text-text text-shadow-none wrap-anywhere untrim",
        mine ? "bubble-mine self-end" : "glass bubble-theirs",
      )}
    >
      {children}
    </div>
  );
}

/** 吹き出しの下の小さな文（時刻・送った人・状態） */
export function ChatMeta({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <span className="text-caption font-medium text-muted" title={title} data-chat-meta="">
      {children}
    </span>
  );
}

/** 1通に添えた画像・ファイル（ChatImage・ChatFile）を並べる。mine は自分（右に寄せる） */
export function ChatAttachments({ mine, children }: { mine?: boolean; children: ReactNode }) {
  return (
    <div className={cx("flex max-w-17/20 flex-wrap items-start gap-1.5", mine && "self-end justify-end")}>{children}</div>
  );
}

/** やり取りに添えた画像。押すと元の大きさで開く */
export function ChatImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a
      className="block max-w-80 overflow-hidden rounded-inner border border-glass-border"
      href={src}
      target="_blank"
      rel="noreferrer"
    >
      <img className="block max-h-80 w-auto max-w-full" src={src} alt={alt} loading="lazy" />
    </a>
  );
}

/** やり取りに添えた、画像でないファイル。href があれば押して開く・保存する */
export function ChatFile({ name, href, icon = "attach" }: { name: string; href?: string; icon?: IconName }) {
  const className =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-glass-border px-3 py-1.5 text-note text-muted no-underline [&_.fluent-icon]:size-rem-4";
  const body = (
    <>
      <Icon name={icon} />
      <span className="ellipsis">{name}</span>
    </>
  );
  return href ? (
    <a className={cx(className, "press hover:border-tint/30")} href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <span className={className}>{body}</span>
  );
}

/** 送る前のファイルの並び（入力欄の上の above に置く）。押すと外す */
export function ChatFileChips({ files, onRemove }: { files: { name: string }[]; onRemove: (index: number) => void }) {
  const t = messages.useT();
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("filesToSend")}>
      {files.map((file, index) => (
        <Button
          key={`${file.name}-${index}`}
          className="max-w-64"
          aria-label={t("removeFile", { name: file.name })}
          onClick={() => onRemove(index)}
        >
          <span className="ellipsis">{file.name}</span>
          <Icon name="dismiss" />
        </Button>
      ))}
    </div>
  );
}

/** 返事を待っているあいだなどの、吹き出しの代わりの小さな文 */
export function ChatPending({ children }: { children: ReactNode }) {
  return <p className="text-label text-muted">{children}</p>;
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
    <IconButton
      icon={icon}
      label={label}
      glass
      selected={on}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    />
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
  // 欄の中の右端の丸いボタン（明るい塗り）
  const sendClass =
    "press absolute right-1.5 grid size-8.5 cursor-pointer place-items-center rounded-full fill-bright text-on-fill disabled:cursor-default disabled:opacity-50 [&_.fluent-icon]:size-5";
  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-3 *:m-0">
      {above}
      <form className="flex items-center gap-2" onSubmit={submit}>
        {leading}
        <div className="relative flex min-w-0 flex-1 items-center">
          {/* 入力欄はピル型（本体の入力欄 Field と同じ色と線） */}
          <input
            ref={inputRef}
            type="text"
            className={cx(
              "tap-lg min-w-0 flex-1 rounded-full border border-glass-border bg-input px-4.5 text-small text-text text-shadow-none placeholder:text-muted disabled:opacity-60",
              (stop || showSend) && "pr-12",
            )}
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
            <button type="button" className={sendClass} aria-label={stop.label} title={stop.label} onClick={stop.onClick}>
              <Icon name="stop" />
            </button>
          ) : (
            showSend && (
              <button type="submit" className={sendClass} aria-label={t("send")} title={t("send")} disabled={!canSubmit}>
                <Icon name="send" />
              </button>
            )
          )}
        </div>
      </form>
    </div>
  );
}
