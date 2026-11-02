import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Badge,
  Button,
  ButtonRow,
  Check,
  Chip,
  cx,
  IconButton,
  DetailFrame,
  Field,
  Message,
  WidgetCard,
  WidgetHint,
  defineMessages,
  defineWidget,
  extensionApiUrl,
  useDateFormat,
  usePolledResource,
  type WidgetDetailProps,
  type WidgetProps,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import {
  MAX_FROM,
  MAX_TEXT,
  NOTE_ALIGN_X,
  NOTE_ALIGN_Y,
  NOTE_BUBBLES,
  NOTE_COLORS,
  NOTE_EXPIRES,
  NOTE_BURSTS,
  type NoteAlignX,
  type NoteAlignY,
  type NoteBubble,
  type NoteColor,
  type NoteExpires,
  type NoteBurst,
  type StickyNote,
} from "./notes";
import { NoteBurstLayer, hasMotion, useArrivals, useBubbleFlash } from "./effects";

interface StickyNotesConfig {
  pollIntervalMs: number;
}

const messages = defineMessages({
  ja: {
    title: "伝言",
    count: "{n}枚",
    add: "付箋を貼る",
    addShort: "貼る",
    empty: "伝言はありません",
    emptyHint: "＋から付箋を貼れます",
    loadFailed: "付箋を読めませんでした",
    requestFailed: "うまくいきませんでした（{status}）",
    detailTitle: "付箋",
    text: "伝言",
    textPlaceholder: "例: 冷蔵庫のケーキは明日の分です",
    previewPlaceholder: "ここに伝言が出ます",
    preview: "見本",
    replay: "もう一度動かす",
    from: "書いた人（任意）",
    color: "色",
    alignX: "横の揃え",
    alignY: "縦の揃え",
    bubble: "付箋の動き",
    burst: "付箋の中の効果",
    repeat: "ときどき繰り返して目立たせる（5分ごと）",
    expires: "はがす時期",
    expires_none: "はがすまで",
    expires_today: "今日中",
    expires_tomorrow: "明日まで",
    expires_week: "1週間",
    color_yellow: "黄",
    color_pink: "ピンク",
    color_blue: "青",
    color_green: "緑",
    alignX_start: "左",
    alignX_center: "中央",
    alignX_end: "右",
    alignY_top: "上",
    alignY_middle: "中央",
    alignY_bottom: "下",
    bubble_none: "なし",
    bubble_slam: "ドン",
    bubble_loud: "大声",
    bubble_gentle: "そっと",
    bubble_ink: "見えないインク",
    burst_none: "なし",
    burst_confetti: "紙吹雪",
    burst_balloons: "風船",
    burst_hearts: "ハート",
    inkHint: "押すと読めます",
    posting: "貼っています…",
    peel: "はがす",
    peelConfirm: "もう一度押すとはがします",
    board: "貼ってある付箋",
    justNow: "たった今",
    minutesAgo: "{n}分前",
    hoursAgo: "{n}時間前",
    daysAgo: "{n}日前",
    untilToday: "今日中",
    untilTomorrow: "明日まで",
    until: "{date}まで",
  },
  en: {
    title: "Notes",
    count: "{n}",
    add: "Stick a note",
    addShort: "Stick",
    empty: "No notes",
    emptyHint: "Tap + to stick one",
    loadFailed: "Couldn't load the notes",
    requestFailed: "That didn't work ({status})",
    detailTitle: "Sticky notes",
    text: "Message",
    textPlaceholder: "e.g. The cake in the fridge is for tomorrow",
    previewPlaceholder: "Your message shows here",
    preview: "Preview",
    replay: "Play again",
    from: "From (optional)",
    color: "Color",
    alignX: "Horizontal alignment",
    alignY: "Vertical alignment",
    bubble: "Note effect",
    burst: "Effect inside the note",
    repeat: "Repeat now and then to stand out (every 5 min)",
    expires: "Peel off",
    expires_none: "When peeled",
    expires_today: "End of today",
    expires_tomorrow: "End of tomorrow",
    expires_week: "In a week",
    color_yellow: "Yellow",
    color_pink: "Pink",
    color_blue: "Blue",
    color_green: "Green",
    alignX_start: "Left",
    alignX_center: "Center",
    alignX_end: "Right",
    alignY_top: "Top",
    alignY_middle: "Middle",
    alignY_bottom: "Bottom",
    bubble_none: "None",
    bubble_slam: "Slam",
    bubble_loud: "Loud",
    bubble_gentle: "Gentle",
    bubble_ink: "Invisible ink",
    burst_none: "None",
    burst_confetti: "Confetti",
    burst_balloons: "Balloons",
    burst_hearts: "Hearts",
    inkHint: "Tap to read",
    posting: "Sticking…",
    peel: "Peel off",
    peelConfirm: "Tap again to peel off",
    board: "Notes on the board",
    justNow: "Just now",
    minutesAgo: "{n} min ago",
    hoursAgo: "{n} h ago",
    daysAgo: "{n} d ago",
    untilToday: "Until today",
    untilTomorrow: "Until tomorrow",
    until: "Until {date}",
  },
});

type T = ReturnType<typeof messages.useT>;

async function request<R>(ctx: WidgetRuntimeContext, path: string, init?: RequestInit & { json?: unknown }): Promise<R> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "sticky-notes", path), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body as R;
}

const fetchNotes = async (ctx: WidgetRuntimeContext) => (await request<{ notes: StickyNote[] }>(ctx, "/notes")).notes;

/** 自分で貼った・はがしたときに、同じ画面のカードと詳細を読み直す（WebSocket が切れていても） */
const CHANGED_EVENT = "sticky-notes:changed";
const notifyChanged = () => window.dispatchEvent(new Event(CHANGED_EVENT));

/**
 * 付箋を読む。サーバーが api.broadcast("changed") すると WebSocket に ext:sticky-notes:changed が届くので、
 * ほかの端末で貼られたものもすぐ出る。ポーリングは知らせを取りこぼしたときの保険
 */
function useNotes(ctx: WidgetRuntimeContext, intervalMs: number) {
  const resource = usePolledResource(() => fetchNotes(ctx), intervalMs);
  const { refresh } = resource;
  useEffect(() => {
    const reload = () => void refresh();
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      if (String(event.data).includes('"ext:sticky-notes:changed"')) reload();
    };
    socket?.addEventListener("message", onMessage);
    window.addEventListener(CHANGED_EVENT, reload);
    return () => {
      socket?.removeEventListener("message", onMessage);
      window.removeEventListener(CHANGED_EVENT, reload);
    };
  }, [ctx.socket, refresh]);
  return resource;
}

function ago(iso: string, t: T): string {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}

/** 期限は「その日の終わり（翌日 0 時）」で持っているので、1 ミリ秒戻してその日として読む */
function useUntilText(t: T) {
  const date = useDateFormat();
  return (iso: string | null): string | null => {
    if (!iso) return null;
    const lastDay = new Date(Date.parse(iso) - 1);
    const today = new Date();
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(lastDay, today)) return t("untilToday");
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (sameDay(lastDay, tomorrow)) return t("untilTomorrow");
    return t("until", { date: date(lastDay, "monthDay") });
  };
}

type NoteLook = Pick<StickyNote, "color" | "alignX" | "alignY" | "bubble" | "burst">;

/** 紙の色（色そのものは本体の theme/small.css の sticky-paper-*） */
const PAPER: Record<NoteColor, string> = {
  yellow: "sticky-paper-yellow",
  pink: "sticky-paper-pink",
  blue: "sticky-paper-blue",
  green: "sticky-paper-green",
};

/** 付箋ごとに少しずつ傾ける（並べたときに手で貼ったように見せる） */
const TILT = ["-rotate-1", "rotate-1", "rotate-0"];

/** 付箋の動き（効果の間だけ付ける）。見えないインクは動きではないので付けない */
const BUBBLE_FX: Record<NoteBubble, string> = {
  none: "",
  slam: "z-1 animate-sticky-slam",
  loud: "z-1 animate-sticky-loud",
  gentle: "animate-sticky-gentle",
  ink: "",
};
/** 付箋の動きに合わせた、中の文の動き */
const BUBBLE_WORDS: Record<NoteBubble, string> = {
  none: "",
  slam: "",
  loud: "font-semibold",
  gentle: "animate-sticky-gentle-words",
  ink: "",
};

/** 横の揃え（文と、書いた人の行） */
const ALIGN_X: Record<NoteAlignX, { words: string; meta: string }> = {
  start: { words: "text-left", meta: "justify-start" },
  center: { words: "text-center", meta: "justify-center" },
  end: { words: "text-right", meta: "justify-end" },
};
/**
 * 縦の揃えは auto の余白で付ける。justify-content で中央・下に寄せると、入りきらない文の頭が上で切れて読めなくなるが、
 * auto の余白は入りきらないときに 0 になるので、そのときは上から出る
 */
const ALIGN_Y: Record<NoteAlignY, string> = { top: "", middle: "my-auto", bottom: "mt-auto" };

/** 付箋 1 枚（紙・傾き・動き）。中の文と書いた人の行は NoteBody が並べる */
function noteClass(note: NoteLook, index: number, extra: { large?: boolean; playing?: boolean }) {
  return cx(
    "sticky-paper relative flex min-h-0 flex-col gap-1 overflow-hidden px-3 pt-3 pb-2 text-left",
    PAPER[note.color],
    TILT[index % 3],
    extra.large && "min-h-32",
    extra.playing && BUBBLE_FX[note.bubble],
  );
}

function NoteBody({
  note,
  text,
  meta,
  inked,
  large,
  playing,
  burst,
  t,
}: {
  note: NoteLook;
  text: string;
  meta?: ReactNode;
  inked: boolean;
  /** 詳細の大きな付箋（字を大きくし、入りきらない分もぼかさない） */
  large?: boolean;
  playing?: boolean;
  /** 動いている間だけ渡す（紙吹雪などを付箋の中で起こす） */
  burst?: NoteBurst;
  t: T;
}) {
  return (
    <>
      {burst && <NoteBurstLayer effect={burst} />}
      {/* 文字と書いた人の行は、効果の粒より手前に出す（伝言は効果の間も読める）。入りきらない分は下をぼかして切る */}
      <span
        className={cx(
          "relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden",
          !large && "mask-b-from-85%",
          inked && "sticky-ink after:animate-sticky-ink motion-reduce:after:animate-none",
        )}
      >
        <span
          className={cx(
            "untrim leading-tight whitespace-pre-wrap wrap-anywhere",
            large ? "text-title" : "text-body",
            ALIGN_X[note.alignX].words,
            ALIGN_Y[note.alignY],
            playing && BUBBLE_WORDS[note.bubble],
          )}
        >
          {text}
        </span>
      </span>
      {inked && <span className="relative z-1 text-micro text-current/60">{t("inkHint")}</span>}
      {meta}
    </>
  );
}

function NoteMeta({ note, t }: { note: StickyNote; t: T }) {
  const until = useUntilText(t)(note.expiresAt);
  return (
    <span className={cx("relative z-1 flex flex-wrap gap-x-2 gap-y-1 text-micro text-current/65", ALIGN_X[note.alignX].meta)}>
      {note.from && <span className="font-semibold">{note.from}</span>}
      <span>{ago(note.createdAt, t)}</span>
      {until && <span className="rounded-full bg-black/8 px-1">{until}</span>}
    </span>
  );
}

/** 見えないインクの付箋を押して読めるようにした id。しばらくすると、またインクに戻る */
function useInkReveal(ms = 10_000) {
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const reveal = (id: string) => {
    setRevealed((prev) => new Set([...prev, id]));
    setTimeout(() => setRevealed((prev) => new Set([...prev].filter((r) => r !== id))), ms);
  };
  return { revealed, reveal };
}

function StickyNotesView({ ctx, config, size, openDetail }: WidgetProps<StickyNotesConfig>) {
  const t = messages.useT();
  const { data, error } = useNotes(ctx, config.pollIntervalMs);
  const { playing, flash } = useBubbleFlash();
  const { revealed, reveal } = useInkReveal();
  useArrivals(data, flash);

  return (
    <WidgetCard className="flex-row-reverse items-stretch justify-start gap-3" label={t("title")}>
      {/* 付箋にカードの高さを全部使わせるため、見出しは置かず、＋と枚数を右の縦の列にまとめる */}
      <div className="flex flex-col items-center gap-2">
        <IconButton icon="add" label={t("add")} onClick={openDetail} />
        {data && data.length > 0 && <Badge tone="dim">{t("count", { n: data.length })}</Badge>}
      </div>
      {Boolean(error) && !data && <WidgetHint tone="error">{t("loadFailed")}</WidgetHint>}
      {data && data.length === 0 && (
        <button
          type="button"
          className="press flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-inner border border-dashed border-glass-border text-muted"
          onClick={openDetail}
        >
          {t("empty")}
          <span className="text-caption">{t("emptyHint")}</span>
        </button>
      )}
      {data && data.length > 0 && (
        // 高さ 1 段につき付箋 1 列。はみ出した分は横にめくって見る
        <div
          className="sticky-columns grid min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-1"
          style={{ gridTemplateRows: `repeat(${Math.max(1, size.h)}, minmax(0, 1fr))` }}
        >
          {data.map((note, i) => {
            const inked = note.bubble === "ink" && !revealed.has(note.id);
            return (
              <button
                key={note.id}
                type="button"
                className={cx(noteClass(note, i, { playing: playing.has(note.id) }), "press cursor-pointer")}
                // 見えないインクは、1 回目に押したらその場で読めるようにする（詳細は 2 回目から）
                onClick={inked ? () => reveal(note.id) : openDetail}
              >
                <NoteBody
                  note={note}
                  text={note.text}
                  inked={inked}
                  playing={playing.has(note.id)}
                  burst={playing.has(note.id) ? note.burst : undefined}
                  t={t}
                  meta={<NoteMeta note={note} t={t} />}
                />
              </button>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

const FROM_KEY = "sticky-notes:from";

function rememberedFrom(): string {
  try {
    return localStorage.getItem(FROM_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 選ぶもののチップの並び（1 つだけ選べる） */
function Choices<V extends string>({
  label,
  values,
  value,
  onChange,
  text,
}: {
  label: string;
  values: readonly V[];
  value: V;
  onChange: (value: V) => void;
  text: (value: V) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {values.map((v) => (
        // 1 つだけ選ぶので、押す・押さないの aria-pressed ではなく radio として読ませる
        <Chip
          key={v}
          role="radio"
          aria-checked={value === v}
          aria-pressed={undefined}
          selected={value === v}
          onClick={() => onChange(v)}
        >
          {text(v)}
        </Chip>
      ))}
    </div>
  );
}

const PREVIEW_ID = "preview";

function NoteForm({ ctx, t }: { ctx: WidgetRuntimeContext; t: T }) {
  const [text, setText] = useState("");
  const [from, setFrom] = useState(rememberedFrom);
  const [color, setColor] = useState<NoteColor>("yellow");
  const [alignX, setAlignX] = useState<NoteAlignX>("start");
  const [alignY, setAlignY] = useState<NoteAlignY>("top");
  const [bubble, setBubble] = useState<NoteBubble>("none");
  const [burst, setBurst] = useState<NoteBurst>("none");
  const [repeat, setRepeat] = useState(false);
  const [expires, setExpires] = useState<NoteExpires>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { playing, flash } = useBubbleFlash();
  const [inkRevealed, setInkRevealed] = useState(false);

  // 効果を選んだら、iMessage の効果の選び方と同じく、その場で見本を動かす
  const chooseBubble = (value: NoteBubble) => {
    setBubble(value);
    setInkRevealed(false);
    if (hasMotion({ bubble: value, burst })) flash([PREVIEW_ID]);
  };
  const chooseBurst = (value: NoteBurst) => {
    setBurst(value);
    if (hasMotion({ bubble, burst: value })) flash([PREVIEW_ID]);
  };
  const replay = () => {
    setInkRevealed(false);
    if (hasMotion({ bubble, burst })) flash([PREVIEW_ID]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request(ctx, "/notes", {
        method: "POST",
        json: { text, from, color, alignX, alignY, bubble, burst, repeat: repeat && hasMotion({ bubble, burst }), expires },
      });
      try {
        localStorage.setItem(FROM_KEY, from.trim());
      } catch {
        // 保存できない端末では毎回入れてもらう
      }
      setText("");
      notifyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const preview: NoteLook = { color, alignX, alignY, bubble, burst };
  const inked = bubble === "ink" && !inkRevealed;

  return (
    <form className="mb-6 flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      <div className="flex gap-6 phone:flex-col">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Field label={t("text")}>
            <textarea
              className="resize-y"
              rows={3}
              value={text}
              maxLength={MAX_TEXT}
              placeholder={t("textPlaceholder")}
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
            <Field label={t("from")}>
              <input value={from} maxLength={MAX_FROM} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("expires")}>
              <select value={expires} onChange={(e) => setExpires(e.target.value as NoteExpires)}>
                {NOTE_EXPIRES.map((value) => (
                  <option key={value} value={value}>
                    {t(`expires_${value}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("color")}>
            <div className="flex gap-3" role="radiogroup" aria-label={t("color")}>
              {NOTE_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={color === value}
                  aria-label={t(`color_${value}`)}
                  className={cx(
                    "press size-10 cursor-pointer rounded-art border-2 border-transparent bg-(--sticky-paper)",
                    "aria-checked:border-text aria-checked:ring-2 aria-checked:ring-shade/50",
                    PAPER[value],
                  )}
                  onClick={() => setColor(value)}
                />
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
            <Field label={t("alignX")}>
              <Choices label={t("alignX")} values={NOTE_ALIGN_X} value={alignX} onChange={setAlignX} text={(v) => t(`alignX_${v}`)} />
            </Field>
            <Field label={t("alignY")}>
              <Choices label={t("alignY")} values={NOTE_ALIGN_Y} value={alignY} onChange={setAlignY} text={(v) => t(`alignY_${v}`)} />
            </Field>
          </div>
          <Field label={t("bubble")}>
            <Choices label={t("bubble")} values={NOTE_BUBBLES} value={bubble} onChange={chooseBubble} text={(v) => t(`bubble_${v}`)} />
          </Field>
          <Field label={t("burst")}>
            <Choices label={t("burst")} values={NOTE_BURSTS} value={burst} onChange={chooseBurst} text={(v) => t(`burst_${v}`)} />
          </Field>
          <Check checked={repeat} disabled={!hasMotion({ bubble, burst })} onChange={setRepeat}>
            {t("repeat")}
          </Check>
        </div>
        {/* 背の低い壁掛けの画面では小窓の中をスクロールするので、見本は見えるところに残す（1 列のときは下の付箋に重ならないよう貼り付けない） */}
        <div
          className="sticky top-0 flex w-52 shrink-0 flex-col gap-3 self-start phone:static phone:w-auto phone:self-stretch"
          aria-label={t("preview")}
        >
          <span className="text-note text-muted">{t("preview")}</span>
          <div
            className={cx(noteClass(preview, 0, { large: true, playing: playing.has(PREVIEW_ID) }), "h-44")}
            onClick={inked ? () => setInkRevealed(true) : undefined}
          >
            <NoteBody
              note={preview}
              text={text.trim() || t("previewPlaceholder")}
              inked={inked}
              large
              playing={playing.has(PREVIEW_ID)}
              burst={playing.has(PREVIEW_ID) ? burst : undefined}
              t={t}
            />
          </div>
          <Button icon="arrow-sync" onClick={replay} disabled={!hasMotion({ bubble, burst })}>
            {t("replay")}
          </Button>
        </div>
      </div>
      {error && <Message tone="error">{error}</Message>}
      <ButtonRow>
        <Button variant="primary" type="submit" icon="add" disabled={busy || !text.trim()}>
          {busy ? t("posting") : t("addShort")}
        </Button>
      </ButtonRow>
    </form>
  );
}

function StickyNotesDetail({ ctx, config }: WidgetDetailProps<StickyNotesConfig>) {
  const t = messages.useT();
  const { data } = useNotes(ctx, config.pollIntervalMs);
  const { playing, flash } = useBubbleFlash();
  const { revealed, reveal } = useInkReveal();
  /** はがすのは 2 回押し。壁の端末で手が当たってはがれないように */
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peel = async (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    setError(null);
    try {
      await request(ctx, `/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    notifyChanged();
  };

  // 貼ってある付箋を押すと、その効果をもう一度見られる
  const replay = (note: StickyNote) => {
    if (note.bubble === "ink" && !revealed.has(note.id)) return reveal(note.id);
    if (hasMotion(note)) flash([note.id]);
  };

  return (
    <DetailFrame title={t("detailTitle")} className="w-208 max-w-full phone:w-auto">
      <NoteForm ctx={ctx} t={t} />
      {error && <Message tone="error">{error}</Message>}
      {data && data.length > 0 && (
        <section className="sticky-board gap-4" aria-label={t("board")}>
          {data.map((note, i) => {
            const inked = note.bubble === "ink" && !revealed.has(note.id);
            return (
              <div
                key={note.id}
                className={cx(noteClass(note, i, { large: true, playing: playing.has(note.id) }), "cursor-pointer")}
                onClick={() => replay(note)}
              >
                <NoteBody
                  note={note}
                  text={note.text}
                  inked={inked}
                  large
                  playing={playing.has(note.id)}
                  burst={playing.has(note.id) ? note.burst : undefined}
                  t={t}
                  meta={<NoteMeta note={note} t={t} />}
                />
                <Button
                  variant={armed === note.id ? "danger" : "default"}
                  className="relative z-1 self-end"
                  onClick={(e) => {
                    e.stopPropagation();
                    void peel(note.id);
                  }}
                >
                  {armed === note.id ? t("peelConfirm") : t("peel")}
                </Button>
              </div>
            );
          })}
        </section>
      )}
    </DetailFrame>
  );
}

export default defineWidget<StickyNotesConfig>({
  id: "sticky-notes",
  name: { ja: "付箋（伝言）", en: "Sticky notes" },
  description: {
    ja: "家にいる人への伝言を付箋で貼ります。文字の揃えや、iMessage のような効果を付けられます",
    en: "Leave notes for whoever is at home, with text alignment and iMessage-style effects",
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  // ふだんは WebSocket の知らせで読み直す。これは知らせを取りこぼしたときの保険
  defaultConfig: { pollIntervalMs: 60 * 1000 },
  Component: StickyNotesView,
  DetailComponent: StickyNotesDetail,
});
