import { readFile } from "node:fs/promises";
import { connect } from "node:net";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

interface HostConfig {
  name: string;
  host: string;
  port: number;
}

interface HostStatus extends HostConfig {
  online: boolean;
  latencyMs: number | null;
}

const hostsConfigPath = join(config.configDir, "homelab-hosts.json");

async function readHostsConfig(): Promise<HostConfig[]> {
  try {
    const raw = await readFile(hostsConfigPath, "utf-8");
    return JSON.parse(raw) as HostConfig[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

function checkHost(host: HostConfig, timeoutMs = 3000): Promise<HostStatus> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = connect({ host: host.host, port: host.port, timeout: timeoutMs });

    const finish = (online: boolean) => {
      socket.destroy();
      resolve({ ...host, online, latencyMs: online ? Date.now() - start : null });
    };

    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function registerHomelabRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/homelab/status", async () => {
    const hosts = await readHostsConfig();
    const statuses = await Promise.all(hosts.map((h) => checkHost(h)));
    return { hosts: statuses };
  });
}
