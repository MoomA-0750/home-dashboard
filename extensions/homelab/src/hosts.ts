import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError, type Locale } from "@home-dashboard/extension-sdk";
import { messages } from "./messages";

/**
 * 設定画面で登録するホスト。種類ごとに、リソースの読み方が違う（collectors.ts）。
 * - self … このダッシュボードが動いている機械（何も入れなくてよい）
 * - node-exporter … Prometheus の node_exporter を入れた機械（Linux など。/metrics を読む）
 * - proxmox … Proxmox VE の API（読むだけのトークン）
 * - ssh … SSH でつないで /proc と df を読む（Linux。相手に何も入れなくてよい。鍵は ssh.ts）
 * - tcp … リソースは読まず、決めた口に TCP でつながるかだけを見る
 * 記録は拡張機能のデータ置き場の hosts.json。Proxmox のトークンのシークレットは画面へは返さない。
 */

export const HOST_TYPES = ["self", "ssh", "node-exporter", "proxmox", "tcp"] as const;
export type HostType = (typeof HOST_TYPES)[number];

export interface HostConfig {
  id: string;
  name: string;
  type: HostType;
  /** ssh・tcp: 宛先（IP かホスト名） */
  host?: string;
  /** ssh・tcp: 口の番号 */
  port?: number;
  /** node-exporter: /metrics の URL。proxmox: https://…:8006 */
  url?: string;
  /** proxmox: どのノードを出すか（空なら最初のノード） */
  node?: string;
  /** ssh: つなぐユーザー */
  username?: string;
  tokenId?: string;
  tokenSecret?: string;
  /** proxmox: 証明書の指紋（SHA-256 の AB:CD:…）。ssh: ホスト鍵の指紋（SHA256:…） */
  fingerprint?: string;
}

/** 画面へ返す形（シークレットは入っているかだけ） */
export type PublicHostConfig = Omit<HostConfig, "tokenSecret"> & { hasTokenSecret: boolean };

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const MAX_HOSTS = 32;

export class HostStore {
  constructor(
    private readonly dataDir: string,
    /** 初めて読むときに取り込む、前の形（config/homelab-hosts.json の { name, host, port }[]） */
    private readonly legacyPath: string | null,
  ) {}

  private get path() {
    return join(this.dataDir, "hosts.json");
  }

  async list(): Promise<HostConfig[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf-8")) as { hosts?: HostConfig[] };
      return Array.isArray(parsed.hosts) ? parsed.hosts : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      return this.importLegacy();
    }
  }

  async listPublic(): Promise<PublicHostConfig[]> {
    return (await this.list()).map(toPublic);
  }

  async get(id: string): Promise<HostConfig | undefined> {
    return (await this.list()).find((h) => h.id === id);
  }

  async create(input: unknown, locale: Locale = "ja"): Promise<PublicHostConfig> {
    const hosts = await this.list();
    if (hosts.length >= MAX_HOSTS) throw new HttpError(400, messages.t(locale, "maxHosts", { max: MAX_HOSTS }));
    const host = validateHost({ ...(input as object), id: randomUUID() }, undefined, locale);
    await this.save([...hosts, host]);
    return toPublic(host);
  }

  async update(id: string, input: unknown, locale: Locale = "ja"): Promise<PublicHostConfig> {
    const hosts = await this.list();
    const index = hosts.findIndex((h) => h.id === id);
    if (index < 0) throw new HttpError(404, messages.t(locale, "hostNotFound"));
    const host = validateHost({ ...(input as object), id }, hosts[index], locale);
    hosts[index] = host;
    await this.save(hosts);
    return toPublic(host);
  }

  async remove(id: string, locale: Locale = "ja"): Promise<void> {
    const hosts = await this.list();
    if (!hosts.some((h) => h.id === id)) throw new HttpError(404, messages.t(locale, "hostNotFound"));
    await this.save(hosts.filter((h) => h.id !== id));
  }

  /** 並べ替え（ids の順にする。載っていないものは後ろに残す） */
  async reorder(ids: unknown): Promise<void> {
    if (!Array.isArray(ids)) throw new HttpError(400, "ids must be an array");
    const hosts = await this.list();
    const rank = (id: string) => {
      const i = ids.indexOf(id);
      return i < 0 ? ids.length : i;
    };
    await this.save([...hosts].sort((a, b) => rank(a.id) - rank(b.id)));
  }

  private async save(hosts: HostConfig[]): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.path, `${JSON.stringify({ hosts }, null, 2)}\n`, { mode: 0o600 });
    // トークンのシークレットが入るので、持ち主だけが読めるようにする（前からあったファイルにも）
    await chmod(this.path, 0o600).catch(() => undefined);
  }

  private async importLegacy(): Promise<HostConfig[]> {
    if (!this.legacyPath) return [];
    try {
      const legacy = JSON.parse(await readFile(this.legacyPath, "utf-8")) as {
        name: string;
        host: string;
        port: number;
      }[];
      const hosts = legacy.map((h) =>
        validateHost({ id: randomUUID(), name: h.name, type: "tcp", host: h.host, port: h.port }, undefined),
      );
      await this.save(hosts);
      return hosts;
    } catch {
      return [];
    }
  }
}

function toPublic({ tokenSecret, ...host }: HostConfig): PublicHostConfig {
  return { ...host, hasTokenSecret: Boolean(tokenSecret) };
}

const text = (value: unknown, max = 512) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function httpUrl(value: unknown, label: string, protocols: string[], locale: Locale): string {
  const raw = text(value, 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, messages.t(locale, "urlRequired", { label }));
  }
  if (!protocols.includes(url.protocol))
    throw new HttpError(
      400,
      messages.t(locale, "urlProtocol", { label, protocols: protocols.join(messages.t(locale, "or")) }),
    );
  return url.toString().replace(/\/$/, "");
}

/** 画面から来た値を確かめて、種類に要る項目だけを残す。シークレットが空なら前の値を残す */
export function validateHost(
  input: Record<string, unknown>,
  previous: HostConfig | undefined,
  locale: Locale = "ja",
): HostConfig {
  const m = (key: Parameters<typeof messages.t>[1]) => messages.t(locale, key);
  const id = text(input.id, 64);
  if (!ID_PATTERN.test(id)) throw new HttpError(400, "invalid host id");
  const name = text(input.name, 64);
  if (!name) throw new HttpError(400, m("nameRequired"));
  const type = input.type as HostType;
  if (!HOST_TYPES.includes(type)) throw new HttpError(400, m("typeRequired"));

  switch (type) {
    case "self":
      return { id, name, type };
    case "tcp": {
      const host = text(input.host, 253);
      if (!/^[A-Za-z0-9.:-]+$/.test(host)) throw new HttpError(400, m("hostInvalid"));
      const port = Number(input.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HttpError(400, m("portInvalid"));
      return { id, name, type, host, port };
    }
    case "ssh": {
      const host = text(input.host, 253);
      if (!/^[A-Za-z0-9.:-]+$/.test(host)) throw new HttpError(400, m("hostInvalid"));
      const port = input.port === undefined || input.port === "" ? 22 : Number(input.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HttpError(400, m("portInvalid"));
      const username = text(input.username, 32);
      if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(username)) throw new HttpError(400, m("usernameRequired"));
      const fingerprint = text(input.fingerprint, 100);
      if (fingerprint && !/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint))
        throw new HttpError(400, m("sshFingerprintFormat"));
      return { id, name, type, host, port, username, fingerprint };
    }
    case "node-exporter":
      return { id, name, type, url: httpUrl(input.url, m("nodeExporterUrl"), ["http:", "https:"], locale) };
    case "proxmox": {
      const tokenId = text(input.tokenId, 256);
      if (!/^[^@\s]+@[^!\s]+![^=\s]+$/.test(tokenId)) throw new HttpError(400, m("tokenIdFormat"));
      const tokenSecret = text(input.tokenSecret, 256) || (previous?.type === "proxmox" ? previous.tokenSecret : "");
      if (!tokenSecret) throw new HttpError(400, m("tokenSecretRequired"));
      const fingerprint = text(input.fingerprint, 200).toUpperCase();
      if (fingerprint && !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint))
        throw new HttpError(400, m("certFingerprintFormat"));
      const node = text(input.node, 64);
      return {
        id,
        name,
        type,
        url: httpUrl(input.url, m("proxmoxUrl"), ["https:"], locale),
        tokenId,
        tokenSecret,
        fingerprint,
        ...(node ? { node } : {}),
      };
    }
  }
}
