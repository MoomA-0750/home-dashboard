import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError, defineServerExtension, defineServerMessages, type Locale } from "@home-dashboard/extension-sdk";
import {
  MAX_FROM,
  MAX_NOTES,
  MAX_TEXT,
  NOTE_ALIGN_X,
  NOTE_ALIGN_Y,
  NOTE_BUBBLES,
  NOTE_COLORS,
  NOTE_EXPIRES,
  NOTE_BURSTS,
  noteExpires,
  noteStyle,
  type NoteExpires,
  type StickyNote,
} from "./notes";

const messages = defineServerMessages({
  ja: {
    noText: "伝言を書いてください",
    tooMany: "付箋は{max}枚までです。古いものをはがしてください",
    notFound: "その付箋はもうありません",
  },
  en: {
    noText: "Write a message",
    tooMany: "You can stick up to {max} notes. Peel off some old ones first",
    notFound: "That note is already gone",
  },
});

const DEFAULT_TIME_ZONE = "Asia/Tokyo";
let timeZone = DEFAULT_TIME_ZONE;

/** タイムゾーンの、その瞬間の UTC からのずれ（ミリ秒） */
function offsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}

/** 家のタイムゾーンで、今日から days 日後の終わり（＝その翌日の 0 時） */
function endOfDay(days: number, now = Date.now()): string {
  let tz = timeZone;
  try {
    offsetMs(now, tz);
  } catch {
    tz = DEFAULT_TIME_ZONE;
  }
  const local = new Date(now + offsetMs(now, tz));
  const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days + 1);
  let at = guess - offsetMs(guess, tz);
  // 夏時間の切り替わりをまたぐと 1 回目のずれが合わないので、もう一度合わせる
  const again = guess - offsetMs(at, tz);
  if (again !== at) at = again;
  return new Date(at).toISOString();
}

function expiresAtFor(expires: NoteExpires): string | null {
  switch (expires) {
    case "none":
      return null;
    case "today":
      return endOfDay(0);
    case "tomorrow":
      return endOfDay(1);
    case "week":
      return endOfDay(6);
  }
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";

function parseNote(input: unknown, locale: Locale): Omit<StickyNote, "id" | "createdAt"> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const body = text(raw.text, MAX_TEXT);
  if (!body) throw new HttpError(400, messages.t(locale, "noText"));
  return { text: body, from: text(raw.from, MAX_FROM), ...noteStyle(raw), expiresAt: expiresAtFor(noteExpires(raw.expires)) };
}

const alive = (note: StickyNote, now = Date.now()) => note.expiresAt === null || Date.parse(note.expiresAt) > now;

class NoteStore {
  private readonly path: string;
  /** 貼った・はがしたときに呼ぶ（画面へ知らせる） */
  onChange: () => void = () => {};
  private notes: StickyNote[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dir: string) {
    this.path = join(dir, "notes.json");
  }

  /** 書き込みを 1 つずつ通す。別の端末から同時に貼られても取りこぼさないように */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async all(): Promise<StickyNote[]> {
    if (this.notes) return this.notes;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf-8"));
      const saved: StickyNote[] = Array.isArray(parsed.notes) ? parsed.notes : [];
      this.notes = saved.map((n) => ({ ...n, ...noteStyle(n as unknown as Record<string, unknown>) }));
    } catch {
      this.notes = [];
    }
    return this.notes!;
  }

  /** 新しい順。期限の切れたものは出さない（ファイルからは次に書くときに消える） */
  async list(): Promise<StickyNote[]> {
    return (await this.all()).filter((n) => alive(n)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  add(input: unknown, locale: Locale): Promise<StickyNote> {
    return this.serial(async () => {
      const note = parseNote(input, locale);
      const notes = (await this.all()).filter((n) => alive(n));
      if (notes.length >= MAX_NOTES) throw new HttpError(400, messages.t(locale, "tooMany", { max: MAX_NOTES }));
      const saved: StickyNote = { id: randomUUID(), createdAt: new Date().toISOString(), ...note };
      await this.save([...notes, saved]);
      return saved;
    });
  }

  remove(id: string, locale: Locale): Promise<void> {
    return this.serial(async () => {
      const notes = await this.all();
      if (!notes.some((n) => n.id === id && alive(n))) throw new HttpError(404, messages.t(locale, "notFound"));
      await this.save(notes.filter((n) => n.id !== id && alive(n)));
    });
  }

  private async save(next: StickyNote[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify({ notes: next }, null, 2), "utf-8");
    await rename(tmp, this.path);
    this.notes = next;
    this.onChange();
  }
}

export default defineServerExtension({
  register(api) {
    const applySettings = () => {
      timeZone = text(api.settings.timeZone, 60) || DEFAULT_TIME_ZONE;
    };
    applySettings();
    api.onSettingsChange(applySettings);

    const store = new NoteStore(api.dataDir);
    // 画面には ext:sticky-notes:changed で届く。ポーリングを待たずに、どの端末もすぐ読み直す
    store.onChange = () => api.broadcast("changed");

    api.route("GET", "/notes", async () => ({ notes: await store.list() }));
    api.route("POST", "/notes", async ({ body, locale }) => ({ note: await store.add(body, locale) }));
    api.route("DELETE", "/notes/:id", async ({ params, locale }) => {
      await store.remove(params.id, locale);
      return { ok: true };
    });

    api.tool({
      name: "list_sticky_notes",
      description: "家のダッシュボードに貼ってある付箋（家にいる人への伝言）を、新しい順に返す。",
      risk: "read",
      handler: async () => ({ notes: await store.list() }),
    });
    api.tool({
      name: "add_sticky_note",
      description:
        "家のダッシュボードに付箋（家にいる人への伝言）を貼る。「〜って伝えておいて」「伝言を残して」と頼まれたときに使う。" +
        `本文は${MAX_TEXT}文字まで。`,
      inputSchema: (z) => ({
        text: z.string().describe("伝言の本文"),
        from: z.string().optional().describe("書いた人の名前（分かれば）"),
        color: z.enum(NOTE_COLORS).optional().describe("付箋の色。急ぎや大事な伝言は pink"),
        expires: z
          .enum(NOTE_EXPIRES)
          .optional()
          .describe("いつはがれるか。none は手ではがすまで、today は今日中、tomorrow は明日まで、week は1週間"),
        alignX: z.enum(NOTE_ALIGN_X).optional().describe("文字の横の揃え。start は左、center は中央、end は右"),
        alignY: z.enum(NOTE_ALIGN_Y).optional().describe("文字の縦の揃え。top は上、middle は中央、bottom は下"),
        bubble: z
          .enum(NOTE_BUBBLES)
          .optional()
          .describe("付箋の動き。slam は叩きつける、loud は大きく震える、gentle はそっと、ink は押すまで読めない"),
        burst: z.enum(NOTE_BURSTS).optional().describe("付箋の中で起こる効果。confetti は紙吹雪、balloons は風船、hearts はハート"),
        repeat: z.boolean().optional().describe("付箋の動きと中の効果を5分ごとに繰り返して目立たせる"),
      }),
      // 貼るだけで、はがせばすぐ戻せる
      risk: "low",
      describe: ({ text }) => `付箋「${text.slice(0, 30)}」を貼る`,
      handler: async (input) => ({ note: await store.add(input, "ja") }),
    });
    api.tool({
      name: "remove_sticky_note",
      description: "付箋をはがす。id は list_sticky_notes で調べる。",
      inputSchema: (z) => ({ id: z.string().describe("はがす付箋の id") }),
      // 家の人が書いた伝言を消すので、話している人に確かめる
      risk: "confirm",
      handler: async ({ id }) => {
        await store.remove(id, "ja");
        return { ok: true };
      },
    });
  },
});
