import { useState, type CSSProperties, type ReactNode } from "react";
import { Button, ButtonRow, Chip, cx, defineMessages, Dialog, Icon, IconButton, Note, SectionTitle, Slider } from "@home-dashboard/widget-sdk";
import { DEFAULT_COLORS, TILE_COLORS, TILE_SIZES, type Climate, type HaEntity, type Tile, type TileSize, type Toggle } from "./homeTypes";
import { lockStateLabel, ModeChips, TargetControl, tileMessages, toggleIcon, toggleStateLabel, useUnlockConfirm } from "./tiles";

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
    size: "タイルの大きさ",
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
    size: "Tile size",
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

/** 大きさの選択肢に添える、形の小さな絵（大きさごとのクラスは全部書く） */
const SIZE_SHAPES: Record<TileSize, string> = {
  "2x1": "h-2 w-4",
  "2x2": "size-3",
  "4x2": "h-2.5 w-5",
  "4x4": "size-4",
};

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

/** 詳細の1項目（見出しと、その操作） */
function Row({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

/** 色の丸（照明の色・タイルの色）。選んでいるものに印と縁を付ける */
function Swatch({
  color,
  selected,
  label,
  disabled,
  onClick,
}: {
  color: string;
  selected: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "press grid size-10.5 cursor-pointer place-items-center rounded-full border-2 border-white/25 bg-(--swatch) p-0 text-black/80",
        "outline-offset-2 aria-pressed:outline-3 aria-pressed:outline-text disabled:cursor-default disabled:opacity-50 [&_.fluent-icon]:size-5",
      )}
      style={{ "--swatch": color } as CSSProperties}
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {selected && <Icon name="checkmark" />}
    </button>
  );
}

/** 上の大きな電源と今の状態 */
function Hero({ control, state, hint }: { control: ReactNode; state: string; hint?: string }) {
  return (
    <div className="flex items-center gap-4">
      {control}
      <div className="flex flex-col gap-1">
        <span className="text-title font-semibold">{state}</span>
        {hint && <span className="text-note text-muted">{hint}</span>}
      </div>
    </div>
  );
}

export function TileDetail({ tile, size, color, canUnlock, busy, modeLabel, onCall, onLayout, onClose }: TileDetailProps) {
  const t = messages.useT();
  const current = color ?? DEFAULT_COLORS[tile.kind];
  return (
    <Dialog title={tile.entity.name} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {tile.kind === "toggle" && <ToggleControls toggle={tile.entity} busy={busy} onCall={onCall} />}
        {tile.kind === "lock" && <LockControls lock={tile.entity} canUnlock={canUnlock} busy={busy} onCall={onCall} />}
        {tile.kind === "climate" && <ClimateControls climate={tile.entity} busy={busy} modeLabel={modeLabel} onCall={onCall} />}

        {/* ここから下は、ます目での見え方（機器の操作と線で分ける） */}
        <div className="flex flex-col gap-5 border-t border-line pt-5">
          <Row title={t("size")}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("size")}>
              {TILE_SIZES.map((option) => (
                <Chip key={option} selected={size === option} onClick={() => onLayout({ size: option })}>
                  <span className={cx("inline-block border-2 border-current", SIZE_SHAPES[option])} aria-hidden="true" />
                  {option.replace("x", "×")}
                </Chip>
              ))}
            </div>
          </Row>
          <Row title={t("tileColor")}>
            <div className="flex flex-wrap gap-2.5" role="group" aria-label={t("tileColor")}>
              {TILE_COLORS.map((swatch) => (
                <Swatch
                  key={swatch}
                  color={swatch}
                  selected={current === swatch}
                  label={swatch === DEFAULT_COLORS[tile.kind] ? t("defaultColor") : t("color", { value: swatch })}
                  onClick={() => onLayout({ color: swatch === DEFAULT_COLORS[tile.kind] ? null : swatch })}
                />
              ))}
            </div>
            <Note>{t("tileColorNote")}</Note>
          </Row>
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
      <Hero
        control={
          <IconButton
            icon={toggleIcon(toggle)}
            size="lg"
            selected={on}
            label={on ? t("turnOff") : t("turnOn")}
            disabled={busy || toggle.state === "unavailable"}
            onClick={() => onCall(on ? "turn_off" : "turn_on")}
          />
        }
        state={toggleStateLabel(toggle, tt)}
        hint={on ? t("turnOff") : t("turnOn")}
      />

      {toggle.dimmable && (
        <Row title={t("brightness", { value: brightness ?? toggle.brightnessPct ?? 0 })}>
          <Slider
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
        </Row>
      )}

      {toggle.colorable && (
        <Row title={t("lightColor")}>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label={t("lightColor")}>
            {HUES.map((option) => {
              const selected = hue !== null && Math.abs(hue - option) < 8 && (toggle.hsColor?.[1] ?? 0) > 40;
              return (
                <Swatch
                  key={option}
                  color={hueCss(option)}
                  selected={selected}
                  label={t("setColor", { name: t("hueOf", { value: option }) })}
                  disabled={busy}
                  onClick={() => onCall("turn_on", { hs_color: [option, SATURATION] })}
                />
              );
            })}
          </div>
        </Row>
      )}

      {toggle.colorTemp && (
        <Row title={`${t("white")} · ${t("kelvin", { value: shownKelvin })}`}>
          <div className="flex items-center gap-2.5">
            <small className="text-caption text-muted">{t("warm")}</small>
            <Slider
              className="flex-1"
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
            <small className="text-caption text-muted">{t("cool")}</small>
          </div>
        </Row>
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
      <Hero
        control={
          <Icon name={unlocked ? "lock-open" : "lock-closed"} className={cx("size-8", unlocked ? "text-warn" : "text-ok")} />
        }
        state={lockStateLabel(lock, tt)}
      />
      <ButtonRow>
        <Button size="lg" disabled={busy || lock.state === "locked"} onClick={() => onCall("lock")}>
          {tt("lock")}
        </Button>
        {canUnlock && (
          <Button size="lg" variant={confirming ? "danger" : "default"} disabled={busy || unlocked} onClick={press}>
            {confirming ? tt("unlockConfirm") : tt("unlock")}
          </Button>
        )}
      </ButtonRow>
      {!canUnlock && <Note>{tt("cannotUnlock")}</Note>}
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
  return (
    <>
      <Hero
        control={
          <IconButton
            icon="power"
            size="lg"
            selected={!off}
            label={tt(off ? "turnOn" : "turnOff", { name: climate.name })}
            disabled={busy}
            onClick={() => onCall(off ? "turn_on" : "turn_off")}
          />
        }
        state={off ? tt("off") : modeLabel(climate.state)}
        hint={t("roomTemp", { value: climate.currentTemperature ?? "—" })}
      />
      <Row title={t("target")}>
        <TargetControl climate={climate} busy={busy} onCall={onCall} />
      </Row>
      {climate.hvacModes.length > 0 && (
        <Row title={t("mode")}>
          <ModeChips climate={climate} modes={climate.hvacModes} busy={busy} label={t("mode")} modeLabel={modeLabel} onCall={onCall} />
        </Row>
      )}
    </>
  );
}
