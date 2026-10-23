import {
  defineMessages,
  defineWidget,
  textFor,
  useLocale,
  usePolling,
  type WidgetDetailProps,
  type WidgetProps,
  ProgressBar,
  DetailFrame,
  WidgetCard,
} from "@home-dashboard/widget-sdk";
import { TYPE_LABELS } from "./HostSettings";

/**
 * ホームラボ稼働状況。設定画面で登録したホストの CPU・メモリ・ディスク・連続稼働時間を出す。
 * ウィジェットには値だけを出し、読めなかった理由や登録の案内は詳細（押すと開く）に出す。
 */

const messages = defineMessages({
  ja: {
    apiError: "homelab status API error: {status}",
    daysHours: "{d}日 {h}時間",
    hoursMinutes: "{h}時間 {m}分",
    minutes: "{m}分",
    cores: "{n}コア",
    memory: "メモリ",
    disk: "ディスク",
    uptime: "稼働 {time}",
    guests: "VM・コンテナ {running}/{total} 稼働",
    title: "ホームラボ稼働状況",
    openDetail: "ホームラボ稼働状況（詳しく見る）",
    latency: "応答 {ms}ms",
    responding: "応答あり",
    notResponding: "応答なし",
    noHosts: "ホストがありません。設定画面の「拡張機能 → homelab」で登録できます。",
    load: "ロード {load}",
    memoryUsage: "メモリ {used} / {total}",
    diskUsage: "ディスク {used} / {total}",
    factSeparator: "・",
    editHint: "ホストの追加・変更は、設定画面の「拡張機能 → homelab」でできます。",
  },
  en: {
    apiError: "homelab status API error: {status}",
    daysHours: "{d}d {h}h",
    hoursMinutes: "{h}h {m}m",
    minutes: "{m}m",
    cores: (p) => (p.n === 1 ? "1 core" : `${p.n} cores`),
    memory: "Memory",
    disk: "Disk",
    uptime: "Up {time}",
    guests: "VMs & containers {running}/{total} running",
    title: "Homelab status",
    openDetail: "Homelab status (show details)",
    latency: "Responds in {ms}ms",
    responding: "Responding",
    notResponding: "No response",
    noHosts: "No hosts yet. Add them in Settings under Extensions → homelab.",
    load: "Load {load}",
    memoryUsage: "Memory {used} / {total}",
    diskUsage: "Disk {used} / {total}",
    factSeparator: " · ",
    editHint: "Add or change hosts in Settings under Extensions → homelab.",
  },
});

type T = ReturnType<typeof messages.useT>;

interface HomelabStatusConfig {
  pollIntervalMs: number;
}

interface Resources {
  cpu: number | null;
  cores: number | null;
  memUsed: number | null;
  memTotal: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  uptimeSec: number | null;
  load1: number | null;
}

interface HostStatus {
  id: string;
  name: string;
  type: keyof typeof TYPE_LABELS;
  address: string;
  online: boolean;
  latencyMs: number | null;
  error: string | null;
  resources: Resources | null;
  guests: { running: number; total: number } | null;
}

async function fetchStatus(apiBaseUrl: string): Promise<{ hosts: HostStatus[] }> {
  const res = await fetch(`${apiBaseUrl}/api/ext/homelab/status`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}

/** 連続稼働時間。1日以上なら「12日 3時間」、それ未満なら「5時間 20分」 */
function formatUptime(sec: number | null, t: T): string {
  if (sec === null) return "—";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (days > 0) return t("daysHours", { d: days, h: hours });
  if (hours > 0) return t("hoursMinutes", { h: hours, m: minutes });
  return t("minutes", { m: minutes });
}

function formatBytes(bytes: number): string {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1000) return `${(gib / 1024).toFixed(1)}TB`;
  return `${gib >= 100 ? gib.toFixed(0) : gib.toFixed(1)}GB`;
}

const ratio = (used: number | null, total: number | null) =>
  used === null || !total ? null : Math.min(1, Math.max(0, used / total));

/** 8割を超えたら注意、9割5分を超えたら警告 */
const levelOf = (value: number | null) =>
  value === null ? "" : value >= 0.95 ? " homelab-usage--hot" : value >= 0.8 ? " homelab-usage--warm" : "";

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function usages(r: Resources, t: T) {
  return [
    { label: "CPU", value: r.cpu, detail: r.cores ? t("cores", { n: r.cores }) : undefined },
    {
      label: t("memory"),
      value: ratio(r.memUsed, r.memTotal),
      detail: r.memUsed !== null && r.memTotal ? `${formatBytes(r.memUsed)} / ${formatBytes(r.memTotal)}` : undefined,
    },
    {
      label: t("disk"),
      value: ratio(r.diskUsed, r.diskTotal),
      detail:
        r.diskUsed !== null && r.diskTotal ? `${formatBytes(r.diskUsed)} / ${formatBytes(r.diskTotal)}` : undefined,
    },
  ];
}

function UsageBars({ resources }: { resources: Resources }) {
  const t = messages.useT();
  return (
    <div className="homelab-node__usage">
      {usages(resources, t).map((u) => (
        <div key={u.label} className={`homelab-usage${levelOf(u.value)}`} title={u.detail}>
          <span className="homelab-usage__label">{u.label}</span>
          <ProgressBar value={u.value ?? 0} />
          <span className="homelab-usage__value">{percent(u.value)}</span>
        </div>
      ))}
    </div>
  );
}

const Dot = ({ online }: { online: boolean }) => (
  <span className={`widget-homelab__dot ${online ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`} />
);

function HomelabStatusView({ ctx, config, openDetail }: WidgetProps<HomelabStatusConfig>) {
  const t = messages.useT();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  const hosts = data?.hosts ?? [];

  // 1台だけなら、バーで大きく出す
  if (hosts.length === 1 && hosts[0].resources) {
    const host = hosts[0];
    return (
      <WidgetCard className="widget-homelab widget-homelab--single" onClick={openDetail}>
        <span className="homelab-node__head">
          <Dot online={host.online} />
          <span className="homelab-node__name">{host.name}</span>
          <span className="homelab-node__uptime">
            {t("uptime", { time: formatUptime(host.resources!.uptimeSec, t) })}
          </span>
        </span>
        <UsageBars resources={host.resources!} />
        {host.guests && (
          <span className="homelab-node__guests">
            {t("guests", { running: host.guests.running, total: host.guests.total })}
          </span>
        )}
      </WidgetCard>
    );
  }

  // 何台もあるときは、1台1行で割合を並べる
  return (
    <WidgetCard className="widget-homelab widget-homelab--list" onClick={openDetail} label={t("openDetail")}>
      <span className="homelab-list">
        <span className="homelab-list__head" aria-hidden="true">
          <span />
          <span>CPU</span>
          <span>{t("memory")}</span>
          <span>{t("disk")}</span>
        </span>
        {hosts.map((host) => (
          <span key={host.id} className="homelab-list__row">
            <span className="homelab-list__name">
              <Dot online={host.online} />
              <span>{host.name}</span>
            </span>
            {host.resources ? (
              usages(host.resources, t).map((u) => (
                <span key={u.label} className={`homelab-list__value${levelOf(u.value)}`}>
                  {percent(u.value)}
                </span>
              ))
            ) : (
              <span className="homelab-list__state">
                {host.online
                  ? host.latencyMs !== null
                    ? t("latency", { ms: host.latencyMs })
                    : t("responding")
                  : t("notResponding")}
              </span>
            )}
          </span>
        ))}
      </span>
    </WidgetCard>
  );
}

function HomelabStatusDetail({ ctx, config }: WidgetDetailProps<HomelabStatusConfig>) {
  const t = messages.useT();
  const locale = useLocale();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);

  return (
    <DetailFrame title={t("title")} className="widget-homelab-detail">
      {data && data.hosts.length === 0 && <p className="homelab-detail__facts">{t("noHosts")}</p>}
      {data?.hosts.map((host) => {
        const r = host.resources;
        return (
          <section key={host.id} className="homelab-detail__node">
            <h3 className="homelab-node__head">
              <Dot online={host.online} />
              <span className="homelab-node__name">{host.name}</span>
              <span className="homelab-node__uptime">
                {r ? t("uptime", { time: formatUptime(r.uptimeSec, t) }) : ""}
              </span>
            </h3>
            {r && <UsageBars resources={r} />}
            <p className="homelab-detail__facts">
              {[
                textFor(TYPE_LABELS[host.type], locale),
                host.address,
                host.latencyMs !== null && t("latency", { ms: host.latencyMs }),
                r?.cores && t("cores", { n: r.cores }),
                r?.load1 !== null && r?.load1 !== undefined && t("load", { load: r.load1.toFixed(2) }),
                r?.memTotal && t("memoryUsage", { used: formatBytes(r.memUsed ?? 0), total: formatBytes(r.memTotal) }),
                r?.diskTotal && t("diskUsage", { used: formatBytes(r.diskUsed ?? 0), total: formatBytes(r.diskTotal) }),
                host.guests && t("guests", { running: host.guests.running, total: host.guests.total }),
              ]
                .filter(Boolean)
                .join(t("factSeparator"))}
            </p>
            {host.error && <p className="homelab-detail__error">{host.error}</p>}
          </section>
        );
      })}
      {data && data.hosts.length > 0 && <p className="homelab-detail__note">{t("editHint")}</p>}
    </DetailFrame>
  );
}

export default defineWidget<HomelabStatusConfig>({
  id: "homelab-status",
  name: { ja: "ホームラボ稼働状況", en: "Homelab status" },
  description: {
    ja: "登録した機械の CPU・メモリ・ディスク・連続稼働時間を表示します",
    en: "Shows CPU, memory, disk and uptime of the machines you register",
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1000 },
  Component: HomelabStatusView,
  DetailComponent: HomelabStatusDetail,
});
