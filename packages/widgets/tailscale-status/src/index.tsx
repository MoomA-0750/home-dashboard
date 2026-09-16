import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface TailscaleConfig {
  pollIntervalMs: number;
}

interface Peer {
  name: string;
  dnsName: string;
  os: string;
  ip: string;
  online: boolean;
  active: boolean;
  isExitNode: boolean;
  offersExitNode: boolean;
  lastSeen: string | null;
  rxBytes: number;
  txBytes: number;
  directAddr: string;
  relay: string;
}

interface TailscaleResponse {
  configured: boolean;
  reason?: string;
  version: string;
  backendState: string;
  self: Peer | null;
  exitNode: { name: string; ip: string; online: boolean } | null;
  onlineCount: number;
  totalCount: number;
  peers: Peer[];
}

async function fetchStatus(apiBaseUrl: string): Promise<TailscaleResponse> {
  const res = await fetch(`${apiBaseUrl}/api/tailscale/status`);
  if (!res.ok) throw new Error(`tailscale API error: ${res.status}`);
  return res.json();
}

const OS_ICON: Record<string, string> = {
  linux: "🐧",
  windows: "🪟",
  macOS: "🍎",
  iOS: "📱",
  android: "🤖",
};

function relativeLastSeen(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

function TailscaleView({ ctx, config, openDetail }: WidgetProps<TailscaleConfig>) {
  const { data, loading } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) return <div className="widget-card widget-tailscale">確認中…</div>;
  if (data && !data.configured) {
    return (
      <div className="widget-card widget-tailscale widget-tailscale--unconfigured">
        Tailscale未接続
        <span className="widget-spotify__hint">{data.reason}</span>
      </div>
    );
  }

  const running = data?.backendState === "Running";

  return (
    <button type="button" className="widget-card widget-tailscale" onClick={openDetail}>
      <span className="widget-tailscale__header">
        <span className={`widget-homelab__dot ${running ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`} />
        <span className="widget-tailscale__title">Tailscale</span>
      </span>
      <span className="widget-tailscale__count">
        {data?.onlineCount ?? 0}<span className="widget-tailscale__total">/{data?.totalCount ?? 0}</span>
      </span>
      <span className="widget-tailscale__sub">{data?.self?.ip ?? ""}</span>
      {data?.exitNode && (
        <span className="widget-tailscale__exit">exit: {data.exitNode.name}</span>
      )}
    </button>
  );
}

function TailscaleDetail({ ctx, config }: WidgetDetailProps<TailscaleConfig>) {
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <div className="widget-detail">読み込み中…</div>;

  return (
    <div className="widget-detail widget-tailscale-detail">
      <h2>Tailscale</h2>
      <p className="widget-tailscale-detail__self">
        {data.self?.name}（{data.self?.ip}） · {data.backendState} · v{data.version.split("-")[0]}
      </p>

      <ul className="widget-tailscale-detail__list">
        {data.peers.map((peer) => (
          <li key={peer.dnsName || peer.name} className="widget-tailscale-detail__item">
            <span className={`widget-homelab__dot ${peer.online ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`} />
            <span className="widget-tailscale-detail__name">
              {OS_ICON[peer.os] ?? "💻"} {peer.name}
            </span>
            <span className="widget-tailscale-detail__ip">{peer.ip}</span>
            <span className="widget-tailscale-detail__meta">
              {peer.isExitNode && <span className="widget-tailscale-detail__badge">exit node</span>}
              {!peer.isExitNode && peer.offersExitNode && (
                <span className="widget-tailscale-detail__badge widget-tailscale-detail__badge--dim">exit可</span>
              )}
              {peer.active && peer.directAddr && <span className="widget-tailscale-detail__badge">direct</span>}
              {peer.active && !peer.directAddr && peer.relay && (
                <span className="widget-tailscale-detail__badge">derp:{peer.relay}</span>
              )}
              {!peer.online && <span className="widget-tailscale-detail__seen">{relativeLastSeen(peer.lastSeen)}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="widget-usage-detail__note">
        表示のみで、exit nodeの切り替えなど経路を変更する操作はできません。
        このダッシュボードはLAN上に認証なしで公開されるため、ホスト自身の経路設定は手元のCLIに残しています。
      </p>
    </div>
  );
}

export default defineWidget<TailscaleConfig>({
  id: "tailscale-status",
  name: "Tailscale",
  description: "tailnet内のノードのオンライン状況・接続経路を表示します（読み取り専用）",
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1000 },
  Component: TailscaleView,
  DetailComponent: TailscaleDetail,
});
