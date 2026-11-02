import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  Button,
  ButtonRow,
  Chip,
  cx,
  defineMessages,
  Icon,
  PillMenu,
  ScreenFrame,
  ScreenNotice,
  SectionTitle,
  StatTile,
  textFor,
  useLocale,
  usePolledResource,
  type IconName,
  type LocalizedText,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import {
  DEFAULT_SIZE,
  fetchLayout,
  gridMetrics,
  moveId,
  orderTiles,
  packTiles,
  saveLayout,
  TILE_SIZES,
  type HaEntity,
  type HomeLayout,
  type Overview,
  type Placement,
  type Tile,
  type TileSize,
} from "./homeTypes";
import { SensorDetail } from "./SensorDetail";
import { TileDetail } from "./TileDetail";
import { ClimateTile, HVAC_LABELS, LockTile, ToggleTile } from "./tiles";
import { localizeState } from "./units";

/**
 * Home Control の画面。部屋の空気（センサー）は上の帯（横長の画面では左の列）に並べ、照明・スイッチ・鍵・空調は
 * 同じ大きさのます目（照明の四角 ＝ 2x2）に並べる。並び・大きさ・タイルの色は「並べ替え」で変え、全部の端末で同じ
 */

async function fetchOverview(apiBaseUrl: string): Promise<Overview> {
  const res = await fetch(`${apiBaseUrl}/api/ext/home-assistant/overview`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  const overview = (await res.json()) as Overview;
  return { ...overview, sensors: (overview.sensors ?? []).map(localizeState) };
}

export async function callService(apiBaseUrl: string, entityId: string, service: string, data?: Record<string, unknown>) {
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
    nothingHere: "この部屋に出せるものはありません。",
    arrange: "並べ替え",
    done: "完了",
    arrangeHint: "タイルを押して選び、大きさを変えます。引くと並べ替えられます。",
    size: "大きさ",
    sizeOf: "{name}の大きさ",
    moveBefore: "前へ",
    moveAfter: "後ろへ",
    openDetail: "詳細",
    saveFailed: "並びを保存できませんでした（{error}）",
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
    nothingHere: "Nothing to show in this room.",
    arrange: "Arrange",
    done: "Done",
    arrangeHint: "Tap a tile to select it and change its size. Drag to reorder.",
    size: "Size",
    sizeOf: "Size of {name}",
    moveBefore: "Earlier",
    moveAfter: "Later",
    openDetail: "Details",
    saveFailed: "Couldn't save the layout ({error})",
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
function groupByArea<T>(items: T[], areaOf: (item: T) => string | null): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = areaOf(item) ?? "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
}

const SCREEN_TITLE = { ja: "ホームコントロール", en: "Home Control" };
/** これだけ指が動いたら、押したのではなく引いている */
const DRAG_THRESHOLD_PX = 8;

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
  const [sensorDetail, setSensorDetail] = useState<{ area: string; merged: MergedSensor } | null>(null);
  const [tileDetail, setTileDetail] = useState<string | null>(null);
  const [layout, setLayout] = useState<HomeLayout>({ order: [], tiles: {} });
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  // ます目の入れ物の幅。列の数を決め、タイルの置き場所（packTiles）を計算する
  const [tilesBox, setTilesBox] = useState<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  useLayoutEffect(() => {
    if (!tilesBox) return;
    setGridWidth(tilesBox.clientWidth);
    const observer = new ResizeObserver(() => setGridWidth(tilesBox.clientWidth));
    observer.observe(tilesBox);
    return () => observer.disconnect();
  }, [tilesBox]);

  useEffect(() => {
    fetchLayout(apiBaseUrl)
      .then(setLayout)
      .catch(() => undefined);
  }, [apiBaseUrl]);

  const run = async (entityId: string, service: string, payload?: Record<string, unknown>) => {
    setBusy(entityId);
    setFailure(null);
    try {
      await callService(apiBaseUrl, entityId, service, payload);
      // HA が状態を反映するまで少しかかるので、すぐと少し後の2回読み直す
      await refresh();
      setTimeout(refresh, 1200);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const persist = async (next: HomeLayout) => {
    setLayout(next);
    try {
      setLayout(await saveLayout(apiBaseUrl, next));
    } catch (err) {
      setFailure(t("saveFailed", { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  if (loading)
    return (
      <ScreenFrame title={SCREEN_TITLE}>
        <ScreenNotice>{t("loading")}</ScreenNotice>
      </ScreenFrame>
    );
  if (error || !data) {
    return (
      <ScreenFrame title={SCREEN_TITLE}>
        <ScreenNotice>{t("unreachable")}</ScreenNotice>
      </ScreenFrame>
    );
  }
  if (!data.configured) {
    return (
      <ScreenFrame title={SCREEN_TITLE}>
        <ScreenNotice>{t("notConfigured")}</ScreenNotice>
      </ScreenFrame>
    );
  }

  // 部屋の一覧は、センサー・鍵・空調・照明とスイッチのどれかがある部屋。部屋の分からないものは「そのほか」
  const all = [...data.sensors, ...data.locks, ...data.climates, ...data.toggles];
  const areas = [...new Set(all.map((e) => e.area ?? ""))].sort((a, b) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ja"),
  );
  const shownRoom = room !== null && areas.includes(room) ? room : null;
  const inRoom = (entity: HaEntity) => shownRoom === null || (entity.area ?? "") === shownRoom;
  const roomLabel = (area: string) => area || t("otherRoom");

  // ます目に並べるもの。はじめの並びは鍵・空調・照明とスイッチの順で、保存した並びがあればそれに従う
  const allTiles = orderTiles(
    [
      ...data.locks.map((entity): Tile => ({ kind: "lock", entity })),
      ...data.climates.map((entity): Tile => ({ kind: "climate", entity })),
      ...data.toggles.map((entity): Tile => ({ kind: "toggle", entity })),
    ],
    layout.order,
  );
  const allIds = allTiles.map((tile) => tile.entity.entityId);
  const tiles = allTiles.filter((tile) => inRoom(tile.entity));
  const sensors = data.sensors.filter(inRoom);
  const sizeFor = (id: string): TileSize => layout.tiles[id]?.size ?? DEFAULT_SIZE;
  const modeLabel = (mode: string) => (HVAC_LABELS[mode] ? textFor(HVAC_LABELS[mode], locale) : mode);

  const setTile = (id: string, patch: { size?: TileSize; color?: string | null }) => {
    const current = { ...layout.tiles[id] };
    if (patch.size) current.size = patch.size;
    if (patch.color === null) delete current.color;
    else if (patch.color) current.color = patch.color;
    void persist({ order: allIds, tiles: { ...layout.tiles, [id]: current } });
  };
  const moveBy = (id: string, delta: number) => {
    // 同じ部屋の中で隣のものと入れ替える（すべての部屋を出しているときも、部屋の見出しをまたがない）
    const tile = tiles.find((x) => x.entity.entityId === id);
    if (!tile) return;
    const neighbors = tiles.filter((x) => (x.entity.area ?? "") === (tile.entity.area ?? "")).map((x) => x.entity.entityId);
    const target = neighbors[neighbors.indexOf(id) + delta];
    if (target) void persist({ ...layout, order: moveId(allIds, id, target) });
  };

  // 並べ替え: 押して離せば選ぶ、引けば指の下のタイルの位置へ動かす（同じ部屋の中だけ）
  const onEditPointerDown = (id: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, x: event.clientX, y: event.clientY, moved: false };
  };
  const onEditPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-tile-id]");
    const target = under?.dataset.tileId;
    const from = event.currentTarget.closest<HTMLElement>("[data-area]")?.dataset.area;
    if (!target || target === current.id || under?.closest<HTMLElement>("[data-area]")?.dataset.area !== from) return;
    setLayout((prev) => ({ ...prev, order: moveId(orderTiles(allTiles, prev.order).map((x) => x.entity.entityId), current.id, target) }));
  };
  const onEditPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (current.moved) void persist({ ...layout, order: orderTiles(allTiles, layout.order).map((x) => x.entity.entityId) });
    else setSelected((prev) => (prev === current.id ? null : current.id));
  };

  const metrics = gridMetrics(gridWidth);
  const renderTile = (tile: Tile, place: Placement) => {
    const id = tile.entity.entityId;
    const frame = {
      tile,
      place,
      size: sizeFor(id),
      color: layout.tiles[id]?.color,
      onDetail: () => setTileDetail(id),
      editOverlay: editing ? (
        // 並べ替えの間は、タイルの上に重ねて押せなくする（押すと選ぶ、引くと並べ替える）
        <div
          className={cx(
            "home-tile-radius absolute inset-0 z-2 flex cursor-grab touch-none items-start justify-between border-2 border-dashed border-white/40 bg-black/20 px-3 py-2.5 font-semibold text-white select-none",
            "aria-pressed:border-3 aria-pressed:border-solid aria-pressed:border-fill aria-pressed:bg-black/10 [&_.fluent-icon]:size-5.5",
          )}
          role="button"
          tabIndex={0}
          aria-pressed={selected === id}
          aria-label={tile.entity.name}
          onPointerDown={onEditPointerDown(id)}
          onPointerMove={onEditPointerMove}
          onPointerUp={onEditPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setSelected((prev) => (prev === id ? null : id));
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") moveBy(id, -1);
            if (event.key === "ArrowRight" || event.key === "ArrowDown") moveBy(id, 1);
          }}
        >
          <Icon name="grip" />
          <span>{sizeFor(id).replace("x", "×")}</span>
        </div>
      ) : undefined,
    };
    if (tile.kind === "toggle") {
      return (
        <ToggleTile
          key={id}
          {...frame}
          toggle={tile.entity}
          busy={busy === id}
          onToggle={() => run(id, "toggle")}
          onBrightness={(pct) => run(id, "turn_on", { brightness_pct: pct })}
        />
      );
    }
    if (tile.kind === "lock") {
      return (
        <LockTile
          key={id}
          {...frame}
          lock={tile.entity}
          canUnlock={data.canUnlock}
          busy={busy === id}
          onLock={() => run(id, "lock")}
          onUnlock={() => run(id, "unlock")}
        />
      );
    }
    return (
      <ClimateTile
        key={id}
        {...frame}
        climate={tile.entity}
        busy={busy === id}
        modeLabel={modeLabel}
        onCall={(service, payload) => run(id, service, payload)}
      />
    );
  };

  const selectedTile = editing ? tiles.find((tile) => tile.entity.entityId === selected) : undefined;
  const detailTile = allTiles.find((tile) => tile.entity.entityId === tileDetail);

  // ほかの画面と同じく、見出しの右にまとめて置く
  const actions = (
    <ButtonRow>
      {areas.length > 1 && (
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
      )}
      {allTiles.length > 0 && (
        <Button
          variant={editing ? "primary" : "default"}
          icon={editing ? "checkmark" : "grid"}
          aria-pressed={editing}
          onClick={() => {
            setEditing((prev) => !prev);
            setSelected(null);
          }}
        >
          {editing ? t("done") : t("arrange")}
        </Button>
      )}
    </ButtonRow>
  );

  return (
    <ScreenFrame title={SCREEN_TITLE} actions={actions}>
      {failure && <ScreenNotice tone="error">{failure}</ScreenNotice>}

      {/* 部屋の空気（センサー）は上に横並びの帯、横長の画面では左に縦並び。照明・鍵・空調は右（下）のます目 */}
      <div className={cx("flex gap-5", sensors.length > 0 ? "home-control-split" : "flex-col")}>
        {sensors.length > 0 && (
          <section className="home-sensors-column flex flex-wrap gap-x-8 gap-y-1.5" aria-label={t("air")}>
            {groupByArea(sensors, (s) => s.area).flatMap(([area, group]) =>
              mergeSensors(group).map((merged) => {
                const known = SENSOR_META[merged.deviceClass ?? ""];
                const label = known ? textFor(known.label, locale) : merged.sensors[0].name;
                // すべての部屋を出しているときは、どの部屋の値か分かるよう部屋の名前を添える
                const shownLabel = shownRoom === null ? sensorTitle(area, label, t) : label;
                const value = formatMergedValue(merged);
                return (
                  <StatTile
                    key={`${area}:${merged.key}`}
                    // センサーの値は、カードの地を敷かずに文字だけで出す（壁紙の上でも読めるよう、影を付ける）
                    // （StatTile のガラスより強くするため ! を付ける。StatTile に地を敷かない形ができたら、そちらに替える）
                    bare
                    className="flex-none [&>:first-child]:whitespace-nowrap"
                    icon={known?.icon ?? "unknown"}
                    label={shownLabel}
                    value={value}
                    unit={merged.unit ?? undefined}
                    tone={merged.level === "ok" ? undefined : merged.level}
                    ariaLabel={t("sensorAria", { label: sensorTitle(area, label, t), value: `${value}${merged.unit ?? ""}` })}
                    onClick={() => setSensorDetail({ area, merged })}
                  />
                );
              }),
            )}
          </section>
        )}

        <div className="@container flex min-w-0 flex-col gap-5" ref={setTilesBox}>
          {editing && (
            <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-group px-4 py-3" role="toolbar" aria-label={t("arrange")}>
              {selectedTile ? (
                <>
                  <span className="font-semibold">{selectedTile.entity.name}</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("sizeOf", { name: selectedTile.entity.name })}>
                    {TILE_SIZES.map((size) => (
                      <Chip
                        key={size}
                        selected={sizeFor(selectedTile.entity.entityId) === size}
                        onClick={() => setTile(selectedTile.entity.entityId, { size })}
                      >
                        {size.replace("x", "×")}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip icon="chevron-left" onClick={() => moveBy(selectedTile.entity.entityId, -1)}>
                      {t("moveBefore")}
                    </Chip>
                    <Chip onClick={() => moveBy(selectedTile.entity.entityId, 1)}>
                      {t("moveAfter")}
                      <Icon name="chevron-right" />
                    </Chip>
                    <Chip onClick={() => setTileDetail(selectedTile.entity.entityId)}>{t("openDetail")}</Chip>
                  </div>
                </>
              ) : (
                <span className="text-small text-muted">{t("arrangeHint")}</span>
              )}
            </div>
          )}
          {groupByArea(tiles, (tile) => tile.entity.area).map(([area, group]) => (
            <section key={area}>
              {shownRoom === null && areas.length > 1 && <SectionTitle>{roomLabel(area)}</SectionTitle>}
              <div
                className="home-grid"
                data-area={area}
                style={{ "--cols": metrics.cols, "--gap": `${metrics.gap}px` } as CSSProperties}
              >
                {(() => {
                  const places = packTiles(
                    group.map((tile) => sizeFor(tile.entity.entityId)),
                    metrics.cols,
                  );
                  return group.map((tile, index) => renderTile(tile, places[index]));
                })()}
              </div>
            </section>
          ))}
        </div>
      </div>

      {sensors.length + tiles.length === 0 && <ScreenNotice>{t("nothingHere")}</ScreenNotice>}
      {sensorDetail && (
        <SensorDetail
          apiBaseUrl={apiBaseUrl}
          title={sensorTitle(
            sensorDetail.area,
            SENSOR_META[sensorDetail.merged.deviceClass ?? ""]
              ? textFor(SENSOR_META[sensorDetail.merged.deviceClass ?? ""].label, locale)
              : sensorDetail.merged.sensors[0].name,
            t,
          )}
          sensors={sensorDetail.merged.sensors}
          digits={sensorDetail.merged.deviceClass === "temperature" ? 1 : 0}
          onClose={() => setSensorDetail(null)}
        />
      )}
      {detailTile && (
        <TileDetail
          tile={detailTile}
          size={sizeFor(detailTile.entity.entityId)}
          color={layout.tiles[detailTile.entity.entityId]?.color}
          canUnlock={data.canUnlock}
          busy={busy === detailTile.entity.entityId}
          modeLabel={modeLabel}
          onCall={(service, payload) => run(detailTile.entity.entityId, service, payload)}
          onLayout={(patch) => setTile(detailTile.entity.entityId, patch)}
          onClose={() => setTileDetail(null)}
        />
      )}
    </ScreenFrame>
  );
}
