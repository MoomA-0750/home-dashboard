import type { DashboardLayout, WidgetInstance } from "@home-dashboard/widget-sdk";

/**
 * レイアウトデータのバージョン。
 * v2 でキャンバス（12カラム・rowHeight 90px の自由配置）からウィジェットレール
 * （1カラム・1行=200px、カード間隔30px）に変わり、`h` の意味が変わった。
 * `w` / `x` はレールでは使わないが、将来のレイアウト変更に備えて保持している。
 */
const LAYOUT_VERSION = 2;

const LEGACY_ROW_HEIGHT = 90;
const LEGACY_MARGIN = 16;
const RAIL_ROW_HEIGHT = 200;
const RAIL_GAP = 30;

/** 旧キャンバスでの実ピクセル高さを、もっとも近いレールの行数に読み替える */
function migrateHeight(instance: WidgetInstance): WidgetInstance {
  const legacyPx = LEGACY_ROW_HEIGHT * instance.h + LEGACY_MARGIN * (instance.h - 1);
  const rows = Math.max(1, Math.round((legacyPx + RAIL_GAP) / (RAIL_ROW_HEIGHT + RAIL_GAP)));
  return { ...instance, h: rows };
}

export async function fetchLayout(apiBaseUrl: string): Promise<DashboardLayout> {
  const res = await fetch(`${apiBaseUrl}/api/layout`);
  if (!res.ok) throw new Error(`layout API error: ${res.status}`);
  const layout: DashboardLayout = await res.json();

  if ((layout.version ?? 1) >= LAYOUT_VERSION) return layout;
  return { ...layout, version: LAYOUT_VERSION, instances: layout.instances.map(migrateHeight) };
}

export async function saveLayout(apiBaseUrl: string, layout: DashboardLayout): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...layout, version: LAYOUT_VERSION }),
  });
  if (!res.ok) throw new Error(`layout save error: ${res.status}`);
}
