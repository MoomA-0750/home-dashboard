import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError, type Locale } from "@home-dashboard/extension-sdk";
import { messages } from "./messages";
import type { MachineConfig, MachineType } from "./types";

/**
 * 設定画面で登録する機械。記録は拡張機能のデータ置き場の machines.json。
 * - ssh … SSH でつないで、相手の仲介スクリプトを動かす（この機械も、Docker の中からはこれでつなぐ）
 * - self … ダッシュボードのサーバーと同じ機械で、仲介スクリプトをそのまま動かす（Docker に入れずに動かすとき）
 */

export const MACHINE_TYPES: MachineType[] = ["ssh", "self"];
const MAX_MACHINES = 16;

export class MachineStore {
  constructor(private readonly dataDir: string) {}

  private get path() {
    return join(this.dataDir, "machines.json");
  }

  async list(): Promise<MachineConfig[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf-8")) as { machines?: MachineConfig[] };
      return Array.isArray(parsed.machines) ? parsed.machines : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      return [];
    }
  }

  async get(id: string, locale: Locale = "ja"): Promise<MachineConfig> {
    const machine = (await this.list()).find((m) => m.id === id);
    if (!machine) throw new HttpError(404, messages.t(locale, "machineNotFound"));
    return machine;
  }

  async create(input: unknown, locale: Locale = "ja"): Promise<MachineConfig> {
    const machines = await this.list();
    if (machines.length >= MAX_MACHINES) throw new HttpError(400, messages.t(locale, "maxMachines", { max: MAX_MACHINES }));
    const machine = validateMachine({ ...(input as object), id: randomUUID() }, locale);
    await this.save([...machines, machine]);
    return machine;
  }

  async update(id: string, input: unknown, locale: Locale = "ja"): Promise<MachineConfig> {
    const machines = await this.list();
    const index = machines.findIndex((m) => m.id === id);
    if (index < 0) throw new HttpError(404, messages.t(locale, "machineNotFound"));
    const machine = validateMachine({ ...(input as object), id }, locale);
    machines[index] = machine;
    await this.save(machines);
    return machine;
  }

  async remove(id: string, locale: Locale = "ja"): Promise<void> {
    const machines = await this.list();
    if (!machines.some((m) => m.id === id)) throw new HttpError(404, messages.t(locale, "machineNotFound"));
    await this.save(machines.filter((m) => m.id !== id));
  }

  private async save(machines: MachineConfig[]): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.path, `${JSON.stringify({ machines }, null, 2)}\n`, { mode: 0o600 });
    await chmod(this.path, 0o600).catch(() => undefined);
  }
}

const text = (value: unknown, max = 512) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** 画面から来た値を確かめて、種類に要る項目だけを残す */
export function validateMachine(input: Record<string, unknown>, locale: Locale = "ja"): MachineConfig {
  const m = (key: Parameters<typeof messages.t>[1]) => messages.t(locale, key);
  const id = text(input.id, 64);
  if (!/^[a-z0-9-]{1,64}$/.test(id)) throw new HttpError(400, "invalid machine id");
  const name = text(input.name, 64);
  if (!name) throw new HttpError(400, m("nameRequired"));
  const type = input.type as MachineType;
  if (!MACHINE_TYPES.includes(type)) throw new HttpError(400, m("typeRequired"));
  if (type === "self") return { id, name, type };
  const host = text(input.host, 253);
  if (!/^[A-Za-z0-9.:-]+$/.test(host)) throw new HttpError(400, m("hostInvalid"));
  const port = input.port === undefined || input.port === "" || input.port === null ? 22 : Number(input.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HttpError(400, m("portInvalid"));
  const username = text(input.username, 32);
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(username)) throw new HttpError(400, m("usernameRequired"));
  const fingerprint = text(input.fingerprint, 100);
  if (fingerprint && !/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint)) throw new HttpError(400, m("sshFingerprintFormat"));
  return { id, name, type, host, port, username, fingerprint };
}
