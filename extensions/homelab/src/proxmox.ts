import { request } from "node:https";
import type { TLSSocket } from "node:tls";
import type { Locale } from "@home-dashboard/extension-sdk";
import type { HostConfig } from "./hosts";
import { messages } from "./messages";
import type { Resources } from "./resources";

/**
 * Proxmox VE の API（読むだけ）。ノードの CPU・メモリ・ディスク・連続稼働時間と、そのノードの VM・コンテナの数を読む。
 * Proxmox の証明書は Proxmox 自身の発行（自己署名）なので、登録した指紋（SHA-256）と同じ証明書のときだけ話す。
 */

export class ProxmoxError extends Error {
  constructor(
    message: string,
    /** 指紋が無い・違うときの、つないだ先の指紋（登録してもらう） */
    readonly observedFingerprint?: string,
  ) {
    super(message);
  }
}

const normalizeFingerprint = (value: string) => value.replace(/[^0-9a-f]/gi, "").toUpperCase();

function getJson(host: HostConfig, path: string, locale: Locale): Promise<unknown> {
  const m = (key: Parameters<typeof messages.t>[1], params?: Record<string, string | number>) =>
    messages.t(locale, key, params);
  const base = new URL(String(host.url));
  const expected = normalizeFingerprint(host.fingerprint ?? "");
  return new Promise((resolve, reject) => {
    const req = request(
      new URL(`/api2/json${path}`, base),
      {
        method: "GET",
        headers: { Authorization: `PVEAPIToken=${host.tokenId}=${host.tokenSecret}` },
        // 自己署名なので CA では確かめず、下で指紋を比べる
        rejectUnauthorized: false,
        // TLS のセッションを使い回すと、つないだ先の証明書が取れず指紋を比べられないので、毎回つなぎ直す
        agent: false,
        timeout: 8000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode === 401) return reject(new ProxmoxError(m("tokenRejected")));
          if (res.statusCode === 403) return reject(new ProxmoxError(m("tokenNoPermission")));
          if (!res.statusCode || res.statusCode >= 400)
            return reject(new ProxmoxError(m("proxmoxStatus", { status: String(res.statusCode) })));
          try {
            resolve((JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { data: unknown }).data);
          } catch {
            reject(new ProxmoxError(m("proxmoxUnreadable")));
          }
        });
      },
    );
    // トークンを送る前（つないだ直後）に証明書の指紋を比べ、違えば切る
    req.on("socket", (socket) => {
      socket.once("secureConnect", () => {
        const observed = (socket as TLSSocket).getPeerCertificate().fingerprint256 ?? "";
        if (!expected) {
          req.destroy(new ProxmoxError(m("certNotRegistered"), observed));
        } else if (normalizeFingerprint(observed) !== expected) {
          req.destroy(new ProxmoxError(m("certMismatch"), observed));
        }
      });
    });
    req.on("timeout", () => req.destroy(new ProxmoxError(m("noReply", { host: base.host }))));
    req.on("error", (err) =>
      reject(err instanceof ProxmoxError ? err : new ProxmoxError(m("cannotConnect", { host: base.host }))),
    );
    req.end();
  });
}

interface RawNode {
  node: string;
  status?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export async function readProxmox(
  host: HostConfig,
  locale: Locale = "ja",
): Promise<{ online: boolean; nodeName: string; resources: Resources; guests: { running: number; total: number } }> {
  const [nodes, guests] = await Promise.all([
    getJson(host, "/nodes", locale) as Promise<RawNode[]>,
    getJson(host, "/cluster/resources?type=vm", locale) as Promise<
      { status?: string; template?: number; node?: string }[]
    >,
  ]);
  const sorted = [...nodes].sort((a, b) => a.node.localeCompare(b.node));
  const node = host.node ? sorted.find((n) => n.node === host.node) : sorted[0];
  if (!node)
    throw new ProxmoxError(
      host.node ? messages.t(locale, "nodeNotFound", { node: host.node }) : messages.t(locale, "noNodes"),
    );
  const own = guests.filter((g) => !g.template && (!g.node || g.node === node.node));
  return {
    online: node.status === "online",
    nodeName: node.node,
    resources: {
      cpu: num(node.cpu),
      cores: num(node.maxcpu),
      memUsed: num(node.mem),
      memTotal: num(node.maxmem),
      diskUsed: num(node.disk),
      diskTotal: num(node.maxdisk),
      uptimeSec: num(node.uptime),
      load1: null,
    },
    guests: { running: own.filter((g) => g.status === "running").length, total: own.length },
  };
}

/** 設定画面の「接続を確かめる」。ノードの名前を返す */
export async function listProxmoxNodes(host: HostConfig, locale: Locale = "ja"): Promise<string[]> {
  const nodes = (await getJson(host, "/nodes", locale)) as RawNode[];
  return nodes.map((n) => n.node).sort();
}
