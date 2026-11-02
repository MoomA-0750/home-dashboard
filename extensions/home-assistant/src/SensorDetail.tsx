import { useEffect, useState } from "react";
import {
  Chip,
  defineMessages,
  Dialog,
  formatClock,
  List,
  ListItem,
  Message,
  Note,
  useLocale,
  type Locale,
} from "@home-dashboard/widget-sdk";
import { localizeSeries } from "./units";

/**
 * 部屋の空気の詳細（カードを押すと開く）。まとめたセンサーそれぞれの今の値と、推移のグラフを出す。
 * 推移は HA の記録（/api/ext/home-assistant/history）から読む。
 */

export interface DetailSensor {
  entityId: string;
  name: string;
  state: string;
  unit: string | null;
}

interface Series {
  entityId: string;
  name: string;
  unit: string | null;
  points: [number, number][];
}

const RANGES = [
  { hours: 24, label: "range24h" },
  { hours: 168, label: "range7d" },
] as const;

const messages = defineMessages({
  ja: {
    range24h: "24時間",
    range7d: "7日",
    noRecords: "この期間の記録がありません。",
    trend: "{range}の推移",
    now: "いま",
    loadFailed: "記録を読めませんでした（{status}）",
    minMax: "{min}〜{max}",
    period: "期間",
    loading: "記録を読み込んでいます…",
    note: "名前の下の「〜」の値は、この期間の最低と最高です。",
  },
  en: {
    range24h: "24 hours",
    range7d: "7 days",
    noRecords: "No records for this period.",
    trend: "Trend over {range}",
    now: "Now",
    loadFailed: "Couldn't load records ({status})",
    minMax: "{min}–{max}",
    period: "Period",
    loading: "Loading records…",
    note: "The range under each name is the lowest and highest value in this period.",
  },
});

// センサーごとの線の色（一覧の丸と同じ）
const COLORS = ["#8adcf8", "#f6c177", "#c4a7e7", "#9ccfd8", "#eb6f92", "#a3e635"];

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PAD = { left: 44, right: 12, top: 12, bottom: 28 };

function formatValue(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatTick(t: number, hours: number, locale: Locale): string {
  const date = new Date(t);
  if (hours <= 24) return formatClock(date, locale);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function Chart({ series, hours, digits }: { series: Series[]; hours: number; digits: number }) {
  const t = messages.useT();
  const locale = useLocale();
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <Note>{t("noRecords")}</Note>;
  const end = Date.now();
  const start = end - hours * 60 * 60 * 1000;
  let min = Math.min(...all.map(([, v]) => v));
  let max = Math.max(...all.map(([, v]) => v));
  // 値がほとんど動かないときも線が真ん中に来るよう、上下に少し余裕を持たせる
  const margin = Math.max((max - min) * 0.15, max === min ? Math.abs(max) * 0.05 || 1 : 0);
  min -= margin;
  max += margin;
  const x = (t: number) => PAD.left + ((t - start) / (end - start)) * (CHART_WIDTH - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (CHART_HEIGHT - PAD.top - PAD.bottom);
  const yTicks = [min + margin, (min + max) / 2, max - margin];
  const xTicks = [start, start + (end - start) / 2, end];

  return (
    <svg
      className="block h-auto w-full"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={t("trend", { range: t(hours <= 24 ? "range24h" : "range7d") })}
    >
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line className="stroke-white/10" strokeWidth={1} x1={PAD.left} x2={CHART_WIDTH - PAD.right} y1={y(v)} y2={y(v)} />
          <text className="fill-muted text-micro" x={PAD.left - 6} y={y(v) + 4} textAnchor="end">
            {formatValue(v, digits)}
          </text>
        </g>
      ))}
      {xTicks.map((tick, i) => (
        <text
          key={`x${tick}`}
          className="fill-muted text-micro"
          x={x(tick)}
          y={CHART_HEIGHT - 8}
          textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
        >
          {i === xTicks.length - 1 ? t("now") : formatTick(tick, hours, locale)}
        </text>
      ))}
      {series.map((s, index) => {
        // 記録は「変わったとき」だけなので、最後の値をいままで引き延ばす
        const points =
          s.points.length > 0 ? [...s.points, [end, s.points[s.points.length - 1][1]] as [number, number]] : [];
        return (
          <polyline
            key={s.entityId}
            fill="none"
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points.map(([t, v]) => `${x(Math.max(t, start)).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
          />
        );
      })}
    </svg>
  );
}

export function SensorDetail({
  apiBaseUrl,
  title,
  sensors,
  digits,
  onClose,
}: {
  apiBaseUrl: string;
  title: string;
  sensors: DetailSensor[];
  digits: number;
  onClose: () => void;
}) {
  const t = messages.useT();
  const [hours, setHours] = useState<number>(24);
  const [series, setSeries] = useState<Series[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = sensors.map((s) => s.entityId).join(",");

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    setError(null);
    const params = new URLSearchParams({ entityIds: ids, hours: String(hours) });
    fetch(`${apiBaseUrl}/api/ext/home-assistant/history?${params}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? messages.t("loadFailed", { status: res.status }));
        if (!cancelled) setSeries((body as { series: Series[] }).series.map(localizeSeries));
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, ids, hours]);

  // 一覧と線の色をそろえる（記録の並びではなく、センサーの並びで色を決める）
  const ordered = series
    ? sensors.map((s) => series.find((x) => x.entityId === s.entityId)).filter((s): s is Series => !!s)
    : [];
  const statsFor = (entityId: string) => {
    const points = series?.find((s) => s.entityId === entityId)?.points ?? [];
    if (points.length === 0) return null;
    const values = points.map(([, v]) => v);
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  return (
    <Dialog title={title} onClose={onClose} size="wide">
      <div className="flex flex-col gap-3">
        <List boxed>
          {sensors.map((sensor, index) => {
            const value = Number(sensor.state);
            const stats = statsFor(sensor.entityId);
            return (
              <ListItem
                key={sensor.entityId}
                // 線の色の印
                leading={<span className="size-2.5 flex-none rounded-full" style={{ background: COLORS[index % COLORS.length] }} />}
                title={sensor.name}
                detail={stats ? t("minMax", { min: formatValue(stats.min, digits), max: formatValue(stats.max, digits) }) : undefined}
                trailing={
                  <span className="text-heading font-semibold whitespace-nowrap tabular-nums">
                    {Number.isFinite(value) ? formatValue(value, digits) : "—"}
                    <small className="ml-0.5 text-caption font-normal text-muted">{sensor.unit}</small>
                  </span>
                }
              />
            );
          })}
        </List>

        <div className="flex gap-2" role="group" aria-label={t("period")}>
          {RANGES.map((range) => (
            <Chip key={range.hours} selected={hours === range.hours} onClick={() => setHours(range.hours)}>
              {t(range.label)}
            </Chip>
          ))}
        </div>
        {error && <Message tone="error">{error}</Message>}
        {!error && !series && <Note>{t("loading")}</Note>}
        {series && <Chart series={ordered} hours={hours} digits={digits} />}
        {series && <Note>{t("note")}</Note>}
      </div>
    </Dialog>
  );
}
