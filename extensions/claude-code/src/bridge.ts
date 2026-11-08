import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
// ssh2 は CommonJS なので、名前を指定せずに読み込む
import ssh2 from "ssh2";
import type { MachineConfig } from "./types";

/**
 * 機械の側の仲介スクリプト（assets/hd-claude-bridge.py）を動かす。
 * - ssh … 機械ごとに SSH のつながりを1本持ち続け、命令ごとに exec する（つなぎ直しの手間を省く。切れたら次の命令でつなぎ直す）。
 *   相手の authorized_keys は command= でスクリプトに縛るので、exec に渡す文字はスクリプトの SSH_ORIGINAL_COMMAND になる
 * - self … 同じ機械で python3 をそのまま動かす
 * 引数は標準入力の JSON で渡し、答えは JSON を1つ受け取る。
 */

export const BRIDGE_VERSION = 1;
export const BRIDGE_FILE = "hd-claude-bridge.py";
export const REMOTE_COMMAND = `python3 ~/.local/bin/${BRIDGE_FILE}`;

const { Client, utils } = ssh2;

/** つながらない・スクリプトが失敗した。code は messages の鍵（仲介スクリプトの error もそのまま） */
export class BridgeFailure extends Error {
  constructor(
    readonly code: string,
    readonly detail: string = "",
    /** ホスト鍵の指紋が無い・違うときの、つないだ先の指紋（登録してもらう） */
    readonly observedFingerprint?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** 同じ機械で動かすときの、仲介スクリプトの置き場（拡張機能のデータ置き場に書き出す） */
export function selfScriptPath(dataDir: string): string {
  return join(dataDir, BRIDGE_FILE);
}

/** 仲介スクリプトを書き出す（中身が変わったときだけ）。同じ機械で動かすときに使う */
export async function writeSelfScript(dataDir: string, source: string): Promise<string> {
  const path = selfScriptPath(dataDir);
  const current = await readFile(path, "utf-8").catch(() => null);
  if (current !== source) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source, { mode: 0o700 });
  }
  return path;
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

let keyPair: Promise<KeyPair> | null = null;

/** ダッシュボードの鍵（この拡張機能だけのもの）。無ければ作る（ed25519） */
export function ensureKeyPair(dataDir: string): Promise<KeyPair> {
  if (!keyPair) {
    keyPair = loadOrCreateKeyPair(dataDir);
    keyPair.catch(() => (keyPair = null));
  }
  return keyPair;
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
  const pair = utils.generateKeyPairSync("ed25519", {
    comment: "home-dashboard-claude-code",
  });
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(privatePath, pair.private, { mode: 0o600 });
  await chmod(privatePath, 0o600);
  await writeFile(`${privatePath}.pub`, `${pair.public.trim()}\n`);
  return { privateKey: pair.private, publicKey: `${pair.public.trim()}\n` };
}

/**
 * 相手の ~/.ssh/authorized_keys に足してもらう1行。restrict で転送・端末を止め、command= で仲介スクリプトしか動かせなくする
 */
export function authorizedKeysLine(publicKey: string): string {
  return `command="${REMOTE_COMMAND}",restrict ${publicKey.trim()}`;
}

export function sshFingerprint(key: Buffer): string {
  return `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
}

interface Connection {
  client: InstanceType<typeof Client>;
  ready: Promise<void>;
  /** つないだときの設定（変わったらつなぎ直す） */
  signature: string;
}

const connections = new Map<string, Connection>();

function signatureOf(machine: MachineConfig): string {
  return JSON.stringify([machine.host, machine.port, machine.username, machine.fingerprint]);
}

/** 設定を変えた・消した機械のつながりを切る */
export function dropConnection(id: string): void {
  const existing = connections.get(id);
  if (existing) {
    connections.delete(id);
    existing.client.end();
  }
}

export function dropAllConnections(): void {
  for (const id of [...connections.keys()]) dropConnection(id);
}

function connect(machine: MachineConfig, keys: KeyPair, timeoutMs: number): Connection {
  const signature = signatureOf(machine);
  const existing = connections.get(machine.id);
  if (existing && existing.signature === signature) return existing;
  if (existing) dropConnection(machine.id);

  const client = new Client();
  const expected = (machine.fingerprint ?? "").trim();
  let failure: BridgeFailure | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    client.on("ready", () => resolve());
    client.on("error", (err: Error & { level?: string }) => {
      if (connections.get(machine.id)?.client === client) connections.delete(machine.id);
      if (failure) return reject(failure);
      if (err.level === "client-authentication") return reject(new BridgeFailure("keyRejected"));
      if (err.level === "client-timeout") return reject(new BridgeFailure("noReply"));
      reject(new BridgeFailure("cannotConnect", err.message));
    });
    client.on("close", () => {
      if (connections.get(machine.id)?.client === client) connections.delete(machine.id);
      reject(failure ?? new BridgeFailure("cannotConnect"));
    });
  });
  // 失敗を誰も待っていないときに、処理されない Promise の失敗として落ちないようにする
  ready.catch(() => undefined);
  client.connect({
    host: machine.host,
    port: machine.port ?? 22,
    username: machine.username,
    privateKey: keys.privateKey,
    readyTimeout: timeoutMs,
    keepaliveInterval: 20_000,
    keepaliveCountMax: 3,
    // ホスト鍵を指紋で確かめる。違えば、鍵で名乗る前に切る
    hostVerifier: (key: Buffer) => {
      const observed = sshFingerprint(key);
      if (!expected) failure = new BridgeFailure("hostKeyNotRegistered", "", observed);
      else if (observed !== expected) failure = new BridgeFailure("hostKeyMismatch", "", observed);
      return failure === null;
    },
  });
  const connection = { client, ready, signature };
  connections.set(machine.id, connection);
  return connection;
}

function parseReply<T>(output: string, stderr: string): T {
  const line = output.trim().split("\n").pop() ?? "";
  let parsed: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    parsed = JSON.parse(line);
  } catch {
    // python3 もスクリプトも無いと、シェルのエラーだけが返る
    if (/not found|No such file|can't open/i.test(stderr + output)) throw new BridgeFailure("bridgeMissing");
    throw new BridgeFailure("bridgeUnreadable", (stderr || output).trim().slice(0, 200));
  }
  if (!parsed.ok) throw new BridgeFailure(String(parsed.error ?? "failed"));
  return parsed as T;
}

async function execSsh(machine: MachineConfig, keys: KeyPair, command: string, input: string, timeoutMs: number) {
  const connection = connect(machine, keys, timeoutMs);
  await connection.ready;
  return new Promise<{ out: string; err: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BridgeFailure("noReply")), timeoutMs);
    connection.client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        // つながりが古くなっていた。次の命令でつなぎ直す
        dropConnection(machine.id);
        return reject(new BridgeFailure("cannotConnect", err.message));
      }
      const out: Buffer[] = [];
      const errOut: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => out.push(chunk));
      stream.stderr.on("data", (chunk: Buffer) => errOut.push(chunk));
      stream.on("close", () => {
        clearTimeout(timer);
        resolve({
          out: Buffer.concat(out).toString("utf-8"),
          err: Buffer.concat(errOut).toString("utf-8"),
        });
      });
      stream.end(input);
    });
  });
}

function execSelf(script: string, command: string, input: string, timeoutMs: number) {
  return new Promise<{ out: string; err: string }>((resolve, reject) => {
    const child = spawn("python3", [script, command], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const errOut: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new BridgeFailure("noReply"));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errOut.push(chunk));
    child.on("error", () => {
      clearTimeout(timer);
      reject(new BridgeFailure("bridgeMissing"));
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve({
        out: Buffer.concat(out).toString("utf-8"),
        err: Buffer.concat(errOut).toString("utf-8"),
      });
    });
    child.stdin.end(input);
  });
}

/**
 * 仲介スクリプトの命令を1つ動かす。同じ機械（self）では、script（書き出したスクリプトの道）を python3 で動かす
 */
export async function runBridge<T>(
  machine: MachineConfig,
  dataDir: string,
  command: string,
  args: Record<string, unknown> = {},
  timeoutMs = 20_000,
  script = selfScriptPath(dataDir),
): Promise<T> {
  const input = JSON.stringify(args);
  const { out, err } =
    machine.type === "self"
      ? await execSelf(script, command, input, timeoutMs)
      : await execSsh(machine, await ensureKeyPair(dataDir), command, input, timeoutMs);
  return parseReply<T>(out, err);
}
