import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, test } from "node:test";
import type { ToolDefinition } from "@home-dashboard/extension-sdk";

// config は読み込み時に環境変数を見るので、モジュールより先に一時ディレクトリを指しておく
const root = await mkdtemp(join(tmpdir(), "voice-guard-"));
process.env.DATA_DIR = root;
const guard = await import("./voiceGuard.js");
const { answerRequest, checkToolUse, coreTools, isAffirmative, listGuardTools, listPending, takeGrant, waitForAnswer } = guard;

after(() => rm(root, { recursive: true, force: true }));

// 拡張機能の道具の代わり（本体の道具の並びに足す）
const testTools: ToolDefinition[] = [
  { name: "get_weather", description: "", readOnly: true, handler: () => null },
  { name: "read_mail", description: "", readOnly: true, personal: true, untrusted: true, handler: () => null },
  { name: "control_music", description: "", risk: "low", handler: () => null },
  {
    name: "send_mail",
    description: "",
    risk: "confirm",
    personal: true,
    describe: (args) => `メールを${String(args.to)}へ送る`,
    handler: () => null,
  },
  {
    name: "control_lock",
    description: "",
    risk: (args) => (args.action === "unlock" ? "approve" : "confirm"),
    describe: (args) => `玄関を${args.action === "unlock" ? "解錠" : "施錠"}する`,
    handler: () => null,
  },
  { name: "no_risk_declared", description: "", handler: () => null },
];
coreTools.push(...testTools);

const account = { id: "acc-1", username: "mooma", role: "admin" as const };

function ask(tool: string, input: Record<string, unknown> = {}, overrides: Partial<Parameters<typeof checkToolUse>[0]> = {}) {
  return checkToolUse({
    conversationId: "conv-1",
    turnId: "turn-1",
    source: "wake",
    accountId: null,
    utterance: "",
    attachments: false,
    tool,
    input,
    ...overrides,
  });
}

beforeEach(() => guard.resetGuardForTest());

describe("voice guard", () => {
  test("読むだけ・すぐ戻せる操作はそのまま通し、/mcp は通したものだけを一度だけ動かす", async () => {
    assert.deepEqual(await ask("mcp__dashboard__get_weather", { day: 1 }), { decision: "allow" });
    assert.deepEqual(await ask("mcp__dashboard__control_music", { action: "pause" }), { decision: "allow" });
    // 引数の並び順は問わない
    assert.ok(takeGrant("get_weather", { day: 1 }));
    assert.equal(takeGrant("get_weather", { day: 1 }), undefined);
    // 通していない引数では動かない
    assert.equal(takeGrant("control_music", { action: "play" }), undefined);
    assert.ok(takeGrant("control_music", { action: "pause" }));
  });

  test("知らない道具・使わせない組み込みの道具は断る", async () => {
    assert.equal((await ask("Bash", { command: "rm -rf /" })).decision, "deny");
    assert.equal((await ask("mcp__dashboard__nothing")).decision, "deny");
    assert.equal((await ask("WebSearch", { query: "天気" })).decision, "allow");
  });

  test("risk を宣言していない書き込みの道具は、了承が要るものとして扱う", async () => {
    assert.equal((await ask("mcp__dashboard__no_risk_declared")).decision, "deny");
    assert.equal(listPending()[0].kind, "confirm");
  });

  test("了承が要る操作は、聞き返した後の別の話しかけで「はい」と言われたときだけ通す", async () => {
    const input = { to: ["mom@example.com"], text: "帰ります" };
    const first = await ask("mcp__dashboard__send_mail", input, { utterance: "お母さんに帰るってメールして" });
    assert.equal(first.decision, "deny");
    assert.match((first as { message: string }).message, /メールをmom@example.comへ送る/);
    assert.equal(listPending().length, 1);
    // 同じ話しかけの中で Claude がもう一度呼んでも通さない（Claude が了承したことにはできない）
    assert.equal((await ask("mcp__dashboard__send_mail", input, { utterance: "はい" })).decision, "deny");
    // 聞き返しのあとの話しかけで「はい」
    const yes = await ask("mcp__dashboard__send_mail", input, { turnId: "turn-2", utterance: "うん、お願い" });
    assert.deepEqual(yes, { decision: "allow" });
    assert.equal(listPending().length, 0);
    assert.ok(takeGrant("send_mail", input));
  });

  test("聞き返しに「いいえ」なら断り、内容が変わったら聞き直す", async () => {
    const input = { to: ["a@example.com"], text: "x" };
    await ask("mcp__dashboard__send_mail", input);
    const no = await ask("mcp__dashboard__send_mail", input, { turnId: "turn-2", utterance: "やっぱりやめて" });
    assert.equal(no.decision, "deny");
    assert.equal(listPending().length, 0);

    await ask("mcp__dashboard__send_mail", input);
    const changed = await ask("mcp__dashboard__send_mail", { ...input, text: "y" }, { turnId: "turn-2", utterance: "はい" });
    assert.equal(changed.decision, "deny");
  });

  test("了承は画面で押してもよい", async () => {
    await ask("mcp__dashboard__control_lock", { action: "lock" });
    const [request] = listPending();
    answerRequest(request.id, true, account, false);
    assert.deepEqual(await ask("mcp__dashboard__control_lock", { action: "lock" }, { turnId: "turn-2" }), { decision: "allow" });
  });

  test("解錠などは、画面で本人確認して許可するまで待ち、許可した人を道具に渡す", async () => {
    const pending = await ask("mcp__dashboard__control_lock", { action: "unlock" });
    assert.equal(pending.decision, "pending");
    const requestId = (pending as { requestId: string }).requestId;
    assert.equal(listPending()[0].description, "玄関を解錠する");
    // 本人確認なしでは許可できない（了承と違い、押すだけでは通らない）
    assert.throws(() => answerRequest(requestId, true, account, false), /本人確認/);
    const waiting = waitForAnswer(requestId, 5_000);
    answerRequest(requestId, true, account, true);
    assert.deepEqual(await waiting, { decision: "allow" });
    assert.deepEqual(takeGrant("control_lock", { action: "unlock" }), { approvedBy: account });
  });

  test("許可しなかった・待っても答えが無いときは断る", async () => {
    const denied = await ask("mcp__dashboard__control_lock", { action: "unlock" });
    const id = (denied as { requestId: string }).requestId;
    const waiting = waitForAnswer(id, 5_000);
    answerRequest(id, false, account, false);
    assert.equal((await waiting).decision, "deny");

    const silent = await ask("mcp__dashboard__control_lock", { action: "unlock" });
    // 期限の前に待ちが切れたら、エージェントにもう一度待ってもらう
    assert.equal((await waitForAnswer((silent as { requestId: string }).requestId, 10)).decision, "pending");
  });

  test("外の人が書いた文を読んだ会話では、すぐ戻せる操作にも了承を求める", async () => {
    assert.equal((await ask("mcp__dashboard__control_music", { action: "play" }, { conversationId: "other" })).decision, "allow");
    await ask("mcp__dashboard__read_mail", { id: "m1" });
    const after = await ask("mcp__dashboard__control_music", { action: "play" });
    assert.equal(after.decision, "deny");
    assert.match((after as { message: string }).message, /外から来た文/);
    // 別の会話には及ばない
    assert.equal((await ask("mcp__dashboard__control_music", { action: "play" }, { conversationId: "other" })).decision, "allow");
    // 添えたファイルも外から来た文として扱う
    await ask("mcp__dashboard__get_weather", {}, { conversationId: "files", attachments: true });
    assert.equal((await ask("mcp__dashboard__control_music", { action: "play" }, { conversationId: "files" })).decision, "deny");
  });

  test("家の人の情報は、設定とゲストモードで声では出さない", async () => {
    assert.equal((await ask("mcp__dashboard__read_mail", { id: "m1" })).decision, "allow");
    await guard.writeGuardSettings({ personal: "screen" });
    assert.equal((await ask("mcp__dashboard__read_mail", { id: "m1" })).decision, "deny");
    assert.equal(
      (await ask("mcp__dashboard__read_mail", { id: "m1" }, { source: "text", accountId: "acc-1" })).decision,
      "allow",
    );
    await guard.setGuestMode(true);
    const guest = await ask("mcp__dashboard__read_mail", { id: "m1" }, { source: "text", accountId: "acc-1" });
    assert.equal(guest.decision, "deny");
    assert.match((guest as { message: string }).message, /ゲストモード/);
    // 個人の情報でないものは使える
    assert.equal((await ask("mcp__dashboard__get_weather")).decision, "allow");
  });

  test("外の道具は名前だけでは通さず、管理者が決めた段に従う", async () => {
    await guard.writeGuardSettings({ personal: "all" });
    assert.equal((await ask("mcp__claude_ai_Gmail__search_threads", { q: "x" })).decision, "deny");
    assert.equal(listPending()[0].kind, "confirm");
    assert.equal((await ask("mcp__claude_ai_Gmail__send_message", { to: "x" })).decision, "pending");
    const tools = await listGuardTools();
    assert.deepEqual(
      tools.filter((t) => t.kind === "external").map((t) => [t.name, t.declared]),
      [
        ["mcp__claude_ai_Gmail__search_threads", "confirm"],
        ["mcp__claude_ai_Gmail__send_message", "approve"],
      ],
    );
    await guard.writeGuardSettings({ tools: { mcp__claude_ai_Gmail__search_threads: { level: "read" } } });
    assert.equal((await ask("mcp__claude_ai_Gmail__search_threads", { q: "x" }, { conversationId: "c2" })).decision, "allow");
    await guard.writeGuardSettings({ tools: { mcp__claude_ai_Gmail__send_message: { level: "deny" } } });
    assert.equal((await ask("mcp__claude_ai_Gmail__send_message", { to: "x" })).decision, "deny");
  });

  test("ダッシュボードの道具の段は、設定で厳しくはできても緩くはできない", async () => {
    await guard.writeGuardSettings({ tools: { mcp__dashboard__control_music: { level: "confirm" } } });
    assert.equal((await ask("mcp__dashboard__control_music", { action: "play" })).decision, "deny");
    await guard.writeGuardSettings({ tools: { mcp__dashboard__send_mail: { level: "read" } } });
    assert.equal((await ask("mcp__dashboard__send_mail", { to: ["a"] })).decision, "deny");
  });

  test("了承の言葉は、短い答えで、断りの言葉を含まないものだけ", () => {
    for (const yes of ["はい", "うん", "いいよ！", "お願いします", "OK", "送って", "はい、どうぞ"]) assert.ok(isAffirmative(yes), yes);
    for (const no of ["いいえ", "やめて", "大丈夫です", "いいです", "はいはい、でも待って", "", "はい、それと明日の天気と、あと電気も全部消しておいてくれる？"])
      assert.ok(!isAffirmative(no), no);
  });
});
