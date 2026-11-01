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
  ToggleSwitch,
  defineMessages,
  usePolledResource,
  type ExtensionSettingsPanelProps,
} from "@home-dashboard/widget-sdk";
import type { ConditionResult, NightCondition, NightRules } from "./night";
import type { NightCandidate } from "./homeassistant";

/**
 * 設定画面の「拡張機能 → Home Assistant」に出す「夜の表示の条件」。照度のセンサー・照明・時間帯を並べ、
 * すべて（またはどれか）を満たして決めた分続いたら、ダッシュボードを夜の表示にする（本体の設定の「夜の表示」が「条件を満たしたとき」のとき）。
 * 条件ごとに今の値と、満たしているかを出す。変えるのは管理者だけ
 */

interface NightView {
  configured: boolean;
  rules: NightRules;
  met: boolean;
  active: boolean;
  results: ConditionResult[];
  entities: NightCandidate[];
}

const messages = defineMessages({
  ja: {
    title: "夜の表示の条件",
    note: "部屋が暗い・電気が消えているなど、決めた条件を満たして続いたら、ダッシュボードの背景と文字をぐっと暗くします（設定の「夜の表示」が「条件を満たしたとき」のとき）。電気をつけるなどで満たさなくなったら、すぐ戻します。",
    enabled: "条件で夜の表示にする",
    match: "満たし方",
    all: "すべて満たす",
    any: "どれかを満たす",
    hold: "続いたら夜にするまで（分）",
    conditions: "条件",
    none: "まだ条件がありません。下で足します。",
    met: "満たしている",
    unmet: "満たしていない",
    current: "今: {value}",
    unreadable: "今: 読めません",
    remove: "外す",
    add: "条件を足す",
    entity: "機器",
    chooseEntity: "選んでください",
    time: "時間帯",
    below: "未満",
    above: "より上",
    off: "消えている",
    on: "ついている",
    value: "値",
    from: "から",
    to: "まで",
    save: "保存",
    saved: "保存しました",
    stateNow: "今: {state}",
    activeNow: "夜の表示に入っています",
    metNow: "条件を満たしています（続いたら夜の表示にします）",
    idleNow: "条件を満たしていません",
    disabledNow: "条件で夜にしていません",
    loading: "読み込んでいます…",
    notConfigured: "Home Assistant につながると、条件を決められます。",
    adminOnly: "条件を変えられるのは管理者だけです。",
    failed: "うまくいきませんでした（{status}）",
    illuminance: "明るさ",
    light: "照明",
    other: "そのほか",
  },
  en: {
    title: "Night display conditions",
    note: "When the conditions you set hold for a while (the room is dark, the lights are off…), the dashboard's background and text get much darker (when Settings → Night display is set to “When conditions are met”). It returns right away once they no longer hold, such as when a light turns on.",
    enabled: "Use conditions for the night display",
    match: "Match",
    all: "All conditions",
    any: "Any condition",
    hold: "Minutes to wait before darkening",
    conditions: "Conditions",
    none: "No conditions yet. Add one below.",
    met: "Met",
    unmet: "Not met",
    current: "Now: {value}",
    unreadable: "Now: unavailable",
    remove: "Remove",
    add: "Add condition",
    entity: "Device",
    chooseEntity: "Choose one",
    time: "Time of day",
    below: "Below",
    above: "Above",
    off: "Is off",
    on: "Is on",
    value: "Value",
    from: "From",
    to: "To",
    save: "Save",
    saved: "Saved",
    stateNow: "Now: {state}",
    activeNow: "The night display is on",
    metNow: "Conditions are met (darkens once they hold)",
    idleNow: "Conditions aren't met",
    disabledNow: "Conditions aren't in use",
    loading: "Loading…",
    notConfigured: "Connect Home Assistant to set conditions.",
    adminOnly: "Only administrators can change the conditions.",
    failed: "Something went wrong ({status})",
    illuminance: "Brightness",
    light: "Lights",
    other: "Others",
  },
});

type T = ReturnType<typeof messages.useT>;
const TIME_KEY = "__time";

function describe(condition: NightCondition, entities: NightCandidate[], t: T): string {
  if (condition.kind === "time") return `${t("time")} ${condition.from}〜${condition.to}`;
  const entity = entities.find((e) => e.entityId === condition.entityId);
  const name = entity?.name ?? condition.entityId;
  if (condition.kind === "below" || condition.kind === "above")
    return `${name} ${condition.value}${entity?.unit ? ` ${entity.unit}` : ""} ${t(condition.kind)}`;
  return `${name} ${t(condition.kind)}`;
}

/** 今の値。照明などは on・off を「ついている・消えている」で出す */
function currentText(condition: NightCondition, current: string, t: T): string {
  if (condition.kind !== "on" && condition.kind !== "off") return current;
  if (current === "on") return t("on");
  if (current === "off") return t("off");
  return current;
}

export function NightConditions({ ctx, isAdmin }: ExtensionSettingsPanelProps) {
  const t = messages.useT();
  const url = `${ctx.apiBaseUrl}/api/ext/home-assistant/night`;
  const { data, error: loadError, refresh } = usePolledResource(
    async () => {
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("failed", { status: res.status }));
      return body as NightView;
    },
    15_000,
    true,
  );
  const [draft, setDraft] = useState<NightRules | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // 読み込んだ条件を下書きにする（直している間は、読み直しで上書きしない）
  useEffect(() => {
    if (data && draft === null) setDraft(data.rules);
  }, [data, draft]);

  const rules = draft ?? data?.rules ?? null;
  const dirty = Boolean(data && draft && JSON.stringify(draft) !== JSON.stringify(data.rules));
  const change = (patch: Partial<NightRules>) => rules && setDraft({ ...rules, ...patch });

  const save = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("failed", { status: res.status }));
      setDraft(body.rules as NightRules);
      setMessage({ tone: "ok", text: t("saved") });
      await refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }, [draft, refresh, t, url]);

  if (!data || !rules)
    return (
      <section className="ha-night">
        <SectionTitle>{t("title")}</SectionTitle>
        {loadError ? <Message tone="error">{(loadError as Error).message}</Message> : <Note>{t("loading")}</Note>}
      </section>
    );

  if (!data.configured)
    return (
      <section className="ha-night">
        <SectionTitle>{t("title")}</SectionTitle>
        <Note>{t("notConfigured")}</Note>
      </section>
    );

  // 保存した条件の判定は、保存した条件と同じ並びのときだけ出す（直している途中は出さない）
  const results = dirty ? [] : data.results;
  const status = !data.rules.enabled ? t("disabledNow") : data.active ? t("activeNow") : data.met ? t("metNow") : t("idleNow");

  return (
    <section className="ha-night">
      <SectionTitle>{t("title")}</SectionTitle>
      <Note>{t("note")}</Note>
      <List boxed>
        <ListItem
          title={t("enabled")}
          detail={status}
          trailing={
            <ToggleSwitch checked={rules.enabled} disabled={!isAdmin} label={t("enabled")} onChange={(enabled) => change({ enabled })} />
          }
        />
      </List>

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
                title={describe(condition, data.entities, t)}
                badge={result ? <Badge tone={result.met ? "on" : "dim"}>{result.met ? t("met") : t("unmet")}</Badge> : undefined}
                detail={result ? (result.current === null ? t("unreadable") : t("current", { value: currentText(condition, result.current, t) })) : undefined}
                trailing={
                  isAdmin && (
                    <Button onClick={() => change({ conditions: rules.conditions.filter((_, i) => i !== index) })}>{t("remove")}</Button>
                  )
                }
              />
            );
          })}
        </List>
      )}

      {isAdmin && (
        <AddCondition
          entities={data.entities}
          onAdd={(condition) => change({ conditions: [...rules.conditions, condition] })}
        />
      )}

      <div className="ha-night__options">
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
      {isAdmin ? (
        <div className="ha-night__actions">
          <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      ) : (
        <Note>{t("adminOnly")}</Note>
      )}
    </section>
  );
}

/** 条件を1つ足す欄。機器を選ぶと、数値なら 未満・より上 と値、照明などなら 消えている・ついている を選ぶ */
function AddCondition({ entities, onAdd }: { entities: NightCandidate[]; onAdd: (condition: NightCondition) => void }) {
  const t = messages.useT();
  const [target, setTarget] = useState("");
  const [test, setTest] = useState<"below" | "above" | "off" | "on">("below");
  const [value, setValue] = useState("10");
  const [from, setFrom] = useState("22:00");
  const [to, setTo] = useState("06:00");

  const entity = entities.find((e) => e.entityId === target) ?? null;
  const isTime = target === TIME_KEY;
  const numeric = entity?.type === "number";

  const choose = (next: string) => {
    setTarget(next);
    const picked = entities.find((e) => e.entityId === next);
    if (picked?.type === "number") {
      setTest("below");
      setValue(picked.deviceClass === "illuminance" ? "10" : picked.state);
    } else setTest("off");
  };

  const groups = [
    { label: t("illuminance"), list: entities.filter((e) => e.deviceClass === "illuminance") },
    { label: t("light"), list: entities.filter((e) => e.entityId.startsWith("light.")) },
    { label: t("other"), list: entities.filter((e) => e.deviceClass !== "illuminance" && !e.entityId.startsWith("light.")) },
  ].filter((g) => g.list.length > 0);

  const condition: NightCondition | null = isTime
    ? { kind: "time", from, to }
    : !entity
      ? null
      : numeric
        ? Number.isFinite(Number(value)) && value.trim() !== ""
          ? { kind: test === "above" ? "above" : "below", entityId: entity.entityId, value: Number(value) }
          : null
        : { kind: test === "on" ? "on" : "off", entityId: entity.entityId };

  return (
    <div className="ha-night__add">
      <Field label={t("entity")} hint={entity ? t("stateNow", { state: `${entity.state}${entity.unit ? ` ${entity.unit}` : ""}` }) : undefined}>
        <select value={target} onChange={(event) => choose(event.target.value)}>
          <option value="">{t("chooseEntity")}</option>
          <option value={TIME_KEY}>{t("time")}</option>
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.list.map((e) => (
                <option key={e.entityId} value={e.entityId}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {isTime && (
        <div className="ha-night__row">
          <Field label={t("from")}>
            <input type="time" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label={t("to")}>
            <input type="time" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
      )}
      {entity && (
        <div className="ha-night__row">
          {numeric && (
            <Field label={`${t("value")}${entity.unit ? `（${entity.unit}）` : ""}`}>
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
