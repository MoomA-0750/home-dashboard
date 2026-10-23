import { request as httpRequest } from "node:http";
import { defineServerExtension, defineServerMessages, type SettingValue } from "@home-dashboard/extension-sdk";

const messages = defineServerMessages({
  ja: { cannotConnect: "tailscaledに接続できません ({socket}): {error}" },
  en: { cannotConnect: "Can't connect to tailscaled ({socket}): {error}" },
});

/** Tailscale の拡張機能のサーバー側。tailscaled の LocalAPI（unixソケット上のHTTP）を読むだけで、経路は変えない */

let settings: Record<string, SettingValue> = {};

/**
 * Tailscaleノード状況。
 *
 * tailscaled はローカルのunixソケットにHTTP API(LocalAPI)を生やしているので、`tailscale` コマンドを
 * 呼び出さずに直接叩く（コンテナ内にtailscaleバイナリを置かずに済む。ソケットだけマウントすればよい）。
 *
 * **読み取り専用**にしている。exit nodeの切り替えはLocalAPIから可能だが、このダッシュボードはLAN上に
 * 認証なしで公開される前提であり、ホスト自身の経路を書き換える操作を無防備に晒すことになるため。
 * （実際にTailscaleのサブネットルート競合でLAN疎通が壊れた経験があるので、なおさら操作は手元に残す）
 */

interface LocalApiPeer {
  HostName?: string;
  DNSName?: string;
  OS?: string;
  TailscaleIPs?: string[];
  Online?: boolean;
  Active?: boolean;
  ExitNode?: boolean;
  ExitNodeOption?: boolean;
  LastSeen?: string;
  RxBytes?: number;
  TxBytes?: number;
  CurAddr?: string;
  Relay?: string;
}

interface LocalApiStatus {
  Version?: string;
  BackendState?: string;
  TailscaleIPs?: string[];
  MagicDNSSuffix?: string;
  Self?: LocalApiPeer;
  Peer?: Record<string, LocalApiPeer>;
}

/** unixソケット上のtailscaled LocalAPIにGETする */
function localApiGet(path: string, timeoutMs = 3000): Promise<LocalApiStatus> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath: String(settings.socketPath),
        path,
        method: "GET",
        // LocalAPIはHostヘッダを検証するので、この固定値でないと 403 になる
        headers: { Host: "local-tailscaled.sock" },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode !== 200) {
            reject(new Error(`tailscale localapi ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body) as LocalApiStatus);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error("tailscale localapi timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** "myhost.tailnet-name.ts.net." のようなDNS名から先頭のホスト名だけ取り出す */
function displayName(peer: LocalApiPeer): string {
  if (peer.HostName) return peer.HostName;
  return (peer.DNSName ?? "").split(".")[0] || "(unknown)";
}

function normalizePeer(peer: LocalApiPeer) {
  return {
    name: displayName(peer),
    dnsName: (peer.DNSName ?? "").replace(/\.$/, ""),
    os: peer.OS ?? "",
    ip: peer.TailscaleIPs?.[0] ?? "",
    online: peer.Online === true,
    active: peer.Active === true,
    isExitNode: peer.ExitNode === true,
    offersExitNode: peer.ExitNodeOption === true,
    lastSeen: peer.LastSeen && !peer.LastSeen.startsWith("0001-") ? peer.LastSeen : null,
    rxBytes: peer.RxBytes ?? 0,
    txBytes: peer.TxBytes ?? 0,
    /** 直接接続なら相手のアドレス、DERP経由なら空。Relayはリレー先リージョン */
    directAddr: peer.CurAddr ?? "",
    relay: peer.Relay ?? "",
  };
}

export default defineServerExtension({
  register(api) {
    settings = api.settings;
    api.route("GET", "/status", async (ctx) => {
      let status: LocalApiStatus;
      try {
        status = await localApiGet("/localapi/v0/status");
      } catch (err) {
        return {
          configured: false,
          reason: messages.t(ctx.locale, "cannotConnect", {
            socket: String(settings.socketPath),
            error: (err as Error).message,
          }),
        };
      }

      const peers = Object.values(status.Peer ?? {})
        .map(normalizePeer)
        .sort((a, b) => {
          if (a.online !== b.online) return a.online ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      const exitNode = peers.find((p) => p.isExitNode) ?? null;

      return {
        configured: true,
        version: status.Version ?? "",
        backendState: status.BackendState ?? "unknown",
        self: status.Self ? normalizePeer(status.Self) : null,
        exitNode: exitNode ? { name: exitNode.name, ip: exitNode.ip, online: exitNode.online } : null,
        onlineCount: peers.filter((p) => p.online).length,
        totalCount: peers.length,
        peers,
      };
    });
  },
});
