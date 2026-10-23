import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
// ssh2 は CommonJS なので、名前を指定せずに読み込む（node の ESM からは utils などを名前で取り出せない）
import ssh2 from "ssh2";
import type { Locale } from "@home-dashboard/extension-sdk";
import type { HostConfig } from "./hosts";
import { messages } from "./messages";
import type { Resources } from "./resources";

/**
 * SSH でつないでリソースを読む（Linux の機械。相手に何も入れなくてよい）。
 * - 鍵はダッシュボードが1組作り（拡張機能のデータ置き場の ssh/）、公開鍵を設定画面に出す
 * - 相手の authorized_keys には command= で REMOTE_COMMAND に固定して登録してもらう（鍵が漏れても、リソースを読む以外のことはできない）
 * - 相手のホスト鍵は、登録した指紋（OpenSSH と同じ SHA256:…）と同じときだけ話す
 */

/** 相手で動かすコマンド。CPU・メモリ・稼働時間・ロード・コア数・ルートのディスク */
export const REMOTE_COMMAND = "head -n1 /proc/stat; cat /proc/meminfo /proc/uptime /proc/loadavg; nproc; df -kP /";

const { Client, utils } = ssh2;

export class SshError extends Error {
  constructor(
    message: string,
    /** ホスト鍵の指紋が無い・違うときの、つないだ先の指紋（登録してもらう） */
    readonly observedFingerprint?: string,
  ) {
    super(message);
  }
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

const keyPairs = new Map<string, Promise<KeyPair>>();

/** ダッシュボードの鍵。無ければ作る（ed25519）。同時に呼ばれても作るのは1回だけ */
export function ensureKeyPair(dataDir: string): Promise<KeyPair> {
  let pending = keyPairs.get(dataDir);
  if (!pending) {
    pending = loadOrCreateKeyPair(dataDir);
    keyPairs.set(dataDir, pending);
    pending.catch(() => keyPairs.delete(dataDir));
  }
  return pending;
}

async function loadOrCreateKeyPair(dataDir: string): Promise<KeyPair> {
  const dir = join(dataDir, "ssh");
  const privatePath = join(dir, "id_ed25519");
  try {
    return {
      privateKey: await readFile(privatePath, "utf-8"),
      publicKey: await readFile(`${privatePath}.pub`, "utf-8"),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const pair = utils.generateKeyPairSync("ed25519", { comment: "home-dashboard-homelab" });
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(privatePath, pair.private, { mode: 0o600 });
  await chmod(privatePath, 0o600);
  await writeFile(`${privatePath}.pub`, `${pair.public.trim()}\n`);
  return { privateKey: pair.private, publicKey: `${pair.public.trim()}\n` };
}

/** 相手の ~/.ssh/authorized_keys に足してもらう1行 */
export function authorizedKeysLine(publicKey: string): string {
  return `command="${REMOTE_COMMAND}",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ${publicKey.trim()}`;
}

/** ホスト鍵の指紋（ssh-keygen -l と同じ「SHA256:」＋末尾の = を除いた base64） */
export function sshFingerprint(key: Buffer): string {
  return `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
}

/** SSH でつないで REMOTE_COMMAND の出力を返す */
export function runRemote(
  host: HostConfig,
  keyPair: KeyPair,
  timeoutMs = 10_000,
  locale: Locale = "ja",
): Promise<string> {
  const m = (key: Parameters<typeof messages.t>[1], params?: Record<string, string>) => messages.t(locale, key, params);
  const expected = (host.fingerprint ?? "").trim();
  return new Promise((resolve, reject) => {
    const client = new Client();
    let failure: SshError | null = null;
    let settled = false;
    const done = (err: SshError | null, output?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.end();
      if (err) reject(err);
      else resolve(output ?? "");
    };
    const timer = setTimeout(() => done(new SshError(m("noReply", { host: String(host.host) }))), timeoutMs);

    client.on("ready", () => {
      client.exec(REMOTE_COMMAND, (err, stream) => {
        if (err) return done(new SshError(m("commandFailed")));
        let output = "";
        stream.on("data", (chunk: Buffer) => (output += chunk.toString("utf-8")));
        stream.stderr.on("data", () => undefined);
        stream.on("close", () => done(null, output));
      });
    });
    client.on("error", (err: Error & { level?: string }) => {
      if (failure) return done(failure);
      if (err.level === "client-authentication") return done(new SshError(m("keyRejected")));
      done(new SshError(m("cannotConnect", { host: String(host.host) })));
    });
    client.connect({
      host: host.host,
      port: host.port ?? 22,
      username: host.username,
      privateKey: keyPair.privateKey,
      readyTimeout: timeoutMs,
      // ホスト鍵を指紋で確かめる。違えば、鍵で名乗る前に切る
      hostVerifier: (key: Buffer) => {
        const observed = sshFingerprint(key);
        if (!expected) failure = new SshError(m("hostKeyNotRegistered"), observed);
        else if (observed !== expected) failure = new SshError(m("hostKeyMismatch"), observed);
        return failure === null;
      },
    });
  });
}

export interface ProcSnapshot {
  cpu: { idle: number; total: number } | null;
  resources: Omit<Resources, "cpu">;
}

/** REMOTE_COMMAND の出力を読む */
export function parseRemoteOutput(output: string): ProcSnapshot {
  const lines = output.split("\n").map((l) => l.trim());
  const cpuLine = lines.find((l) => l.startsWith("cpu "));
  let cpu: ProcSnapshot["cpu"] = null;
  if (cpuLine) {
    const values = cpuLine.split(/\s+/).slice(1).map(Number);
    cpu = {
      idle: (values[3] ?? 0) + (values[4] ?? 0),
      total: values.slice(0, 8).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0),
    };
  }
  const kb = (name: string) => {
    const value = Number(lines.find((l) => l.startsWith(`${name}:`))?.match(/(\d+)\s*kB/)?.[1]);
    return Number.isFinite(value) ? value * 1024 : null;
  };
  const memTotal = kb("MemTotal");
  const memAvailable = kb("MemAvailable");
  const uptime = lines.find((l) => /^\d+(\.\d+)? \d+(\.\d+)?$/.test(l));
  const loadavg = lines.find((l) => /^\d+\.\d+ \d+\.\d+ \d+\.\d+ \d+\/\d+ \d+$/.test(l));
  const nproc = lines.find((l) => /^\d+$/.test(l));
  // df -kP の行（見出しの次。1024 バイト単位）
  const dfIndex = lines.findIndex((l) => l.startsWith("Filesystem"));
  const df = dfIndex >= 0 ? lines[dfIndex + 1]?.split(/\s+/) : undefined;
  const diskTotal = df ? Number(df[1]) * 1024 : null;
  const diskAvail = df ? Number(df[3]) * 1024 : null;
  return {
    cpu,
    resources: {
      cores: nproc ? Number(nproc) : null,
      memUsed: memTotal !== null && memAvailable !== null ? memTotal - memAvailable : null,
      memTotal,
      diskUsed: diskTotal !== null && diskAvail !== null && Number.isFinite(diskTotal) ? diskTotal - diskAvail : null,
      diskTotal: diskTotal !== null && Number.isFinite(diskTotal) ? diskTotal : null,
      uptimeSec: uptime ? Math.round(Number(uptime.split(" ")[0])) : null,
      load1: loadavg ? Number(loadavg.split(" ")[0]) : null,
    },
  };
}
