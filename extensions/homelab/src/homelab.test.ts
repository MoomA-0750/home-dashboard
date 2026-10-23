import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:https";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { HostStore, type HostConfig } from "./hosts";
import { parseMetrics, readHost, readSelf, resourcesFromMetrics, testHost } from "./resources";
import ssh2 from "ssh2";
import { authorizedKeysLine, ensureKeyPair, REMOTE_COMMAND, sshFingerprint } from "./ssh";

const dir = await mkdtemp(join(tmpdir(), "homelab-"));

// 偽の Proxmox。自己署名の証明書で、トークンが合うときだけノードと VM を返す
execFileSync(
  "openssl",
  ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=fake-pve"].concat([
    "-keyout",
    join(dir, "key.pem"),
    "-out",
    join(dir, "cert.pem"),
  ]),
  { stdio: "ignore" },
);
const fingerprint = execFileSync("openssl", ["x509", "-in", join(dir, "cert.pem"), "-noout", "-fingerprint", "-sha256"])
  .toString()
  .split("=")[1]
  .trim();
let pveRequests = 0;
const pve = createServer(
  { key: await readFile(join(dir, "key.pem")), cert: await readFile(join(dir, "cert.pem")) },
  (req, res) => {
    pveRequests += 1;
    if (req.headers.authorization !== "PVEAPIToken=root@pam!dash=secret") {
      res.writeHead(401);
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.url === "/api2/json/nodes")
      return res.end(
        JSON.stringify({
          data: [
            { node: "pve2", status: "online", cpu: 0.5, maxcpu: 4, mem: 1, maxmem: 2, disk: 1, maxdisk: 2, uptime: 10 },
            {
              node: "pve",
              status: "online",
              cpu: 0.25,
              maxcpu: 8,
              mem: 8,
              maxmem: 32,
              disk: 1,
              maxdisk: 4,
              uptime: 90061,
            },
          ],
        }),
      );
    if (req.url?.startsWith("/api2/json/cluster/resources"))
      return res.end(
        JSON.stringify({
          data: [
            { node: "pve", status: "running" },
            { node: "pve", status: "stopped" },
            { node: "pve", status: "stopped", template: 1 },
            { node: "pve2", status: "running" },
          ],
        }),
      );
    res.end('{"data":null}');
  },
);
await new Promise<void>((resolve) => pve.listen(0, "127.0.0.1", resolve));
const pveUrl = `https://127.0.0.1:${(pve.address() as AddressInfo).port}`;

// 偽の node_exporter。呼ぶたびに CPU の idle が少し進む
let ticks = 0;
const exporter = createHttpServer((_req, res) => {
  ticks += 1;
  res.end(
    [
      "# HELP node_cpu_seconds_total x",
      `node_cpu_seconds_total{cpu="0",mode="idle"} ${100 + ticks * 3}`,
      `node_cpu_seconds_total{cpu="0",mode="user"} ${50 + ticks * 1}`,
      `node_cpu_seconds_total{cpu="1",mode="idle"} ${100 + ticks * 3}`,
      `node_cpu_seconds_total{cpu="1",mode="user"} ${50 + ticks * 1}`,
      "node_memory_MemTotal_bytes 1000",
      "node_memory_MemAvailable_bytes 250",
      'node_filesystem_size_bytes{device="/dev/sda1",fstype="ext4",mountpoint="/"} 400',
      'node_filesystem_avail_bytes{device="/dev/sda1",fstype="ext4",mountpoint="/"} 100',
      'node_filesystem_size_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 9',
      "node_time_seconds 1000.5",
      "node_boot_time_seconds 400",
      "node_load1 0.42",
    ].join("\n"),
  );
});
await new Promise<void>((resolve) => exporter.listen(0, "127.0.0.1", resolve));
const exporterUrl = `http://127.0.0.1:${(exporter.address() as AddressInfo).port}/metrics`;

after(async () => {
  pve.close();
  exporter.close();
  await rm(dir, { recursive: true, force: true });
});

const proxmoxHost = (extra: Partial<HostConfig> = {}): HostConfig => ({
  id: "p",
  name: "pve",
  type: "proxmox",
  url: pveUrl,
  tokenId: "root@pam!dash",
  tokenSecret: "secret",
  fingerprint,
  ...extra,
});

test("前の config/homelab-hosts.json を、応答の確認だけのホストとして取り込む", async () => {
  const legacy = join(dir, "legacy.json");
  await writeFile(legacy, JSON.stringify([{ name: "box", host: "192.168.1.10", port: 22 }]));
  const store = new HostStore(join(dir, "data1"), legacy);
  const hosts = await store.list();
  assert.equal(hosts.length, 1);
  assert.deepEqual({ ...hosts[0], id: "" }, { id: "", name: "box", type: "tcp", host: "192.168.1.10", port: 22 });
});

test("登録・更新・削除。シークレットは返さず、空で更新すれば前のものを残す。ファイルは持ち主だけが読める", async () => {
  const store = new HostStore(join(dir, "data2"), null);
  const created = await store.create({
    name: "pve",
    type: "proxmox",
    url: "https://192.168.1.10:8006/",
    tokenId: "root@pam!dash",
    tokenSecret: "secret",
    fingerprint: fingerprint.toLowerCase(),
  });
  assert.equal("tokenSecret" in created, false);
  assert.equal(created.hasTokenSecret, true);
  assert.equal(created.url, "https://192.168.1.10:8006");
  assert.equal(created.fingerprint, fingerprint);
  await store.update(created.id, { ...created, name: "pve-main", tokenSecret: "" });
  const saved = await store.get(created.id);
  assert.equal(saved?.name, "pve-main");
  assert.equal(saved?.tokenSecret, "secret");
  assert.equal((await stat(join(dir, "data2", "hosts.json"))).mode & 0o777, 0o600);
  await store.remove(created.id);
  assert.deepEqual(await store.list(), []);
});

test("種類に合わない値は受けない", async () => {
  const store = new HostStore(join(dir, "data3"), null);
  await assert.rejects(store.create({ name: "", type: "self" }), /名前/);
  await assert.rejects(store.create({ name: "x", type: "telnet" }), /種類/);
  await assert.rejects(store.create({ name: "x", type: "tcp", host: "a b", port: 22 }), /宛先/);
  await assert.rejects(store.create({ name: "x", type: "tcp", host: "a", port: 70000 }), /口の番号/);
  await assert.rejects(store.create({ name: "x", type: "node-exporter", url: "file:///etc/passwd" }), /http/);
  await assert.rejects(
    store.create({ name: "x", type: "proxmox", url: "http://a:8006", tokenId: "a@b!c", tokenSecret: "s" }),
    /https/,
  );
  await assert.rejects(
    store.create({ name: "x", type: "proxmox", url: "https://a:8006", tokenId: "nope", tokenSecret: "s" }),
    /トークンの ID/,
  );
});

test("node_exporter の値から、メモリ・ルートのディスク・稼働時間・ロード・コア数を読み、CPU は前回との差で出す", async () => {
  const metrics = parseMetrics(await (await fetch(exporterUrl)).text());
  assert.deepEqual(resourcesFromMetrics(metrics, null), {
    cpu: null,
    cores: 2,
    memUsed: 750,
    memTotal: 1000,
    diskUsed: 300,
    diskTotal: 400,
    uptimeSec: 601,
    load1: 0.42,
  });
  const status = await readHost({ id: "n", name: "nas", type: "node-exporter", url: exporterUrl }, dir);
  assert.equal(status.online, true);
  // 1回ごとに idle 3・user 1 進むので、使用率は 1/4
  assert.equal(status.resources?.cpu, 0.25);
});

test("Proxmox は登録したノード（無ければ最初のノード）と、そのノードの VM の数を読む", async () => {
  const first = await readHost(proxmoxHost(), dir);
  assert.equal(first.error, null);
  assert.equal(first.resources?.uptimeSec, 90061);
  assert.deepEqual(first.guests, { running: 1, total: 2 });
  const second = await readHost(proxmoxHost({ node: "pve2" }), dir);
  assert.equal(second.resources?.cores, 4);
  assert.deepEqual(second.guests, { running: 1, total: 1 });
});

test("Proxmox の指紋が無い・違うときはトークンを送らずに切り、確かめるとつないだ先の指紋を返す", async () => {
  const before = pveRequests;
  const wrong = await readHost(proxmoxHost({ fingerprint: "AA" }), dir);
  assert.equal(wrong.online, false);
  assert.equal(wrong.error, "証明書の指紋が合いません");
  const result = await testHost(proxmoxHost({ fingerprint: "" }), dir);
  assert.equal(result.ok, false);
  assert.equal(result.fingerprint, fingerprint);
  assert.equal(pveRequests, before, "問い合わせ（トークン）が届いてしまった");
  assert.deepEqual(await testHost(proxmoxHost(), dir), {
    ok: true,
    message: "つながりました（ノード pve・pve2）",
    nodes: ["pve", "pve2"],
  });
});

test("この機械のリソースを読む", async () => {
  const resources = await readSelf(dir);
  assert.ok(resources.memTotal && resources.memTotal > 0);
  assert.ok(resources.diskTotal && resources.diskTotal > 0);
  assert.ok(resources.uptimeSec !== null && resources.uptimeSec > 0);
  assert.ok(resources.cpu === null || (resources.cpu >= 0 && resources.cpu <= 1));
});

test("応答の確認だけのホストは、つながらなければそう出す", async () => {
  const status = await readHost({ id: "t", name: "x", type: "tcp", host: "127.0.0.1", port: 1 }, dir);
  assert.equal(status.online, false);
  assert.equal(status.error, "応答がありません");
  assert.equal(status.address, "127.0.0.1:1");
});

// --- SSH（偽の SSH サーバー。ダッシュボードの鍵でだけ通し、決めたコマンドの出力を返す） ---

const { Server, utils: sshUtils } = ssh2;
const sshData = join(dir, "ssh-data");
const dashboardKey = await ensureKeyPair(sshData);
const allowedKey = sshUtils.parseKey(dashboardKey.publicKey);
const hostKey = sshUtils.generateKeyPairSync("ed25519");
const hostFingerprint = sshFingerprint(
  (sshUtils.parseKey(hostKey.public) as { getPublicSSH(): Buffer }).getPublicSSH(),
);
let procTicks = 0;
const commands: string[] = [];
const sshServer = new Server({ hostKeys: [hostKey.private] }, (client) => {
  // 指紋が違うとダッシュボードの方から切るので、そのときのエラーは受け流す
  client.on("error", () => undefined);
  client.on("authentication", (ctx) => {
    const key = allowedKey as { getPublicSSH(): Buffer };
    if (ctx.method === "publickey" && ctx.username === "monitor" && ctx.key.data.equals(key.getPublicSSH()))
      return ctx.accept();
    ctx.reject(["publickey"]);
  });
  client.on("ready", () => {
    client.on("session", (accept) => {
      accept().on("exec", (acceptExec, _reject, info) => {
        commands.push(info.command);
        procTicks += 1;
        const stream = acceptExec();
        stream.write(
          [
            `cpu  ${100 + procTicks} 0 ${100 + procTicks} ${800 + procTicks * 2} 0 0 0 0 0 0`,
            "MemTotal:        4000000 kB",
            "MemFree:          500000 kB",
            "MemAvailable:    1000000 kB",
            "3600.50 7000.00",
            "0.25 0.30 0.35 1/200 1234",
            "4",
            "Filesystem     1024-blocks    Used Available Capacity Mounted on",
            "/dev/sda1         1000000  600000    400000      60% /",
            "",
          ].join("\n"),
        );
        stream.exit(0);
        stream.end();
      });
    });
  });
});
await new Promise<void>((resolve) => sshServer.listen(0, "127.0.0.1", resolve));
const sshPort = (sshServer.address() as AddressInfo).port;
after(() => sshServer.close());

const sshHost = (extra: Partial<HostConfig> = {}): HostConfig => ({
  id: "s",
  name: "box",
  type: "ssh",
  host: "127.0.0.1",
  port: sshPort,
  username: "monitor",
  fingerprint: hostFingerprint,
  ...extra,
});

test("SSH でつなぎ、/proc と df からリソースを読む。CPU は前回との差で出す", async () => {
  const status = await readHost(sshHost(), sshData);
  assert.equal(status.error, null);
  assert.deepEqual(status.resources, {
    // 1回ごとに user 1・system 1・idle 2 進むので、使用率は 2/4
    cpu: 0.5,
    cores: 4,
    memUsed: 3000000 * 1024,
    memTotal: 4000000 * 1024,
    diskUsed: 600000 * 1024,
    diskTotal: 1000000 * 1024,
    uptimeSec: 3601,
    load1: 0.25,
  });
  assert.ok(commands.every((c) => c === REMOTE_COMMAND));
  assert.equal(status.address, `monitor@127.0.0.1:${sshPort}`);
});

test("SSH のホスト鍵の指紋が無い・違うときは、鍵で名乗らずに切り、確かめるとつないだ先の指紋を返す", async () => {
  const before = commands.length;
  const result = await testHost(sshHost({ fingerprint: "" }), sshData);
  assert.equal(result.ok, false);
  assert.equal(result.fingerprint, hostFingerprint);
  const wrong = await readHost(sshHost({ id: "s2", fingerprint: `SHA256:${"A".repeat(43)}` }), sshData);
  assert.equal(wrong.error, "ホスト鍵の指紋が合いません");
  assert.equal(commands.length, before);
  assert.deepEqual(await testHost(sshHost(), sshData), { ok: true, message: "つながりました" });
});

test("ほかのユーザーでは鍵が通らないと知らせる。authorized_keys の行はコマンドを固定する", async () => {
  const result = await testHost(sshHost({ username: "root" }), sshData);
  assert.equal(result.ok, false);
  assert.match(result.message, /鍵が通りません/);
  const line = authorizedKeysLine(dashboardKey.publicKey);
  assert.ok(line.startsWith(`command="${REMOTE_COMMAND}",no-port-forwarding`));
  assert.ok(line.endsWith(dashboardKey.publicKey.trim()));
  assert.equal((await stat(join(sshData, "ssh", "id_ed25519"))).mode & 0o777, 0o600);
});
