import type { Locale } from "@home-dashboard/widget-sdk";

/**
 * 拡張機能の manifest の文言（名前・説明・設定の項目）を、画面の言語に合わせる。英語の版（manifest の locales.en）に
 * 書いていないものは日本語のまま出す
 */

export interface ManifestTranslation {
  name?: string;
  description?: string;
  settingsNote?: string;
  settingsLinks?: string[];
  settings?: Record<string, { label?: string; placeholder?: string }>;
  settingsGroups?: Record<string, { title?: string; note?: string; steps?: string[]; links?: string[] }>;
  features?: Record<string, { name?: string; description?: string }>;
}

export type ManifestLocales = { en?: ManifestTranslation } | undefined;

const text = (value: unknown, fallback: string): string => (typeof value === "string" && value ? value : fallback);

function translation(locales: ManifestLocales, locale: Locale): ManifestTranslation | null {
  return locale === "en" && locales?.en && typeof locales.en === "object" ? locales.en : null;
}

/** 拡張機能の名前・説明・機能の口の名前 */
export function localizeExtension<
  T extends {
    name: string;
    description: string | null;
    features: { id: string; name: string; description: string | null }[];
    locales?: ManifestLocales;
  },
>(ext: T, locale: Locale): T {
  const tr = translation(ext.locales, locale);
  if (!tr) return ext;
  return {
    ...ext,
    name: text(tr.name, ext.name),
    description: ext.description === null ? null : text(tr.description, ext.description),
    features: ext.features.map((f) => ({
      ...f,
      name: text(tr.features?.[f.id]?.name, f.name),
      description: f.description === null ? null : text(tr.features?.[f.id]?.description, f.description),
    })),
  };
}

/** 接続設定の節（見出し・説明・リンク・区画・項目の名前と入力例） */
export function localizeSection<
  T extends {
    title: string;
    note: string | null;
    links: { label: string; href: string }[];
    groups: { id: string; title: string; note: string | null; steps: string[]; links: { label: string; href: string }[] }[];
    fields: { key: string; label: string; placeholder: string | null }[];
    locales?: ManifestLocales;
  },
>(section: T, locale: Locale): T {
  const tr = translation(section.locales, locale);
  if (!tr) return section;
  return {
    ...section,
    title: text(tr.name, section.title),
    note: section.note === null ? null : text(tr.settingsNote, section.note),
    links: section.links.map((link, i) => ({ ...link, label: text(tr.settingsLinks?.[i], link.label) })),
    groups: section.groups.map((group) => {
      const gt = tr.settingsGroups?.[group.id];
      return {
        ...group,
        title: text(gt?.title, group.title),
        note: group.note === null ? null : text(gt?.note, group.note),
        steps: group.steps.map((step, i) => text(gt?.steps?.[i], step)),
        links: group.links.map((link, i) => ({ ...link, label: text(gt?.links?.[i], link.label) })),
      };
    }),
    fields: section.fields.map((field) => ({
      ...field,
      label: text(tr.settings?.[field.key]?.label, field.label),
      placeholder: field.placeholder === null ? null : text(tr.settings?.[field.key]?.placeholder, field.placeholder),
    })),
  };
}
