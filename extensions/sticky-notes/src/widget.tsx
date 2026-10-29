import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  ButtonRow,
  Check,
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
  NOTE_SCREENS,
  type NoteAlignX,
  type NoteAlignY,
  type NoteBubble,
  type NoteColor,
  type NoteExpires,
  type NoteScreen,
  type StickyNote,
} from "./notes";
import { ScreenEffects, playScreenEffect, useArrivals, useBubbleFlash } from "./effects";

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
    screen: "画面の効果",
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
    screen_none: "なし",
    screen_confetti: "紙吹雪",
    screen_balloons: "風船",
    screen_hearts: "ハート",
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
    screen: "Screen effect",
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
    screen_none: "None",
    screen_confetti: "Confetti",
    screen_balloons: "Balloons",
    screen_hearts: "Hearts",
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

type NoteLook = Pick<StickyNote, "color" | "alignX" | "alignY" | "bubble">;

function noteClass(note: NoteLook, index: number, extra: { large?: boolean; playing?: boolean; inked?: boolean }) {
  return [
    "sticky-note",
    `sticky-note--${note.color}`,
    `sticky-note--x-${note.alignX}`,
    `sticky-note--y-${note.alignY}`,
    `sticky-note--tilt${index % 3}`,
    extra.large && "sticky-note--large",
    extra.playing && `sticky-note--fx-${note.bubble}`,
    extra.inked && "sticky-note--ink",
  ]
    .filter(Boolean)
    .join(" ");
}

function NoteBody({ text, meta, inked, t }: { text: string; meta?: ReactNode; inked: boolean; t: T }) {
  return (
    <>
      <span className="sticky-note__text">
        <span className="sticky-note__words">{text}</span>
      </span>
      {inked && <span className="sticky-note__ink-hint">{t("inkHint")}</span>}
      {meta}
    </>
  );
}

function NoteMeta({ note, t }: { note: StickyNote; t: T }) {
  const until = useUntilText(t)(note.expiresAt);
  return (
    <span className="sticky-note__meta">
      {note.from && <span className="sticky-note__from">{note.from}</span>}
      <span>{ago(note.createdAt, t)}</span>
      {until && <span className="sticky-note__until">{until}</span>}
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
    <WidgetCard className="sticky-notes" label={t("title")}>
      <ScreenEffects />
      {/* 付箋にカードの高さを全部使わせるため、見出しは置かず、＋と枚数を右の縦の列にまとめる */}
      <div className="sticky-notes__side">
        <button type="button" className="sticky-notes__add ui-glass" onClick={openDetail} aria-label={t("add")}>
          ＋
        </button>
        {data && data.length > 0 && <span className="sticky-notes__count">{t("count", { n: data.length })}</span>}
      </div>
      {Boolean(error) && !data && <WidgetHint tone="error">{t("loadFailed")}</WidgetHint>}
      {data && data.length === 0 && (
        <button type="button" className="sticky-notes__empty" onClick={openDetail}>
          {t("empty")}
          <span className="widget-hint">{t("emptyHint")}</span>
        </button>
      )}
      {data && data.length > 0 && (
        // 高さ 1 段につき付箋 1 列。はみ出した分は横にめくって見る
        <div className="sticky-notes__board" style={{ gridTemplateRows: `repeat(${Math.max(1, size.h)}, minmax(0, 1fr))` }}>
          {data.map((note, i) => {
            const inked = note.bubble === "ink" && !revealed.has(note.id);
            return (
              <button
                key={note.id}
                type="button"
                className={noteClass(note, i, { playing: playing.has(note.id), inked })}
                // 見えないインクは、1 回目に押したらその場で読めるようにする（詳細は 2 回目から）
                onClick={inked ? () => reveal(note.id) : openDetail}
              >
                <NoteBody text={note.text} inked={inked} t={t} meta={<NoteMeta note={note} t={t} />} />
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
    <div className="sticky-notes-choices" role="radiogroup" aria-label={label}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={`sticky-notes-choices__chip ui-glass${value === v ? " sticky-notes-choices__chip--on" : ""}`}
          onClick={() => onChange(v)}
        >
          {text(v)}
        </button>
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
  const [screen, setScreen] = useState<NoteScreen>("none");
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
    if (value !== "none" && value !== "ink") flash([PREVIEW_ID]);
  };
  const chooseScreen = (value: NoteScreen) => {
    setScreen(value);
    playScreenEffect(value);
  };
  const replay = () => {
    setInkRevealed(false);
    if (bubble !== "none" && bubble !== "ink") flash([PREVIEW_ID]);
    playScreenEffect(screen);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request(ctx, "/notes", {
        method: "POST",
        json: { text, from, color, alignX, alignY, bubble, screen, repeat, expires },
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

  const preview: NoteLook = { color, alignX, alignY, bubble };
  const inked = bubble === "ink" && !inkRevealed;

  return (
    <form className="sticky-notes-form" onSubmit={(e) => void submit(e)}>
      <div className="sticky-notes-form__fields">
        <Field label={t("text")}>
          <textarea
            rows={3}
            value={text}
            maxLength={MAX_TEXT}
            placeholder={t("textPlaceholder")}
            autoFocus
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="sticky-notes-form__row">
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
          <div className="sticky-notes-form__colors" role="radiogroup" aria-label={t("color")}>
            {NOTE_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={color === value}
                aria-label={t(`color_${value}`)}
                className={`sticky-notes-form__swatch sticky-note--${value}`}
                onClick={() => setColor(value)}
              />
            ))}
          </div>
        </Field>
        <div className="sticky-notes-form__row">
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
        <Field label={t("screen")}>
          <Choices label={t("screen")} values={NOTE_SCREENS} value={screen} onChange={chooseScreen} text={(v) => t(`screen_${v}`)} />
        </Field>
        <Check checked={repeat} disabled={bubble === "none" || bubble === "ink"} onChange={setRepeat}>
          {t("repeat")}
        </Check>
      </div>
      <div className="sticky-notes-form__preview" aria-label={t("preview")}>
        <span className="sticky-notes-form__preview-label">{t("preview")}</span>
        <div
          className={noteClass(preview, 0, { large: true, playing: playing.has(PREVIEW_ID), inked })}
          onClick={inked ? () => setInkRevealed(true) : undefined}
        >
          <NoteBody text={text.trim() || t("previewPlaceholder")} inked={inked} t={t} />
        </div>
        <Button icon="arrow-sync" onClick={replay} disabled={bubble === "none" && screen === "none"}>
          {t("replay")}
        </Button>
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
    if (note.bubble !== "none" && note.bubble !== "ink") flash([note.id]);
    playScreenEffect(note.screen);
  };

  return (
    <DetailFrame title={t("detailTitle")} className="sticky-notes-detail">
      <NoteForm ctx={ctx} t={t} />
      {error && <Message tone="error">{error}</Message>}
      {data && data.length > 0 && (
        <section className="sticky-notes-detail__board" aria-label={t("board")}>
          {data.map((note, i) => {
            const inked = note.bubble === "ink" && !revealed.has(note.id);
            return (
              <div
                key={note.id}
                className={noteClass(note, i, { large: true, playing: playing.has(note.id), inked })}
                onClick={() => replay(note)}
              >
                <NoteBody text={note.text} inked={inked} t={t} meta={<NoteMeta note={note} t={t} />} />
                <button
                  type="button"
                  className={`sticky-note__peel ${armed === note.id ? "sticky-note__peel--armed" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void peel(note.id);
                  }}
                >
                  {armed === note.id ? t("peelConfirm") : t("peel")}
                </button>
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
