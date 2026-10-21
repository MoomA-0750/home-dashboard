import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// extensions/tailscale/src/server.ts
import { request as httpRequest } from "node:http";

// packages/extension-sdk/src/index.ts
function defineServerMessages(dicts) {
  return {
    t(locale, key, params) {
      const value = dicts[locale][key] ?? dicts.ja[key];
      if (typeof value === "function") return value(params ?? {});
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
    }
  };
}
function defineServerExtension(extension) {
  return extension;
}

// extensions/tailscale/src/server.ts
var messages = defineServerMessages({
  ja: { cannotConnect: "tailscaled\u306B\u63A5\u7D9A\u3067\u304D\u307E\u305B\u3093 ({socket}): {error}" },
  en: { cannotConnect: "Can't connect to tailscaled ({socket}): {error}" }
});
var settings = {};
function localApiGet(path, timeoutMs = 3e3) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath: String(settings.socketPath),
        path,
        method: "GET",
        // LocalAPIはHostヘッダを検証するので、この固定値でないと 403 になる
        headers: { Host: "local-tailscaled.sock" },
        timeout: timeoutMs
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode !== 200) {
            reject(new Error(`tailscale localapi ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("tailscale localapi timeout")));
    req.on("error", reject);
    req.end();
  });
}
function displayName(peer) {
  if (peer.HostName) return peer.HostName;
  return (peer.DNSName ?? "").split(".")[0] || "(unknown)";
}
function normalizePeer(peer) {
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
    relay: peer.Relay ?? ""
  };
}
var server_default = defineServerExtension({
  register(api) {
    settings = api.settings;
    api.route("GET", "/status", async (ctx) => {
      let status;
      try {
        status = await localApiGet("/localapi/v0/status");
      } catch (err) {
        return {
          configured: false,
          reason: messages.t(ctx.locale, "cannotConnect", {
            socket: String(settings.socketPath),
            error: err.message
          })
        };
      }
      const peers = Object.values(status.Peer ?? {}).map(normalizePeer).sort((a, b) => {
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
        peers
      };
    });
  }
});
export {
  server_default as default
};
