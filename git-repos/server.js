import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// extensions/git-repos/src/server.ts
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

// packages/extension-sdk/src/index.ts
function defineServerMessages(dicts) {
  return {
    t(locale, key, params) {
      const value = dicts[locale][key] ?? dicts.ja[key];
      if (typeof value === "function") return value(params ?? {});
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
    }
  };
}
function defineServerExtension(extension) {
  return extension;
}

// extensions/git-repos/src/server.ts
var messages = defineServerMessages({
  ja: { cannotRead: "\u30EA\u30DD\u30B8\u30C8\u30EA\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u8AAD\u3081\u307E\u305B\u3093 ({root}): {error}" },
  en: { cannotRead: "Can't read the repositories folder ({root}): {error}" }
});
var settings = {};
var execFileAsync = promisify(execFile);
var GIT_BASE_ARGS = ["--no-optional-locks", "-c", "safe.directory=*"];
var GIT_TIMEOUT_MS = 5e3;
var FIELD_SEP = "";
async function git(repoPath, args) {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, ...GIT_BASE_ARGS, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024
  });
  return stdout;
}
function parseStatus(stdout) {
  let branch = "(detached)";
  let upstream = null;
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
async function readRepo(name, repoPath) {
  const base = {
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
    error: null
  };
  try {
    const status = parseStatus(await git(repoPath, ["status", "--porcelain=v2", "--branch"]));
    Object.assign(base, status);
    base.dirty = status.staged + status.unstaged + status.untracked > 0;
  } catch (err) {
    base.error = err.message.split("\n")[0];
    return base;
  }
  try {
    const log = await git(repoPath, ["log", "-1", `--format=%H${FIELD_SEP}%s${FIELD_SEP}%cI`]);
    const [hash, subject, date] = log.trim().split(FIELD_SEP);
    if (hash) base.lastCommit = { hash: hash.slice(0, 7), subject: subject ?? "", date: date ?? "" };
  } catch {
  }
  return base;
}
async function findRepos(root) {
  const dirents = await readdir(root, { withFileTypes: true });
  const repos = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const repoPath = join(root, dirent.name);
    try {
      await stat(join(repoPath, ".git"));
      repos.push({ name: dirent.name, path: repoPath });
    } catch {
    }
  }
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}
var server_default = defineServerExtension({
  register(api) {
    settings = api.settings;
    api.route("GET", "/repos", async (ctx) => {
      const root = String(settings.reposDir);
      let repos;
      try {
        repos = await findRepos(root);
      } catch (err) {
        return {
          configured: false,
          reason: messages.t(ctx.locale, "cannotRead", { root, error: err.message })
        };
      }
      const statuses = await Promise.all(repos.map((r) => readRepo(r.name, r.path)));
      return {
        configured: true,
        root,
        dirtyCount: statuses.filter((s) => s.dirty).length,
        unpushedCount: statuses.filter((s) => s.ahead > 0).length,
        repos: statuses
      };
    });
  }
});
export {
  server_default as default
};
