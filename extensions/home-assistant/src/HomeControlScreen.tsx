import { useEffect, useState } from "react";
import {
  defineMessages,
  Icon,
  PillMenu,
  ScreenFrame,
  Slider,
  textFor,
  useLocale,
  usePolledResource,
  type IconName,
  type LocalizedText,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import { SensorDetail } from "./SensorDetail";
import { localizeState } from "./units";

interface HaEntity {
  entityId: string;
  domain: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
  area: string | null;
}

interface Climate extends HaEntity {
  currentTemperature: number | null;
  targetTemperature: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  step: number | null;
  hvacModes: string[];
}

interface Toggle extends HaEntity {
  brightnessPct: number | null;
  dimmable: boolean;
}

interface Overview {
  configured: boolean;
  canUnlock: boolean;
  sensors: HaEntity[];
  locks: HaEntity[];
  climates: Climate[];
  toggles: Toggle[];
}

async function fetchOverview(apiBaseUrl: string): Promise<Overview> {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/overview`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  const overview = (await res.json()) as Overview;
  return { ...overview, sensors: (overview.sensors ?? []).map(localizeState) };
}

async function callService(apiBaseUrl: string, entityId: string, service: string, data?: Record<string, unknown>) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, service, data }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? messages.t("callFailed", { status: res.status }));
  }
}

const SENSOR_META: Record<string, { label: LocalizedText; icon: IconName }> = {
  temperature: { label: { ja: "室温", en: "Temperature" }, icon: "temperature" },
  humidity: { label: { ja: "湿度", en: "Humidity" }, icon: "drop" },
  carbon_dioxide: { label: "CO₂", icon: "molecule" },
  pm25: { label: "PM2.5", icon: "molecule" },
  illuminance: { label: { ja: "明るさ", en: "Brightness" }, icon: "weather-sunny" },
};

const HVAC_LABELS: Record<string, LocalizedText> = {
  off: { ja: "停止", en: "Off" },
  heat: { ja: "暖房", en: "Heat" },
  cool: { ja: "冷房", en: "Cool" },
  heat_cool: { ja: "冷暖房", en: "Heat/Cool" },
  auto: { ja: "自動", en: "Auto" },
  dry: { ja: "除湿", en: "Dry" },
  fan_only: { ja: "送風", en: "Fan" },
};

const messages = defineMessages({
  ja: {
    apiError: "home assistant API error: {status}",
    callFailed: "操作に失敗しました（{status}）",
    loading: "読み込み中…",
    unreachable: "Home Assistant に届きません。サーバーとの接続を確かめてください。",
    notConfigured:
      "Home Assistant が未接続です。設定画面の「接続設定 → Home Assistant」で URL とトークンを入れてください。",
    otherRoom: "そのほか",
    allRooms: "すべての部屋",
    roomPicker: "出す部屋（いまは{room}）",
    air: "部屋の空気",
    inArea: "{area}の{label}",
    sensorAria: "{label} {value}（詳しく見る）",
    locks: "鍵",
    climate: "空調",
    toggles: "照明・スイッチ",
    nothingHere: "この部屋に出せるものはありません。",
    locked: "施錠中",
    unlocked: "解錠中",
    locking: "施錠しています…",
    unlocking: "解錠しています…",
    jammed: "詰まっています",
    open: "開いています",
    unknownState: "状態不明",
    lock: "施錠",
    unlockConfirm: "もう一度押して解錠",
    unlock: "解錠",
    cannotUnlock: "この画面からは解錠できません",
    turnOn: "{name}をつける",
    turnOff: "{name}を止める",
    roomTemp: "室温 {value}",
    lowerTemp: "設定温度を下げる",
    raiseTemp: "設定温度を上げる",
    hvacMode: "運転モード",
    noResponse: "応答なし",
    on: "オン",
    off: "オフ",
    brightnessOf: "{name}の明るさ",
  },
  en: {
    apiError: "home assistant API error: {status}",
    callFailed: "The action failed ({status})",
    loading: "Loading…",
    unreachable: "Can't reach Home Assistant. Check the connection to the server.",
    notConfigured:
      "Home Assistant isn't connected. Enter the URL and token in Settings under Connections → Home Assistant.",
    otherRoom: "Other",
    allRooms: "All rooms",
    roomPicker: "Room to show (now: {room})",
    air: "Air",
    inArea: "{area} {label}",
    sensorAria: "{label} {value} (show details)",
    locks: "Locks",
    climate: "Climate",
    toggles: "Lights & switches",
    nothingHere: "Nothing to show in this room.",
    locked: "Locked",
    unlocked: "Unlocked",
    locking: "Locking…",
    unlocking: "Unlocking…",
    jammed: "Jammed",
    open: "Open",
    unknownState: "Unknown",
    lock: "Lock",
    unlockConfirm: "Press again to unlock",
    unlock: "Unlock",
    cannotUnlock: "Can't unlock from this screen",
    turnOn: "Turn on {name}",
    turnOff: "Turn off {name}",
    roomTemp: "Room {value}",
    lowerTemp: "Lower target temperature",
    raiseTemp: "Raise target temperature",
    hvacMode: "Mode",
    noResponse: "No response",
    on: "On",
    off: "Off",
    brightnessOf: "{name} brightness",
  },
});

type T = ReturnType<typeof messages.useT>;

/** 部屋の名前を添えたセンサーの名前（「リビングの室温」） */
function sensorTitle(area: string, label: string, t: T): string {
  return area ? t("inArea", { area, label }) : label;
}

/** 空気の具合の目安。CO₂ は 1000ppm（建築物衛生法の基準）を超えたら換気、1500 で強めに知らせる */
function sensorLevel(deviceClass: string | null, value: number | null): "ok" | "warm" | "hot" {
  if (value === null || !Number.isFinite(value)) return "ok";
  if (deviceClass === "carbon_dioxide") return value >= 1500 ? "hot" : value >= 1000 ? "warm" : "ok";
  if (deviceClass === "humidity") return value < 30 || value > 70 ? "warm" : "ok";
  if (deviceClass === "pm25") return value >= 35 ? "hot" : value >= 15 ? "warm" : "ok";
  return "ok";
}

function formatSensorValue(entity: HaEntity): string {
  const value = Number(entity.state);
  if (!Number.isFinite(value)) return entity.state === "unavailable" ? "—" : entity.state;
  const digits = entity.deviceClass === "temperature" ? 1 : 0;
  return value.toFixed(digits);
}

/** 同じ部屋で同じものを測っているセンサーをまとめたもの。値は読めたセンサーの平均で出す */
interface MergedSensor {
  key: string;
  deviceClass: string | null;
  sensors: HaEntity[];
  unit: string | null;
  /** 読めた値の平均。読めた値が無ければ null */
  average: number | null;
  /** 平均の値で決める */
  level: "ok" | "warm" | "hot";
}

function mergeSensors(sensors: HaEntity[]): MergedSensor[] {
  const groups = new Map<string, HaEntity[]>();
  for (const sensor of sensors) {
    // 種類の分からないセンサーは、まとめずに1つずつ出す
    const key = sensor.deviceClass ? `${sensor.deviceClass}:${sensor.unit ?? ""}` : sensor.entityId;
    groups.set(key, [...(groups.get(key) ?? []), sensor]);
  }
  return [...groups.entries()].map(([key, members]) => {
    // 読めないセンサー（unavailable など）は平均に入れない
    const values = members.map((m) => Number(m.state)).filter((v) => Number.isFinite(v));
    const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    return {
      key,
      deviceClass: members[0].deviceClass,
      sensors: members,
      unit: members[0].unit,
      average,
      level: sensorLevel(members[0].deviceClass, average),
    };
  });
}

function formatNumber(value: number, deviceClass: string | null): string {
  return value.toFixed(deviceClass === "temperature" ? 1 : 0);
}

function formatMergedValue(merged: MergedSensor): string {
  if (merged.sensors.length === 1) return formatSensorValue(merged.sensors[0]);
  return merged.average === null ? "—" : formatNumber(merged.average, merged.deviceClass);
}

/** 部屋（エリア）ごとにまとめる。エリアの分からないものは最後に「そのほか」でまとめる */
function groupByArea<T extends HaEntity>(entities: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const entity of entities) {
    const key = entity.area ?? "";
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
}

export function HomeControlScreen({ ctx }: ScreenProps) {
  const t = messages.useT();
  const locale = useLocale();
  const { apiBaseUrl } = ctx;
  const { data, error, loading, refresh } = usePolledResource(() => fetchOverview(apiBaseUrl), 5000, true, {
    cacheKey: "home-assistant:overview",
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // 出す部屋。null は「すべての部屋」（既定。開くたびにすべての部屋から始める）
  const [room, setRoom] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ area: string; merged: MergedSensor } | null>(null);

  const run = async (entityId: string, service: string, data?: Record<string, unknown>) => {
    setBusy(entityId);
    setFailure(null);
    try {
      await callService(apiBaseUrl, entityId, service, data);
      // HA が状態を反映するまで少しかかるので、すぐと少し後の2回読み直す
      await refresh();
      setTimeout(refresh, 1200);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <ScreenFrame title={{ ja: "ホームコントロール", en: "Home Control" }}>{t("loading")}</ScreenFrame>;
  }
  if (error || !data) {
    return (
      <ScreenFrame title={{ ja: "ホームコントロール", en: "Home Control" }}>
        <p className="screen__notice">{t("unreachable")}</p>
      </ScreenFrame>
    );
  }
  if (!data.configured) {
    return (
      <ScreenFrame title={{ ja: "ホームコントロール", en: "Home Control" }}>
        <p className="screen__notice">{t("notConfigured")}</p>
      </ScreenFrame>
    );
  }

  // 部屋の一覧は、センサー・鍵・空調・照明とスイッチのどれかがある部屋。部屋の分からないものは「そのほか」
  const all = [...data.sensors, ...data.locks, ...data.climates, ...data.toggles];
  const areas = [...new Set(all.map((e) => e.area ?? ""))].sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ja"),
  );
  const shownRoom = room !== null && areas.includes(room) ? room : null;
  const inRoom = <T extends HaEntity>(entities: T[]) =>
    shownRoom === null ? entities : entities.filter((e) => (e.area ?? "") === shownRoom);
  const sensors = inRoom(data.sensors);
  const locks = inRoom(data.locks);
  const climates = inRoom(data.climates);
  const toggles = inRoom(data.toggles);
  const roomLabel = (area: string) => area || t("otherRoom");

  const roomPicker =
    areas.length > 1 ? (
      <PillMenu
        label={shownRoom === null ? t("allRooms") : roomLabel(shownRoom)}
        icon="home"
        ariaLabel={t("roomPicker", { room: shownRoom === null ? t("allRooms") : roomLabel(shownRoom) })}
        items={[
          { id: "*", label: t("allRooms"), selected: shownRoom === null },
          ...areas.map((area) => ({ id: `room:${area}`, label: roomLabel(area), selected: shownRoom === area })),
        ]}
        onSelect={(id) => setRoom(id === "*" ? null : id.slice("room:".length))}
      />
    ) : undefined;

  return (
    <ScreenFrame title={{ ja: "ホームコントロール", en: "Home Control" }} actions={roomPicker}>
      {failure && (
        <p className="screen__error" role="alert">
          {failure}
        </p>
      )}

      <div className="screen__columns home-control__columns">
        <div>
          {sensors.length > 0 && (
            <section className="screen__section home-section--air">
              <h2 className="screen__section-title">{t("air")}</h2>
              {groupByArea(sensors).map(([area, sensors]) => (
                <div key={area} className="home-control__area">
                  {area && shownRoom === null && <h3 className="home-control__area-name">{area}</h3>}
                  <div className="home-control__sensors">
                    {mergeSensors(sensors).map((merged) => {
                      const known = SENSOR_META[merged.deviceClass ?? ""];
                      const meta = {
                        label: known ? textFor(known.label, locale) : merged.sensors[0].name,
                        icon: known?.icon ?? ("unknown" as const),
                      };
                      // 押すと、センサーごとの値と推移を出す詳細を開く
                      return (
                        <button
                          type="button"
                          key={merged.key}
                          className={`home-sensor home-sensor--${merged.level}`}
                          aria-label={t("sensorAria", {
                            label: sensorTitle(area, meta.label, t),
                            value: `${formatMergedValue(merged)}${merged.unit ?? ""}`,
                          })}
                          onClick={() => setDetail({ area, merged })}
                        >
                          <span className="home-sensor__label">
                            <Icon name={meta.icon} />
                            {meta.label}
                          </span>
                          <span className="home-sensor__value">
                            {formatMergedValue(merged)}
                            <small>{merged.unit}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {locks.length > 0 && (
            <section className="screen__section home-section--locks">
              <h2 className="screen__section-title">{t("locks")}</h2>
              <div className="home-control__locks">
                {locks.map((lock) => (
                  <LockCard
                    key={lock.entityId}
                    lock={lock}
                    canUnlock={data.canUnlock}
                    busy={busy === lock.entityId}
                    onLock={() => run(lock.entityId, "lock")}
                    onUnlock={() => run(lock.entityId, "unlock")}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
        <div>
          {climates.length > 0 && (
            <section className="screen__section home-section--climate">
              <h2 className="screen__section-title">{t("climate")}</h2>
              <div className="home-control__climates">
                {climates.map((climate) => (
                  <ClimateCard
                    key={climate.entityId}
                    climate={climate}
                    busy={busy === climate.entityId}
                    onCall={(service, payload) => run(climate.entityId, service, payload)}
                  />
                ))}
              </div>
            </section>
          )}

          {toggles.length > 0 && (
            <section className="screen__section home-section--toggles">
              <h2 className="screen__section-title">{t("toggles")}</h2>
              {groupByArea(toggles).map(([area, toggles]) => (
                <div key={area} className="home-control__area">
                  {area && shownRoom === null && <h3 className="home-control__area-name">{area}</h3>}
                  <div className="home-control__toggles">
                    {toggles.map((toggle) => (
                      <ToggleTile
                        key={toggle.entityId}
                        toggle={toggle}
                        busy={busy === toggle.entityId}
                        onToggle={() => run(toggle.entityId, "toggle")}
                        onBrightness={(pct) => run(toggle.entityId, "turn_on", { brightness_pct: pct })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
      {sensors.length + locks.length + climates.length + toggles.length === 0 && (
        <p className="screen__notice">{t("nothingHere")}</p>
      )}
      {detail && (
        <SensorDetail
          apiBaseUrl={apiBaseUrl}
          title={sensorTitle(
            detail.area,
            SENSOR_META[detail.merged.deviceClass ?? ""]
              ? textFor(SENSOR_META[detail.merged.deviceClass ?? ""].label, locale)
              : detail.merged.sensors[0].name,
            t,
          )}
          icon={(SENSOR_META[detail.merged.deviceClass ?? ""] ?? { icon: "unknown" as const }).icon}
          sensors={detail.merged.sensors}
          digits={detail.merged.deviceClass === "temperature" ? 1 : 0}
          onClose={() => setDetail(null)}
        />
      )}
    </ScreenFrame>
  );
}

const UNLOCK_CONFIRM_MS = 4000;

function LockCard({
  lock,
  canUnlock,
  busy,
  onLock,
  onUnlock,
}: {
  lock: HaEntity;
  canUnlock: boolean;
  busy: boolean;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const t = messages.useT();
  // 解錠はうっかり押しても開かないよう、もう一度押して確かめる
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), UNLOCK_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const locked = lock.state === "locked";
  const unlocked = lock.state === "unlocked" || lock.state === "open";
  const stateKey = (["locked", "unlocked", "locking", "unlocking", "jammed", "open"] as const).find(
    (key) => key === lock.state,
  );
  const stateLabel = t(stateKey ?? "unknownState");

  return (
    <div
      className={`home-lock${unlocked ? " home-lock--unlocked" : ""}${lock.state === "jammed" ? " home-lock--jammed" : ""}`}
    >
      <div className="home-lock__status">
        <Icon name={unlocked ? "lock-open" : "lock-closed"} className="home-lock__icon" />
        <div>
          <span className="home-lock__name">{lock.name}</span>
          <span className="home-lock__state">{stateLabel}</span>
        </div>
      </div>
      <div className="home-lock__actions">
        <button type="button" className="home-button" disabled={busy || locked} onClick={onLock}>
          {t("lock")}
        </button>
        {canUnlock ? (
          <button
            type="button"
            className={`home-button${confirming ? " home-button--danger" : ""}`}
            disabled={busy || unlocked}
            onClick={() => {
              if (!confirming) return setConfirming(true);
              setConfirming(false);
              onUnlock();
            }}
          >
            {confirming ? t("unlockConfirm") : t("unlock")}
          </button>
        ) : (
          <span className="home-lock__note">{t("cannotUnlock")}</span>
        )}
      </div>
    </div>
  );
}

function ClimateCard({
  climate,
  busy,
  onCall,
}: {
  climate: Climate;
  busy: boolean;
  onCall: (service: string, data?: Record<string, unknown>) => void;
}) {
  const t = messages.useT();
  const locale = useLocale();
  const step = climate.step ?? 0.5;
  const target = climate.targetTemperature;
  const off = climate.state === "off";
  const clamp = (value: number) =>
    Math.min(climate.maxTemperature ?? 30, Math.max(climate.minTemperature ?? 16, Math.round(value / step) * step));
  const modes = climate.hvacModes.filter((mode) => mode !== "off");

  return (
    <div className={`home-climate${off ? " home-climate--off" : ""}`}>
      <div className="home-climate__head">
        <span className="home-climate__name">
          {climate.name}
          {climate.area && <small>{climate.area}</small>}
        </span>
        <button
          type="button"
          className={`home-icon-button${off ? "" : " home-icon-button--on"}`}
          aria-label={t(off ? "turnOn" : "turnOff", { name: climate.name })}
          aria-pressed={!off}
          disabled={busy}
          onClick={() => onCall(off ? "turn_on" : "turn_off")}
        >
          <Icon name="power" />
        </button>
      </div>
      <div className="home-climate__temps">
        <span className="home-climate__current">
          {t("roomTemp", { value: climate.currentTemperature ?? "—" })}
          <small>℃</small>
        </span>
        <div className="home-climate__target">
          <button
            type="button"
            className="home-icon-button"
            aria-label={t("lowerTemp")}
            disabled={busy || off || target === null}
            onClick={() => target !== null && onCall("set_temperature", { temperature: clamp(target - step) })}
          >
            <Icon name="chevron-down" />
          </button>
          <span className="home-climate__target-value">
            {off ? "—" : (target ?? "—")}
            <small>℃</small>
          </span>
          <button
            type="button"
            className="home-icon-button"
            aria-label={t("raiseTemp")}
            disabled={busy || off || target === null}
            onClick={() => target !== null && onCall("set_temperature", { temperature: clamp(target + step) })}
          >
            <Icon name="chevron-up" />
          </button>
        </div>
      </div>
      {modes.length > 0 && (
        <div className="home-climate__modes" role="group" aria-label={t("hvacMode")}>
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`home-chip${climate.state === mode ? " home-chip--on" : ""}`}
              aria-pressed={climate.state === mode}
              disabled={busy}
              onClick={() => onCall("set_hvac_mode", { hvac_mode: mode })}
            >
              {HVAC_LABELS[mode] ? textFor(HVAC_LABELS[mode], locale) : mode}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleTile({
  toggle,
  busy,
  onToggle,
  onBrightness,
}: {
  toggle: Toggle;
  busy: boolean;
  onToggle: () => void;
  onBrightness: (pct: number) => void;
}) {
  const t = messages.useT();
  const on = toggle.state === "on";
  const unavailable = toggle.state === "unavailable";
  const [draft, setDraft] = useState<number | null>(null);
  const icon: IconName = toggle.domain === "light" ? "lightbulb" : toggle.domain === "fan" ? "arrow-sync" : "plug";

  return (
    <div className={`home-toggle${on ? " home-toggle--on" : ""}`}>
      <button
        type="button"
        className="home-toggle__button"
        aria-pressed={on}
        disabled={busy || unavailable}
        onClick={onToggle}
      >
        <Icon name={icon} className="home-toggle__icon" />
        <span className="home-toggle__name">{toggle.name}</span>
        <span className="home-toggle__state">
          {unavailable
            ? t("noResponse")
            : on
              ? toggle.brightnessPct !== null
                ? `${toggle.brightnessPct}%`
                : t("on")
              : t("off")}
        </span>
      </button>
      {toggle.dimmable && on && (
        <Slider
          className="home-toggle__slider"
          value={draft ?? toggle.brightnessPct ?? 100}
          min={1}
          max={100}
          step={1}
          label={t("brightnessOf", { name: toggle.name })}
          valueText={`${draft ?? toggle.brightnessPct ?? 100}%`}
          onInput={setDraft}
          // 動かしている間は送らず、指を離したときに一度だけ送る（HA への呼び出しを詰まらせない）
          onCommit={(value) => {
            onBrightness(value);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}
