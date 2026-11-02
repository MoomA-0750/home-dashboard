import { useCallback, useEffect, useState } from "react";
import {
  List,
  ListItem,
  Message,
  Note,
  SectionTitle,
  ToggleSwitch,
  defineMessages,
  textFor,
  useLocale,
  type ExtensionSettingsPanelProps,
  type LocalizedText,
} from "@home-dashboard/widget-sdk";
import { localizeState } from "./units";

/**
 * 設定画面の「拡張機能 → Home Assistant」で、接続設定の下に出す「計測に使うセンサー」。
 * 切ったセンサーは、ホームコントロールの画面・ウィジェット（平均）・音声アシスタントに出さない。入／切は管理者だけ。
 */

interface SensorRow {
  entityId: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
  area: string | null;
  enabled: boolean;
}

const CLASS_LABELS: Record<string, LocalizedText> = {
  temperature: { ja: "室温", en: "Temperature" },
  humidity: { ja: "湿度", en: "Humidity" },
  carbon_dioxide: "CO₂",
  pm25: "PM2.5",
  illuminance: { ja: "明るさ", en: "Brightness" },
};

const messages = defineMessages({
  ja: {
    unreadable: "読めません",
    loadFailed: "センサーを読めませんでした（{status}）",
    changeFailed: "変えられませんでした（{status}）",
    title: "計測に使うセンサー",
    note: "切ったセンサーは、ホームコントロールの画面・家電操作のウィジェット（平均の値）・音声アシスタントに使いません。壊れたセンサーや、外に置いたセンサーを外すときに使います。",
    loading: "センサーを読み込んでいます…",
    none: "温度・湿度・CO₂ などのセンサーが見つかりません。",
    turnOff: "{name}を切る",
    turnOn: "{name}を入れる",
  },
  en: {
    unreadable: "Unavailable",
    loadFailed: "Couldn't load sensors ({status})",
    changeFailed: "Couldn't change it ({status})",
    title: "Sensors used for readings",
    note: "Sensors you turn off aren't used on the Home Control screen, in the home controls widget (averages) or by the voice assistant. Use this to leave out broken sensors or ones placed outdoors.",
    loading: "Loading sensors…",
    none: "No temperature, humidity, CO₂ or similar sensors found.",
    turnOff: "Turn off {name}",
    turnOn: "Turn on {name}",
  },
});

function formatState(sensor: SensorRow, t: ReturnType<typeof messages.useT>): string {
  const value = Number(sensor.state);
  if (!Number.isFinite(value)) return sensor.state === "unavailable" ? t("unreadable") : sensor.state;
  return `${value.toFixed(sensor.deviceClass === "temperature" ? 1 : 0)}${sensor.unit ?? ""}`;
}

export function SensorSettings({ ctx, isAdmin }: ExtensionSettingsPanelProps) {
  const t = messages.useT();
  const locale = useLocale();
  const url = `${ctx.apiBaseUrl}/api/ext/home-assistant/sensors`;
  const [sensors, setSensors] = useState<SensorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? messages.t("loadFailed", { status: res.status }));
      if (!body.configured) return setSensors([]);
      setSensors((body.sensors as SensorRow[]).map(localizeState));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (sensor: SensorRow, enabled: boolean) => {
    setError(null);
    // 先に見た目を変え、だめだったら読み直して戻す
    setSensors((list) => list?.map((s) => (s.entityId === sensor.entityId ? { ...s, enabled } : s)) ?? null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: sensor.entityId, enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? messages.t("changeFailed", { status: res.status }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      void load();
    }
  };

  const groups = Object.keys(CLASS_LABELS)
    .map((deviceClass) => [deviceClass, (sensors ?? []).filter((s) => s.deviceClass === deviceClass)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <section className="mt-5 flex flex-col gap-2.5">
      <SectionTitle>{t("title")}</SectionTitle>
      <Note>{t("note")}</Note>
      {error && <Message tone="error">{error}</Message>}
      {sensors === null && !error && <Note>{t("loading")}</Note>}
      {sensors !== null && sensors.length === 0 && <Note>{t("none")}</Note>}
      {groups.map(([deviceClass, list]) => (
        <div key={deviceClass}>
          <SectionTitle>{textFor(CLASS_LABELS[deviceClass], locale)}</SectionTitle>
          <List>
            {list.map((sensor) => (
              <ListItem
                key={sensor.entityId}
                title={sensor.name}
                detail={[sensor.area, formatState(sensor, t), sensor.entityId].filter(Boolean).join(" · ")}
                off={!sensor.enabled}
                trailing={
                  <ToggleSwitch
                    checked={sensor.enabled}
                    disabled={!isAdmin}
                    label={t(sensor.enabled ? "turnOff" : "turnOn", { name: sensor.name })}
                    onChange={(enabled) => void toggle(sensor, enabled)}
                  />
                }
              />
            ))}
          </List>
        </div>
      ))}
    </section>
  );
}
