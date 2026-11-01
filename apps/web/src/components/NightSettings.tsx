import { useEffect, useState } from "react";
import { Button, defineMessages, List, ListItem, Note, openSettings, Slider } from "@home-dashboard/widget-sdk";
import { Icon } from "./Icon";
import type { NightState } from "../lib/useNight";

/**
 * 設定画面の「夜の表示」。いつ夜にするか（条件で・いつも・使わない）と、夜のときの暗さ。全部の端末で同じで、変えるのは管理者だけ。
 * 条件そのもの（照度・照明・時間帯）は、その状態を知っている拡張機能（Home Assistant）の設定で決める
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
    conditionsWhere: "条件は、拡張機能の Home Assistant の設定にある「夜の表示の条件」で決めます。",
    openConditions: "条件を決める",
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
    conditionsWhere: "Set the conditions under “Night display conditions” in the Home Assistant extension settings.",
    openConditions: "Set conditions",
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
    <section className="night-settings">
      <Note>{t("note")}</Note>
      <h4 className="settings-detail__subtitle">{t("now")}</h4>
      <p className={night?.active ? "night-settings__now night-settings__now--on" : "night-settings__now"}>
        <Icon name="weather-moon" />
        <span>{night?.active ? t("activeNow") : t("inactiveNow")}</span>
      </p>
      {reasons.length > 0 && <Note>{t("because", { reason: reasons.join(" / ") })}</Note>}
      <h4 className="settings-detail__subtitle">{t("when")}</h4>
      <List boxed label={t("when")}>
        {modes.map((option) => (
          <ListItem
            key={option.id}
            title={option.label}
            detail={option.detail}
            selected={option.id === mode}
            trailing={<Icon name="checkmark" className={option.id === mode ? undefined : "settings-choice__off"} />}
            chevron={false}
            onClick={isAdmin ? () => void save({ mode: option.id }) : undefined}
          />
        ))}
      </List>
      {mode === "auto" && (
        <div className="night-settings__conditions">
          <Note>{t("conditionsWhere")}</Note>
          <Button onClick={() => openSettings({ page: "extensions", extension: "home-assistant" })}>{t("openConditions")}</Button>
        </div>
      )}
      <h4 className="settings-detail__subtitle">{t("darknessLabel")}</h4>
      <Note>{t("darknessNote")}</Note>
      <div className="wallpaper-dim__strength">
        <span>{t("darkness", { value: percent(darkness) })}</span>
        <Slider
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
      {error && <p className="connection-settings__message connection-settings__message--error">{error}</p>}
    </section>
  );
}
