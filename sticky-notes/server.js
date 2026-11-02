import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// extensions/sticky-notes/src/server.ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

// packages/extension-sdk/src/index.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
};
function defineServerMessages(dicts) {
  return {
    t(locale, key, params) {
      const value = dicts[locale][key] ?? dicts.ja[key];
      if (typeof value === "function") return value(params ?? {});
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
    }
  };
}
function defineServerExtension(extension) {
  return extension;
}

// extensions/sticky-notes/src/notes.ts
var NOTE_COLORS = ["yellow", "pink", "blue", "green"];
var NOTE_EXPIRES = ["none", "today", "tomorrow", "week"];
var NOTE_ALIGN_X = ["start", "center", "end"];
var NOTE_ALIGN_Y = ["top", "middle", "bottom"];
var NOTE_BUBBLES = ["none", "slam", "loud", "gentle", "ink"];
var NOTE_BURSTS = ["none", "confetti", "balloons", "hearts"];
var MAX_TEXT = 200;
var MAX_FROM = 20;
var MAX_NOTES = 40;
var REPEAT_MS = 5 * 60 * 1e3;
var pick = (choices, value, fallback) => choices.includes(value) ? value : fallback;
function noteStyle(raw) {
  return {
    color: pick(NOTE_COLORS, raw.color, "yellow"),
    alignX: pick(NOTE_ALIGN_X, raw.alignX, "start"),
    alignY: pick(NOTE_ALIGN_Y, raw.alignY, "top"),
    bubble: pick(NOTE_BUBBLES, raw.bubble, "none"),
    burst: pick(NOTE_BURSTS, raw.burst, "none"),
    repeat: raw.repeat === true
  };
}
var noteExpires = (value) => pick(NOTE_EXPIRES, value, "none");

// extensions/sticky-notes/src/server.ts
var messages = defineServerMessages({
  ja: {
    noText: "\u4F1D\u8A00\u3092\u66F8\u3044\u3066\u304F\u3060\u3055\u3044",
    tooMany: "\u4ED8\u7B8B\u306F{max}\u679A\u307E\u3067\u3067\u3059\u3002\u53E4\u3044\u3082\u306E\u3092\u306F\u304C\u3057\u3066\u304F\u3060\u3055\u3044",
    notFound: "\u305D\u306E\u4ED8\u7B8B\u306F\u3082\u3046\u3042\u308A\u307E\u305B\u3093"
  },
  en: {
    noText: "Write a message",
    tooMany: "You can stick up to {max} notes. Peel off some old ones first",
    notFound: "That note is already gone"
  }
});
var DEFAULT_TIME_ZONE = "Asia/Tokyo";
var timeZone = DEFAULT_TIME_ZONE;
function offsetMs(instant, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(instant));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}
function endOfDay(days, now = Date.now()) {
  let tz = timeZone;
  try {
    offsetMs(now, tz);
  } catch {
    tz = DEFAULT_TIME_ZONE;
  }
  const local = new Date(now + offsetMs(now, tz));
  const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days + 1);
  let at = guess - offsetMs(guess, tz);
  const again = guess - offsetMs(at, tz);
  if (again !== at) at = again;
  return new Date(at).toISOString();
}
function expiresAtFor(expires) {
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
var text = (value, max) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
function parseNote(input, locale) {
  const raw = input ?? {};
  const body = text(raw.text, MAX_TEXT);
  if (!body) throw new HttpError(400, messages.t(locale, "noText"));
  return { text: body, from: text(raw.from, MAX_FROM), ...noteStyle(raw), expiresAt: expiresAtFor(noteExpires(raw.expires)) };
}
var alive = (note, now = Date.now()) => note.expiresAt === null || Date.parse(note.expiresAt) > now;
var NoteStore = class {
  constructor(dir) {
    this.dir = dir;
    this.path = join(dir, "notes.json");
  }
  path;
  /** 貼った・はがしたときに呼ぶ（画面へ知らせる） */
  onChange = () => {
  };
  notes = null;
  queue = Promise.resolve();
  /** 書き込みを 1 つずつ通す。別の端末から同時に貼られても取りこぼさないように */
  serial(work) {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => void 0);
    return next;
  }
  async all() {
    if (this.notes) return this.notes;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf-8"));
      const saved = Array.isArray(parsed.notes) ? parsed.notes : [];
      this.notes = saved.map((n) => ({ ...n, ...noteStyle(n) }));
    } catch {
      this.notes = [];
    }
    return this.notes;
  }
  /** 新しい順。期限の切れたものは出さない（ファイルからは次に書くときに消える） */
  async list() {
    return (await this.all()).filter((n) => alive(n)).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  }
  add(input, locale) {
    return this.serial(async () => {
      const note = parseNote(input, locale);
      const notes = (await this.all()).filter((n) => alive(n));
      if (notes.length >= MAX_NOTES) throw new HttpError(400, messages.t(locale, "tooMany", { max: MAX_NOTES }));
      const saved = { id: randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), ...note };
      await this.save([...notes, saved]);
      return saved;
    });
  }
  remove(id, locale) {
    return this.serial(async () => {
      const notes = await this.all();
      if (!notes.some((n) => n.id === id && alive(n))) throw new HttpError(404, messages.t(locale, "notFound"));
      await this.save(notes.filter((n) => n.id !== id && alive(n)));
    });
  }
  async save(next) {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify({ notes: next }, null, 2), "utf-8");
    await rename(tmp, this.path);
    this.notes = next;
    this.onChange();
  }
};
var server_default = defineServerExtension({
  register(api) {
    const applySettings = () => {
      timeZone = text(api.settings.timeZone, 60) || DEFAULT_TIME_ZONE;
    };
    applySettings();
    api.onSettingsChange(applySettings);
    const store = new NoteStore(api.dataDir);
    store.onChange = () => api.broadcast("changed");
    api.route("GET", "/notes", async () => ({ notes: await store.list() }));
    api.route("POST", "/notes", async ({ body, locale }) => ({ note: await store.add(body, locale) }));
    api.route("DELETE", "/notes/:id", async ({ params, locale }) => {
      await store.remove(params.id, locale);
      return { ok: true };
    });
    api.tool({
      name: "list_sticky_notes",
      description: "\u5BB6\u306E\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306B\u8CBC\u3063\u3066\u3042\u308B\u4ED8\u7B8B\uFF08\u5BB6\u306B\u3044\u308B\u4EBA\u3078\u306E\u4F1D\u8A00\uFF09\u3092\u3001\u65B0\u3057\u3044\u9806\u306B\u8FD4\u3059\u3002",
      risk: "read",
      handler: async () => ({ notes: await store.list() })
    });
    api.tool({
      name: "add_sticky_note",
      description: `\u5BB6\u306E\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306B\u4ED8\u7B8B\uFF08\u5BB6\u306B\u3044\u308B\u4EBA\u3078\u306E\u4F1D\u8A00\uFF09\u3092\u8CBC\u308B\u3002\u300C\u301C\u3063\u3066\u4F1D\u3048\u3066\u304A\u3044\u3066\u300D\u300C\u4F1D\u8A00\u3092\u6B8B\u3057\u3066\u300D\u3068\u983C\u307E\u308C\u305F\u3068\u304D\u306B\u4F7F\u3046\u3002\u672C\u6587\u306F${MAX_TEXT}\u6587\u5B57\u307E\u3067\u3002`,
      inputSchema: (z) => ({
        text: z.string().describe("\u4F1D\u8A00\u306E\u672C\u6587"),
        from: z.string().optional().describe("\u66F8\u3044\u305F\u4EBA\u306E\u540D\u524D\uFF08\u5206\u304B\u308C\u3070\uFF09"),
        color: z.enum(NOTE_COLORS).optional().describe("\u4ED8\u7B8B\u306E\u8272\u3002\u6025\u304E\u3084\u5927\u4E8B\u306A\u4F1D\u8A00\u306F pink"),
        expires: z.enum(NOTE_EXPIRES).optional().describe("\u3044\u3064\u306F\u304C\u308C\u308B\u304B\u3002none \u306F\u624B\u3067\u306F\u304C\u3059\u307E\u3067\u3001today \u306F\u4ECA\u65E5\u4E2D\u3001tomorrow \u306F\u660E\u65E5\u307E\u3067\u3001week \u306F1\u9031\u9593"),
        alignX: z.enum(NOTE_ALIGN_X).optional().describe("\u6587\u5B57\u306E\u6A2A\u306E\u63C3\u3048\u3002start \u306F\u5DE6\u3001center \u306F\u4E2D\u592E\u3001end \u306F\u53F3"),
        alignY: z.enum(NOTE_ALIGN_Y).optional().describe("\u6587\u5B57\u306E\u7E26\u306E\u63C3\u3048\u3002top \u306F\u4E0A\u3001middle \u306F\u4E2D\u592E\u3001bottom \u306F\u4E0B"),
        bubble: z.enum(NOTE_BUBBLES).optional().describe("\u4ED8\u7B8B\u306E\u52D5\u304D\u3002slam \u306F\u53E9\u304D\u3064\u3051\u308B\u3001loud \u306F\u5927\u304D\u304F\u9707\u3048\u308B\u3001gentle \u306F\u305D\u3063\u3068\u3001ink \u306F\u62BC\u3059\u307E\u3067\u8AAD\u3081\u306A\u3044"),
        burst: z.enum(NOTE_BURSTS).optional().describe("\u4ED8\u7B8B\u306E\u4E2D\u3067\u8D77\u3053\u308B\u52B9\u679C\u3002confetti \u306F\u7D19\u5439\u96EA\u3001balloons \u306F\u98A8\u8239\u3001hearts \u306F\u30CF\u30FC\u30C8"),
        repeat: z.boolean().optional().describe("\u4ED8\u7B8B\u306E\u52D5\u304D\u3068\u4E2D\u306E\u52B9\u679C\u30925\u5206\u3054\u3068\u306B\u7E70\u308A\u8FD4\u3057\u3066\u76EE\u7ACB\u305F\u305B\u308B")
      }),
      // 貼るだけで、はがせばすぐ戻せる
      risk: "low",
      describe: ({ text: text2 }) => `\u4ED8\u7B8B\u300C${text2.slice(0, 30)}\u300D\u3092\u8CBC\u308B`,
      handler: async (input) => ({ note: await store.add(input, "ja") })
    });
    api.tool({
      name: "remove_sticky_note",
      description: "\u4ED8\u7B8B\u3092\u306F\u304C\u3059\u3002id \u306F list_sticky_notes \u3067\u8ABF\u3079\u308B\u3002",
      inputSchema: (z) => ({ id: z.string().describe("\u306F\u304C\u3059\u4ED8\u7B8B\u306E id") }),
      // 家の人が書いた伝言を消すので、話している人に確かめる
      risk: "confirm",
      handler: async ({ id }) => {
        await store.remove(id, "ja");
        return { ok: true };
      }
    });
  }
});
export {
  server_default as default
};
