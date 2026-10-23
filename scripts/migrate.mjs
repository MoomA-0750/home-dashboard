#!/usr/bin/env node
/**
 * 別の機械へ移すための道具（docs/migration.md）。
 *
 *   pnpm migrate export [--out <ファイル>] [--stop] [--live] [--no-encrypt] [--no-voice-workspace]
 *   pnpm migrate import <ファイル> [--force]
 *   pnpm migrate check
 *   pnpm migrate list <ファイル>
 *
 * - export: data/・config/・apps/server/.env・apps/voice-agent/.env と、音声アシスタントの作業場所
 *   （~/.local/share/home-dashboard-voice/workspace）を1つのファイルにまとめ、合言葉で暗号化する（AES-256-GCM）。
 *   data/ にはコンテナ（root）が書いたファイルがあるので、tar は Docker の中で作る
 * - import: まとめたファイルを、この機械のリポジトリと家のフォルダーに戻す。持ち主は今のユーザーにそろえ、権限はそのまま。
 *   すでにあるものは消さず、<名前>.before-import-<日時> に移しておく（--force のときだけ置き換える）
 * - check: 移した先で、起動に要るもの（Docker・wave のネットワーク・ホストのフォルダー・.env・待ち受けの IP・パスキーのホスト名）を確かめる
 * 合言葉は聞かれたときに打つ（HD_MIGRATE_PASSPHRASE にも書ける）。中身はトークンやパスワードを平文で含むので、暗号化せずに作ったものは人に渡さない
 */
import { execFileSync, spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, hostname, networkInterfaces, tmpdir, userInfo } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip, createGzip } from "node:zlib";

const ROOT = resolve(process.env.HD_MIGRATE_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const HOME = process.env.HD_MIGRATE_HOME ?? homedir();
const VOICE_WORKSPACE = join(HOME, ".local/share/home-dashboard-voice/workspace");
const IMAGE = "node:22-slim";
const MAGIC = Buffer.from("HDMIGRATE1\n");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FORMAT = 1;

/** まとめるもの。repo は リポジトリからの場所、home は家のフォルダーからの場所 */
const REPO_ITEMS = ["data", "config", "apps/server/.env", "apps/voice-agent/.env"];
/** 作り直せるので入れないもの */
const EXCLUDES = ["repo/data/extension-cache"];

const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.slice(1).filter((arg, i, all) => !arg.startsWith("--") && all[i - 1] !== "--out");

const say = (text) => console.log(text);
const fail = (text) => {
  console.error(`止めました: ${text}`);
  process.exit(1);
};
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");

function run(cmd, cmdArgs, options = {}) {
  return execFileSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

function tryRun(cmd, cmdArgs) {
  try {
    return run(cmd, cmdArgs);
  } catch {
    return null;
  }
}

/** 合言葉を、打った文字を出さずに聞く */
async function askHidden(question) {
  if (!process.stdin.isTTY) fail("合言葉を聞けません（端末から動かすか、HD_MIGRATE_PASSPHRASE に書いてください）");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (text) => write(text.startsWith(question) ? text : "");
  const answer = await new Promise((done) => rl.question(question, done));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function passphrase(confirm) {
  if (process.env.HD_MIGRATE_PASSPHRASE) return process.env.HD_MIGRATE_PASSPHRASE;
  const first = await askHidden("合言葉: ");
  if (first.length < 8) fail("合言葉は8文字以上にしてください");
  if (confirm && (await askHidden("もう一度: ")) !== first) fail("合言葉が一致しません");
  return first;
}

const keyOf = (pass, salt) => scryptSync(pass, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

/** Docker の中で動かす（コンテナが root で書いたファイルも読み書きできるように）。ネットワークは使わない */
function docker(mounts, script, { input = false } = {}) {
  const volumeArgs = mounts.flatMap(([host, inner, mode]) => ["-v", `${host}:${inner}${mode ? `:${mode}` : ""}`]);
  return spawn("docker", ["run", "--rm", ...(input ? ["-i"] : []), "--network", "none", ...volumeArgs, IMAGE, "sh", "-c", script], {
    stdio: [input ? "pipe" : "ignore", "pipe", "inherit"],
  });
}

function waitExit(child, what) {
  return new Promise((done, reject) =>
    child.on("close", (code) => (code === 0 ? done() : reject(new Error(`${what}が失敗しました（終了コード ${code}）`)))),
  );
}

function requireDocker() {
  if (!tryRun("docker", ["version", "--format", "{{.Server.Version}}"])) fail("Docker が使えません（入れて、動かしてから）");
}

const containerRunning = () =>
  tryRun("docker", ["compose", "--project-directory", ROOT, "ps", "--status", "running", "--quiet", "home-dashboard"]);
const agentActive = () => tryRun("systemctl", ["--user", "is-active", "home-dashboard-voice-agent"]) === "active";

// ---------------------------------------------------------------- export

async function exportCommand() {
  requireDocker();
  const encrypt = !flag("--no-encrypt");
  const withWorkspace = !flag("--no-voice-workspace") && existsSync(VOICE_WORKSPACE);
  const out = resolve(option("--out") ?? join(process.cwd(), `home-dashboard-${stamp()}.${encrypt ? "hdmigrate" : "tar.gz"}`));
  if (existsSync(out)) fail(`${out} はもうあります`);
  if (!existsSync(join(ROOT, "data"))) fail(`${join(ROOT, "data")} がありません`);

  // 書いている途中のファイルを持ち出さないよう、止めてから作る
  const running = Boolean(containerRunning());
  const agent = agentActive();
  if ((running || agent) && !flag("--stop") && !flag("--live"))
    fail("ダッシュボードか音声エージェントが動いています。--stop で止めてから作る（終わったら動かし直す）か、--live でそのまま作ってください");
  const pass = encrypt ? await passphrase(true) : null;

  const stopped = [];
  if (flag("--stop")) {
    if (running) {
      say("ダッシュボードを止めます");
      run("docker", ["compose", "--project-directory", ROOT, "stop", "home-dashboard"], { stdio: "inherit" });
      stopped.push("container");
    }
    if (agent) {
      say("音声エージェントを止めます");
      run("systemctl", ["--user", "stop", "home-dashboard-voice-agent"]);
      stopped.push("agent");
    }
  }

  const meta = await mkdtemp(join(tmpdir(), "hd-migrate-"));
  try {
    const items = REPO_ITEMS.filter((item) => existsSync(join(ROOT, item)));
    const manifest = {
      format: FORMAT,
      createdAt: new Date().toISOString(),
      hostname: hostname(),
      home: HOME,
      user: userInfo().username,
      commit: tryRun("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"]),
      repo: items,
      home_items: withWorkspace ? [relative(HOME, VOICE_WORKSPACE)] : [],
      encrypted: encrypt,
    };
    await writeFile(join(meta, "MIGRATION.json"), JSON.stringify(manifest, null, 2));

    const members = ["meta/MIGRATION.json", ...items.map((item) => `repo/${item}`), ...(withWorkspace ? ["voice-workspace"] : [])];
    const excludes = EXCLUDES.map((path) => `--exclude=${path}`).join(" ");
    const mounts = [
      [ROOT, "/m/repo", "ro"],
      [meta, "/m/meta", "ro"],
      ...(withWorkspace ? [[VOICE_WORKSPACE, "/m/voice-workspace", "ro"]] : []),
    ];
    say(`まとめます: ${members.slice(1).join("、")}`);
    const tar = docker(mounts, `cd /m && tar -cf - ${excludes} ${members.join(" ")}`);
    const steps = [tar.stdout, createGzip({ level: 6 })];
    const file = createWriteStream(out, { mode: 0o600 });

    if (encrypt) {
      const salt = randomBytes(SALT_BYTES);
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", keyOf(pass, salt), iv);
      file.write(Buffer.concat([MAGIC, salt, iv]));
      // 終わりに認証のタグを足す
      const withTag = new Transform({
        transform(chunk, _enc, next) {
          next(null, chunk);
        },
        flush(next) {
          this.push(cipher.getAuthTag());
          next();
        },
      });
      await Promise.all([pipeline(...steps, cipher, withTag, file), waitExit(tar, "tar")]);
    } else {
      await Promise.all([pipeline(...steps, file), waitExit(tar, "tar")]);
    }
    const size = statSync(out).size;
    say(`できました: ${out}（${(size / 1024 / 1024).toFixed(1)}MB${encrypt ? "・暗号化済み" : "・暗号化なし。トークンやパスワードがそのまま入っています"}）`);
    say("移した先で: pnpm migrate import <このファイル> → pnpm migrate check");
  } finally {
    await rm(meta, { recursive: true, force: true });
    if (stopped.includes("container")) {
      say("ダッシュボードを動かし直します");
      run("docker", ["compose", "--project-directory", ROOT, "start", "home-dashboard"], { stdio: "inherit" });
    }
    if (stopped.includes("agent")) run("systemctl", ["--user", "start", "home-dashboard-voice-agent"]);
  }
}

// ---------------------------------------------------------------- 読む（import・list）

/** まとめたファイルを、tar の流れにして返す（暗号化してあれば解く） */
async function openArchive(path) {
  if (!existsSync(path)) fail(`${path} がありません`);
  const size = statSync(path).size;
  const handle = await open(path, "r");
  const head = Buffer.alloc(MAGIC.length + SALT_BYTES + IV_BYTES);
  await handle.read(head, 0, head.length, 0);
  const encrypted = head.subarray(0, MAGIC.length).equals(MAGIC);
  if (!encrypted) {
    await handle.close();
    return { encrypted, stream: () => createReadStream(path).pipe(createGunzip()) };
  }
  const tag = Buffer.alloc(TAG_BYTES);
  await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  await handle.close();
  const salt = head.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = head.subarray(MAGIC.length + SALT_BYTES);
  const key = keyOf(await passphrase(false), salt);
  return {
    encrypted,
    stream: () => {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const out = new PassThrough();
      pipeline(createReadStream(path, { start: head.length, end: size - TAG_BYTES - 1 }), decipher, createGunzip(), out).catch((err) =>
        out.destroy(
          /unable to authenticate|auth/i.test(String(err))
            ? new Error("合言葉が違うか、ファイルが壊れています")
            : err,
        ),
      );
      return out;
    },
  };
}

/** tar の中の MIGRATION.json だけを読む */
async function readManifest(archive) {
  const work = await mkdtemp(join(tmpdir(), "hd-migrate-"));
  try {
    const tar = spawn("tar", ["-xf", "-", "-C", work, "meta/MIGRATION.json"], { stdio: ["pipe", "ignore", "pipe"] });
    let errors = "";
    tar.stderr.on("data", (chunk) => (errors += chunk));
    await pipeline(archive.stream(), tar.stdin).catch(() => undefined);
    await new Promise((done) => tar.on("close", done));
    const path = join(work, "meta/MIGRATION.json");
    if (!existsSync(path))
      fail(
        archive.encrypted
          ? "まとめたファイルを読めません（合言葉が違うか、ファイルが壊れています）"
          : `まとめたファイルを読めません（${errors.trim() || "MIGRATION.json がありません"}）`,
      );
    const manifest = JSON.parse(await readFile(path, "utf8"));
    if (manifest.format !== FORMAT) fail(`この道具の知らない形です（format ${manifest.format}）`);
    return manifest;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function listCommand() {
  const file = positional[0];
  if (!file) fail("使い方: pnpm migrate list <ファイル>");
  const archive = await openArchive(resolve(file));
  const manifest = await readManifest(archive);
  say(`作った日時: ${manifest.createdAt}`);
  say(`作った機械: ${manifest.hostname}（${manifest.user}、${manifest.home}）・コミット ${manifest.commit ?? "不明"}`);
  say(`中身: ${[...manifest.repo, ...manifest.home_items.map((item) => `~/${item}`)].join("、")}`);
  say(`暗号化: ${archive.encrypted ? "あり" : "なし"}`);
}

// ---------------------------------------------------------------- import

async function moveAside(path) {
  const aside = `${path}.before-import-${stamp()}`;
  await rename(path, aside);
  return aside;
}

async function hasContent(path) {
  if (!existsSync(path)) return false;
  if (!statSync(path).isDirectory()) return true;
  return (await readdir(path)).some((name) => name !== ".gitkeep");
}

async function importCommand() {
  const file = positional[0];
  if (!file) fail("使い方: pnpm migrate import <ファイル> [--force]");
  requireDocker();
  if (containerRunning()) fail("ダッシュボードが動いています。docker compose stop home-dashboard で止めてから戻してください");
  const archive = await openArchive(resolve(file));
  const manifest = await readManifest(archive);
  say(`${manifest.hostname} で ${manifest.createdAt} に作ったものを戻します`);

  // 置き換えるものを確かめる（消さずに横へ移す）
  const targets = [
    ...manifest.repo.map((item) => ({ from: `repo/${item}`, to: join(ROOT, item) })),
    ...manifest.home_items.map((item) => ({ from: "voice-workspace", to: join(HOME, item) })),
  ];
  const occupied = [];
  for (const target of targets) if (await hasContent(target.to)) occupied.push(target.to);
  if (occupied.length > 0 && !flag("--force"))
    fail(`もうあります: ${occupied.join("、")}\n  置き換えるなら --force（今のものは <名前>.before-import-<日時> に残します）`);

  // いったん横に広げてから、一つずつ置く（途中で失敗しても今のものは壊さない）
  const stage = await mkdtemp(join(ROOT, ".migrate-import-"));
  try {
    const { uid, gid } = userInfo();
    const tar = docker([[stage, "/out"]], `tar -xf - -C /out --no-same-owner && chown -R ${uid}:${gid} /out`, { input: true });
    await Promise.all([pipeline(archive.stream(), tar.stdin), waitExit(tar, "展開")]);

    const moved = [];
    for (const target of targets) {
      const source = join(stage, target.from);
      if (!existsSync(source)) continue;
      if (existsSync(target.to)) {
        if (await hasContent(target.to)) moved.push(await moveAside(target.to));
        else await rm(target.to, { recursive: true, force: true });
      }
      await mkdir(dirname(target.to), { recursive: true });
      await rename(source, target.to);
      say(`戻しました: ${target.to}`);
    }
    // どこから来たかを残す（check がパスやホスト名の違いを確かめるのに使う）
    await writeFile(join(ROOT, "data", ".migrated-from.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    if (moved.length > 0) say(`前のものは残してあります: ${moved.join("、")}`);
    say("次に: pnpm migrate check");
  } finally {
    await rm(stage, { recursive: true, force: true }).catch(() =>
      say(`作業用のフォルダーを消せませんでした（手で消してください）: ${stage}`),
    );
  }
}

// ---------------------------------------------------------------- check

/** .env の値（中身は出さない） */
function envValue(path, name) {
  if (!existsSync(path)) return undefined;
  const line = readFileSync(path, "utf8")
    .split("\n")
    .find((raw) => raw.trim().startsWith(`${name}=`));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

async function checkCommand() {
  const results = [];
  const ok = (text) => results.push(["ok", text]);
  const warn = (text) => results.push(["!!", text]);
  const ng = (text) => results.push(["NG", text]);

  // Docker と compose が要るもの
  if (tryRun("docker", ["version", "--format", "{{.Server.Version}}"])) ok("Docker が動いている");
  else ng("Docker が使えない");
  if (tryRun("docker", ["network", "inspect", "relay-deploy-v2_default"])) ok("wave のネットワーク（relay-deploy-v2_default）がある");
  else
    ng("wave のネットワーク（relay-deploy-v2_default）が無い。先に wave を起動するか、docker-compose.yml の networks から wave を外す（無いと compose が起動しない）");

  // ホストから読み込むもの（docker-compose.yml の volumes）
  const hostPaths = [
    [join(HOME, ".claude/projects"), "Claude Code の使用量"],
    [join(HOME, "Documents/git-cloned"), "git リポジトリのウィジェット"],
    ["/var/run/tailscale/tailscaled.sock", "Tailscale のウィジェット"],
    [join(HOME, ".step/certs/root_ca.crt"), "https の入口（家の認証局のルート証明書）"],
  ];
  for (const [path, use] of hostPaths)
    existsSync(path) ? ok(`${path} がある（${use}）`) : warn(`${path} が無い（${use}が動かない。Docker が空のフォルダーを作ってしまう）`);

  // 設定ファイル
  const serverEnv = join(ROOT, "apps/server/.env");
  const agentEnv = join(ROOT, "apps/voice-agent/.env");
  for (const path of [serverEnv, agentEnv]) {
    if (!existsSync(path)) {
      ng(`${relative(ROOT, path)} が無い`);
      continue;
    }
    const mode = statSync(path).mode & 0o777;
    mode & 0o077 ? warn(`${relative(ROOT, path)} がほかの人にも読める（chmod 600 を勧めます）`) : ok(`${relative(ROOT, path)} がある`);
  }
  const serverToken = envValue(serverEnv, "VOICE_AGENT_TOKEN");
  const agentToken = envValue(agentEnv, "VOICE_AGENT_TOKEN");
  if (serverToken && agentToken) serverToken === agentToken ? ok("VOICE_AGENT_TOKEN が2つの .env でそろっている") : ng("VOICE_AGENT_TOKEN が2つの .env で違う");

  // https の待ち受け
  const bind = process.env.DASHBOARD_HTTPS_BIND ?? envValue(join(ROOT, ".env"), "DASHBOARD_HTTPS_BIND") ?? "192.168.1.10";
  const addresses = Object.values(networkInterfaces())
    .flat()
    .map((info) => info?.address);
  addresses.includes(bind)
    ? ok(`https の待ち受け ${bind} はこの機械の IP`)
    : ng(`https の待ち受け ${bind} がこの機械の IP に無い。リポジトリ直下の .env に DASHBOARD_HTTPS_BIND と DASHBOARD_ACME_DIRECTORY を書く`);

  // 戻したデータ
  const dataDir = join(ROOT, "data");
  if (!(await hasContent(dataDir))) ng("data/ が空（pnpm migrate import で戻す）");
  else ok("data/ がある");
  const unreadable = [];
  for await (const path of walk(dataDir)) {
    try {
      await (await open(path, "r")).close();
    } catch {
      unreadable.push(relative(ROOT, path));
    }
  }
  // コンテナは root で動くので、コンテナが書いたファイルは今のユーザーから読めないことがある（サーバーは読めるので動きはする。
  // export は Docker の中で読むので持ち出せ、import で今のユーザーの持ち物にそろう）
  if (unreadable.length > 0)
    warn(
      `今のユーザーから読めないファイルが ${unreadable.length} 個ある（コンテナが root で書いたもの。動きには困らず、pnpm migrate export で持ち出せる）: ${unreadable.slice(0, 3).join("、")}${unreadable.length > 3 ? " など" : ""}`,
    );

  // 前の機械の場所が、データの中に残っていないか（中身は出さず、ファイルの名前だけ）
  const fromPath = join(dataDir, ".migrated-from.json");
  if (existsSync(fromPath)) {
    const from = JSON.parse(await readFile(fromPath, "utf8"));
    if (from.home !== HOME) {
      const found = [];
      for await (const path of walk(dataDir)) {
        if (path === fromPath || !/\.(json|jsonl)$/.test(path) || statSync(path).size > 5 * 1024 * 1024) continue;
        const text = await readFile(path, "utf8").catch(() => "");
        if (text.includes(from.home)) found.push(relative(ROOT, path));
      }
      found.length > 0
        ? warn(`前の機械の家のフォルダー（${from.home}）を指す値が残っている: ${found.join("、")}（設定画面で直す）`)
        : ok(`前の機械の家のフォルダー（${from.home}）を指す値は無い`);
    }
  }

  // パスキーはホスト名に結び付く
  const passkeysPath = join(dataDir, "passkeys.json");
  if (existsSync(passkeysPath)) {
    try {
      const raw = JSON.parse(await readFile(passkeysPath, "utf8"));
      const list = Array.isArray(raw) ? raw : (raw.passkeys ?? []);
      const hosts = [...new Set(list.map((passkey) => passkey.rpId).filter(Boolean))];
      if (hosts.length > 0)
        warn(`パスキーはこのホスト名でだけ使える: ${hosts.join("、")}（違う名前で開くなら、パスワードで入って登録し直す）`);
    } catch {
      warn("data/passkeys.json を読めないので、パスキーのホスト名は確かめていない（パスキーは登録したときのホスト名でだけ使える）");
    }
  }

  // 音声エージェント（ホスト上で動かす）
  existsSync(join(ROOT, "apps/voice-agent/.venv/bin/python"))
    ? ok("音声エージェントの venv がある")
    : warn("音声エージェントの venv が無い（README の「音声アシスタント」の手順で作る）");
  existsSync(join(HOME, ".config/systemd/user/home-dashboard-voice-agent.service"))
    ? ok("音声エージェントのサービスが入っている")
    : warn("音声エージェントのサービスが無い（cp apps/voice-agent/home-dashboard-voice-agent.service ~/.config/systemd/user/）");

  for (const [mark, text] of results) say(`${mark}  ${text}`);
  const bad = results.filter(([mark]) => mark === "NG").length;
  say(bad > 0 ? `\n直すものが ${bad} 件あります` : "\n起動に要るものはそろっています（!! は動かない機能があるだけ）");
  if (bad > 0) process.exitCode = 1;
}

// ----------------------------------------------------------------

const commands = { export: exportCommand, import: importCommand, check: checkCommand, list: listCommand };
if (!commands[command]) {
  console.error(
    "使い方:\n" +
      "  pnpm migrate export [--out <ファイル>] [--stop] [--live] [--no-encrypt] [--no-voice-workspace]\n" +
      "  pnpm migrate import <ファイル> [--force]\n" +
      "  pnpm migrate check\n" +
      "  pnpm migrate list <ファイル>",
  );
  process.exit(1);
}
await commands[command]().catch((err) => fail(err instanceof Error ? err.message : String(err)));
