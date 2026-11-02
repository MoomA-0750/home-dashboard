import { useCallback, useState, type CSSProperties } from "react";
import {
  cx,
  defineMessages,
  defineWidget,
  Icon,
  List,
  ListItem,
  Note,
  SectionTitle,
  ToggleSwitch,
  textFor,
  useLocale,
  usePolling,
  type IconName,
  type Locale,
  type LocalizedText,
  type WidgetProps,
  type WidgetSettingsProps,
  WidgetCard,
  WidgetHint,
} from "@home-dashboard/widget-sdk";
import { DEFAULT_COLORS, textOn } from "./homeTypes";
import { localizeReading } from "./units";

/** 家電のボタンの「オン」の地。Home Control の照明のタイルと同じ色（home-tile-state が --tile-color・--tile-ink を使う） */
const ON_COLORS = { "--tile-color": DEFAULT_COLORS.toggle, "--tile-ink": textOn(DEFAULT_COLORS.toggle) } as CSSProperties;

/**
 * 家電操作のウィジェット。左に温度・湿度など（設定で選んだ種類の、入っているセンサーの平均）、
 * 右に設定で選んだ家電のボタンを出す。設定はホームの編集中に歯車から開く。
 */

interface HaControlsConfig {
  pollIntervalMs: number;
  /** 出す家電（並びもこの順）。未設定のときは最初の4つ */
  entityIds?: string[];
  /** 左に出す情報の種類（device_class）。並びは READING_META の順 */
  readings?: string[];
}

const DEFAULT_ENTITY_COUNT = 4;
const DEFAULT_READINGS = ["temperature", "humidity"];

const READING_META: Record<string, { label: LocalizedText; icon: IconName; digits: number }> = {
  temperature: { label: { ja: "室温", en: "Temperature" }, icon: "temperature", digits: 1 },
  humidity: { label: { ja: "湿度", en: "Humidity" }, icon: "drop", digits: 0 },
  carbon_dioxide: { label: "CO₂", icon: "molecule", digits: 0 },
  pm25: { label: "PM2.5", icon: "molecule", digits: 0 },
  illuminance: { label: { ja: "明るさ", en: "Brightness" }, icon: "weather-sunny", digits: 0 },
};

/** 1st・2nd・3rd… */
function ordinal(n: number): string {
  const rem100 = n % 100;
  const suffix = rem100 >= 11 && rem100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

const messages = defineMessages({
  ja: {
    apiError: "home assistant API error: {status}",
    serviceFailed: "service call failed: {status}",
    disabled: "この操作は無効化されています",
    notConnected: "Home Assistant未接続",
    notConnectedHint: "設定画面の「拡張機能 → Home Assistant」で URL とトークンを入れてください",
    readingAverage: "{label}（{n}個のセンサーの平均）",
    loading: "読み込み中…",
    unreachable: "Home Assistant に届きません",
    chooseHint: "ホームの編集中に歯車から、出す家電を選んでください",
    readingsTitle: "左に出す情報",
    readingsNote:
      "家じゅうの、入っているセンサーの平均を出します（センサーの入／切は設定画面の「拡張機能 → Home Assistant」）。",
    noSensor: "読めるセンサーがありません",
    hide: "{name}を出さない",
    show: "{name}を出す",
    devicesTitle: "出す家電",
    loadingDevices: "家電を読み込んでいます…",
    position: "{n}番目に出す",
  },
  en: {
    apiError: "home assistant API error: {status}",
    serviceFailed: "service call failed: {status}",
    disabled: "This action is disabled",
    notConnected: "Home Assistant not connected",
    notConnectedHint: "Enter the URL and token in Settings under Extensions → Home Assistant",
    readingAverage: (p) => `${p.label} (average of ${p.n} ${p.n === 1 ? "sensor" : "sensors"})`,
    loading: "Loading…",
    unreachable: "Can't reach Home Assistant",
    chooseHint: "While editing Home, open the gear to choose devices",
    readingsTitle: "Readings on the left",
    readingsNote:
      "Shows the average of the enabled sensors around the home (turn sensors on or off in Settings under Extensions → Home Assistant).",
    noSensor: "No readable sensors",
    hide: "Hide {name}",
    show: "Show {name}",
    devicesTitle: "Devices to show",
    loadingDevices: "Loading devices…",
    position: (p) => `Shown ${ordinal(Number(p.n))}`,
  },
});

interface HaEntity {
  entityId: string;
  domain: string;
  name: string;
  state: string;
  unit: string | null;
  deviceClass: string | null;
}

interface Reading {
  deviceClass: string;
  unit: string | null;
  value: number;
  count: number;
}

interface ControlsResponse {
  configured: boolean;
  entities: HaEntity[];
  /** 種類ごとの、入っているセンサーの平均 */
  readings: Reading[];
  allowUnlock: boolean;
}

async function fetchControls(apiBaseUrl: string): Promise<ControlsResponse> {
  // ログインしていれば allowUnlock が true で返る
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/controls`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  const body = (await res.json()) as ControlsResponse;
  return { ...body, readings: (body.readings ?? []).map(localizeReading) };
}

async function callService(apiBaseUrl: string, entityId: string, service: string) {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, service }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? messages.t("serviceFailed", { status: res.status }));
  }
}

/** Home Control 画面と同じアイコン */
function entityIcon(entity: HaEntity): IconName {
  switch (entity.domain) {
    case "light":
      return "lightbulb";
    case "switch":
      return "plug";
    case "fan":
      return "arrow-sync";
    case "lock":
      return entity.state === "unlocked" ? "lock-open" : "lock-closed";
    case "climate":
      return "temperature";
    default:
      return "unknown";
  }
}

const STATE_LABELS: Record<string, LocalizedText> = {
  on: { ja: "オン", en: "On" },
  off: { ja: "オフ", en: "Off" },
  locked: { ja: "施錠中", en: "Locked" },
  unlocked: { ja: "解錠中", en: "Unlocked" },
  locking: { ja: "施錠しています", en: "Locking" },
  unlocking: { ja: "解錠しています", en: "Unlocking" },
  jammed: { ja: "動きません", en: "Jammed" },
  unavailable: { ja: "つながりません", en: "Unavailable" },
  heat: { ja: "暖房", en: "Heat" },
  cool: { ja: "冷房", en: "Cool" },
  heat_cool: { ja: "冷暖房", en: "Heat/Cool" },
  auto: { ja: "自動", en: "Auto" },
  dry: { ja: "除湿", en: "Dry" },
  fan_only: { ja: "送風", en: "Fan" },
};

const stateLabel = (state: string, locale: Locale) => {
  const label = STATE_LABELS[state];
  return label ? textFor(label, locale) : state;
};

function isOn(entity: HaEntity): boolean {
  return entity.state === "on" || entity.state === "unlocked" || entity.state === "heat" || entity.state === "cool";
}

/** そのエンティティを押したときに呼ぶサービス名を決める。押せない場合はnull */
function serviceForToggle(entity: HaEntity, allowUnlock: boolean): string | null {
  switch (entity.domain) {
    case "light":
    case "switch":
      return "toggle";
    case "climate":
      return entity.state === "off" ? "turn_on" : "turn_off";
    case "lock":
      // 解錠はサーバー側で既定拒否。無効時はボタン自体を押せなくしておく
      if (entity.state === "locked") return allowUnlock ? "unlock" : null;
      return "lock";
    default:
      return null;
  }
}

/** 設定で選んだ家電を、選んだ順に。未設定なら最初のいくつか */
function chosenEntities(entities: HaEntity[], entityIds: string[] | undefined): HaEntity[] {
  if (!entityIds) return entities.slice(0, DEFAULT_ENTITY_COUNT);
  const byId = new Map(entities.map((e) => [e.entityId, e]));
  return entityIds.flatMap((id) => byId.get(id) ?? []);
}

function chosenReadings(readings: Reading[], classes: string[] | undefined): Reading[] {
  const wanted = classes ?? DEFAULT_READINGS;
  return readings.filter((r) => wanted.includes(r.deviceClass) && READING_META[r.deviceClass]);
}

function useEntityControl(apiBaseUrl: string, pollIntervalMs: number) {
  const { data, error, loading } = usePolling(() => fetchControls(apiBaseUrl), pollIntervalMs);
  /** 楽観的更新。次のポーリングで実状態に上書きされる */
  const [pending, setPending] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const toggle = useCallback(
    async (entity: HaEntity, allowUnlock: boolean) => {
      const service = serviceForToggle(entity, allowUnlock);
      if (!service) return;

      const optimistic =
        entity.domain === "lock" ? (service === "lock" ? "locked" : "unlocked") : isOn(entity) ? "off" : "on";
      setPending((p) => ({ ...p, [entity.entityId]: optimistic }));
      setFailure(null);
      try {
        await callService(apiBaseUrl, entity.entityId, service);
      } catch (err) {
        setPending((p) => {
          const next = { ...p };
          delete next[entity.entityId];
          return next;
        });
        setFailure(err instanceof Error ? err.message : String(err));
      }
    },
    [apiBaseUrl],
  );

  const entities = (data?.entities ?? []).map((e) => (pending[e.entityId] ? { ...e, state: pending[e.entityId] } : e));

  return { data, entities, error, loading, toggle, failure };
}

function EntityButton({
  entity,
  allowUnlock,
  onToggle,
}: {
  entity: HaEntity;
  allowUnlock: boolean;
  onToggle: (e: HaEntity) => void;
}) {
  const t = messages.useT();
  const locale = useLocale();
  const service = serviceForToggle(entity, allowUnlock);
  const on = isOn(entity);

  return (
    // Home Control のタイルと同じ見た目（オフはガラス、オンはタイルの色）。角はカードの丸みから余白を引いたもの
    <button
      type="button"
      className={cx(
        "glass home-tile-state press untrim flex min-h-0 cursor-pointer flex-col items-start justify-between gap-1 overflow-hidden rounded-inner px-3.5 py-2.5 text-left text-text",
        "disabled:cursor-not-allowed disabled:opacity-55",
      )}
      style={ON_COLORS}
      data-state={on ? "on" : undefined}
      disabled={!service}
      onClick={() => onToggle(entity)}
      // 状態は色で分かるので文字では出さない。読み上げと押さえたときの説明にだけ添える
      aria-label={`${entity.name}（${stateLabel(entity.state, locale)}）`}
      title={service ? stateLabel(entity.state, locale) : t("disabled")}
    >
      <Icon name={entityIcon(entity)} className="size-5 flex-none" />
      {/* タイルが低いときも名前の欄は縮めない（縮めると字の上下が切れる） */}
      <span className="ellipsis max-w-full flex-none text-note font-semibold">{entity.name}</span>
    </button>
  );
}

function HaControlsView({ ctx, config }: WidgetProps<HaControlsConfig>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error, entities, loading, toggle, failure } = useEntityControl(ctx.apiBaseUrl, config.pollIntervalMs);

  if (!loading && data && !data.configured) {
    return (
      <WidgetCard>
        {t("notConnected")}
        <WidgetHint>{t("notConnectedHint")}</WidgetHint>
      </WidgetCard>
    );
  }

  const shown = chosenEntities(entities, config.entityIds);
  const readings = chosenReadings(data?.readings ?? [], config.readings);

  return (
    // 左に室温・湿度など、右に選んだ家電のボタン
    <WidgetCard className="flex-row items-center justify-start gap-5">
      {readings.length > 0 && (
        <div className="flex flex-none flex-col justify-center gap-2">
          {readings.map((reading) => {
            const meta = READING_META[reading.deviceClass];
            return (
              <span
                key={reading.deviceClass}
                className="flex items-center gap-2 text-muted [&_.fluent-icon]:size-5"
                title={t("readingAverage", { label: textFor(meta.label, locale), n: reading.count })}
              >
                <Icon name={meta.icon} />
                <span className="text-heading font-semibold text-text tabular-nums">
                  {reading.value.toFixed(meta.digits)}
                  <small className="ml-0.5 text-note font-medium text-muted">{reading.unit}</small>
                </span>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-auto flex-col gap-2 self-stretch">
        {loading && !data && <WidgetHint>{t("loading")}</WidgetHint>}
        {Boolean(error) && !data && <WidgetHint tone="error">{t("unreachable")}</WidgetHint>}
        {failure && <WidgetHint tone="error">{failure}</WidgetHint>}
        {data && shown.length === 0 && <WidgetHint>{t("chooseHint")}</WidgetHint>}
        {/* タイルの段は、カードの中身の高さ（カードの余白の内側）に収める。はみ出すと外側の余白がつぶれて角の丸みがずれる */}
        <div className="ha-controls-grid grid min-h-0 w-full flex-auto gap-2.5">
          {shown.map((e) => (
            <EntityButton
              key={e.entityId}
              entity={e}
              allowUnlock={data?.allowUnlock ?? false}
              onToggle={(entity) => toggle(entity, data?.allowUnlock ?? false)}
            />
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

/** ウィジェットの設定。左に出す情報と、出す家電を選ぶ */
function HaControlsSettings({ ctx, config, onChange }: WidgetSettingsProps<HaControlsConfig>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data, error } = usePolling(() => fetchControls(ctx.apiBaseUrl), 60 * 1000);
  const readings = config.readings ?? DEFAULT_READINGS;
  const entityIds = config.entityIds ?? (data?.entities ?? []).slice(0, DEFAULT_ENTITY_COUNT).map((e) => e.entityId);
  const available = new Set((data?.readings ?? []).map((r) => r.deviceClass));

  const setReading = (deviceClass: string, on: boolean) => {
    const next = on ? [...readings, deviceClass] : readings.filter((c) => c !== deviceClass);
    // 並びは READING_META の順にそろえる
    onChange({ ...config, readings: Object.keys(READING_META).filter((c) => next.includes(c)) });
  };
  const setEntity = (entityId: string, on: boolean) => {
    // 足したものは最後に並ぶ
    const next = on
      ? [...entityIds.filter((id) => id !== entityId), entityId]
      : entityIds.filter((id) => id !== entityId);
    onChange({ ...config, entityIds: next });
  };

  return (
    <div>
      <SectionTitle>{t("readingsTitle")}</SectionTitle>
      <Note>{t("readingsNote")}</Note>
      <List>
        {Object.entries(READING_META).map(([deviceClass, meta]) => (
          <ListItem
            key={deviceClass}
            leading={<Icon name={meta.icon} className="size-5.5 flex-none" />}
            title={textFor(meta.label, locale)}
            detail={data && !available.has(deviceClass) ? t("noSensor") : undefined}
            trailing={
              <ToggleSwitch
                checked={readings.includes(deviceClass)}
                label={t(readings.includes(deviceClass) ? "hide" : "show", { name: textFor(meta.label, locale) })}
                onChange={(on) => setReading(deviceClass, on)}
              />
            }
          />
        ))}
      </List>

      <SectionTitle>{t("devicesTitle")}</SectionTitle>
      {Boolean(error) && !data && <Note>{t("unreachable")}</Note>}
      {!data && !error && <Note>{t("loadingDevices")}</Note>}
      {data && (
        <List>
          {data.entities.map((entity) => {
            const on = entityIds.includes(entity.entityId);
            return (
              <ListItem
                key={entity.entityId}
                leading={<Icon name={entityIcon(entity)} className="size-5.5 flex-none" />}
                title={entity.name}
                detail={on ? t("position", { n: entityIds.indexOf(entity.entityId) + 1 }) : entity.entityId}
                trailing={
                  <ToggleSwitch
                    checked={on}
                    label={t(on ? "hide" : "show", { name: entity.name })}
                    onChange={(next) => setEntity(entity.entityId, next)}
                  />
                }
              />
            );
          })}
        </List>
      )}
    </div>
  );
}

export default defineWidget<HaControlsConfig>({
  id: "ha-controls",
  name: { ja: "家電操作", en: "Home controls" },
  description: {
    ja: "Home Assistantの照明・スイッチ・鍵・エアコンを操作し、室温・湿度などを表示します",
    en: "Controls Home Assistant lights, switches, locks and air conditioners, and shows temperature, humidity and more",
  },
  defaultSize: { w: 4, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 10 * 1000 },
  Component: HaControlsView,
  SettingsComponent: HaControlsSettings,
});
