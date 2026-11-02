import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Chip, cx, defineMessages, Icon, IconButton, Slider, type IconName } from "@home-dashboard/widget-sdk";
import { DEFAULT_COLORS, sizeOf, textOn, type Climate, type HaEntity, type Placement, type Tile, type TileSize, type Toggle } from "./homeTypes";

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
  /** ます目のどこに置くか（packTiles で決める）。無ければ並び順に流す */
  place?: Placement;
  /** 並べ替え・大きさを変えている間は、中身を押せないようにして上に重ねたものを出す */
  editOverlay?: ReactNode;
  onDetail: () => void;
}

/**
 * 大きさごとの見た目（クラスはつながずに全部書く。Tailwind が見つけられるように）。
 * 2x1 は横に並べて背を低くし、字とアイコンを一回り小さくする（明るさのバーは出さない）。4x4 は字とアイコンを大きく
 */
const SIZE_CLASSES: Record<
  TileSize,
  { frame: string; main: string; icon: string; text: string; name: string; state: string; actions: string; action: string; more: string }
> = {
  "2x1": {
    frame: "flex-row items-center",
    main: "flex-row items-center justify-start gap-2.5 py-0 pr-1 pl-3.5",
    icon: "size-6",
    text: "gap-0.5",
    name: "text-fit-small",
    state: "text-fit-caption",
    actions: "p-0 pr-1",
    action: "flex-none",
    more: "static mr-2 flex-none",
  },
  "2x2": { frame: "", main: "", icon: "", text: "", name: "", state: "", actions: "", action: "", more: "" },
  "4x2": { frame: "", main: "", icon: "", text: "", name: "", state: "", actions: "", action: "", more: "" },
  "4x4": { frame: "", main: "px-6.5 py-6", icon: "size-11", text: "", name: "text-fit-title", state: "", actions: "", action: "", more: "" },
};

/** タイルの中身（アイコン・名前・状態）。押せるもの（照明）は button、押せないもの（鍵・空調）は div */
const MAIN =
  "flex min-h-0 w-full flex-1 flex-col items-start justify-between gap-1.5 border-0 bg-transparent px-4.5 py-4 text-left text-current";
const MAIN_STATIC = "flex-initial justify-start";

/** 色の付いた地の上に置くボタン（「>」・設定温度の上げ下げ）は、文字の色に寄せて馴染ませる */
const ON_TILE_BUTTON = "text-current hover:bg-current/10 focus-visible:bg-current/10";
/** 色の付いた地の上で選んでいるもの（電源・運転モード）は、明るい塗りでは地に溶けるので、文字の色を地にする */
const ON_TILE_SELECTED = "aria-pressed:bg-(--tile-ink) aria-pressed:text-(--tile-color)";

/** 字を小さくするのはここまで（もとの 70%） */
const MIN_FIT = 0.7;

/**
 * 名前や状態がタイルに収まらないとき、字を少しずつ小さくして収める（切らない）。
 * タイルの大きさ・名前・状態が変わるたびに、もとの大きさから測り直す
 */
function useFitText(tile: HTMLDivElement | null, key: string) {
  useLayoutEffect(() => {
    if (!tile) return;
    const fit = () => {
      const overflows = () =>
        Array.from(tile.querySelectorAll<HTMLElement>("[data-tile-main]")).some(
          (main) => main.scrollHeight > main.clientHeight + 1 || main.scrollWidth > main.clientWidth + 1,
        );
      let scale = 1;
      tile.style.setProperty("--fit", "1");
      while (overflows() && scale > MIN_FIT) {
        scale = Math.round((scale - 0.05) * 100) / 100;
        tile.style.setProperty("--fit", String(scale));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(tile);
    return () => observer.disconnect();
  }, [tile, key]);
}

/** タイルの中身（アイコン・名前・状態）。名前と状態は切らずに折り返す（長い名前でも最後まで読める） */
function TileText({ size, icon, iconClass, name, state }: { size: TileSize; icon: IconName; iconClass?: string; name: string; state: ReactNode }) {
  const sz = SIZE_CLASSES[size];
  return (
    <>
      <Icon name={icon} className={cx("size-7 flex-none", sz.icon, iconClass)} />
      <span className={cx("flex max-w-full min-w-0 flex-col gap-1", sz.text)}>
        <span className={cx("text-fit-body leading-tight font-semibold wrap-anywhere", sz.name)}>{name}</span>
        <span className={cx("text-fit-note leading-tight wrap-anywhere opacity-75", sz.state)}>{state}</span>
      </span>
    </>
  );
}

/** タイルの外枠。ます目の数・色・「オン」の地・詳細を開くボタン */
function TileFrame({
  tile,
  size,
  color,
  place,
  editOverlay,
  onDetail,
  state,
  children,
}: TileFrameProps & { state?: "alert" | "error"; children: ReactNode }) {
  const t = tileMessages.useT();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  useFitText(box, `${size}:${tile.entity.name}:${tile.entity.state}`);
  const { w, h } = sizeOf(size);
  const tint = color ?? DEFAULT_COLORS[tile.kind];
  const style = {
    gridColumn: place ? `${place.col + 1} / span ${place.w}` : `span ${w}`,
    gridRow: place ? `${place.row + 1} / span ${h}` : `span ${h}`,
    "--tile-color": tint,
    "--tile-ink": textOn(tint),
  } as CSSProperties;
  return (
    // タイルの大きさはます目で決まり、中身（明るさのバーの有無など）では変わらない
    <div
      className={cx(
        "glass home-tile-radius home-tile-state change @container relative flex min-h-0 min-w-0 flex-col justify-between overflow-hidden",
        SIZE_CLASSES[size].frame,
      )}
      style={style}
      ref={setBox}
      data-tile-id={tile.entity.entityId}
      data-state={tileIsOn(tile) ? "on" : state}
    >
      {children}
      {!editOverlay && (
        // 詳細を開く「>」（右上。2x1 は右端）
        <IconButton
          icon="chevron-right"
          label={t("details", { name: tile.entity.name })}
          className={cx("absolute top-2 right-2 z-1", ON_TILE_BUTTON, SIZE_CLASSES[size].more)}
          onClick={onDetail}
        />
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
        className={cx(MAIN, "cursor-pointer disabled:cursor-default disabled:opacity-60", SIZE_CLASSES[frame.size].main)}
        data-tile-main
        aria-pressed={on}
        disabled={busy || toggle.state === "unavailable"}
        onClick={onToggle}
      >
        <TileText size={frame.size} icon={toggleIcon(toggle)} name={toggle.name} state={toggleStateLabel(toggle, t)} />
      </button>
      {showSlider && (
        // 明るさのバー。点いているときはタイルの地の上なので、文字の色に寄せる（home-tile-state が色を決める）
        <Slider
          className="mx-4.5 mb-3.5 flex-none"
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
  const sz = SIZE_CLASSES[frame.size];

  const lockButton = (
    <Button size="lg" className={cx("flex-1 px-3", sz.action)} disabled={busy || lock.state === "locked"} onClick={onLock}>
      {t("lock")}
    </Button>
  );
  const unlockButton = canUnlock ? (
    <Button
      size="lg"
      variant={confirming ? "danger" : "default"}
      className={cx("flex-1 px-3", sz.action)}
      disabled={busy || unlocked}
      onClick={press}
    >
      {confirming ? t(short ? "unlockConfirmShort" : "unlockConfirm") : t("unlock")}
    </Button>
  ) : null;

  return (
    // 鍵: 解錠中は注意の色、詰まったら赤い縁。施錠中はアイコンをタイルの色にする
    <TileFrame {...frame} state={lock.state === "jammed" ? "error" : unlocked ? "alert" : undefined}>
      <div className={cx(MAIN, MAIN_STATIC, sz.main)} data-tile-main>
        <TileText
          size={frame.size}
          icon={unlocked ? "lock-open" : "lock-closed"}
          iconClass={unlocked ? "text-warn" : "text-(--tile-color)"}
          name={lock.name}
          state={lockStateLabel(lock, t)}
        />
      </div>
      <div className={cx("flex flex-none gap-2 px-3.5 pb-3.5", sz.actions)}>
        {/* 広いタイルは両方、狭いタイルは今の状態から次にすることだけ（解錠中なら施錠） */}
        {wide ? (
          <>
            {lockButton}
            {unlockButton ?? <span className="text-note opacity-75">{t("cannotUnlock")}</span>}
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

/** 設定温度と、その上げ下げ（タイルと詳細で同じもの）。onTile はタイルの色の地の上に置くとき */
export function TargetControl({
  climate,
  busy,
  onCall,
  onTile,
}: {
  climate: Climate;
  busy: boolean;
  onCall: (service: string, data?: Record<string, unknown>) => void;
  onTile?: boolean;
}) {
  const t = tileMessages.useT();
  const step = climate.step ?? 0.5;
  const target = climate.targetTemperature;
  const off = climate.state === "off";
  const disabled = busy || off || target === null;
  const buttonClass = cx("size-10", onTile && ON_TILE_BUTTON);
  return (
    <div className="flex items-center gap-1">
      <IconButton
        icon="chevron-down"
        label={t("lowerTemp")}
        className={buttonClass}
        disabled={disabled}
        onClick={() => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target - step) })}
      />
      <span className="home-target-value">
        {off ? "—" : (target ?? "—")}
        <small>℃</small>
      </span>
      <IconButton
        icon="chevron-up"
        label={t("raiseTemp")}
        className={buttonClass}
        disabled={disabled}
        onClick={() => target !== null && onCall("set_temperature", { temperature: climateClamp(climate, target + step) })}
      />
    </div>
  );
}

/** 運転モードの選択（タイルと詳細で同じもの） */
export function ModeChips({
  climate,
  modes,
  busy,
  label,
  modeLabel,
  onCall,
  className,
  chipClass,
}: {
  climate: Climate;
  modes: string[];
  busy: boolean;
  label: string;
  modeLabel: (mode: string) => string;
  onCall: (service: string, data?: Record<string, unknown>) => void;
  className?: string;
  /** 1つずつの Chip に足すクラス（タイルの色の地の上に置くとき） */
  chipClass?: string;
}) {
  return (
    <div className={cx("flex flex-wrap gap-2", className)} role="group" aria-label={label}>
      {modes.map((mode) => (
        <Chip
          key={mode}
          selected={climate.state === mode}
          className={chipClass}
          disabled={busy}
          onClick={() => onCall("set_hvac_mode", { hvac_mode: mode })}
        >
          {modeLabel(mode)}
        </Chip>
      ))}
    </div>
  );
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
  const off = climate.state === "off";
  const short = frame.size === "2x1";
  const wide = frame.size === "4x2" || frame.size === "4x4";
  const modes = climate.hvacModes.filter((mode) => mode !== "off");
  const sz = SIZE_CLASSES[frame.size];

  const power = (
    <IconButton
      icon="power"
      size="lg"
      selected={!off}
      label={t(off ? "turnOn" : "turnOff", { name: climate.name })}
      // 2x1 では右に並べ、ほかでは右上（詳細の「>」の隣）に置く
      className={cx(!short && "absolute top-2 right-14 z-1", ON_TILE_SELECTED)}
      disabled={busy}
      onClick={() => onCall(off ? "turn_on" : "turn_off")}
    />
  );

  return (
    <TileFrame {...frame}>
      <div className={cx(MAIN, MAIN_STATIC, sz.main)} data-tile-main>
        <TileText
          size={frame.size}
          icon="temperature"
          name={climate.name}
          state={
            <>
              {off ? t("off") : modeLabel(climate.state)} · {t("roomTemp", { value: climate.currentTemperature ?? "—" })}℃
            </>
          }
        />
      </div>
      {short ? (
        <div className={cx("flex flex-none gap-2 px-3.5 pb-3.5", sz.actions)}>{power}</div>
      ) : (
        // 下に設定温度。広いタイルは、その右に運転モードを並べる（入りきらなければ折り返す）。
        // 4x2 でもスマホのように幅が足りないときは運転モードを出さない（電源と重なるため。詳細で変える）
        <div className="flex flex-none items-center gap-3 px-3 pb-3">
          {power}
          <TargetControl climate={climate} busy={busy} onCall={onCall} onTile={!off} />
          {wide && modes.length > 0 && (
            <ModeChips
              climate={climate}
              modes={modes}
              busy={busy}
              label={t("hvacMode")}
              modeLabel={modeLabel}
              onCall={onCall}
              className="hidden min-w-0 flex-1 justify-end gap-1.5 @tile:flex"
              chipClass={ON_TILE_SELECTED}
            />
          )}
        </div>
      )}
    </TileFrame>
  );
}
