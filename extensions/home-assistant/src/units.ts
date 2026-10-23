import { convertReading } from "@home-dashboard/widget-sdk";

/**
 * Home Assistant の温度を、設定（設定の「一般 → 温度の単位」）の単位に直す。画面が受け取ったところで1回だけ直すので、
 * タイル・ウィジェット・グラフ・設定の一覧がそろって同じ単位になる（エアコンの設定温度は Home Assistant の単位のまま）
 */
export function localizeState<T extends { state: string; unit: string | null }>(entity: T): T {
  const value = Number(entity.state);
  if (entity.state === "" || !Number.isFinite(value)) return { ...entity, unit: convertReading(0, entity.unit).unit };
  const converted = convertReading(value, entity.unit);
  return { ...entity, state: String(Math.round(converted.value * 100) / 100), unit: converted.unit };
}

export function localizeReading<T extends { value: number; unit: string | null }>(reading: T): T {
  const converted = convertReading(reading.value, reading.unit);
  return { ...reading, value: converted.value, unit: converted.unit };
}

export function localizeSeries<T extends { unit: string | null; points: [number, number][] }>(series: T): T {
  const unit = convertReading(0, series.unit).unit;
  return { ...series, unit, points: series.points.map(([t, v]) => [t, convertReading(v, series.unit).value]) };
}
