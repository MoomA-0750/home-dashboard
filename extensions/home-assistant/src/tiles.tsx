import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { defineMessages, Icon, Slider, type IconName } from "@home-dashboard/widget-sdk";
import { DEFAULT_COLORS, sizeOf, textOn, type Climate, type HaEntity, type Tile, type TileSize, type Toggle } from "./homeTypes";

/**
 * Home Control のます目に並べるタイル（照明・スイッチ・鍵・空調）。大きさ（2x1・2x2・4x2・4x4）はます目の数で決まり、
 * 中身（明るさのバーがあるかなど）では変わらない。大きさに合わせて、出す中身を減らす・増やす
 */

export const tileMessages = defineMessages({
  ja: {
    locked: "施錠中",
    unlocked: "解錠中",
    locking: "施錠しています…",
    unlocking: "解錠しています…",
    jammed: "詰まっています",
    open: "開いています",
    unknownState: "状態不明",
    lock: "施錠",
    unlockConfirm: "もう一度押して解錠",
    unlockConfirmShort: "もう一度",
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
    details: "{name}の詳細",
  },
  en: {
    locked: "Locked",
    unlocked: "Unlocked",
    locking: "Locking…",
    unlocking: "Unlocking…",
    jammed: "Jammed",
    open: "Open",
    unknownState: "Unknown",
    lock: "Lock",
    unlockConfirm: "Press again to unlock",
    unlockConfirmShort: "Again",
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
    details: "{name} details",
  },
});

type T = ReturnType<typeof tileMessages.useT>;

export const HVAC_LABELS: Record<string, { ja: string; en: string }> = {
  off: { ja: "停止", en: "Off" },
  heat: { ja: "暖房", en: "Heat" },
  cool: { ja: "冷房", en: "Cool" },
  heat_cool: { ja: "冷暖房", en: "Heat/Cool" },
  auto: { ja: "自動", en: "Auto" },
  dry: { ja: "除湿", en: "Dry" },
  fan_only: { ja: "送風", en: "Fan" },
};

export function toggleIcon(toggle: Toggle): IconName {
  return toggle.domain === "light" ? "lightbulb" : toggle.domain === "fan" ? "arrow-sync" : "plug";
}

export function lockStateLabel(lock: HaEntity, t: T): string {
  const key = (["locked", "unlocked", "locking", "unlocking", "jammed", "open"] as const).find((k) => k === lock.state);
  return t(key ?? "unknownState");
}

export function toggleStateLabel(toggle: Toggle, t: T): string {
  if (toggle.state === "unavailable") return t("noResponse");
  if (toggle.state !== "on") return t("off");
  return toggle.brightnessPct !== null ? `${toggle.brightnessPct}%` : t("on");
}

/** 「オン」とみなす状態（地の色をタイルの色にする） */
export function tileIsOn(tile: Tile): boolean {
  if (tile.kind === "toggle") return tile.entity.state === "on";
  if (tile.kind === "climate") return tile.entity.state !== "off" && tile.entity.state !== "unavailable";
  return false;
}

export interface TileFrameProps {
  tile: Tile;
  size: TileSize;
  color?: string;
  /** 並べ替え・大きさを変えている間は、中身を押せないようにして上に重ねたものを出す */
  editOverlay?: ReactNode;
  onDetail: () => void;
}

/** タイルの外枠。ます目の数・色・「オン」の地・詳細を開くボタン */
function TileFrame({ tile, size, color, editOverlay, onDetail, className, children }: TileFrameProps & { className?: string; children: ReactNode }) {
  const t = tileMessages.useT();
  const { w, h } = sizeOf(size);
  const tint = color ?? DEFAULT_COLORS[tile.kind];
  const style = {
    gridColumn: `span ${w}`,
    gridRow: `span ${h}`,
    "--tile-color": tint,
    "--tile-ink": textOn(tint),
  } as CSSProperties;
  return (
    <div
      className={`ui-glass home-tile home-tile--${size} home-tile--${tile.kind}${tileIsOn(tile) ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      data-tile-id={tile.entity.entityId}
    >
      {children}
      {!editOverlay && (
        <button
          type="button"
          className="home-tile__more"
          aria-label={t("details", { name: tile.entity.name })}
          onClick={onDetail}
        >
          <Icon name="chevron-right" />
        </button>
      )}
      {editOverlay}
    </div>
  );
}

export function ToggleTile({
  toggle,
  busy,
  onToggle,
  onBrightness,
  ...frame
}: TileFrameProps & { toggle: Toggle; busy: boolean; onToggle: () => void; onBrightness: (pct: number) => void }) {
  const t = tileMessages.useT();
  const on = toggle.state === "on";
  const [draft, setDraft] = useState<number | null>(null);
  // 2x1 は背が低いので明るさのバーを出さない（詳細で変える）。出しても出さなくても、タイルの大きさは変わらない
  const showSlider = frame.size !== "2x1" && toggle.dimmable && on;
  return (
    <TileFrame {...frame}>
      <button
        type="button"
        className="home-tile__main"
        aria-pressed={on}
        disabled={busy || toggle.state === "unavailable"}
        onClick={onToggle}
      >
        <Icon name={toggleIcon(toggle)} className="home-tile__icon" />
        <span className="home-tile__text">
          <span className="home-tile__name">{toggle.name}</span>
          <span className="home-tile__state">{toggleStateLabel(toggle, t)}</span>
        </span>
      </button>
      {showSlider && (
        <Slider
          className="home-tile__slider"
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
    </TileFrame>
  );
}

const UNLOCK_CONFIRM_MS = 4000;

/** 解錠はうっかり押しても開かないよう、もう一度押して確かめる */
export function useUnlockConfirm(onUnlock: () => void) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), UNLOCK_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);
  const press = () => {
    if (!confirming) return setConfirming(true);
    setConfirming(false);
    onUnlock();
  };
  return { confirming, press };
}

export function LockTile({
  lock,
  canUnlock,
  busy,
  onLock,
  onUnlock,
  ...frame
}: TileFrameProps & { lock: HaEntity; canUnlock: boolean; busy: boolean; onLock: () => void; onUnlock: () => void }) {
  const t = tileMessages.useT();
  const { confirming, press } = useUnlockConfirm(onUnlock);
  const unlocked = lock.state === "unlocked" || lock.state === "open";
  const wide = frame.size === "4x2" || frame.size === "4x4";
  const short = frame.size === "2x1";

  const lockButton = (
    <button type="button" className="home-button home-tile__action" disabled={busy || lock.state === "locked"} onClick={onLock}>
      {t("lock")}
    </button>
  );
  const unlockButton = canUnlock ? (
    <button
      type="button"
      className={`home-button home-tile__action${confirming ? " home-button--danger" : ""}`}
      disabled={busy || unlocked}
      onClick={press}
    >
      {confirming ? t(short ? "unlockConfirmShort" : "unlockConfirm") : t("unlock")}
    </button>
  ) : null;

  return (
    <TileFrame
      {...frame}
      className={`${unlocked ? "home-tile--alert" : ""}${lock.state === "jammed" ? " home-tile--error" : ""}`}
    >
      <div className="home-tile__main home-tile__main--static">
        <Icon name={unlocked ? "lock-open" : "lock-closed"} className="home-tile__icon" />
        <span className="home-tile__text">
          <span className="home-tile__name">{lock.name}</span>
          <span className="home-tile__state">{lockStateLabel(lock, t)}</span>
        </span>
      </div>
      <div className="home-tile__actions">
        {/* 広いタイルは両方、狭いタイルは今の状態から次にすることだけ（解錠中なら施錠） */}
        {wide ? (
          <>
            {lockButton}
            {unlockButton ?? <span className="home-tile__note">{t("cannotUnlock")}</span>}
          </>
        ) : unlocked || !unlockButton ? (
          lockButton
        ) : (
          unlockButton
        )}
      </div>
    </TileFrame>
  );
}

export function climateClamp(climate: Climate, value: number): number {
  const step = climate.step ?? 0.5;
  return Math.min(climate.maxTemperature ?? 30, Math.max(climate.minTemperature ?? 16, Math.round(value / step) * step));
}

export function ClimateTile({
  climate,
  busy,
  onCall,
  modeLabel,
  ...frame
}: TileFrameProps & {
  climate: Climate;
  busy: boolean;
  onCall: (service: string, data?: Record<string, unknown>) => void;
  modeLabel: (mode: string) => string;
}) {
  const t = tileMessages.useT();
  const step = climate.step ?? 0.5;
  const target = climate.targetTemperature;
  const off = climate.state === "off";
  const short = frame.size === "2x1";
  const wide = frame.size === "4x2" || frame.size === "4x4";
  const modes = climate.hvacModes.filter((mode) => mode !== "off");

  const power = (
    <button
      type="button"
      className={`home-icon-button home-tile__power${off ? "" : " home-icon-button--on"}`}
      aria-label={t(off ? "turnOn" : "turnOff", { name: climate.name })}
      aria-pressed={!off}
      disabled={busy}
      onClick={() => onCall(off ? "turn_on" : "turn_off")}
    >
      <Icon name="power" />
    </button>
  );

  return (
    <TileFrame {...frame}>
      <div className="home-tile__main home-tile__main--static">
        <Icon name="temperature" className="home-tile__icon" />
        <span className="home-tile__text">
          <span className="home-tile__name">{climate.name}</span>
          <span className="home-tile__state">
            {off ? t("off") : modeLabel(climate.state)} · {t("roomTemp", { value: climate.currentTemperature ?? "—" })}℃
          </span>
        </span>
      </div>
      {/* 電源は、2x1 では右に、ほかでは右上（詳細の「>」の隣）に置く */}
      {short ? (
        <div className="home-tile__actions">{power}</div>
      ) : (
        <div className="home-tile__climate">
          {power}
          <div className="home-tile__target">
            <button
              type="button"
              className="home-icon-button"
              aria-label={t("lowerTemp")}
              disabled={busy || off || target === null}
              onClick={() => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target - step) })}
            >
              <Icon name="chevron-down" />
            </button>
            <span className="home-tile__target-value">
              {off ? "—" : (target ?? "—")}
              <small>℃</small>
            </span>
            <button
              type="button"
              className="home-icon-button"
              aria-label={t("raiseTemp")}
              disabled={busy || off || target === null}
              onClick={() => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target + step) })}
            >
              <Icon name="chevron-up" />
            </button>
          </div>
        </div>
      )}
      {wide && modes.length > 0 && (
        <div className="home-tile__modes" role="group" aria-label={t("hvacMode")}>
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`home-chip${climate.state === mode ? " home-chip--on" : ""}`}
              aria-pressed={climate.state === mode}
              disabled={busy}
              onClick={() => onCall("set_hvac_mode", { hvac_mode: mode })}
            >
              {modeLabel(mode)}
            </button>
          ))}
        </div>
      )}
    </TileFrame>
  );
}
