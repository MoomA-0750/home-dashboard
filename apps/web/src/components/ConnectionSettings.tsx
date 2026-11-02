import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  ButtonRow,
  Check,
  defineMessages,
  Field,
  Group,
  Message,
  Note,
  Notice,
  SectionTitle,
  useLocale,
} from "@home-dashboard/widget-sdk";
import { localizeSection, type ManifestLocales } from "../lib/manifestText";

type FieldKind = "text" | "url" | "secret" | "number" | "boolean";
type FieldValue = string | number | boolean;

interface FieldView {
  key: string;
  label: string;
  kind: FieldKind;
  env: string | null;
  placeholder: string | null;
  value: FieldValue | null;
  isSet: boolean;
  source: "settings" | "env" | "unset";
}

interface SectionView {
  id: string;
  title: string;
  /** 拡張機能の manifest.json の settingsNote */
  note: string | null;
  /** 「接続を確かめる」で呼ぶ、拡張機能の道（/api/ext/<id> の下） */
  test: string | null;
  /** 認可のページなど（本体の中の道） */
  links: { label: string; href: string }[];
  /** 出どころごとの区画（manifest の settingsGroups）。どの区画にも無い項目は、いちばん上の区画に出す */
  groups: GroupView[];
  /** 英語にしたときの文言（manifest の locales。lib/manifestText の localizeSection で使う） */
  locales?: ManifestLocales;
  fields: FieldView[];
}

interface GroupView {
  id: string;
  title: string;
  note: string | null;
  fields: string[];
  /** 「手順」を開くと出す、番号付きの手順。{key} はその項目の今の値に置き換える */
  steps: string[];
  links: { label: string; href: string }[];
}

interface ConnectionsResponse {
  sections: SectionView[];
  editable: boolean;
}

const messages = defineMessages({
  ja: {
    sourceSettings: "この画面で設定",
    sourceEnv: ".env の値",
    unset: "未設定",
    loadFailed: "読み込めませんでした（{status}）",
    connectionSettings: "接続設定",
    adminOnly: "接続設定を変えられるのは管理者のアカウントだけです。",
    saveFailed: "保存できませんでした（{status}）",
    saved: "保存しました",
    resetDone: "{label}を .env の値に戻しました",
    configured: "設定済み",
    secretSet: "設定済み（変えるときだけ入力）",
    envName: "（{env}）",
    resetToEnv: ".env に戻す",
    save: "保存",
    testConnection: "接続を確かめる",
    steps: "手順",
  },
  en: {
    sourceSettings: "Set on this screen",
    sourceEnv: "Value from .env",
    unset: "Not set",
    loadFailed: "Couldn't load ({status})",
    connectionSettings: "Connection settings",
    adminOnly: "Only admin accounts can change connection settings.",
    saveFailed: "Couldn't save ({status})",
    saved: "Saved",
    resetDone: "Reset {label} to the .env value",
    configured: "Configured",
    secretSet: "Set (enter only to change)",
    envName: " ({env})",
    resetToEnv: "Reset to .env",
    save: "Save",
    testConnection: "Test connection",
    steps: "Steps",
  },
});

const SOURCE_LABELS = {
  settings: "sourceSettings",
  env: "sourceEnv",
  unset: "unset",
} as const satisfies Record<FieldView["source"], string>;

/**
 * 拡張機能の接続設定（設定画面の「拡張機能」で、その拡張機能を開いたときに出す）。
 * 項目は拡張機能の manifest.json の settings から来る。.env を書き換えずに、接続先とトークンを変える。
 * 秘密の値はサーバーから返ってこないので、欄は空のまま「設定済み」と出し、入れたときだけ送る。
 */
export function ConnectionSection({ apiBaseUrl, sectionId }: { apiBaseUrl: string; sectionId: string }) {
  const t = messages.useT();
  const locale = useLocale();
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/settings/connections`);
      if (!res.ok) throw new Error(messages.t("loadFailed", { status: res.status }));
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  // 見出し・説明・項目の名前を画面の言語に合わせる（読み直したときと言語を変えたときだけ作り直す。下の欄は section が変わると入力を戻すため）
  const section = useMemo(() => {
    const found = data?.sections.find((s) => s.id === sectionId);
    return found ? localizeSection(found, locale) : null;
  }, [data, sectionId, locale]);

  if (error) return <Message tone="error">{error}</Message>;
  if (!data) return null;
  // 切ってある拡張機能や、設定の項目が無い拡張機能では出さない
  if (!section) return null;
  return (
    <section>
      <SectionTitle>{t("connectionSettings")}</SectionTitle>
      {!data.editable && <Notice>{t("adminOnly")}</Notice>}
      <SectionForm key={section.id} apiBaseUrl={apiBaseUrl} section={section} editable={data.editable} onSaved={load} />
    </section>
  );
}

function initialDraft(section: SectionView): Record<string, FieldValue> {
  return Object.fromEntries(
    section.fields.map((field) => [
      field.key,
      field.kind === "secret" ? "" : (field.value ?? (field.kind === "boolean" ? false : "")),
    ]),
  );
}

/** 区画の形。いちばん上の区画（id が null）は、どの区画にも入っていない項目と、節の説明・確かめ・リンクを持つ */
interface Panel {
  id: string | null;
  title: string | null;
  note: string | null;
  fields: FieldView[];
  steps: string[];
  links: { label: string; href: string }[];
  test: string | null;
}

function panelsOf(section: SectionView): Panel[] {
  const grouped = new Set(section.groups.flatMap((group) => group.fields));
  const main: Panel = {
    id: null,
    title: null,
    note: section.note,
    fields: section.fields.filter((field) => !grouped.has(field.key)),
    steps: [],
    links: section.links,
    test: section.test,
  };
  const groups = section.groups.map(
    (group): Panel => ({
      id: group.id,
      title: group.title,
      note: group.note,
      // 並びは settings の順
      fields: section.fields.filter((field) => group.fields.includes(field.key)),
      steps: group.steps,
      links: group.links,
      test: null,
    }),
  );
  const hasMain = main.fields.length > 0 || main.note !== null || main.test !== null || main.links.length > 0;
  return [...(hasMain ? [main] : []), ...groups];
}

/** 秘密の項目と URL がすべて入っていれば「設定済み」（無ければ文字の項目で見る）。既定値のあるポートなどでは判断しない */
function isConfigured(fields: FieldView[]): boolean {
  const required = fields.filter((field) => field.kind === "secret" || field.kind === "url");
  return (required.length > 0 ? required : fields.filter((field) => field.kind === "text")).every((field) => field.isSet);
}

/** 項目の名前の、括弧の前まで（手順の中で、まだ入っていない値の代わりに出す） */
function shortLabel(label: string): string {
  return label.split(/[（(]/)[0].trim();
}

/**
 * 手順の {key} を、その項目の今の値（無ければ項目の名前）に置き換える。続けて書いた道（/auth/... など）までを
 * 1つの code にして、URL をまとめて写しやすくする
 */
function StepText({ text, fields }: { text: string; fields: FieldView[] }) {
  const parts = text.split(/\{([A-Za-z0-9_]+)\}/);
  const nodes: ReactNode[] = [];
  let rest = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    nodes.push(rest);
    const field = fields.find((f) => f.key === parts[i] && f.kind !== "secret");
    const [, tail = "", after = ""] = /^(\S*)([\s\S]*)$/.exec(parts[i + 1]) ?? [];
    if (!field) {
      nodes.push(`{${parts[i]}}${tail}`);
    } else if (field.isSet && field.value !== null) {
      nodes.push(
        <code key={i} className="rounded-art bg-tint/15 px-1 text-text wrap-anywhere">
          {`${String(field.value).replace(/\/$/, "")}${tail}`}
        </code>,
      );
    } else {
      nodes.push(
        <span key={i} className="font-semibold text-text">
          {`<${shortLabel(field.label)}>`}
        </span>,
        tail,
      );
    }
    rest = after;
  }
  nodes.push(rest);
  return <>{nodes}</>;
}

function SectionForm({
  apiBaseUrl,
  section,
  editable,
  onSaved,
}: {
  apiBaseUrl: string;
  section: SectionView;
  editable: boolean;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => initialDraft(section));
  useEffect(() => setDraft(initialDraft(section)), [section]);
  const panels = panelsOf(section);
  // 区画に分けたときは、区画ごとに「設定済み」を出す（いちばん上の区画は共通の項目なので出さない）
  const grouped = section.groups.length > 0;
  return (
    <>
      {panels.map((panel) => (
        <PanelForm
          key={panel.id ?? ""}
          apiBaseUrl={apiBaseUrl}
          sectionId={section.id}
          panel={panel}
          allFields={section.fields}
          showBadge={!grouped || panel.id !== null}
          draft={draft}
          setDraft={setDraft}
          editable={editable}
          onSaved={onSaved}
        />
      ))}
    </>
  );
}

function PanelForm({
  apiBaseUrl,
  sectionId,
  panel,
  allFields,
  showBadge,
  draft,
  setDraft,
  editable,
  onSaved,
}: {
  apiBaseUrl: string;
  sectionId: string;
  panel: Panel;
  allFields: FieldView[];
  showBadge: boolean;
  draft: Record<string, FieldValue>;
  setDraft: (draft: Record<string, FieldValue>) => void;
  editable: boolean;
  onSaved: () => Promise<void>;
}) {
  const t = messages.useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const configured = isConfigured(panel.fields);

  const put = async (values: Record<string, FieldValue | null>) => {
    const res = await fetch(`${apiBaseUrl}/api/settings/connections/${sectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? t("saveFailed", { status: res.status }));
  };

  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await task() });
      await onSaved();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      // この区画の項目だけを送る。秘密の項目は入れたときだけ送る（空のままなら今の値のまま）。ほかの項目は空にすると .env の値に戻る
      const values: Record<string, FieldValue | null> = {};
      for (const field of panel.fields) {
        const value = draft[field.key];
        if (field.kind === "secret" && value === "") continue;
        values[field.key] = value;
      }
      await put(values);
      return t("saved");
    });
  };

  const reset = (field: FieldView) =>
    run(async () => {
      await put({ [field.key]: null });
      return t("resetDone", { label: field.label });
    });

  const testConnection = (path: string) =>
    run(async () => {
      const res = await fetch(`${apiBaseUrl}/api/ext/${sectionId}${path}`, { method: "POST" });
      const body = (await res.json()) as { ok: boolean; message: string };
      if (!body.ok) throw new Error(body.message);
      return body.message;
    });

  return (
    <Group>
      {(panel.title || showBadge) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {panel.title && <h5 className="text-label font-semibold">{panel.title}</h5>}
          {showBadge && <Badge on={configured}>{configured ? t("configured") : t("unset")}</Badge>}
        </div>
      )}
      <form onSubmit={submit}>
        {panel.note && <Note>{panel.note}</Note>}
        {panel.steps.length > 0 && (
          <details className="mb-3 text-note leading-normal">
            <summary className="inline-flex min-h-8 cursor-pointer items-center text-text underline">{t("steps")}</summary>
            <ol className="mt-1.5 flex list-decimal flex-col gap-1.5 pl-6 text-muted">
              {panel.steps.map((step, i) => (
                <li key={i}>
                  <StepText text={step} fields={allFields} />
                </li>
              ))}
            </ol>
          </details>
        )}
        <fieldset disabled={!editable || busy} className="min-w-0 disabled:opacity-60">
          {panel.fields.map((field) => {
            const source = (
              <span className="flex flex-wrap items-center gap-2">
                {t(SOURCE_LABELS[field.source])}
                {field.env && t("envName", { env: field.env })}
                {field.source === "settings" && (
                  <button type="button" className="cursor-pointer text-text underline" onClick={() => void reset(field)}>
                    {t("resetToEnv")}
                  </button>
                )}
              </span>
            );
            return field.kind === "boolean" ? (
              <div key={field.key}>
                <Check checked={draft[field.key] === true} onChange={(checked) => setDraft({ ...draft, [field.key]: checked })}>
                  {field.label}
                </Check>
                <small className="mb-3 block text-caption text-muted">{source}</small>
              </div>
            ) : (
              <Field key={field.key} label={field.label} hint={source}>
                <input
                  type={field.kind === "secret" ? "password" : "text"}
                  inputMode={field.kind === "number" ? "decimal" : field.kind === "url" ? "url" : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    field.kind === "secret"
                      ? field.isSet
                        ? t("secretSet")
                        : t("unset")
                      : (field.placeholder ?? "")
                  }
                  value={String(draft[field.key] ?? "")}
                  onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                />
              </Field>
            );
          })}
          <ButtonRow>
            {panel.fields.length > 0 && (
              <Button type="submit" variant="primary">
                {t("save")}
              </Button>
            )}
            {panel.test && <Button onClick={() => void testConnection(panel.test!)}>{t("testConnection")}</Button>}
            {panel.links.map((link) => (
              <ButtonLink
                key={link.href}
                // 外のページ（https）はそのまま、本体の中の道はサーバーの頭を付ける
                href={link.href.startsWith("https://") ? link.href : `${apiBaseUrl}${link.href}`}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </ButtonLink>
            ))}
          </ButtonRow>
        </fieldset>
        {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      </form>
    </Group>
  );
}
