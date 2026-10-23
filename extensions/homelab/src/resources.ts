import { readFile, statfs } from "node:fs/promises";
import { connect } from "node:net";
import { cpus, loadavg, uptime } from "node:os";
import type { Locale } from "@home-dashboard/extension-sdk";
import type { HostConfig, HostType } from "./hosts";
import { messages } from "./messages";
import { listProxmoxNodes, ProxmoxError, readProxmox } from "./proxmox";
import { ensureKeyPair, parseRemoteOutput, runRemote, SshError } from "./ssh";

/** ホストのリソース。読めないものは null */
export interface Resources {
  /** CPU の使用率（0〜1） */
  cpu: number | null;
  cores: number | null;
  memUsed: number | null;
  memTotal: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  /** 連続稼働時間（秒） */
  uptimeSec: number | null;
  /** 1分のロードアベレージ */
  load1: number | null;
}

export interface HostStatus {
  id: string;
  name: string;
  type: HostType;
  /** 画面に出す宛先（IP:口・URL など） */
  address: string;
  online: boolean;
  /** tcp のときの、つながるまでの時間 */
  latencyMs: number | null;
  /** 読めなかった理由（詳細に出す） */
  error: string | null;
  resources: Resources | null;
  /** proxmox のときの VM・コンテナの数 */
  guests: { running: number; total: number } | null;
}

// --- CPU の使用率は、2回の読み取りの差で出す。前回の値を覚えておき、初めてのときだけ少し待って2回読む ---

interface CpuSample {
  idle: number;
  total: number;
}

const lastCpu = new Map<string, CpuSample>();

async function cpuUsage(key: string, read: () => Promise<CpuSample | null>): Promise<number | null> {
  let previous = lastCpu.get(key);
  if (!previous) {
    const first = await read();
    if (!first) return null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    previous = first;
  }
  const current = await read();
  if (!current) return null;
  lastCpu.set(key, current);
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  return total > 0 ? Math.min(1, Math.max(0, 1 - idle / total)) : null;
}

// --- この機械（ダッシュボードの入れ物の中からでも、/proc と os はホストの値を返す） ---

async function readProcStat(): Promise<CpuSample | null> {
  try {
    const line = (await readFile("/proc/stat", "utf-8")).split("\n").find((l) => l.startsWith("cpu "));
    if (!line) return null;
    const values = line.trim().split(/\s+/).slice(1).map(Number);
    // user nice system idle iowait irq softirq steal …
    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    return { idle, total: values.slice(0, 8).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0) };
  } catch {
    return null;
  }
}

async function readMeminfo(): Promise<{ used: number; total: number } | null> {
  try {
    const text = await readFile("/proc/meminfo", "utf-8");
    const kb = (name: string) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+) kB`, "m"))?.[1]) * 1024;
    const total = kb("MemTotal");
    const available = kb("MemAvailable");
    return Number.isFinite(total) && Number.isFinite(available) ? { used: total - available, total } : null;
  } catch {
    return null;
  }
}

/** diskPath … 容量を測るファイルシステムの場所（ダッシュボードのデータ置き場。入れ物の中でもホストのディスクに載っている） */
export async function readSelf(diskPath: string): Promise<Resources> {
  const [cpu, mem, disk] = await Promise.all([
    cpuUsage("self", readProcStat),
    readMeminfo(),
    statfs(diskPath).catch(() => null),
  ]);
  return {
    cpu,
    cores: cpus().length || null,
    memUsed: mem?.used ?? null,
    memTotal: mem?.total ?? null,
    diskUsed: disk ? (disk.blocks - disk.bfree) * disk.bsize : null,
    diskTotal: disk ? disk.blocks * disk.bsize : null,
    uptimeSec: Math.round(uptime()),
    load1: loadavg()[0] ?? null,
  };
}

// --- node_exporter（/metrics の文字を読む） ---

interface Metric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export function parseMetrics(text: string): Metric[] {
  const metrics: Metric[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(\S+)/);
    if (!match) continue;
    const labels: Record<string, string> = {};
    for (const pair of (match[3] ?? "").matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g))
      labels[pair[1]] = pair[2];
    metrics.push({ name: match[1], labels, value: Number(match[4]) });
  }
  return metrics;
}

async function fetchMetrics(url: string, locale: Locale): Promise<Metric[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(messages.t(locale, "nodeExporterStatus", { status: res.status }));
  return parseMetrics(await res.text());
}

function cpuFromMetrics(metrics: Metric[]): CpuSample | null {
  const cpu = metrics.filter((m) => m.name === "node_cpu_seconds_total");
  if (cpu.length === 0) return null;
  const idle = cpu
    .filter((m) => m.labels.mode === "idle" || m.labels.mode === "iowait")
    .reduce((s, m) => s + m.value, 0);
  return { idle, total: cpu.reduce((s, m) => s + m.value, 0) };
}

/** node_exporter の値からリソースを出す。CPU だけは前回との差が要るので、cpu に渡す */
export function resourcesFromMetrics(metrics: Metric[], cpu: number | null): Resources {
  const one = (name: string, labels: Record<string, string> = {}) =>
    metrics.find((m) => m.name === name && Object.entries(labels).every(([k, v]) => m.labels[k] === v))?.value ?? null;
  const memTotal = one("node_memory_MemTotal_bytes");
  const memAvailable = one("node_memory_MemAvailable_bytes");
  const diskTotal = one("node_filesystem_size_bytes", { mountpoint: "/" });
  const diskAvail = one("node_filesystem_avail_bytes", { mountpoint: "/" });
  const now = one("node_time_seconds");
  const boot = one("node_boot_time_seconds");
  const cores = new Set(metrics.filter((m) => m.name === "node_cpu_seconds_total").map((m) => m.labels.cpu)).size;
  return {
    cpu,
    cores: cores || null,
    memUsed: memTotal !== null && memAvailable !== null ? memTotal - memAvailable : null,
    memTotal,
    diskUsed: diskTotal !== null && diskAvail !== null ? diskTotal - diskAvail : null,
    diskTotal,
    uptimeSec: now !== null && boot !== null ? Math.round(now - boot) : null,
    load1: one("node_load1"),
  };
}

async function readNodeExporter(host: HostConfig, locale: Locale): Promise<Resources> {
  let latest: Metric[] = [];
  const cpu = await cpuUsage(host.id, async () => {
    latest = await fetchMetrics(String(host.url), locale);
    return cpuFromMetrics(latest);
  });
  return resourcesFromMetrics(latest, cpu);
}

// --- 応答だけ（TCP でつながるか） ---

export function checkTcp(host: string, port: number, timeoutMs = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = connect({ host, port, timeout: timeoutMs });
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok ? Date.now() - start : null);
    };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export function addressOf(host: HostConfig, locale: Locale = "ja"): string {
  if (host.type === "tcp") return `${host.host}:${host.port}`;
  if (host.type === "ssh")
    return `${host.username}@${host.host}${host.port && host.port !== 22 ? `:${host.port}` : ""}`;
  if (host.type === "self") return messages.t(locale, "thisMachine");
  try {
    return new URL(String(host.url)).host;
  } catch {
    return String(host.url ?? "");
  }
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** SSH で読む。CPU は前回との差で出す（初めてのときは2回読む） */
async function readSsh(host: HostConfig, dataDir: string, locale: Locale): Promise<Resources> {
  const keyPair = await ensureKeyPair(dataDir);
  let latest: ReturnType<typeof parseRemoteOutput> | null = null;
  const cpu = await cpuUsage(host.id, async () => {
    latest = parseRemoteOutput(await runRemote(host, keyPair, undefined, locale));
    return latest.cpu;
  });
  if (!latest) throw new SshError(messages.t(locale, "unreadable"));
  return { cpu, ...(latest as ReturnType<typeof parseRemoteOutput>).resources };
}

/** diskPath … 拡張機能のデータ置き場（この機械のディスクを測る場所で、SSH の鍵の置き場でもある） */
export async function readHost(host: HostConfig, diskPath: string, locale: Locale = "ja"): Promise<HostStatus> {
  const base = {
    id: host.id,
    name: host.name,
    type: host.type,
    address: addressOf(host, locale),
    latencyMs: null,
    error: null,
    resources: null,
    guests: null,
  };
  try {
    switch (host.type) {
      case "self":
        return { ...base, online: true, resources: await readSelf(diskPath) };
      case "tcp": {
        const latencyMs = await checkTcp(String(host.host), Number(host.port));
        return {
          ...base,
          online: latencyMs !== null,
          latencyMs,
          error: latencyMs === null ? messages.t(locale, "noResponse") : null,
        };
      }
      case "node-exporter":
        return { ...base, online: true, resources: await readNodeExporter(host, locale) };
      case "ssh":
        return { ...base, online: true, resources: await readSsh(host, diskPath, locale) };
      case "proxmox": {
        const result = await readProxmox(host, locale);
        return { ...base, online: result.online, resources: result.resources, guests: result.guests };
      }
    }
  } catch (err) {
    return { ...base, online: false, error: messageOf(err) };
  }
}

/** 設定画面の「接続を確かめる」。Proxmox・SSH で指紋が無い・違うときは、つないだ先の指紋も返す */
export async function testHost(
  host: HostConfig,
  diskPath: string,
  locale: Locale = "ja",
): Promise<{ ok: boolean; message: string; fingerprint?: string; nodes?: string[] }> {
  const m = (key: Parameters<typeof messages.t>[1], params?: Record<string, string | number>) =>
    messages.t(locale, key, params);
  try {
    if (host.type === "proxmox") {
      const nodes = await listProxmoxNodes(host, locale);
      return { ok: true, message: m("connectedNodes", { nodes: nodes.join(m("nodeSeparator")) }), nodes };
    }
    if (host.type === "ssh") {
      const snapshot = parseRemoteOutput(await runRemote(host, await ensureKeyPair(diskPath), undefined, locale));
      if (snapshot.resources.memTotal === null) return { ok: false, message: m("connectedNoProc") };
      return { ok: true, message: m("connected") };
    }
    const status = await readHost(host, diskPath, locale);
    if (status.error) return { ok: false, message: status.error };
    if (host.type === "tcp") return { ok: true, message: m("connectedLatency", { ms: String(status.latencyMs) }) };
    return { ok: true, message: m("readOk") };
  } catch (err) {
    if ((err instanceof ProxmoxError || err instanceof SshError) && err.observedFingerprint)
      return { ok: false, message: err.message, fingerprint: err.observedFingerprint };
    return { ok: false, message: messageOf(err) };
  }
}
