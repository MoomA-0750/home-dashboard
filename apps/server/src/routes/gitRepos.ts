import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

/**
 * ローカルのgitリポジトリ群の状況。
 *
 * 対象ディレクトリ（既定は ~/Documents/git-cloned）直下のリポジトリを走査し、
 * ブランチ・未コミット変更数・upstreamとの差分・最終コミットを返す。
 *
 * 実行時の注意:
 * - `--no-optional-locks` を付けてインデックスの更新（書き込み）を抑止する。
 *   コンテナからは read-only でマウントするため、書き込もうとすると失敗するため
 * - コンテナ内のrootとホスト側のファイル所有者が異なると git が "dubious ownership" で止まるので
 *   `-c safe.directory=*` を付ける（read-onlyかつ表示専用なので実害はない）
 */

const execFileAsync = promisify(execFile);

const GIT_BASE_ARGS = ["--no-optional-locks", "-c", "safe.directory=*"];
const GIT_TIMEOUT_MS = 5000;
/** ログ1行のフィールド区切り。コミットメッセージに現れない制御文字を使う */
const FIELD_SEP = "\u001f";

interface RepoStatus {
  name: string;
  path: string;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  dirty: boolean;
  lastCommit: { hash: string; subject: string; date: string } | null;
  error: string | null;
}

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, ...GIT_BASE_ARGS, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

/**
 * `git status --porcelain=v2 --branch` の出力を解釈する。
 * `# branch.*` のヘッダ行でブランチ情報、それ以外の行が変更エントリ:
 *   1/2 = 変更されたトラック済みファイル（2桁のXYでstaged/unstagedを表す）、? = untracked、u = コンフリクト
 */
function parseStatus(stdout: string) {
  let branch = "(detached)";
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const line of stdout.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim();
    } else if (line.startsWith("# branch.upstream ")) {
      upstream = line.slice("# branch.upstream ".length).trim();
    } else if (line.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(line);
      if (match) {
        ahead = Number(match[1]);
        behind = Number(match[2]);
      }
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      const xy = line.slice(2, 4);
      if (xy[0] !== ".") staged += 1;
      if (xy[1] !== ".") unstaged += 1;
    } else if (line.startsWith("? ")) {
      untracked += 1;
    } else if (line.startsWith("u ")) {
      staged += 1;
    }
  }

  return { branch, upstream, ahead, behind, staged, unstaged, untracked };
}

async function readRepo(name: string, repoPath: string): Promise<RepoStatus> {
  const base: RepoStatus = {
    name,
    path: repoPath,
    branch: "",
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    dirty: false,
    lastCommit: null,
    error: null,
  };

  try {
    const status = parseStatus(await git(repoPath, ["status", "--porcelain=v2", "--branch"]));
    Object.assign(base, status);
    base.dirty = status.staged + status.unstaged + status.untracked > 0;
  } catch (err) {
    base.error = (err as Error).message.split("\n")[0];
    return base;
  }

  try {
    const log = await git(repoPath, ["log", "-1", `--format=%H${FIELD_SEP}%s${FIELD_SEP}%cI`]);
    const [hash, subject, date] = log.trim().split(FIELD_SEP);
    if (hash) base.lastCommit = { hash: hash.slice(0, 7), subject: subject ?? "", date: date ?? "" };
  } catch {
    // コミットが1つも無いリポジトリなど。ステータスは取れているのでそのまま返す
  }

  return base;
}

async function findRepos(root: string): Promise<Array<{ name: string; path: string }>> {
  const dirents = await readdir(root, { withFileTypes: true });
  const repos: Array<{ name: string; path: string }> = [];

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const repoPath = join(root, dirent.name);
    try {
      await stat(join(repoPath, ".git"));
      repos.push({ name: dirent.name, path: repoPath });
    } catch {
      // .git が無いディレクトリはリポジトリではないので無視
    }
  }

  return repos.sort((a, b) => a.name.localeCompare(b.name));
}

export async function registerGitRepoRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/git/repos", async (_request, reply) => {
    const root = config.git.reposDir;

    let repos: Array<{ name: string; path: string }>;
    try {
      repos = await findRepos(root);
    } catch (err) {
      return reply.send({
        configured: false,
        reason: `リポジトリディレクトリを読めません (${root}): ${(err as Error).message}`,
      });
    }

    const statuses = await Promise.all(repos.map((r) => readRepo(r.name, r.path)));

    return {
      configured: true,
      root,
      dirtyCount: statuses.filter((s) => s.dirty).length,
      unpushedCount: statuses.filter((s) => s.ahead > 0).length,
      repos: statuses,
    };
  });
}
