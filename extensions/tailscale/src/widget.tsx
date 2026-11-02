import {
  defineMessages,
  defineWidget,
  Icon,
  usePolling,
  type IconName,
  type WidgetDetailProps,
  type WidgetProps,
  Badge,
  cx,
  DetailFrame,
  Note,
  WidgetCard,
  WidgetHint,
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

/** つながっているか（緑 / 注意の色）の丸い印 */
const Dot = ({ ok }: { ok: boolean }) => (
  <span className={cx("size-2.5 shrink-0 rounded-full", ok ? "bg-ok" : "bg-warn")} />
);

function TailscaleView({ ctx, config, openDetail }: WidgetProps<TailscaleConfig>) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) return <WidgetCard>{t("checking")}</WidgetCard>;
  if (data && !data.configured) {
    return (
      <WidgetCard>
        {t("notConnected")}
        <WidgetHint>{data.reason}</WidgetHint>
      </WidgetCard>
    );
  }

  const running = data?.backendState === "Running";

  return (
    <WidgetCard className="items-stretch gap-1 text-left tabular-nums" onClick={openDetail}>
      <span className="flex items-center gap-1.5">
        <Dot ok={running} />
        <span className="text-note text-muted">Tailscale</span>
      </span>
      <span className="text-stat font-semibold leading-none">
        {data?.onlineCount ?? 0}
        <span className="text-body font-normal text-muted">/{data?.totalCount ?? 0}</span>
      </span>
      <span className="text-caption text-muted">{data?.self?.ip ?? ""}</span>
      {data?.exitNode && <span className="text-caption text-muted">exit: {data.exitNode.name}</span>}
    </WidgetCard>
  );
}

function TailscaleDetail({ ctx, config }: WidgetDetailProps<TailscaleConfig>) {
  const t = messages.useT();
  const { data } = usePolling(() => fetchStatus(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <DetailFrame>{t("loading")}</DetailFrame>;

  return (
    <DetailFrame title="Tailscale">
      <p className="mb-3 text-label text-muted">
        {t("self", { name: data.self?.name ?? "", ip: data.self?.ip ?? "" })} · {data.backendState} · v
        {data.version.split("-")[0]}
      </p>

      <ul className="flex flex-col gap-1.5">
        {data.peers.map((peer) => (
          <li key={peer.dnsName || peer.name} className="flex items-center gap-2.5 text-label">
            <Dot ok={peer.online} />
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
              <Icon name={osIcon(peer.os)} label={peer.os || undefined} className="size-4.5 shrink-0 text-muted" />
              {peer.name}
            </span>
            <span className="text-muted tabular-nums">{peer.ip}</span>
            <span className="flex items-center gap-1">
              {peer.isExitNode && <Badge>exit node</Badge>}
              {!peer.isExitNode && peer.offersExitNode && (
                <Badge tone="dim">{t("exitCapable")}</Badge>
              )}
              {peer.active && peer.directAddr && <Badge>direct</Badge>}
              {peer.active && !peer.directAddr && peer.relay && (
                <Badge>derp:{peer.relay}</Badge>
              )}
              {!peer.online && (
                <span className="text-muted tabular-nums">{relativeLastSeen(peer.lastSeen, t)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <Note>{t("note")}</Note>
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
