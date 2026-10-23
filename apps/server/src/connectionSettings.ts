import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionManifest, SettingField, SettingGroup, SettingValue } from "@home-dashboard/extension-sdk";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";

/**
 * 設定画面の「接続設定」。項目は拡張機能が manifest.json の settings で決める（Home Assistant の URL とトークンなど）。
 *
 * .env の値を既定にして、画面で変えた分だけを data/connections.json に置き、起動時と保存時に上書きする。
 * 画面で消した項目は .env の値に戻る。
 * - 秘密の値（トークン・パスワード）は画面へ返さない。「設定済みか」だけを返し、空のまま保存すれば変えない
 * - 書き込みは管理者のアカウントからだけ受け付ける（ルート側で確かめる）
 */

const SETTINGS_PATH = join(config.dataDir, "connections.json");
const TEXT_MAX_LENGTH = 2000;

// 拡張機能にする前は、節の名前が違った
const LEGACY_SECTION_IDS: Record<string, string> = { homeAssistant: "home-assistant" };

type StoredSettings = Record<string, Record<string, SettingValue>>;

export interface SectionExtras {
  note?: string;
  test?: string;
  links?: { label: string; href: string }[];
  /** 項目を出どころごとの区画に分ける（拡張機能の manifest の settingsGroups） */
  groups?: SettingGroup[];
  /** 英語にしたときの文言（拡張機能の manifest の locales）。画面が言語に合わせて使う */
  locales?: ExtensionManifest["locales"];
}

/** 画面に返す区画の形 */
export interface GroupView {
  id: string;
  title: string;
  note: string | null;
  fields: string[];
  steps: string[];
  links: { label: string; href: string }[];
}

/** 区画のリンクは https の外のページか、本体の中の道だけ（javascript: などを出さない） */
function safeHref(href: string): boolean {
  return href.startsWith("https://") || (href.startsWith("/") && !href.startsWith("//"));
}

function groupViews(groups: SettingGroup[] | undefined, fields: SettingField[]): GroupView[] {
  const keys = new Set(fields.map((field) => field.key));
  return (groups ?? []).map((group) => ({
    id: group.id,
    title: group.title,
    note: group.note ?? null,
    fields: group.fields.filter((key) => keys.has(key)),
    steps: group.steps ?? [],
    links: (group.links ?? []).filter((link) => safeHref(link.href)),
  }));
}

interface Section {
  id: string;
  title: string;
  note: string | null;
  test: string | null;
  links: { label: string; href: string }[];
  groups: GroupView[];
  locales: NonNullable<ExtensionManifest["locales"]>;
  fields: SettingField[];
  /** .env（と既定値）の値。画面で消した項目はこれに戻す */
  envValues: Record<string, SettingValue>;
  /** 今の値。拡張機能へは、この入れ物をそのまま渡す（中身を書き換えるので、読むたびに今の値になる） */
  live: Record<string, SettingValue>;
  listeners: Array<() => void>;
}

const sections = new Map<string, Section>();
let stored: StoredSettings = {};
let loaded = false;

/** 環境変数の文字を、項目の種類に合わせて読む。読めなければ既定値 */
function readEnv(field: SettingField): SettingValue {
  const fallback = field.default ?? (field.kind === "boolean" ? false : field.kind === "number" ? 0 : "");
  const raw = field.env ? process.env[field.env] : undefined;
  // 既定値の ~/ はホームディレクトリ（Claude Code のログ置き場など）
  if (raw === undefined || raw === "")
    return typeof fallback === "string" && fallback.startsWith("~/") ? join(homedir(), fallback.slice(2)) : fallback;
  if (field.kind === "boolean") return raw === "true" ? true : raw === "false" ? false : fallback;
  if (field.kind === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }
  return field.kind === "url" ? raw.replace(/\/+$/, "") : raw;
}

/** 画面から来た値を、項目の種類に合わせて確かめて直す。空の文字は「上書きを消す」として null にする */
export function parseFieldValue(field: SettingField, raw: unknown): SettingValue | null {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (field.kind) {
    case "boolean":
      if (typeof raw !== "boolean") throw new ServiceError(400, `${field.label}: true か false にしてください`, `${field.label}: must be true or false`);
      return raw;
    case "number": {
      const value = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) throw new ServiceError(400, `${field.label}: 数値にしてください`, `${field.label}: must be a number`);
      if (field.integer && !Number.isInteger(value)) throw new ServiceError(400, `${field.label}: 整数にしてください`, `${field.label}: must be a whole number`);
      if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))
        throw new ServiceError(400, `${field.label}: ${field.min}〜${field.max} にしてください`, `${field.label}: must be between ${field.min} and ${field.max}`);
      return value;
    }
    default: {
      if (typeof raw !== "string") throw new ServiceError(400, `${field.label}: 文字で入れてください`, `${field.label}: must be text`);
      const value = raw.trim();
      if (value.length > TEXT_MAX_LENGTH) throw new ServiceError(400, `${field.label}: 長すぎます`, `${field.label}: too long`);
      if (field.kind === "url") {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          throw new ServiceError(400, `${field.label}: URL の形にしてください`, `${field.label}: must be a URL`);
        }
        if (url.protocol !== "http:" && url.protocol !== "https:")
          throw new ServiceError(400, `${field.label}: http か https の URL にしてください`, `${field.label}: must be an http or https URL`);
        // 末尾の / は付けない（「URL + /api/...」で呼ぶため）
        return value.replace(/\/+$/, "");
      }
      return value;
    }
  }
}

function apply(section: Section): void {
  for (const field of section.fields) {
    section.live[field.key] = stored[section.id]?.[field.key] ?? section.envValues[field.key];
  }
  for (const listener of section.listeners) listener();
}

/** 起動時に一度呼ぶ。保存してある上書きを読む（拡張機能を読み込む前に） */
export async function loadConnectionSettings(): Promise<void> {
  try {
    const raw = JSON.parse(await readFile(SETTINGS_PATH, "utf-8")) as StoredSettings;
    stored = {};
    for (const [id, values] of Object.entries(raw)) stored[LEGACY_SECTION_IDS[id] ?? id] = values;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    stored = {};
  }
  loaded = true;
  for (const section of sections.values()) apply(section);
}

/**
 * 拡張機能の設定の節を登録し、今の値の入れ物を返す。同じ id で登録し直すと（拡張機能の入れ替え）項目を置き換える。
 * 前の入れ物と知らせの登録は捨てる（拡張機能は登録し直しのたびに新しい入れ物を受け取る）
 */
export function registerSettingsSection(
  id: string,
  title: string,
  fields: SettingField[],
  extras: SectionExtras = {},
): Record<string, SettingValue> {
  const section: Section = {
    id,
    title,
    note: extras.note ?? null,
    test: extras.test ?? null,
    links: extras.links ?? [],
    groups: groupViews(extras.groups, fields),
    locales: extras.locales ?? {},
    fields,
    envValues: Object.fromEntries(fields.map((field) => [field.key, readEnv(field)])),
    live: {},
    listeners: [],
  };
  sections.set(id, section);
  apply(section);
  return section.live;
}

export function unregisterSettingsSection(id: string): void {
  sections.delete(id);
}

/** 接続設定が変わったときに、その設定を覚えている処理（トークンやキャッシュ）を捨てるための知らせ */
export function onConnectionChange(sectionId: string, listener: () => void): void {
  const section = sections.get(sectionId);
  if (!section) throw new Error(`unknown settings section: ${sectionId}`);
  section.listeners.push(listener);
}

function findSection(id: string): Section {
  const section = sections.get(id);
  if (!section) throw new ServiceError(400, `unknown section: ${id}`);
  return section;
}

async function save(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const tmp = `${SETTINGS_PATH}.tmp`;
  // 秘密の値が入るので、持ち主だけが読めるようにする
  await writeFile(tmp, JSON.stringify(stored, null, 2), { encoding: "utf-8", mode: 0o600 });
  await rename(tmp, SETTINGS_PATH);
}

export interface FieldView {
  key: string;
  label: string;
  kind: SettingField["kind"];
  env: string | null;
  placeholder: string | null;
  /** 秘密でない項目の今の値。秘密の項目では null */
  value: SettingValue | null;
  /** 値が入っているか */
  isSet: boolean;
  /** 今の値がどこから来たか */
  source: "settings" | "env" | "unset";
}

export interface SectionView {
  id: string;
  title: string;
  note: string | null;
  /** 「接続を確かめる」で呼ぶ道（/api/ext/<id> の下） */
  test: string | null;
  links: { label: string; href: string }[];
  /** 出どころごとの区画。どの区画にも無い項目は、いちばん上の区画に出す */
  groups: GroupView[];
  /** 英語にしたときの文言（manifest の locales） */
  locales: NonNullable<ExtensionManifest["locales"]>;
  fields: FieldView[];
}

function isEmpty(value: SettingValue | undefined): boolean {
  return value === undefined || value === "";
}

function describe(section: Section): SectionView {
  return {
    id: section.id,
    title: section.title,
    note: section.note,
    test: section.test,
    links: section.links,
    groups: section.groups,
    locales: section.locales,
    fields: section.fields
      .filter((field) => !field.hidden)
      .map((field): FieldView => {
        const current = section.live[field.key];
        const overridden = stored[section.id]?.[field.key] !== undefined;
        const fromEnv = Boolean(field.env && process.env[field.env]);
        return {
          key: field.key,
          label: field.label,
          kind: field.kind,
          env: field.env ?? null,
          placeholder: field.placeholder ?? null,
          value: field.kind === "secret" ? null : current,
          isSet: !isEmpty(current),
          source: overridden ? "settings" : fromEnv ? "env" : "unset",
        };
      }),
  };
}

/** 画面に返す形。秘密の値と hidden の項目は含めない。sectionIds で並びと絞り込みを決める */
export function describeConnectionSettings(sectionIds?: string[]): SectionView[] {
  const ids = sectionIds ?? [...sections.keys()];
  return ids
    .map((id) => sections.get(id))
    .filter((section): section is Section => section !== undefined && section.fields.some((f) => !f.hidden))
    .map(describe);
}

/**
 * 1つの節の値を変える。values に無い項目はそのまま、null か空の文字は上書きを消して .env の値に戻す。
 * 秘密の項目は、画面が空のまま送ってきたら変えない（values に入れてこない）約束。
 */
export async function updateConnectionSettings(sectionId: string, values: unknown): Promise<SectionView> {
  if (!loaded) throw new Error("connection settings are not loaded");
  const section = findSection(sectionId);
  if (typeof values !== "object" || values === null || Array.isArray(values))
    throw new ServiceError(400, "values must be an object");
  const next = { ...stored[section.id] };
  for (const [key, raw] of Object.entries(values)) {
    const field = section.fields.find((f) => f.key === key && !f.hidden);
    if (!field) throw new ServiceError(400, `unknown field: ${key}`);
    const value = parseFieldValue(field, raw);
    if (value === null) delete next[key];
    else next[key] = value;
  }
  stored = { ...stored, [section.id]: next };
  if (Object.keys(next).length === 0) delete stored[section.id];
  await save();
  apply(section);
  return describe(section);
}

export function resetConnectionSettingsForTest(): void {
  stored = {};
  loaded = true;
  for (const section of sections.values()) apply(section);
}
