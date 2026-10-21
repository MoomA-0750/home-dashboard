import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// packages/extension-sdk/src/index.ts
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

// extensions/claude/src/usage.ts
import { open, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
var messages = defineServerMessages({
  ja: { notFound: "Claude Code\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: {dir}" },
  en: { notFound: "Claude Code session folder not found: {dir}" }
});
var projectsDir = "";
var BLOCK_DURATION_MS = 5 * 60 * 60 * 1e3;
var RETENTION_DAYS = 30;
var fileStates = /* @__PURE__ */ new Map();
var seenMessages = /* @__PURE__ */ new Set();
var entries = [];
var lastScanAt = null;
var scanInFlight = null;
function emptyTotals() {
  return { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0 };
}
function addEntry(totals, entry) {
  totals.input += entry.input;
  totals.output += entry.output;
  totals.cacheCreate += entry.cacheCreate;
  totals.cacheRead += entry.cacheRead;
  totals.total += entry.input + entry.output + entry.cacheCreate + entry.cacheRead;
}
function projectNameFromDir(dirName) {
  const parts = dirName.split("-").filter(Boolean);
  return parts[parts.length - 1] ?? dirName;
}
function shortModelName(model) {
  return model.replace(/^claude-/, "");
}
function parseLine(line, project) {
  if (!line.startsWith("{")) return null;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  if (record.type !== "assistant") return null;
  const message = record.message;
  const usage = message?.usage;
  if (!usage) return null;
  const dedupeKey = `${String(message?.id ?? "")}:${String(record.requestId ?? "")}`;
  if (dedupeKey !== ":" && seenMessages.has(dedupeKey)) return null;
  if (dedupeKey !== ":") seenMessages.add(dedupeKey);
  const ts = Date.parse(String(record.timestamp ?? ""));
  if (Number.isNaN(ts)) return null;
  const cwd = typeof record.cwd === "string" ? record.cwd : "";
  const cwdName = cwd ? basename(cwd) : "";
  return {
    ts,
    model: shortModelName(String(message?.model ?? "unknown")),
    project: cwdName || project,
    sessionId: String(record.sessionId ?? ""),
    input: Number(usage.input_tokens ?? 0),
    output: Number(usage.output_tokens ?? 0),
    cacheCreate: Number(usage.cache_creation_input_tokens ?? 0),
    cacheRead: Number(usage.cache_read_input_tokens ?? 0)
  };
}
async function readNewLines(path, from, to) {
  const handle = await open(path, "r");
  try {
    const length = to - from;
    const buffer = Buffer.allocUnsafe(length);
    await handle.read(buffer, 0, length, from);
    const lastNewline = buffer.lastIndexOf(10);
    if (lastNewline < 0) return { text: "", consumed: 0 };
    return { text: buffer.subarray(0, lastNewline).toString("utf-8"), consumed: lastNewline + 1 };
  } finally {
    await handle.close();
  }
}
async function scanFile(path, project, cutoff) {
  const info = await stat(path);
  const state = fileStates.get(path);
  if (!state && info.mtimeMs < cutoff) {
    fileStates.set(path, { offset: info.size, mtimeMs: info.mtimeMs });
    return;
  }
  if (state && state.offset === info.size && state.mtimeMs === info.mtimeMs) return;
  const from = state && info.size >= state.offset ? state.offset : 0;
  if (from >= info.size) {
    fileStates.set(path, { offset: info.size, mtimeMs: info.mtimeMs });
    return;
  }
  const { text, consumed } = await readNewLines(path, from, info.size);
  for (const line of text.split("\n")) {
    const entry = parseLine(line, project);
    if (entry && entry.ts >= cutoff) entries.push(entry);
  }
  fileStates.set(path, { offset: from + consumed, mtimeMs: info.mtimeMs });
}
async function scan() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1e3;
  const root = projectsDir;
  const projectDirs = await readdir(root, { withFileTypes: true });
  for (const dirent of projectDirs) {
    if (!dirent.isDirectory()) continue;
    const project = projectNameFromDir(dirent.name);
    const dirPath = join(root, dirent.name);
    const files = await readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      try {
        await scanFile(join(dirPath, file), project, cutoff);
      } catch {
      }
    }
  }
  entries = entries.filter((e) => e.ts >= cutoff).sort((a, b) => a.ts - b.ts);
  lastScanAt = (/* @__PURE__ */ new Date()).toISOString();
}
function scanOnce() {
  if (!scanInFlight) {
    scanInFlight = scan().finally(() => {
      scanInFlight = null;
    });
  }
  return scanInFlight;
}
function buildBlocks(sorted) {
  const blocks = [];
  let current = null;
  let lastTs = 0;
  for (const entry of sorted) {
    const startsNewBlock = !current || entry.ts >= current.endsAt || entry.ts - lastTs >= BLOCK_DURATION_MS;
    if (startsNewBlock) {
      const startsAt = new Date(entry.ts).setMinutes(0, 0, 0);
      current = { startsAt, endsAt: startsAt + BLOCK_DURATION_MS, entries: [] };
      blocks.push(current);
    }
    current.entries.push(entry);
    lastTs = entry.ts;
  }
  return blocks;
}
function summarizeByModel(list) {
  const byModel = /* @__PURE__ */ new Map();
  for (const entry of list) {
    let totals = byModel.get(entry.model);
    if (!totals) {
      totals = emptyTotals();
      byModel.set(entry.model, totals);
    }
    addEntry(totals, entry);
  }
  return [...byModel.entries()].map(([model, totals]) => ({ model, ...totals })).sort((a, b) => b.total - a.total);
}
function localDateKey(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
function buildSummary() {
  const now = Date.now();
  const todayKey = localDateKey(now);
  const todayEntries = entries.filter((e) => localDateKey(e.ts) === todayKey);
  const blocks = buildBlocks(entries);
  const activeBlock = blocks.length > 0 && blocks[blocks.length - 1].endsAt > now ? blocks[blocks.length - 1] : null;
  const dailyMap = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = localDateKey(entry.ts);
    let totals = dailyMap.get(key);
    if (!totals) {
      totals = emptyTotals();
      dailyMap.set(key, totals);
    }
    addEntry(totals, entry);
  }
  const daily = [...dailyMap.entries()].map(([date, totals]) => ({ date, ...totals })).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 14);
  const projectMap = /* @__PURE__ */ new Map();
  for (const entry of todayEntries) {
    let totals = projectMap.get(entry.project);
    if (!totals) {
      totals = emptyTotals();
      projectMap.set(entry.project, totals);
    }
    addEntry(totals, entry);
  }
  const projects = [...projectMap.entries()].map(([name, totals]) => ({ name, ...totals })).sort((a, b) => b.total - a.total);
  const todayTotals = emptyTotals();
  for (const entry of todayEntries) addEntry(todayTotals, entry);
  const blockTotals = emptyTotals();
  for (const entry of activeBlock?.entries ?? []) addEntry(blockTotals, entry);
  return {
    configured: true,
    lastScanAt,
    today: {
      date: todayKey,
      tokens: todayTotals,
      messages: todayEntries.length,
      sessions: new Set(todayEntries.map((e) => e.sessionId)).size,
      byModel: summarizeByModel(todayEntries)
    },
    block: activeBlock ? {
      startsAt: new Date(activeBlock.startsAt).toISOString(),
      endsAt: new Date(activeBlock.endsAt).toISOString(),
      remainingMs: activeBlock.endsAt - now,
      tokens: blockTotals,
      messages: activeBlock.entries.length,
      byModel: summarizeByModel(activeBlock.entries)
    } : null,
    daily,
    projects
  };
}
async function getClaudeUsage(locale = "ja") {
  try {
    await stat(projectsDir);
  } catch {
    return {
      configured: false,
      reason: messages.t(locale, "notFound", { dir: projectsDir })
    };
  }
  await scanOnce();
  return buildSummary();
}
function setProjectsDir(dir) {
  if (dir === projectsDir) return;
  projectsDir = dir;
  fileStates.clear();
  entries.length = 0;
}

// extensions/claude/src/limits.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join as join2 } from "node:path";
var dataDir = "";
var limitsPath = () => join2(dataDir, "limits.json");
var MAX_WINDOWS = 8;
var KIND_PATTERN = /^[a-z0-9_]{1,64}$/;
var MAX_TIME_SKEW_MS = 400 * 24 * 60 * 60 * 1e3;
var store = null;
async function loadStore() {
  if (store) return store;
  try {
    store = JSON.parse(await readFile(limitsPath(), "utf-8"));
  } catch {
    store = { windows: {} };
  }
  return store;
}
async function saveStore(next) {
  await mkdir(dataDir, { recursive: true });
  const tmp = `${limitsPath()}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
  await rename(tmp, limitsPath());
}
function parseStatusLineLimits(input, now = Date.now()) {
  if (!input || typeof input !== "object") return [];
  const rateLimits = input.rate_limits;
  if (!rateLimits || typeof rateLimits !== "object") return [];
  const observations = [];
  for (const [kind, value] of Object.entries(rateLimits)) {
    if (observations.length >= MAX_WINDOWS) break;
    if (!KIND_PATTERN.test(kind) || !value || typeof value !== "object") continue;
    const { used_percentage: used, resets_at: resetsAt } = value;
    if (typeof used !== "number" || !Number.isFinite(used) || used < 0 || used > 100) continue;
    let resetsAtIso = null;
    if (typeof resetsAt === "number" && Number.isFinite(resetsAt)) {
      const ms = resetsAt * 1e3;
      if (Math.abs(ms - now) <= MAX_TIME_SKEW_MS) resetsAtIso = new Date(ms).toISOString();
    }
    observations.push({ kind, usedPercent: used, resetsAt: resetsAtIso });
  }
  return observations;
}
function mergeObservations(windows, observations, observedAt) {
  const next = { ...windows };
  for (const observation of observations) {
    const previous = next[observation.kind];
    const sameWindow = previous && previous.resetsAt === observation.resetsAt;
    next[observation.kind] = {
      kind: observation.kind,
      usedPercent: observation.usedPercent,
      peakPercent: sameWindow ? Math.max(previous.peakPercent, observation.usedPercent) : observation.usedPercent,
      resetsAt: observation.resetsAt,
      observedAt
    };
  }
  return next;
}
async function getClaudeLimits() {
  const { windows } = await loadStore();
  return { windows: Object.values(windows), serverNow: (/* @__PURE__ */ new Date()).toISOString() };
}
function setLimitsDataDir(dir) {
  dataDir = dir;
  store = null;
}
async function recordStatusLine(input) {
  const observations = parseStatusLineLimits(input);
  if (observations.length === 0) return { recorded: 0 };
  const current = await loadStore();
  store = { windows: mergeObservations(current.windows, observations, (/* @__PURE__ */ new Date()).toISOString()) };
  await saveStore(store);
  return { recorded: observations.length };
}

// extensions/claude/src/server.ts
var server_default = defineServerExtension({
  register(api) {
    setLimitsDataDir(api.dataDir);
    const syncDir = () => setProjectsDir(String(api.settings.projectsDir));
    syncDir();
    api.onSettingsChange(syncDir);
    api.route("GET", "/usage", (ctx) => getClaudeUsage(ctx.locale));
    api.route("GET", "/limits", () => getClaudeLimits());
    api.route("POST", "/limits", ({ body }) => recordStatusLine(body), { public: true });
  }
});
export {
  server_default as default
};
