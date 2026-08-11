import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface HomelabStatusConfig {
  pollIntervalMs: number;
}

interface HostStatus {
  name: string;
  host: string;
  port: number;
  online: boolean;
  latencyMs: number | null;
}

interface HomelabStatusResponse {
  hosts: HostStatus[];
}

async function fetchStatus(apiBaseUrl: string): Promise<HomelabStatusResponse> {
  const res = await fetch(`${apiBaseUrl}/api/homelab/status`);
  if (!res.ok) throw new Error(`homelab status API error: ${res.status}`);
  return res.json();
}

function HomelabStatusView({ ctx, config, openDetail }: WidgetProps<HomelabStatusConfig>) {
  const { data, loading } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  const onlineCount = data?.hosts.filter((h) => h.online).length ?? 0;
  const total = data?.hosts.length ?? 0;
  const allOnline = total > 0 && onlineCount === total;

  return (
    <button type="button" className="widget-card widget-homelab" onClick={openDetail}>
      <span className={`widget-homelab__dot ${allOnline ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`} />
      <span className="widget-homelab__summary">
        {loading && !data ? "確認中…" : `${onlineCount}/${total} online`}
      </span>
    </button>
  );
}

function HomelabStatusDetail({ ctx, config }: WidgetDetailProps<HomelabStatusConfig>) {
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);

  return (
    <div className="widget-detail widget-homelab-detail">
      <h2>ホームラボ稼働状況</h2>
      <ul className="widget-homelab-detail__list">
        {data?.hosts.map((h) => (
          <li key={h.name} className="widget-homelab-detail__item">
            <span className={`widget-homelab__dot ${h.online ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`} />
            <span className="widget-homelab-detail__name">{h.name}</span>
            <span className="widget-homelab-detail__host">{h.host}:{h.port}</span>
            <span className="widget-homelab-detail__latency">
              {h.online ? `${h.latencyMs}ms` : "unreachable"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default defineWidget<HomelabStatusConfig>({
  id: "homelab-status",
  name: "ホームラボ稼働状況",
  description: "config/homelab-hosts.json に設定したホストの死活監視を表示します",
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1000 },
  Component: HomelabStatusView,
  DetailComponent: HomelabStatusDetail,
});
