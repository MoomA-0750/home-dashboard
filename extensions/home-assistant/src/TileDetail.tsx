import { useState, type CSSProperties } from "react";
import { defineMessages, Dialog, Icon, Slider } from "@home-dashboard/widget-sdk";
import { DEFAULT_COLORS, TILE_COLORS, TILE_SIZES, type Climate, type HaEntity, type Tile, type TileSize, type Toggle } from "./homeTypes";
import { climateClamp, lockStateLabel, tileMessages, toggleIcon, toggleStateLabel, useUnlockConfirm } from "./tiles";

/**
 * タイルの詳細（右上の「>」で開く）。機器そのものの操作（明るさ・照明の色・白の色温度・施錠・空調の温度と運転モード）と、
 * ます目での見え方（大きさ・タイルの色）を変える
 */

const messages = defineMessages({
  ja: {
    power: "電源",
    turnOn: "つける",
    turnOff: "消す",
    brightness: "明るさ {value}%",
    lightColor: "照明の色",
    hueOf: "色相 {value}°",
    white: "白の色",
    kelvin: "{value} K",
    warm: "暖かい",
    cool: "涼しい",
    setColor: "{name}にする",
    tile: "ます目での見え方",
    size: "大きさ",
    tileColor: "タイルの色",
    tileColorNote: "つけているとき・動いているときのタイルの地の色です。全部の端末で同じになります。",
    defaultColor: "既定の色",
    color: "色 {value}",
    target: "設定温度",
    roomTemp: "室温 {value}℃",
    mode: "運転モード",
    lockState: "状態",
  },
  en: {
    power: "Power",
    turnOn: "Turn on",
    turnOff: "Turn off",
    brightness: "Brightness {value}%",
    lightColor: "Light color",
    hueOf: "Hue {value}°",
    white: "White",
    kelvin: "{value} K",
    warm: "Warm",
    cool: "Cool",
    setColor: "Set to {name}",
    tile: "How it looks on the grid",
    size: "Size",
    tileColor: "Tile color",
    tileColorNote: "The tile's background while it's on or running. The same on every device.",
    defaultColor: "Default color",
    color: "Color {value}",
    target: "Target temperature",
    roomTemp: "Room {value}℃",
    mode: "Mode",
    lockState: "State",
  },
});

/** 照明の色の候補（色相）。彩度は鮮やかすぎない 85% */
const HUES = [0, 25, 45, 60, 90, 130, 170, 195, 220, 250, 280, 320];
const SATURATION = 85;

const hueCss = (hue: number, saturation = SATURATION) => `hsl(${hue} ${saturation}% 60%)`;

interface TileDetailProps {
  tile: Tile;
  size: TileSize;
  color?: string;
  canUnlock: boolean;
  busy: boolean;
  modeLabel: (mode: string) => string;
  onCall: (service: string, data?: Record<string, unknown>) => void;
  onLayout: (patch: { size?: TileSize; color?: string | null }) => void;
  onClose: () => void;
}

export function TileDetail({ tile, size, color, canUnlock, busy, modeLabel, onCall, onLayout, onClose }: TileDetailProps) {
  const t = messages.useT();
  const current = color ?? DEFAULT_COLORS[tile.kind];
  return (
    <Dialog title={tile.entity.name} onClose={onClose}>
      <div className="tile-detail">
        {tile.kind === "toggle" && <ToggleControls toggle={tile.entity} busy={busy} onCall={onCall} />}
        {tile.kind === "lock" && <LockControls lock={tile.entity} canUnlock={canUnlock} busy={busy} onCall={onCall} />}
        {tile.kind === "climate" && <ClimateControls climate={tile.entity} busy={busy} modeLabel={modeLabel} onCall={onCall} />}

        <h3 className="tile-detail__title">{t("tile")}</h3>
        <div className="tile-detail__row">
          <span className="tile-detail__label">{t("size")}</span>
          <div className="tile-detail__chips" role="group" aria-label={t("size")}>
            {TILE_SIZES.map((option) => (
              <button
                key={option}
                type="button"
                className={`home-chip${size === option ? " home-chip--on" : ""}`}
                aria-pressed={size === option}
                onClick={() => onLayout({ size: option })}
              >
                <span className={`tile-detail__size-icon tile-detail__size-icon--${option}`} aria-hidden="true" />
                {option.replace("x", "×")}
              </button>
            ))}
          </div>
        </div>
        <div className="tile-detail__row tile-detail__row--top">
          <span className="tile-detail__label">{t("tileColor")}</span>
          <div>
            <div className="tile-detail__swatches" role="group" aria-label={t("tileColor")}>
              {TILE_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={`tile-detail__swatch${current === swatch ? " is-on" : ""}`}
                  style={{ "--swatch": swatch } as CSSProperties}
                  aria-pressed={current === swatch}
                  aria-label={swatch === DEFAULT_COLORS[tile.kind] ? t("defaultColor") : t("color", { value: swatch })}
                  onClick={() => onLayout({ color: swatch === DEFAULT_COLORS[tile.kind] ? null : swatch })}
                >
                  {current === swatch && <Icon name="checkmark" />}
                </button>
              ))}
            </div>
            <p className="tile-detail__note">{t("tileColorNote")}</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function ToggleControls({ toggle, busy, onCall }: { toggle: Toggle; busy: boolean; onCall: TileDetailProps["onCall"] }) {
  const t = messages.useT();
  const tt = tileMessages.useT();
  const on = toggle.state === "on";
  const [brightness, setBrightness] = useState<number | null>(null);
  const minK = toggle.minKelvin ?? 2000;
  const maxK = toggle.maxKelvin ?? 6500;
  const [kelvin, setKelvin] = useState<number | null>(null);
  const shownKelvin = kelvin ?? toggle.colorTempKelvin ?? Math.round((minK + maxK) / 2);
  const hue = toggle.hsColor?.[0] ?? null;

  return (
    <>
      <div className="tile-detail__hero">
        <button
          type="button"
          className={`tile-detail__power${on ? " is-on" : ""}`}
          aria-pressed={on}
          disabled={busy || toggle.state === "unavailable"}
          onClick={() => onCall(on ? "turn_off" : "turn_on")}
          style={(on && hue !== null ? { "--light": hueCss(hue, toggle.hsColor?.[1] ?? SATURATION) } : {}) as CSSProperties}
        >
          <Icon name={toggleIcon(toggle)} />
        </button>
        <div>
          <span className="tile-detail__state">{toggleStateLabel(toggle, tt)}</span>
          <span className="tile-detail__hint">{on ? t("turnOff") : t("turnOn")}</span>
        </div>
      </div>

      {toggle.dimmable && (
        <div className="tile-detail__row">
          <span className="tile-detail__label">{t("brightness", { value: brightness ?? toggle.brightnessPct ?? 0 })}</span>
          <Slider
            className="tile-detail__slider"
            value={brightness ?? toggle.brightnessPct ?? 100}
            min={1}
            max={100}
            step={1}
            disabled={busy}
            label={tt("brightnessOf", { name: toggle.name })}
            valueText={`${brightness ?? toggle.brightnessPct ?? 100}%`}
            onInput={setBrightness}
            onCommit={(value) => {
              onCall("turn_on", { brightness_pct: value });
              setBrightness(null);
            }}
          />
        </div>
      )}

      {toggle.colorable && (
        <div className="tile-detail__row tile-detail__row--top">
          <span className="tile-detail__label">{t("lightColor")}</span>
          <div className="tile-detail__swatches" role="group" aria-label={t("lightColor")}>
            {HUES.map((option) => {
              const selected = hue !== null && Math.abs(hue - option) < 8 && (toggle.hsColor?.[1] ?? 0) > 40;
              return (
                <button
                  key={option}
                  type="button"
                  className={`tile-detail__swatch${selected ? " is-on" : ""}`}
                  style={{ "--swatch": hueCss(option) } as CSSProperties}
                  aria-pressed={selected}
                  aria-label={t("setColor", { name: t("hueOf", { value: option }) })}
                  disabled={busy}
                  onClick={() => onCall("turn_on", { hs_color: [option, SATURATION] })}
                >
                  {selected && <Icon name="checkmark" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {toggle.colorTemp && (
        <div className="tile-detail__row">
          <span className="tile-detail__label">
            {t("white")} · {t("kelvin", { value: shownKelvin })}
          </span>
          <div className="tile-detail__kelvin">
            <small>{t("warm")}</small>
            <Slider
              className="tile-detail__slider tile-detail__slider--kelvin"
              value={shownKelvin}
              min={minK}
              max={maxK}
              step={50}
              disabled={busy}
              label={t("white")}
              valueText={t("kelvin", { value: shownKelvin })}
              onInput={setKelvin}
              onCommit={(value) => {
                onCall("turn_on", { color_temp_kelvin: Math.round(value) });
                setKelvin(null);
              }}
            />
            <small>{t("cool")}</small>
          </div>
        </div>
      )}
    </>
  );
}

function LockControls({
  lock,
  canUnlock,
  busy,
  onCall,
}: {
  lock: HaEntity;
  canUnlock: boolean;
  busy: boolean;
  onCall: TileDetailProps["onCall"];
}) {
  const tt = tileMessages.useT();
  const { confirming, press } = useUnlockConfirm(() => onCall("unlock"));
  const unlocked = lock.state === "unlocked" || lock.state === "open";
  return (
    <>
      <div className="tile-detail__hero">
        <span className={`tile-detail__power${unlocked ? " is-alert" : " is-on"}`} aria-hidden="true">
          <Icon name={unlocked ? "lock-open" : "lock-closed"} />
        </span>
        <span className="tile-detail__state">{lockStateLabel(lock, tt)}</span>
      </div>
      <div className="tile-detail__buttons">
        <button type="button" className="home-button" disabled={busy || lock.state === "locked"} onClick={() => onCall("lock")}>
          {tt("lock")}
        </button>
        {canUnlock ? (
          <button
            type="button"
            className={`home-button${confirming ? " home-button--danger" : ""}`}
            disabled={busy || unlocked}
            onClick={press}
          >
            {confirming ? tt("unlockConfirm") : tt("unlock")}
          </button>
        ) : (
          <span className="tile-detail__note">{tt("cannotUnlock")}</span>
        )}
      </div>
    </>
  );
}

function ClimateControls({
  climate,
  busy,
  modeLabel,
  onCall,
}: {
  climate: Climate;
  busy: boolean;
  modeLabel: (mode: string) => string;
  onCall: TileDetailProps["onCall"];
}) {
  const t = messages.useT();
  const tt = tileMessages.useT();
  const off = climate.state === "off";
  const step = climate.step ?? 0.5;
  const target = climate.targetTemperature;
  return (
    <>
      <div className="tile-detail__hero">
        <button
          type="button"
          className={`tile-detail__power${off ? "" : " is-on"}`}
          aria-pressed={!off}
          aria-label={tt(off ? "turnOn" : "turnOff", { name: climate.name })}
          disabled={busy}
          onClick={() => onCall(off ? "turn_on" : "turn_off")}
        >
          <Icon name="power" />
        </button>
        <div>
          <span className="tile-detail__state">{off ? tt("off") : modeLabel(climate.state)}</span>
          <span className="tile-detail__hint">{t("roomTemp", { value: climate.currentTemperature ?? "—" })}</span>
        </div>
      </div>
      <div className="tile-detail__row">
        <span className="tile-detail__label">{t("target")}</span>
        <div className="home-tile__target">
          <button
            type="button"
            className="home-icon-button"
            aria-label={tt("lowerTemp")}
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
            aria-label={tt("raiseTemp")}
            disabled={busy || off || target === null}
            onClick={() => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target + step) })}
          >
            <Icon name="chevron-up" />
          </button>
        </div>
      </div>
      {climate.hvacModes.length > 0 && (
        <div className="tile-detail__row tile-detail__row--top">
          <span className="tile-detail__label">{t("mode")}</span>
          <div className="tile-detail__chips" role="group" aria-label={t("mode")}>
            {climate.hvacModes.map((mode) => (
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
        </div>
      )}
    </>
  );
}
