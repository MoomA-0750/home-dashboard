import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Field,
  List,
  ListItem,
  Message,
  Note,
  SectionTitle,
  defineMessages,
  usePolledResource,
} from "@home-dashboard/widget-sdk";
import type { NightCondition, NightRules, NightState } from "../lib/useNight";
import { STACK } from "./settingsStyles";

/** 入力欄を横に並べる（スマホでは縦に） */
const FIELD_ROW = "grid grid-cols-2 gap-3 phone:grid-cols-1";

/**
 * 設定画面の「夜の表示」の条件。照度などの数値・照明などのオンオフ・時間帯を並べ、すべて（またはどれか）を満たして
 * 決めた分続いたら夜の表示にする（「条件を満たしたとき」のとき）。値は、家の状態を差し出している拡張機能
 * （Home Assistant など）から本体が読む（/api/night/readings）ので、連携先を問わない。条件ごとに今の値と満たしているかを出す
 */

interface Reading {
  id: string;
  name: string;
  kind: "number" | "onoff";
  value: number | boolean | null;
  unit?: string | null;
}

interface ReadingSource {
  source: string;
  name: string;
  readings: Reading[];
  error: string | null;
}

const messages = defineMessages({
  ja: {
    conditions: "条件",
    none: "まだ条件がありません。下で足します。条件が無いあいだは、暗くしません。",
    noSources:
      "照度や照明を条件に使うには、家の状態を差し出す拡張機能（Home Assistant など）を入れてつなぎます。時間帯はいつでも使えます。",
    sourceError: "{name} の値を読めませんでした（{error}）",
    match: "満たし方",
    all: "すべて満たす",
    any: "どれかを満たす",
    hold: "続いたら夜にするまで（分）",
    met: "満たしている",
    unmet: "満たしていない",
    current: "今: {value}",
    unreadable: "今: 読めません",
    remove: "外す",
    add: "条件を足す",
    target: "何を見るか",
    choose: "選んでください",
    time: "時間帯",
    below: "未満",
    above: "より上",
    off: "消えている",
    on: "ついている",
    value: "値",
    from: "から",
    to: "まで",
    save: "条件を保存",
    saved: "保存しました",
    now: "今: {value}",
    numbers: "{name}の数値",
    switches: "{name}のオン・オフ",
    failed: "うまくいきませんでした（{status}）",
  },
  en: {
    conditions: "Conditions",
    none: "No conditions yet. Add one below. Nothing darkens while there are none.",
    noSources:
      "To use brightness or lights as conditions, install and connect an extension that shares home states (such as Home Assistant). Time of day is always available.",
    sourceError: "Couldn't read values from {name} ({error})",
    match: "Match",
    all: "All conditions",
    any: "Any condition",
    hold: "Minutes to wait before darkening",
    met: "Met",
    unmet: "Not met",
    current: "Now: {value}",
    unreadable: "Now: unavailable",
    remove: "Remove",
    add: "Add condition",
    target: "What to watch",
    choose: "Choose one",
    time: "Time of day",
    below: "Below",
    above: "Above",
    off: "Is off",
    on: "Is on",
    value: "Value",
    from: "From",
    to: "To",
    save: "Save conditions",
    saved: "Saved",
    now: "Now: {value}",
    numbers: "{name} values",
    switches: "{name} on/off",
    failed: "Something went wrong ({status})",
  },
});

type T = ReturnType<typeof messages.useT>;
const TIME_KEY = "__time";
const keyOf = (source: string, id: string) => JSON.stringify([source, id]);

function findReading(sources: ReadingSource[], source: string, id: string): Reading | undefined {
  return sources.find((s) => s.source === source)?.readings.find((r) => r.id === id);
}

function describe(condition: NightCondition, sources: ReadingSource[], t: T): string {
  if (condition.kind === "time") return `${t("time")} ${condition.from}〜${condition.to}`;
  const reading = findReading(sources, condition.source, condition.id);
  const name = reading?.name ?? condition.id;
  if (condition.kind === "below" || condition.kind === "above")
    return `${name} ${condition.value}${reading?.unit ? ` ${reading.unit}` : ""} ${t(condition.kind)}`;
  return `${name} ${t(condition.kind)}`;
}

/** 今の値を、画面の言葉で（オンオフは「ついている・消えている」） */
function readingText(reading: Reading, t: T): string {
  if (reading.value === null) return "—";
  if (typeof reading.value === "boolean") return reading.value ? t("on") : t("off");
  return `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`;
}

/** 条件の今の値。時間帯は本体が確かめた時刻、ほかは差し出している拡張機能の値（画面の言葉で） */
function currentOf(condition: NightCondition, checked: string | null, sources: ReadingSource[], t: T): string {
  if (condition.kind === "time") return t("current", { value: checked ?? "—" });
  const reading = findReading(sources, condition.source, condition.id);
  return reading && reading.value !== null ? t("current", { value: readingText(reading, t) }) : t("unreadable");
}

interface NightConditionsProps {
  apiBaseUrl: string;
  night: NightState;
  isAdmin: boolean;
  onChange: (state: NightState) => void;
}

export function NightConditions({ apiBaseUrl, night, isAdmin, onChange }: NightConditionsProps) {
  const t = messages.useT();
  const { data } = usePolledResource(
    async () => {
      const res = await fetch(`${apiBaseUrl}/api/night/readings`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("failed", { status: res.status }));
      return (body.sources ?? []) as ReadingSource[];
    },
    15_000,
    true,
  );
  const sources = data ?? [];
  const [draft, setDraft] = useState<NightRules | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // 保存してある条件を下書きにする（直している間は、知らせで上書きしない）
  useEffect(() => {
    if (draft === null) setDraft(night.rules);
  }, [night.rules, draft]);

  const rules = draft ?? night.rules;
  const dirty = JSON.stringify(rules) !== JSON.stringify(night.rules);
  const change = (patch: Partial<NightRules>) => {
    setMessage(null);
    setDraft({ ...rules, ...patch });
  };

  const save = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/night`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("failed", { status: res.status }));
      onChange(body as NightState);
      setDraft((body as NightState).rules);
      setMessage({ tone: "ok", text: t("saved") });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }, [apiBaseUrl, onChange, rules, t]);

  // 保存した条件の判定は、直している途中は出さない（並びがずれるため）
  const results = dirty ? [] : (night.evaluation?.results ?? []);

  return (
    <div className={STACK}>
      <SectionTitle>{t("conditions")}</SectionTitle>
      {rules.conditions.length === 0 ? (
        <Note>{t("none")}</Note>
      ) : (
        <List boxed label={t("conditions")}>
          {rules.conditions.map((condition, index) => {
            const result = results[index];
            return (
              <ListItem
                key={index}
                title={describe(condition, sources, t)}
                badge={result ? <Badge tone={result.met ? "on" : "dim"}>{result.met ? t("met") : t("unmet")}</Badge> : undefined}
                detail={result ? currentOf(condition, result.current, sources, t) : undefined}
                trailing={
                  isAdmin && (
                    <Button onClick={() => change({ conditions: rules.conditions.filter((_, i) => i !== index) })}>{t("remove")}</Button>
                  )
                }
                chevron={false}
              />
            );
          })}
        </List>
      )}

      {data && sources.length === 0 && <Note>{t("noSources")}</Note>}
      {sources
        .filter((s) => s.error)
        .map((s) => (
          <Message key={s.source} tone="error">
            {t("sourceError", { name: s.name, error: s.error ?? "" })}
          </Message>
        ))}

      {isAdmin && <AddCondition sources={sources} onAdd={(condition) => change({ conditions: [...rules.conditions, condition] })} />}

      <div className={FIELD_ROW}>
        <Field label={t("match")}>
          <select
            value={rules.match}
            disabled={!isAdmin}
            onChange={(event) => change({ match: event.target.value === "any" ? "any" : "all" })}
          >
            <option value="all">{t("all")}</option>
            <option value="any">{t("any")}</option>
          </select>
        </Field>
        <Field label={t("hold")}>
          <input
            type="number"
            min={0}
            max={60}
            step={1}
            value={rules.holdMinutes}
            disabled={!isAdmin}
            onChange={(event) => change({ holdMinutes: Math.max(0, Math.min(60, Math.round(Number(event.target.value) || 0))) })}
          />
        </Field>
      </div>

      {message && <Message tone={message.tone}>{message.text}</Message>}
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** 条件を1つ足す欄。値を選ぶと、数値なら 未満・より上 と値、オンオフなら 消えている・ついている を選ぶ */
function AddCondition({ sources, onAdd }: { sources: ReadingSource[]; onAdd: (condition: NightCondition) => void }) {
  const t = messages.useT();
  const [target, setTarget] = useState("");
  const [test, setTest] = useState<"below" | "above" | "off" | "on">("below");
  const [value, setValue] = useState("10");
  const [from, setFrom] = useState("22:00");
  const [to, setTo] = useState("06:00");

  const picked = (() => {
    if (!target || target === TIME_KEY) return null;
    const [source, id] = JSON.parse(target) as [string, string];
    const reading = findReading(sources, source, id);
    return reading ? { source, reading } : null;
  })();
  const isTime = target === TIME_KEY;
  const numeric = picked?.reading.kind === "number";

  const choose = (next: string) => {
    setTarget(next);
    if (!next || next === TIME_KEY) return;
    const [source, id] = JSON.parse(next) as [string, string];
    const reading = findReading(sources, source, id);
    if (reading?.kind === "number") {
      setTest("below");
      setValue(typeof reading.value === "number" ? String(reading.value) : "10");
    } else setTest("off");
  };

  const condition: NightCondition | null = isTime
    ? { kind: "time", from, to }
    : !picked
      ? null
      : numeric
        ? Number.isFinite(Number(value)) && value.trim() !== ""
          ? { kind: test === "above" ? "above" : "below", source: picked.source, id: picked.reading.id, value: Number(value) }
          : null
        : { kind: test === "on" ? "on" : "off", source: picked.source, id: picked.reading.id };

  // 差し出している拡張機能ごとに、数値とオンオフで分けて並べる
  const groups = sources.flatMap((s) =>
    (["number", "onoff"] as const)
      .map((kind) => ({
        label: t(kind === "number" ? "numbers" : "switches", { name: s.name }),
        source: s.source,
        list: s.readings.filter((r) => r.kind === kind),
      }))
      .filter((g) => g.list.length > 0),
  );

  return (
    <div className="flex flex-col gap-3 rounded-group bg-input p-4">
      <Field label={t("target")} hint={picked ? t("now", { value: readingText(picked.reading, t) }) : undefined}>
        <select value={target} onChange={(event) => choose(event.target.value)}>
          <option value="">{t("choose")}</option>
          <option value={TIME_KEY}>{t("time")}</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.list.map((r) => (
                <option key={r.id} value={keyOf(group.source, r.id)}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {isTime && (
        <div className={FIELD_ROW}>
          <Field label={t("from")}>
            <input type="time" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label={t("to")}>
            <input type="time" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
      )}
      {picked && (
        <div className={FIELD_ROW}>
          {numeric && (
            <Field label={`${t("value")}${picked.reading.unit ? `（${picked.reading.unit}）` : ""}`}>
              <input type="number" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
            </Field>
          )}
          <Field label=" ">
            <select value={test} onChange={(event) => setTest(event.target.value as typeof test)}>
              {(numeric ? (["below", "above"] as const) : (["off", "on"] as const)).map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <Button
        icon="add"
        className="self-start"
        disabled={!condition}
        onClick={() => {
          if (!condition) return;
          onAdd(condition);
          setTarget("");
        }}
      >
        {t("add")}
      </Button>
    </div>
  );
}
