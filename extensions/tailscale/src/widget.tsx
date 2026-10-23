import {
  defineMessages,
  defineWidget,
  Icon,
  usePolling,
  type IconName,
  type WidgetDetailProps,
  type WidgetProps,
  Badge,
  DetailFrame,
  WidgetCard,
} from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    apiError: "tailscale API error: {status}",
    minutesAgo: "{n}分前",
    hoursAgo: "{n}時間前",
    daysAgo: "{n}日前",
    checking: "確認中…",
    notConnected: "Tailscale未接続",
    loading: "読み込み中…",
    self: "{name}（{ip}）",
    exitCapable: "exit可",
    note: "表示のみで、exit nodeの切り替えなど経路を変更する操作はできません。 このダッシュボードはLAN上に認証なしで公開されるため、ホスト自身の経路設定は手元のCLIに残しています。",
  },
  en: {
    apiError: "tailscale API error: {status}",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    checking: "Checking…",
    notConnected: "Tailscale not connected",
    loading: "Loading…",
    self: "{name} ({ip})",
    exitCapable: "exit OK",
    note: "View only: you can't change routes here (such as switching the exit node). This dashboard is served on the LAN without authentication, so the host's own routing stays with the local CLI.",
  },
});

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
  const res = await fetch(`${apiBaseUrl}/api/ext/tailscale/status`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}

/** 電話は電話、それ以外（Linux・Windows・macOS など）はパソコンのアイコン */
const osIcon = (os: string): IconName => (os === "iOS" || os === "android" ? "phone" : "desktop");

function relativeLastSeen(iso: string | null, t: ReturnType<typeof messages.useT>): string {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return t("minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  return t("daysAgo", { n: Math.floor(hours / 24) });
}

function TailscaleView({ ctx, config, openDetail }: WidgetProps<TailscaleConfig>) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) return <WidgetCard className="widget-tailscale">{t("checking")}</WidgetCard>;
  if (data && !data.configured) {
    return (
      <WidgetCard className="widget-tailscale widget-tailscale--unconfigured">
        {t("notConnected")}
        <span className="widget-hint">{data.reason}</span>
      </WidgetCard>
    );
  }

  const running = data?.backendState === "Running";

  return (
    <WidgetCard className="widget-tailscale" onClick={openDetail}>
      <span className="widget-tailscale__header">
        <span className={`widget-homelab__dot ${running ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`} />
        <span className="widget-tailscale__title">Tailscale</span>
      </span>
      <span className="widget-tailscale__count">
        {data?.onlineCount ?? 0}
        <span className="widget-tailscale__total">/{data?.totalCount ?? 0}</span>
      </span>
      <span className="widget-tailscale__sub">{data?.self?.ip ?? ""}</span>
      {data?.exitNode && <span className="widget-tailscale__exit">exit: {data.exitNode.name}</span>}
    </WidgetCard>
  );
}

function TailscaleDetail({ ctx, config }: WidgetDetailProps<TailscaleConfig>) {
  const t = messages.useT();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <DetailFrame>{t("loading")}</DetailFrame>;

  return (
    <DetailFrame title="Tailscale" className="widget-tailscale-detail">
      <p className="widget-tailscale-detail__self">
        {t("self", { name: data.self?.name ?? "", ip: data.self?.ip ?? "" })} · {data.backendState} · v
        {data.version.split("-")[0]}
      </p>

      <ul className="widget-tailscale-detail__list">
        {data.peers.map((peer) => (
          <li key={peer.dnsName || peer.name} className="widget-tailscale-detail__item">
            <span
              className={`widget-homelab__dot ${peer.online ? "widget-homelab__dot--ok" : "widget-homelab__dot--warn"}`}
            />
            <span className="widget-tailscale-detail__name">
              <Icon name={osIcon(peer.os)} label={peer.os || undefined} className="widget-tailscale-detail__os" />
              {peer.name}
            </span>
            <span className="widget-tailscale-detail__ip">{peer.ip}</span>
            <span className="widget-tailscale-detail__meta">
              {peer.isExitNode && <Badge>exit node</Badge>}
              {!peer.isExitNode && peer.offersExitNode && (
                <Badge tone="dim">{t("exitCapable")}</Badge>
              )}
              {peer.active && peer.directAddr && <Badge>direct</Badge>}
              {peer.active && !peer.directAddr && peer.relay && (
                <Badge>derp:{peer.relay}</Badge>
              )}
              {!peer.online && (
                <span className="widget-tailscale-detail__seen">{relativeLastSeen(peer.lastSeen, t)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="widget-note">{t("note")}</p>
    </DetailFrame>
  );
}

export default defineWidget<TailscaleConfig>({
  id: "tailscale-status",
  name: "Tailscale",
  description: {
    ja: "tailnet内のノードのオンライン状況・接続経路を表示します（読み取り専用）",
    en: "Shows which tailnet nodes are online and how they connect (read-only)",
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 30 * 1000 },
  Component: TailscaleView,
  DetailComponent: TailscaleDetail,
});
