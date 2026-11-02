import { useEffect, useState } from "react";
import { defineMessages, List, ListItem, Message, Note, SectionTitle, Slider } from "@home-dashboard/widget-sdk";
import { choiceMark, SLIDER_ROW, SLIDER_ROW_LABEL, STACK } from "./settingsStyles";
import { Icon } from "./Icon";
import { NightConditions } from "./NightConditions";
import type { NightState } from "../lib/useNight";

/**
 * 設定画面の「夜の表示」。いつ夜にするか（条件で・いつも・使わない）と、夜のときの暗さ。全部の端末で同じで、変えるのは管理者だけ。
 * 条件（照度・照明・時間帯）もここで決める（値は、家の状態を差し出している拡張機能から本体が読む）
 */

interface NightSettingsProps {
  apiBaseUrl: string;
  night: NightState | null;
  isAdmin: boolean;
  onChange: (state: NightState) => void;
}

const messages = defineMessages({
  ja: {
    note: "部屋が暗い・電気が消えているときに、ダッシュボードの背景と文字をぐっと暗くします。全部の端末で同じです。",
    when: "夜にするとき",
    auto: "条件を満たしたとき",
    autoDetail: "照度・照明・時間帯の条件で決めます",
    on: "いつも",
    onDetail: "条件に関わらず、いつも暗くします",
    off: "使わない",
    offDetail: "暗くしません",
    now: "今",
    activeNow: "夜の表示です",
    inactiveNow: "夜の表示ではありません",
    because: "満たしている条件: {reason}",
    darkness: "暗さ {value}%",
    darknessLabel: "夜のときの暗さ",
    darknessNote: "夜のとき、画面全体に重ねる暗さです。壁紙はさらに暗くします。",
    adminOnly: "変えられるのは管理者だけです。",
    requestFailed: "うまくいきませんでした（{status}）",
  },
  en: {
    note: "Darkens the dashboard's background and text when the room is dark or the lights are off. The same on every device.",
    when: "When to darken",
    auto: "When conditions are met",
    autoDetail: "Based on illuminance, lights and time of day",
    on: "Always",
    onDetail: "Always darken, regardless of conditions",
    off: "Off",
    offDetail: "Never darken",
    now: "Now",
    activeNow: "Night display is on",
    inactiveNow: "Night display is off",
    because: "Conditions met: {reason}",
    darkness: "Darkness {value}%",
    darknessLabel: "Darkness at night",
    darknessNote: "How dark the whole screen gets at night. The wallpaper gets darker still.",
    adminOnly: "Only administrators can change this.",
    requestFailed: "Something went wrong ({status})",
  },
});

const percent = (value: number) => Math.round(value * 100);

export function NightSettings({ apiBaseUrl, night, isAdmin, onChange }: NightSettingsProps) {
  const t = messages.useT();
  const [error, setError] = useState<string | null>(null);
  const [darkness, setDarkness] = useState(night?.darkness ?? 0.75);
  useEffect(() => {
    if (night) setDarkness(night.darkness);
  }, [night?.darkness]);

  const save = async (patch: Partial<Pick<NightState, "mode" | "darkness">>) => {
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/night`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("requestFailed", { status: res.status }));
      onChange(body as NightState);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const modes = [
    { id: "auto", label: t("auto"), detail: t("autoDetail") },
    { id: "on", label: t("on"), detail: t("onDetail") },
    { id: "off", label: t("off"), detail: t("offDetail") },
  ] as const;
  const mode = night?.mode ?? "auto";
  const reasons = (night?.signals ?? []).map((s) => s.reason).filter(Boolean);

  return (
    <section className={STACK}>
      <Note>{t("note")}</Note>
      <SectionTitle>{t("now")}</SectionTitle>
      <p className={night?.active ? "inline-flex items-center gap-2 font-semibold text-accent" : "inline-flex items-center gap-2 font-semibold text-muted"}>
        <Icon name="weather-moon" />
        <span>{night?.active ? t("activeNow") : t("inactiveNow")}</span>
      </p>
      {reasons.length > 0 && <Note>{t("because", { reason: reasons.join(" / ") })}</Note>}
      <SectionTitle>{t("when")}</SectionTitle>
      <List boxed label={t("when")}>
        {modes.map((option) => (
          <ListItem
            key={option.id}
            title={option.label}
            detail={option.detail}
            selected={option.id === mode}
            trailing={<Icon name="checkmark" className={choiceMark(option.id === mode)} />}
            chevron={false}
            onClick={isAdmin ? () => void save({ mode: option.id }) : undefined}
          />
        ))}
      </List>
      {mode === "auto" && night && <NightConditions apiBaseUrl={apiBaseUrl} night={night} isAdmin={isAdmin} onChange={onChange} />}
      <SectionTitle>{t("darknessLabel")}</SectionTitle>
      <Note>{t("darknessNote")}</Note>
      <div className={SLIDER_ROW}>
        <span className={SLIDER_ROW_LABEL}>{t("darkness", { value: percent(darkness) })}</span>
        <Slider
          className="flex-1"
          value={darkness}
          min={0.3}
          max={0.95}
          step={0.05}
          disabled={!isAdmin}
          label={t("darknessLabel")}
          valueText={`${percent(darkness)}%`}
          onInput={setDarkness}
          onCommit={(value) => {
            setDarkness(value);
            void save({ darkness: value });
          }}
        />
      </div>
      {!isAdmin && <Note>{t("adminOnly")}</Note>}
      {error && <Message tone="error">{error}</Message>}
    </section>
  );
}
