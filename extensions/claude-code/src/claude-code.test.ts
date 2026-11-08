import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { authorizedKeysLine, bridgeScriptPath } from "./bridge";
import { validateMachine } from "./machines";
import type { LogChunk, LogItem, SessionSummary } from "./types";

// PATH を絞って動かすので、python3 の場所は先に調べておく
const PYTHON = spawnSync("sh", ["-c", "command -v python3"], { encoding: "utf-8" }).stdout.trim() || "python3";
const SESSION = "0f4e4b73-439f-41b3-917c-432bf925a368";
const home = mkdtempSync(join(tmpdir(), "claude-code-test-"));
after(() => rmSync(home, { recursive: true, force: true }));

const lines = [
  { type: "ai-title", aiTitle: "テストのセッション", sessionId: SESSION },
  {
    type: "user",
    uuid: "u1",
    timestamp: "2026-11-09T00:00:00Z",
    cwd: "/work/app",
    gitBranch: "main",
    message: { role: "user", content: "<system-reminder>見せない</system-reminder>\nREADME を直して" },
  },
  { type: "user", uuid: "meta", isMeta: true, message: { role: "user", content: "内部の文" } },
  {
    type: "assistant",
    uuid: "a1",
    timestamp: "2026-11-09T00:00:01Z",
    message: {
      model: "claude-opus-5-5",
      content: [
        { type: "thinking", thinking: "考える" },
        { type: "text", text: "直します。" },
        { type: "tool_use", id: "toolu_1", name: "Edit", input: { file_path: "/work/app/README.md", old_string: "a", new_string: "b" } },
      ],
    },
  },
  {
    type: "user",
    uuid: "u2",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok", is_error: false }] },
  },
  { type: "api-request", id: "x", params: {} },
  { type: "assistant", uuid: "side", isSidechain: true, message: { content: [{ type: "text", text: "サブエージェント" }] } },
  { type: "system", uuid: "s1", subtype: "compact_boundary", content: "Conversation compacted" },
];

const projectDir = join(home, ".claude", "projects", "-work-app");
mkdirSync(projectDir, { recursive: true });
writeFileSync(join(projectDir, `${SESSION}.jsonl`), `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);

/** 仲介スクリプトを、作ったホームで動かす（Herdr が見つからないように PATH も絞る） */
function bridge<T>(command: string, args: unknown = {}, env: Record<string, string> = {}): T & { ok: boolean; error?: string } {
  const result = spawnSync(PYTHON, [bridgeScriptPath(), command], {
    input: JSON.stringify(args),
    env: { HOME: home, PATH: "/nonexistent", ...env },
    encoding: "utf-8",
  });
  return JSON.parse(result.stdout);
}

describe("仲介スクリプト", () => {
  test("一覧に名前・場所・ブランチを出し、Herdr が無ければ herdr は null", () => {
    const reply = bridge<{ sessions: SessionSummary[]; herdr: unknown }>("overview", { days: 3650 });
    assert.equal(reply.ok, true);
    assert.equal(reply.herdr, null);
    assert.equal(reply.sessions.length, 1);
    assert.equal(reply.sessions[0].title, "テストのセッション");
    assert.equal(reply.sessions[0].cwd, "/work/app");
    assert.equal(reply.sessions[0].branch, "main");
  });

  test("やり取りは画面に出すものだけにし、system-reminder・内部の文・サブエージェントを除く", () => {
    const reply = bridge<LogChunk>("log", { sessionId: SESSION });
    assert.equal(reply.ok, true);
    const kinds = reply.items.map((i: LogItem) => i.k);
    assert.deepEqual(kinds, ["user", "thinking", "assistant", "tool", "result", "system"]);
    const user = reply.items[0] as Extract<LogItem, { k: "user" }>;
    assert.equal(user.text, "README を直して");
    const tool = reply.items[3] as Extract<LogItem, { k: "tool" }>;
    assert.equal(tool.id, "toolu_1");
    assert.equal(reply.items[4].id, "toolu_1");
    assert.equal(reply.more, false);
  });

  test("続きは end から読み、新しい行だけを返す", () => {
    const first = bridge<LogChunk>("log", { sessionId: SESSION });
    const next = bridge<LogChunk>("log", { sessionId: SESSION, from: first.end });
    assert.equal(next.items.length, 0);
    assert.equal(next.end, first.end);
  });

  test("決まった命令・形の引数しか受け付けない", () => {
    assert.equal(bridge("rm").error, "unknown-command");
    assert.equal(bridge("log", { sessionId: "../../etc/passwd" }).error, "bad-session");
    assert.equal(bridge("keys", { pane: "w1:p1", keys: ["ctrl+d; rm"] }).error, "bad-keys");
    // SSH の command= で縛ったとき、ssh で渡したコマンドの1語めを命令として読む
    assert.equal(bridge("", {}, { SSH_ORIGINAL_COMMAND: "rm -rf /" }).error, "unknown-command");
    assert.equal(bridge("prompt", { pane: "w1:p1", text: "hi" }).error, "herdr-missing");
  });
});

describe("機械の登録", () => {
  test("SSH の機械は宛先・ユーザー・指紋の形を確かめる", () => {
    const machine = validateMachine({ id: "m1", name: "PC", type: "ssh", host: "192.168.1.10", username: "mooma" });
    assert.equal(machine.port, 22);
    assert.throws(() => validateMachine({ id: "m1", name: "PC", type: "ssh", host: "a b", username: "x" }));
    assert.throws(() => validateMachine({ id: "m1", name: "PC", type: "ssh", host: "h", username: "x", fingerprint: "MD5:aa" }));
    assert.deepEqual(validateMachine({ id: "m2", name: "このサーバー", type: "self", host: "ignored" }), {
      id: "m2",
      name: "このサーバー",
      type: "self",
    });
  });

  test("鍵の1行は仲介スクリプトに縛り、転送・端末を止める", () => {
    const line = authorizedKeysLine("ssh-ed25519 AAAA test\n");
    assert.match(line, /^command="python3 ~\/\.local\/bin\/hd-claude-bridge\.py",restrict ssh-ed25519 AAAA test$/);
  });
});
