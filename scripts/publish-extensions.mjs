#!/usr/bin/env node
/**
 * 拡張機能を組み立てて、リポジトリの公開用の枝（既定は dist-extensions）に置く道具。
 * ダッシュボードはこの枝を「リポジトリ」として登録し、組み立て済みのものを取ってきて入れる・更新する
 * （ダッシュボードの側では組み立てないので、どの環境でも同じものが動く）。
 *
 *   pnpm publish:extensions            # 組み立てて、置くものと前との違いを見せる（枝は変えない）
 *   pnpm publish:extensions --push     # 公開用の枝に置いて push する（GitHub Actions もこれを呼ぶ）
 *   オプション: --branch <枝>（既定 dist-extensions） --remote <リモート>（既定 origin）
 *
 * 枝の形:
 *   catalog.json        { format: 1, commit, extensions: [{ id, name, version, description, apiVersion, features, provides, revision, path }] }
 *   <id>/               組み立てたもの（manifest.json・server.js・web.js・web.css・assets/）
 *
 * 中身が変わったのに版（manifest.json の version）が前と同じか古いものは置かない（ダッシュボードは版が上がったときだけ更新を知らせるため）。
 */
import { execFile as execFileCb } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const push = args.includes("--push");
const branch = option("--branch", "dist-extensions");
const remote = option("--remote", "origin");

const git = async (gitArgs, cwd = ROOT) => (await execFile("git", gitArgs, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout.trim();

/** 1.2.10 と 1.2.9 のような版を比べる（数でない部分は文字として比べる） */
export function compareVersions(a, b) {
  const pa = String(a).split(/[.+-]/);
  const pb = String(b).split(/[.+-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "0";
    const y = pb[i] ?? "0";
    const nx = Number(x);
    const ny = Number(y);
    const diff = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(path, base)));
    else out.push(relative(base, path).split("\\").join("/"));
  }
  return out.sort();
}

/** 組み立てたものの中身から作る値。前と同じなら置き直さない */
async function revisionOf(dir) {
  const hash = createHash("sha256");
  for (const name of await listFiles(dir)) hash.update(`${name}\0`).update(await readFile(join(dir, name))).update("\0");
  return hash.digest("hex").slice(0, 16);
}

// 1. 本体の拡張機能をすべて組み立てる
console.log("組み立てています…");
await execFile(process.execPath, ["--import", "tsx", join(ROOT, "scripts/build-extension.mjs"), "--all"], {
  cwd: ROOT,
  maxBuffer: 64 * 1024 * 1024,
});

const entries = [];
for (const entry of await readdir(join(ROOT, "extensions"), { withFileTypes: true })) {
  const dist = join(ROOT, "extensions", entry.name, "dist");
  if (!entry.isDirectory() || !existsSync(join(dist, "manifest.json"))) continue;
  const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf-8"));
  entries.push({
    dist,
    meta: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? null,
      apiVersion: manifest.apiVersion,
      features: manifest.features ?? [],
      provides: manifest.provides ?? [],
      revision: await revisionOf(dist),
      path: manifest.id,
    },
  });
}
entries.sort((a, b) => a.meta.id.localeCompare(b.meta.id));

// 2. 前に置いたものと比べる（枝がまだ無ければ、初めて置く）
let previous = new Map();
let hasBranch = false;
try {
  await git(["fetch", "--quiet", remote, `refs/heads/${branch}`]);
  hasBranch = true;
  const catalog = JSON.parse(await git(["show", "FETCH_HEAD:catalog.json"]));
  previous = new Map(catalog.extensions.map((ext) => [ext.id, ext]));
} catch {
  console.log(`${remote} に ${branch} の枝がまだありません。初めて置きます`);
}

const problems = [];
for (const { meta } of entries) {
  const before = previous.get(meta.id);
  if (!before) console.log(`  足す     ${meta.id} ${meta.version}`);
  else if (before.revision === meta.revision) console.log(`  そのまま ${meta.id} ${meta.version}`);
  else if (compareVersions(meta.version, before.version) <= 0)
    problems.push(`${meta.id}: 中身が変わったのに版が ${meta.version} のままです（前は ${before.version}）。manifest.json の version を上げてください`);
  else console.log(`  更新     ${meta.id} ${before.version} → ${meta.version}`);
}
for (const id of previous.keys()) if (!entries.some((e) => e.meta.id === id)) console.log(`  外す     ${id}`);
if (problems.length > 0) {
  console.error(`\n置けません:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
if (!push) {
  console.log(`\n枝は変えていません。置くときは --push を付けてください`);
  process.exit(0);
}

// 3. 公開用の枝の作業場を作り、組み立てたものと一覧を置いて push する
const work = await mkdtemp(join(tmpdir(), "publish-extensions-"));
try {
  if (hasBranch) await git(["worktree", "add", "--quiet", "--detach", work, "FETCH_HEAD"]);
  else {
    await git(["worktree", "add", "--quiet", "--detach", work]);
    await git(["checkout", "--quiet", "--orphan", `publish-${Date.now()}`], work);
  }
  for (const name of await readdir(work)) if (name !== ".git") await rm(join(work, name), { recursive: true, force: true });
  for (const { dist, meta } of entries) await cp(dist, join(work, meta.path), { recursive: true });
  const commit = await git(["rev-parse", "HEAD"]);
  await writeFile(
    join(work, "catalog.json"),
    JSON.stringify({ format: 1, commit, extensions: entries.map((e) => e.meta) }, null, 2) + "\n",
  );
  await writeFile(
    join(work, "README.md"),
    "# 組み立て済みの拡張機能\n\nホームダッシュボードの拡張機能を組み立てたもの（`scripts/publish-extensions.mjs` が置く）。手で書き換えない。\n" +
      "ダッシュボードの設定画面の「拡張機能 → リポジトリ」で、このリポジトリと枝を登録すると、ここから入れたり更新したりできる。\n",
  );
  await git(["add", "--all"], work);
  const status = await git(["status", "--porcelain"], work);
  if (!status) {
    console.log("\n変わったものはありません");
  } else {
    const changed = entries
      .filter(({ meta }) => previous.get(meta.id)?.revision !== meta.revision)
      .map(({ meta }) => `${meta.id} ${meta.version}`);
    await git(["commit", "--quiet", "-m", `拡張機能を置く: ${changed.join("、") || "一覧の更新"}`, "-m", `元: ${commit}`], work);
    await git(["push", "--quiet", remote, `HEAD:refs/heads/${branch}`], work);
    console.log(`\n${remote} の ${branch} に置きました`);
  }
} finally {
  await git(["worktree", "remove", "--force", work]).catch(() => undefined);
  await rm(work, { recursive: true, force: true });
}
