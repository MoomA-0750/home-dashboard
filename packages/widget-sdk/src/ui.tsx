import { useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * 拡張機能が画面を組むための本体の部品（ボタン・入れ物・一覧・入力欄・文字）。見た目は本体の theme.css の ui-* が持つので、
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

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export type ButtonVariant = "default" | "primary" | "danger";

interface ButtonOwnProps {
  /** primary: その場でいちばん押すもの（保存など）。danger: 消すのを確かめるもの */
  variant?: ButtonVariant;
  /** 文字の前に出すアイコン */
  icon?: IconName;
}

/** ボタン。どれも丸い端の同じ高さ。type は既定で "button"（フォームを送るものだけ "submit" にする） */
export function Button({
  variant = "default",
  icon,
  className,
  type = "button",
  children,
  ...rest
}: ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx("ui-button", variant !== "default" && `ui-button--${variant}`, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/** アイコンだけのボタン（閉じる・その他の操作）。押せる大きさは 44px の丸。label は読み上げと hover の説明に使う */
export function IconButton({
  icon,
  label,
  className,
  type = "button",
  ...rest
}: { icon: IconName; label: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type={type} className={cx("ui-icon-button", className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
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
      className={cx("ui-progress", className)}
      {...(label
        ? { role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent }
        : { "aria-hidden": true })}
    >
      <span className="ui-progress__fill" style={{ width: `${percent}%` }} />
    </span>
  );
}

/** ボタンの形のリンク（書き出し・外のページを開くなど） */
export function ButtonLink({
  variant = "default",
  icon,
  className,
  children,
  ...rest
}: ButtonOwnProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cx("ui-button", variant !== "default" && `ui-button--${variant}`, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </a>
  );
}

/** ボタンを横に並べる（入りきらなければ折り返す） */
export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="ui-button-row">{children}</div>;
}

/** 入れ物（区画）。中に入力欄やボタンを並べる。角丸と内側の余白は本体が決める */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("ui-group", className)}>{children}</section>;
}

/** 線で区切った一覧の入れ物。中に ListItem を並べる */
export function List({ children, label, boxed }: { children: ReactNode; label?: string; boxed?: boolean }) {
  return (
    <ul className={boxed ? "ui-list ui-list--boxed" : "ui-list"} aria-label={label}>
      {children}
    </ul>
  );
}

export interface ListItemProps {
  title: ReactNode;
  /** 名前の下に小さく出す説明 */
  detail?: ReactNode;
  /** 名前の右に小さく出す印（「既定」など） */
  badge?: ReactNode;
  /** 左に出すもの（アイコン・画像） */
  leading?: ReactNode;
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
}

/** 一覧の1行（名前と説明。左右に何かを置ける） */
export function ListItem({ title, detail, badge, leading, trailing, onClick, off, selected, chevron = true, error }: ListItemProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick?.();
  };
  return (
    <li>
      <div
        className={cx("ui-list-item", onClick && "ui-list-item--action", off && "ui-list-item--off", selected && "ui-list-item--on")}
        aria-current={selected ? "true" : undefined}
        {...(onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown } : {})}
      >
        {leading}
        <span className="ui-list-item__text">
          <span className="ui-list-item__title">
            <span className="ui-list-item__name">{title}</span>
            {badge && <small>{badge}</small>}
          </span>
          {detail && (
            <span className={cx("ui-list-item__detail", error && "ui-list-item__detail--error")}>{detail}</span>
          )}
        </span>
        {trailing}
        {onClick && chevron && <Icon name="chevron-right" className="ui-list-item__chevron" />}
      </div>
    </li>
  );
}

/** 入力欄・選ぶ欄に名前と説明を付ける。children に <input>・<select>・<textarea> を1つ置く */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
      {hint && <small className="ui-field__hint">{hint}</small>}
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
    <label className="ui-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** 区画の見出し */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="ui-section-title">{children}</h4>;
}

/** 説明の文 */
export function Note({ children }: { children: ReactNode }) {
  return <p className="ui-note">{children}</p>;
}

/** 目立たせる知らせ（気をつけてほしいこと） */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="ui-notice">{children}</p>;
}

/** 操作の結果（できた・できなかった） */
export function Message({ tone = "ok", children }: { tone?: "ok" | "error"; children: ReactNode }) {
  return (
    <p className={cx("ui-message", tone === "error" && "ui-message--error")} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

/** 小さな印（件数・状態）。tone: on（入っている・設定済み）／warn（気を付ける・変更あり）／dim（控えめ） */
export function Badge({ on, tone, children }: { on?: boolean; tone?: "on" | "warn" | "dim"; children: ReactNode }) {
  const kind = tone ?? (on ? "on" : null);
  return <span className={cx("ui-badge", kind && `ui-badge--${kind}`)}>{children}</span>;
}

/** 前の画面へ戻るボタン（一覧から開いた詳しい画面の左上） */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ui-back" onClick={onClick}>
      <Icon name="chevron-left" />
      <span>{label}</span>
    </button>
  );
}

/** そのまま写して使う文字（コマンド・鍵など）。押すと全体を選ぶ */
export function CodeBlock({ children }: { children: string }) {
  return <code className="ui-code">{children}</code>;
}

// --- ウィジェット・画面の部品 ---

/**
 * ウィジェットのカード（暗いガラス・角丸・内側の余白）。押すと詳しい画面を開くものは onClick を渡す（button になる）。
 * className には中身の並べ方だけを書く（色・角丸・余白はカードが持つ）
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
  if (onClick)
    return (
      <button type="button" className={cx("widget-card", className)} onClick={onClick} aria-label={label}>
        {children}
      </button>
    );
  return <div className={cx("widget-card", className)}>{children}</div>;
}

/** ウィジェットの中の補足の一行（「未接続」の理由など）。tone="error" で注意の色 */
export function WidgetHint({ tone, children }: { tone?: "error"; children: ReactNode }) {
  return <p className={cx("widget-hint", tone === "error" && "widget-status--error")}>{children}</p>;
}

/** 詳しい画面（ウィジェットを押すと開く）の中身の枠と見出し */
export function DetailFrame({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx("widget-detail", className)}>
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

/** 画面（ScreenFrame の中）の区切り。見出しを付けられる */
export function ScreenSection({ title, className, children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cx("screen__section", className)}>
      {title && <h2 className="screen__section-title">{title}</h2>}
      {children}
    </section>
  );
}

/**
 * 左に選ぶ欄（受信箱・カレンダーの一覧など）、右に中身を置く2カラム（設定・チャットと同じ並び）。
 * 狭い画面（900px 以下）では1列にし、narrow が "hide" なら左の欄を出さない（代わりの選び方を右上などに置く）、
 * "below" なら中身の下に回す
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
    <div className={cx("ui-side-layout", `ui-side-layout--narrow-${narrow}`, className)}>
      <aside className="ui-side-layout__side" aria-label={sideLabel}>
        {side}
      </aside>
      <div className="ui-side-layout__main">{children}</div>
    </div>
  );
}

/** SideLayout の左の欄が出ない狭い画面でだけ出すもの（右上の「受信箱を選ぶ」など） */
export function NarrowOnly({ children }: { children: ReactNode }) {
  return <div className="ui-narrow-only">{children}</div>;
}

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
      <span className="ui-stat__label">
        <Icon name={icon} />
        {label}
      </span>
      <span className="ui-stat__value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {children}
      {note && <span className="ui-stat__note">{note}</span>}
    </>
  );
  const classes = cx("ui-stat", tone && `ui-stat--${tone}`, onClick && "ui-stat--action", className);
  if (onClick)
    return (
      <button type="button" className={classes} aria-label={ariaLabel} onClick={onClick}>
        {content}
      </button>
    );
  return <div className={classes}>{content}</div>;
}

/** 値のタイルを、幅に合わせて並べる */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ui-stat-grid">{children}</div>;
}

/** 画面の知らせ（「つながりません」など）。tone="error" で注意の色 */
export function ScreenNotice({ tone, children }: { tone?: "error"; children: ReactNode }) {
  return (
    <p className={tone === "error" ? "screen__error" : "screen__notice"} role={tone === "error" ? "alert" : undefined}>
      {children}
    </p>
  );
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
  /** 明るい地の上に置くときなどに色を変える（--slider-color・--slider-track を指定するクラス） */
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
      className={cx("ui-slider", !usable && "ui-slider--disabled", className)}
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
      <div className="ui-slider__track">
        <span className="ui-slider__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="ui-slider__thumb" style={{ left: `${ratio * 100}%` }} />
    </div>
  );
}
