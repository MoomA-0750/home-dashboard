import {
  createContext,
  useContext,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/**
 * 拡張機能が画面を組むための本体の部品（ボタン・入れ物・一覧・入力欄・文字）。見た目は部品が Tailwind のクラスで持つので、
 * 拡張機能は自分で色や角丸を決めず、これを組み合わせる（本体の見た目が変わっても、拡張機能はそのままそろう）。
 * 値を選ぶバーは Slider。ほかに ToggleSwitch（入／切）・Icon・PillMenu（画面の右上の選択）・ScreenFrame（画面の枠）も使える。
 *
 *   <SectionTitle>ホスト</SectionTitle>
 *   <Note>ウィジェットに出す機械です。</Note>
 *   <List>
 *     <ListItem title="mooma-lpve" detail="SSH · 192.168.1.10" onClick={open} />
 *   </List>
 *   <Group>
 *     <Field label="名前"><input value={name} onChange={...} /></Field>
 *     <ButtonRow>
 *       <Button variant="primary" type="submit">保存</Button>
 *       <Button onClick={test}>接続を確かめる</Button>
 *     </ButtonRow>
 *   </Group>
 */

export type ButtonVariant = "default" | "primary" | "danger";
/** md: ふつう（高さ 40px）。lg: 壁掛けで離れて押すもの（52px。Home Control の操作など） */
export type ButtonSize = "md" | "lg";

interface ButtonOwnProps {
  /** primary: その場でいちばん押すもの（保存など）。danger: 消すのを確かめるもの */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 文字の前に出すアイコン */
  icon?: IconName;
}

/** ボタンの見た目（Button と、リンクをボタンの形にする ButtonLink・PillMenu で同じものを使う） */
export function buttonClass(variant: ButtonVariant = "default", size: ButtonSize = "md") {
  return cx(
    "press inline-flex items-center justify-center gap-2 rounded-full px-4 font-semibold leading-none whitespace-nowrap text-shadow-none no-underline cursor-pointer",
    "disabled:cursor-default disabled:opacity-50 [&_.fluent-icon]:size-5",
    size === "lg" ? "tap-xl px-6 text-body" : "tap text-label",
    // ガラス（glass）は地と縁をまとめて決め、bg-*・border-* より後に効くので、塗りのボタンには付けない
    variant === "primary"
      ? "fill-bright text-on-fill"
      : variant === "danger"
        ? "border border-transparent bg-danger-strong text-on-danger"
        : "glass text-text hover:border-tint/30",
  );
}

/** ボタン。どれも丸い端の同じ高さ。type は既定で "button"（フォームを送るものだけ "submit" にする） */
export function Button({
  variant = "default",
  size = "md",
  icon,
  className,
  type = "button",
  children,
  ...rest
}: ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx(buttonClass(variant, size), className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/**
 * アイコンだけのボタン（閉じる・その他の操作・家電の電源）。label は読み上げと hover の説明に使う。
 * md は地の無い 44px の丸（hover で薄く浮かぶ）、lg は壁掛けで押す 52px のガラスの丸。selected は入っているもの（明るい塗り）。
 * glass を付けると md でもガラスの丸にする（チャットの入力欄の横のマイク・添付など、ボタンの並びに置くもの）
 */
export function IconButton({
  icon,
  label,
  size = "md",
  selected,
  glass,
  className,
  type = "button",
  ...rest
}: { icon: IconName; label: string; size?: ButtonSize; selected?: boolean; glass?: boolean } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
>) {
  const glassy = glass ?? size === "lg";
  return (
    <button
      type={type}
      className={cx(
        "press grid shrink-0 cursor-pointer place-items-center rounded-full p-0 text-text disabled:cursor-default disabled:opacity-40",
        size === "lg" ? "size-13" : "size-11",
        glassy
          ? "glass text-shadow-none hover:border-tint/30"
          : cx("border-0 bg-transparent", !selected && "hover:bg-white/10 focus-visible:bg-white/10"),
        selected && "fill-bright no-blur text-on-fill",
        className,
      )}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

/** 選べるものを並べる小さな丸いボタン（運転モード・大きさなど）。selected は選んでいるもの（明るい塗り） */
export function Chip({
  selected,
  icon,
  className,
  type = "button",
  children,
  ...rest
}: { selected?: boolean; icon?: IconName } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "glass press tap inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 text-small text-text text-shadow-none",
        "hover:border-tint/30 disabled:cursor-default disabled:opacity-40 [&_.fluent-icon]:size-4.5",
        selected && "fill-bright no-blur text-on-fill",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/**
 * 進み具合・使っている量のバー（高さ 6px）。value は 0〜1。色は CSS の --progress-color で変える（既定は緑）。
 * label を渡すと読み上げで量を伝える（無ければ飾りとして扱う。隣に数値を書いているとき）
 */
export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span
      className={cx("block h-1.5 overflow-hidden rounded-full bg-line", className)}
      {...(label
        ? { role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent }
        : { "aria-hidden": true })}
    >
      {/* 幅は変えず、左へずらして量を出す（動かすのは transform だけ。右の端の丸みも崩れない） */}
      <span
        className="block h-full w-full rounded-full bg-[var(--progress-color,var(--accent-ok))] transition-transform duration-(--motion-slow) ease-standard"
        style={{ translate: `${percent - 100}% 0` }}
      />
    </span>
  );
}

/** ボタンの形のリンク（書き出し・外のページを開くなど） */
export function ButtonLink({
  variant = "default",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonOwnProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cx(buttonClass(variant, size), className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </a>
  );
}

/** ボタンを横に並べる（入りきらなければ折り返す） */
export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/**
 * 入れ物（区画）。中に入力欄やボタンを並べる。角丸と内側の余白は本体が決める。
 * collapsible と title を渡すと開け閉めする区画（<details>）になり、見出しの行（title と、右に badge）を押して開く。open は最初に開いておくか
 */
export function Group({
  children,
  className,
  collapsible,
  title,
  badge,
  open,
}: {
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  title?: ReactNode;
  badge?: ReactNode;
  open?: boolean;
}) {
  if (collapsible && title)
    return (
      <details className={cx("glass mb-3 rounded-group text-shadow-none", className)} open={open}>
        <summary className="press-wide tap-lg flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-body [&::-webkit-details-marker]:hidden">
          <span>{title}</span>
          {badge}
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    );
  return <section className={cx("glass mb-3 rounded-group p-4 text-shadow-none", className)}>{children}</section>;
}

/** List の形（ListItem が行の形を合わせる）。boxed: 1つの入れ物の中の行 / chevron: 押せる行の右の矢印を出すか */
const ListContext = createContext<{ boxed: boolean; chevron: boolean }>({ boxed: false, chevron: true });

/**
 * 線で区切った一覧の入れ物。中に ListItem を並べる。
 * boxed: 並べて読み比べるもの（天気の日ごと・予定・メール）を、1つのガラスの入れ物に入れて線で区切る。
 * 無し: 左の欄で選ぶもの（会話・受信箱・設定の項目）。入れ物の枠は無く、行ごとに角の丸い行が並び、選んでいる行だけガラスになる
 */
export function List({ children, label, boxed }: { children: ReactNode; label?: string; boxed?: boolean }) {
  const parent = useContext(ListContext);
  return (
    <ListContext.Provider value={{ boxed: Boolean(boxed), chevron: parent.chevron }}>
      <ul
        className={cx(
          "mb-3 flex list-none flex-col gap-1.5 p-0",
          boxed && "glass gap-0 divide-y divide-line overflow-hidden rounded-group text-shadow-none",
        )}
        aria-label={label}
      >
        {children}
      </ul>
    </ListContext.Provider>
  );
}

/** List の中の行の右の矢印を出さない（チャットの会話の一覧のように、押すとすぐ横に開くもの） */
export function ListNoChevron({ children }: { children: ReactNode }) {
  const parent = useContext(ListContext);
  return <ListContext.Provider value={{ ...parent, chevron: false }}>{children}</ListContext.Provider>;
}

export interface ListItemProps {
  title: ReactNode;
  /** 名前の下に小さく出す説明 */
  detail?: ReactNode;
  /** 名前の右に小さく出す印（「既定」など） */
  badge?: ReactNode;
  /** 左に出すもの（画像など） */
  leading?: ReactNode;
  /** 左に出す、淡い色の角丸の地のアイコン（ListIcon。leading より先に出す） */
  icon?: IconName;
  /** 右に出すもの（ToggleSwitch・Button など） */
  trailing?: ReactNode;
  /** 押したとき（詳しい画面を開くなど）。渡すと行全体が押せるようになり、右に矢印が出る */
  onClick?: () => void;
  /** 切ってあるものを薄く出す */
  off?: boolean;
  /** 選んでいる行（チャットの開いている会話など） */
  selected?: boolean;
  /** 押せる行の右の矢印（開く先があることを示す）。選ぶだけの行（言語など）は false */
  chevron?: boolean;
  /** detail を注意の色で出す */
  error?: boolean;
  /** detail を省略（…）せず、折り返して全部出す */
  wrap?: boolean;
  /** 読み上げ用の名前（押せる行で、中身だけでは分かりにくいとき） */
  ariaLabel?: string;
}

/** 一覧の1行（名前と説明。左右に何かを置ける） */
export function ListItem({
  title,
  detail,
  badge,
  leading,
  icon,
  trailing,
  onClick,
  off,
  selected,
  chevron = true,
  error,
  wrap,
  ariaLabel,
}: ListItemProps) {
  const list = useContext(ListContext);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick?.();
  };
  return (
    <li>
      <div
        className={cx(
          "flex cursor-default items-center gap-3.5 text-left",
          list.boxed
            ? cx(
                "px-4 py-3",
                onClick && "press-wide cursor-pointer hover:bg-tint/6 focus-visible:bg-tint/6 focus-visible:outline-none",
                selected && "bg-tint/6",
              )
            : cx(
                // 左のアイコンの丸と角丸をそろえるため、左と上下の余白を同じにする
                "rounded-inner border border-transparent p-3 pr-3.5",
                onClick && "press-wide cursor-pointer",
                selected
                  ? "glass text-shadow-none"
                  : onClick &&
                      "hover:border-glass-border hover:bg-white/8 focus-visible:border-glass-border focus-visible:bg-white/8 focus-visible:outline-none",
              ),
        )}
        aria-current={selected ? "true" : undefined}
        aria-label={ariaLabel}
        {...(onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown } : {})}
      >
        {icon && <ListIcon icon={icon} />}
        {leading}
        <span className={cx("flex min-w-0 flex-1 flex-col gap-1.5", off && "opacity-60")}>
          <span className="flex min-w-0 items-baseline gap-2 text-body">
            {/* 名前は1行に収め、入りきらなければ … で切る（壁紙の上では、文字の影が切れないよう余白を取る） */}
            <span className={cx("ellipsis min-w-0", !list.boxed && !selected && "halo-room")}>{title}</span>
            {badge && <small className="shrink-0 text-micro text-muted">{badge}</small>}
          </span>
          {detail && (
            <span
              className={cx(
                "text-caption leading-normal font-medium",
                wrap ? "untrim" : "ellipsis",
                error ? "text-danger" : "text-muted",
              )}
            >
              {detail}
            </span>
          )}
        </span>
        {trailing}
        {onClick && chevron && list.chevron && <Icon name="chevron-right" className="opacity-50" />}
      </div>
    </li>
  );
}

/** 一覧の行の左に置く、小さな角丸の地のアイコン（受信箱・設定の項目など） */
export function ListIcon({ icon, className }: { icon: IconName; className?: string }) {
  return (
    <span
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-nav bg-accent-soft/18 [&_.fluent-icon]:size-5",
        className,
      )}
    >
      <Icon name={icon} />
    </span>
  );
}

/** Field の外に置く入力欄・選ぶ欄のクラス（Field の中と同じ見た目）。<input className={inputClass}> */
export const inputClass =
  "tap-lg w-full min-w-0 rounded-inner border border-glass-border bg-input px-(--field-padding-x) text-small text-text text-shadow-none placeholder:text-muted [&_option]:bg-raised";

/** 入力欄・選ぶ欄に名前と説明を付ける。children に <input>・<select>・<textarea> を1つ置く（見た目は Field が付ける） */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("fields mb-3 flex flex-col gap-1.5 text-label", className)}>
      <span>{label}</span>
      {children}
      {hint && <small className="text-caption font-medium text-muted">{hint}</small>}
    </label>
  );
}

/** チェックボックスと、その説明（一覧の行で入／切するなら ToggleSwitch を使う） */
export function Check({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 flex items-center gap-2 text-label">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** 区画の見出し */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mt-6 mb-2.5 text-label font-semibold text-muted first:mt-0">{children}</h4>;
}

/** 説明の文 */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-note leading-normal font-medium text-muted">{children}</p>;
}

/** 目立たせる知らせ（気をつけてほしいこと） */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 animate-fade rounded-inner bg-warn/12 px-3.5 py-2.5 text-note leading-normal text-text untrim">
      {children}
    </p>
  );
}

/** 操作の結果（できた・できなかった） */
export function Message({ tone = "ok", children }: { tone?: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      className={cx("mt-2.5 animate-fade text-note font-medium", tone === "error" ? "text-danger" : "text-success")}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

const BADGE_TONES = {
  on: "border-transparent bg-success text-on-fill",
  warn: "border-transparent bg-warn/18 text-warn",
  dim: "border-transparent bg-white/6",
} as const;

/** 小さな印（件数・状態）。tone: on（入っている・設定済み）／warn（気を付ける・変更あり）／dim（控えめ） */
export function Badge({ on, tone, children }: { on?: boolean; tone?: "on" | "warn" | "dim"; children: ReactNode }) {
  const kind = tone ?? (on ? "on" : null);
  return (
    <span
      className={cx(
        "inline-block rounded-full border border-glass-border px-2 py-0.5 text-micro whitespace-nowrap text-muted tabular-nums",
        kind && BADGE_TONES[kind],
      )}
    >
      {children}
    </span>
  );
}

/** つながりの状態の小さな丸（ok: つながっている） */
export function StatusDot({ ok }: { ok?: boolean }) {
  return <span className={cx("size-2 shrink-0 rounded-full", ok ? "bg-ok" : "bg-muted opacity-60")} aria-hidden="true" />;
}

/** 前の画面へ戻るボタン（一覧から開いた詳しい画面の左上） */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="press -ml-1.5 mb-3 inline-flex cursor-pointer items-center gap-1 rounded-inner py-1.5 pr-2.5 pl-1 text-accent-soft hover:bg-tint/8"
      onClick={onClick}
    >
      <Icon name="chevron-left" />
      <span>{label}</span>
    </button>
  );
}

/** そのまま写して使う文字（コマンド・鍵など）。押すと全体を選ぶ */
export function CodeBlock({ children }: { children: string }) {
  return (
    <code className="block max-h-28 w-full overflow-auto rounded-inner border border-glass-border bg-input px-3.5 py-2.5 text-caption break-all select-all">
      {children}
    </code>
  );
}

// --- ウィジェット・画面の部品 ---

/**
 * ウィジェットのカード（暗いガラス・角丸・内側の余白）。押すと詳しい画面を開くものは onClick を渡す（button になる）。
 * className には中身の並べ方だけを書く（色・角丸・余白はカードが持つ）。カードの要素には data-widget-card が付く
 * （追加したカードを光らせる WidgetHost が選ぶ印）
 */
export function WidgetCard({
  className,
  onClick,
  label,
  children,
}: {
  className?: string;
  onClick?: () => void;
  /** 読み上げ用の名前（押せるカードで、中身だけでは分かりにくいとき） */
  label?: string;
  children: ReactNode;
}) {
  const classes = cx(
    "glass relative flex size-full flex-col items-start justify-center gap-1 overflow-hidden rounded-card p-(--card-padding) text-left text-text text-shadow-none",
    "[&_:is(h1,h2)]:text-card [&_:is(h1,h2)]:font-bold",
    onClick && "press-wide cursor-pointer",
    className,
  );
  if (onClick)
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={label} data-widget-card="">
        {children}
      </button>
    );
  return (
    <div className={classes} data-widget-card="">
      {children}
    </div>
  );
}

/** ウィジェットの中の補足の一行（「未接続」の理由など）。tone="error" で注意の色 */
export function WidgetHint({ tone, children }: { tone?: "error"; children: ReactNode }) {
  return <p className={cx("text-caption font-medium", tone === "error" ? "text-warn" : "text-muted")}>{children}</p>;
}

/** 詳しい画面（ウィジェットを押すと開く）の中身の枠と見出し */
export function DetailFrame({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      {title && <h2 className="mb-4 text-heading font-semibold">{title}</h2>}
      {children}
    </div>
  );
}

/** 画面（ScreenFrame の中）の区切り。見出しを付けられる */
export function ScreenSection({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cx("mb-10 wall:mb-6", className)}>
      {title && <h2 className="mb-4 text-small font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  );
}

const SIDE_NARROW = {
  hide: "tablet:hidden",
  below: "tablet:order-1",
} as const;

/**
 * 左に選ぶ欄（受信箱・カレンダーの一覧など）、右に中身を置く2カラム（設定・チャットと同じ並び）。
 * 狭い画面（900px 以下）では1列にし、narrow が "hide" なら左の欄を出さない（代わりの選び方を右上などに置く）、
 * "below" なら中身の下に回す。左の欄は送っても見えるよう貼り付け、項目が多ければ欄の中で送る
 */
export function SideLayout({
  side,
  sideLabel,
  narrow = "below",
  className,
  children,
}: {
  side: ReactNode;
  sideLabel: string;
  narrow?: "hide" | "below";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("grid grid-cols-side items-start gap-8 tablet:grid-cols-1", className)}>
      <aside
        className={cx(
          "shadow-room-x shadow-room-b sticky top-0 max-h-svh min-w-0 overflow-y-auto overscroll-contain",
          "tablet:static tablet:max-h-none tablet:overflow-visible",
          SIDE_NARROW[narrow],
        )}
        aria-label={sideLabel}
      >
        {side}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** SideLayout の左の欄が出ない狭い画面でだけ出すもの（右上の「受信箱を選ぶ」など） */
export function NarrowOnly({ children }: { children: ReactNode }) {
  return <div className="hidden tablet:contents">{children}</div>;
}

const STAT_TONES = {
  // 縁の色（glass は components の層にあるので、border-* がいつも勝つ）
  warm: { tile: "border-warn/45", value: "text-warn" },
  hot: { tile: "border-danger-strong/55", value: "text-danger-strong" },
} as const;

/**
 * 値のタイル（Home Control のセンサーと同じ形）。上にアイコン付きの名前、大きな値（単位は unit）、その下に children、
 * いちばん下に note。StatGrid に並べる
 */
export function StatTile({
  icon,
  label,
  value,
  unit,
  note,
  tone,
  onClick,
  ariaLabel,
  className,
  children,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  /** 気を付けたい値（warm: 注意の色 / hot: 危ない色）。数値と縁の色が変わる */
  tone?: "warm" | "hot";
  /** 押すと詳しい中身を開くとき */
  onClick?: () => void;
  /** 押せるタイルの読み上げ（値と単位をまとめて伝えたいとき） */
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-label text-muted">
        <Icon name={icon} />
        {label}
      </span>
      <span className={cx("text-stat font-semibold leading-none", tone ? STAT_TONES[tone].value : "text-text")}>
        {value}
        {unit && <small className="ml-1 text-unit font-normal">{unit}</small>}
      </span>
      {children}
      {note && <span className="mt-auto text-note leading-normal font-medium text-muted">{note}</span>}
    </>
  );
  const classes = cx(
    "glass flex min-w-0 flex-col gap-2.5 rounded-card px-6 py-5 text-left leading-tight text-text text-shadow-none tabular-nums",
    tone && STAT_TONES[tone].tile,
    onClick && "press cursor-pointer hover:border-tint/35",
    className,
  );
  if (onClick)
    return (
      <button type="button" className={classes} aria-label={ariaLabel} onClick={onClick}>
        {content}
      </button>
    );
  return <div className={classes}>{content}</div>;
}

/** 値のタイルを、幅に合わせて並べる（どの行のタイルも同じ高さにそろえる） */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-3 grid grid-cols-stat auto-rows-fr gap-3.5">{children}</div>;
}

/** 画面の知らせ（「つながりません」など）。tone="error" で注意の色 */
export function ScreenNotice({ tone, children }: { tone?: "error"; children: ReactNode }) {
  if (tone === "error")
    return (
      <p className="mb-5 animate-fade rounded-inner bg-danger-strong/16 px-4 py-3 leading-normal text-danger untrim" role="alert">
        {children}
      </p>
    );
  return <p className="animate-fade leading-normal font-medium text-muted untrim">{children}</p>;
}

interface SliderProps {
  value: number;
  min?: number;
  max: number;
  /** 値の刻み（ドラッグの値もこの刻みにそろえる。0 なら刻まない） */
  step?: number;
  /** 矢印キー1回で動く量（既定は step。step も 0 なら幅の 1/20） */
  keyStep?: number;
  disabled?: boolean;
  label: string;
  /** 読み上げる値（「1:23 / 3:45」「60%」など） */
  valueText?: string;
  /** 動かしている間の値（離す前。画面にすぐ当てて見せるのに使う） */
  onInput?: (value: number) => void;
  /** 決まった値（指を離したとき・矢印キーを押したとき）。保存・送信はこちらで一度だけする */
  onCommit: (value: number) => void;
  /** 明るい地の上に置くときなどに色を変える（--slider-color・--slider-track を指定するクラス）。並べ方（flex-1 など）も */
  className?: string;
}

/**
 * つまみを動かして値を選ぶバー（プレイヤーの再生位置・壁紙の暗さの強さなど）。バーを押す・つまみをドラッグする・矢印キーで動かす。
 * 動かしている間は指の位置を出し、離したときに onCommit を一度だけ呼ぶ
 */
export function Slider({
  value,
  min = 0,
  max,
  step = 0,
  keyStep,
  disabled,
  label,
  valueText,
  onInput,
  onCommit,
  className,
}: SliderProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragging = useRef(false);
  const usable = !disabled && max > min;
  const shown = dragValue ?? value;
  const ratio = usable ? Math.min(1, Math.max(0, (shown - min) / (max - min))) : 0;

  const snap = (raw: number) => {
    const stepped = step > 0 ? min + Math.round((raw - min) / step) * step : raw;
    // 刻みの足し算で 0.30000000000000004 のような値にしない
    return Math.min(max, Math.max(min, Math.round(stepped * 1e6) / 1e6));
  };
  const valueAt = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    return snap(min + Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * (max - min));
  };
  const move = (next: number) => {
    setDragValue(next);
    onInput?.(next);
  };

  return (
    <div
      ref={barRef}
      className={cx(
        "relative flex h-7 touch-none items-center rounded-full select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft",
        usable ? "cursor-pointer" : "cursor-default",
        className,
      )}
      role="slider"
      tabIndex={usable ? 0 : -1}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={shown}
      aria-valuetext={valueText}
      aria-disabled={!usable}
      onPointerDown={(event) => {
        if (!usable) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        move(valueAt(event.clientX));
      }}
      onPointerMove={(event) => {
        if (dragging.current) move(valueAt(event.clientX));
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        dragging.current = false;
        const next = valueAt(event.clientX);
        setDragValue(null);
        onCommit(next);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setDragValue(null);
        onInput?.(value);
      }}
      onKeyDown={(event) => {
        if (!usable) return;
        const unit = keyStep ?? (step > 0 ? step : (max - min) / 20);
        const delta =
          event.key === "ArrowRight" || event.key === "ArrowUp"
            ? unit
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? -unit
              : 0;
        if (!delta) return;
        event.preventDefault();
        const next = snap(shown + delta);
        onInput?.(next);
        onCommit(next);
      }}
    >
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--slider-track,var(--line))]">
        <span className="block h-full rounded-full bg-[var(--slider-color,var(--text-primary))]" style={{ width: `${ratio * 100}%` }} />
      </div>
      {/* つまみ。触れている間・キーボードで選んでいる間は大きくする */}
      {usable && (
        <span
          className="knob-shadow absolute top-1/2 size-3.5 -translate-1/2 rounded-full bg-[var(--slider-color,var(--text-primary))] transition-transform duration-(--motion-fast) ease-standard [:focus-visible>&]:scale-143 [:active>&]:scale-143"
          style={{ left: `${ratio * 100}%` }}
        />
      )}
    </div>
  );
}
