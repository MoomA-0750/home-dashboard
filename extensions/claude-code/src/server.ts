import { cachedLoader, defineServerExtension, HttpError, type Locale } from "@home-dashboard/extension-sdk";
import {
  authorizedKeysLine,
  BRIDGE_FILE,
  BRIDGE_VERSION,
  BridgeFailure,
  dropAllConnections,
  dropConnection,
  ensureKeyPair,
  REMOTE_COMMAND,
  runBridge,
  writeSelfScript,
} from "./bridge";
import { MachineStore, validateMachine } from "./machines";
import { BRIDGE_SOURCE } from "./script";
import { MESSAGE_KEYS, messages, type MessageKey } from "./messages";
import type {
  AgentAction,
  HerdrState,
  LogChunk,
  MachineConfig,
  MachineHello,
  MachineOverview,
  SessionSummary,
} from "./types";

/**
 * Claude Code の拡張機能のサーバー側。登録した機械（SSH の先・この機械）の Claude Code のセッションを読み、
 * Herdr があればそのエージェントを操作する。どの道も管理者だけ（指示を送れるのは、その機械でコマンドを動かせるのと同じ）。
 * - GET /overview … 全部の機械のセッションと Herdr の様子
 * - GET /machines/:id/log … 1つのセッションのやり取り（?session=&from= か &before=）
 * - GET /machines/:id/screen … Herdr のエージェントの今の画面（?pane=）
 * - POST /machines/:id/action … 指示・キー・Herdr で開く・新しく始める
 * - /machines … 設定画面の機械の登録
 */

const ADMIN = { adminOnly: true } as const;

function known(code: string): code is MessageKey {
  return MESSAGE_KEYS.has(code);
}

/** 仲介スクリプト・SSH の失敗を、画面に出す文にする */
function describeFailure(err: unknown, locale: Locale, host = ""): string {
  if (!(err instanceof BridgeFailure))
    return messages.t(locale, "failed", {
      detail: String((err as Error)?.message ?? err),
    });
  if (err.code.startsWith("herdr: ")) {
    const detail = err.code.slice("herdr: ".length);
    if (detail.includes("agent_blocked")) return messages.t(locale, "agentBlocked");
    return messages.t(locale, "herdrFailed", { detail });
  }
  if (known(err.code)) return messages.t(locale, err.code, { host, detail: err.detail });
  return messages.t(locale, "failed", { detail: err.message });
}

function asHttpError(err: unknown, locale: Locale, machine?: MachineConfig): HttpError {
  if (err instanceof HttpError) return err;
  const status = err instanceof BridgeFailure && /^(bad-|empty-|prompt-|cwd-|session-not)/.test(err.code) ? 400 : 502;
  return new HttpError(status, describeFailure(err, locale, machine?.host ?? machine?.name ?? ""));
}

const int = (value: string | undefined) =>
  value === undefined || value === "" ? undefined : Number.parseInt(value, 10);

export default defineServerExtension({
  register(api) {
    const store = new MachineStore(api.dataDir);
    api.onDispose(dropAllConnections);
    // 同じ機械（self）で動かすときのために、仲介スクリプトをデータ置き場に書き出しておく
    const selfScript = writeSelfScript(api.dataDir, BRIDGE_SOURCE);
    selfScript.catch((err: Error) => api.log.warn(`仲介スクリプトを書き出せませんでした: ${err.message}`));
    async function call<T>(
      machine: MachineConfig,
      command: string,
      args: Record<string, unknown> = {},
      timeoutMs?: number,
    ) {
      if (machine.type === "self") await selfScript;
      return runBridge<T>(machine, api.dataDir, command, args, timeoutMs);
    }

    // 何台もの画面が数秒ごとに読んでも、機械へ聞きに行くのは 3 秒に1回まで
    const overview = cachedLoader(3_000);

    async function readMachine(machine: MachineConfig, locale: Locale): Promise<MachineOverview> {
      try {
        const reply = await call<{
          sessions: SessionSummary[];
          herdr: HerdrState | null;
        }>(machine, "overview", { days: 21, limit: 80 }, 30_000);
        return {
          id: machine.id,
          name: machine.name,
          ok: true,
          sessions: reply.sessions,
          herdr: reply.herdr,
        };
      } catch (err) {
        return {
          id: machine.id,
          name: machine.name,
          ok: false,
          error: describeFailure(err, locale, machine.host ?? machine.name),
          sessions: [],
          herdr: null,
        };
      }
    }

    api.route(
      "GET",
      "/overview",
      async ({ locale }) =>
        overview(locale, async () => {
          const machines = await store.list();
          return {
            machines: await Promise.all(machines.map((m) => readMachine(m, locale))),
          };
        }),
      ADMIN,
    );

    api.route(
      "GET",
      "/machines/:id/log",
      async ({ params, query, locale }) => {
        const machine = await store.get(params.id, locale);
        try {
          return await call<LogChunk>(machine, "log", {
            sessionId: query.session ?? "",
            from: int(query.from),
            before: int(query.before),
            limit: int(query.limit) ?? 200,
          });
        } catch (err) {
          throw asHttpError(err, locale, machine);
        }
      },
      ADMIN,
    );

    api.route(
      "GET",
      "/machines/:id/screen",
      async ({ params, query, locale }) => {
        const machine = await store.get(params.id, locale);
        try {
          return await call<{ text: string }>(machine, "screen", {
            pane: query.pane ?? "",
            lines: int(query.lines) ?? 60,
          });
        } catch (err) {
          throw asHttpError(err, locale, machine);
        }
      },
      ADMIN,
    );

    api.route(
      "POST",
      "/machines/:id/action",
      async ({ params, body, locale }) => {
        const machine = await store.get(params.id, locale);
        const input = (body ?? {}) as AgentAction;
        const { action, ...args } = input;
        if (!["prompt", "keys", "focus", "start"].includes(action)) throw new HttpError(400, "unknown action");
        try {
          const result = await call<Record<string, unknown>>(
            machine,
            action,
            args,
            action === "start" ? 75_000 : 65_000,
          );
          return { ok: true, ...result };
        } catch (err) {
          throw asHttpError(err, locale, machine);
        }
      },
      ADMIN,
    );

    // --- 設定画面（機械の登録）

    api.route("GET", "/machines", async () => ({ machines: await store.list() }), ADMIN);
    api.route("POST", "/machines", ({ body, locale }) => store.create(body, locale), ADMIN);
    api.route(
      "PUT",
      "/machines/:id",
      async ({ params, body, locale }) => {
        const machine = await store.update(params.id, body, locale);
        dropConnection(machine.id);
        return machine;
      },
      ADMIN,
    );
    api.route(
      "DELETE",
      "/machines/:id",
      async ({ params, locale }) => {
        await store.remove(params.id, locale);
        dropConnection(params.id);
        return { ok: true };
      },
      ADMIN,
    );

    // 保存する前の値でつないで確かめる（つながりは残さない）
    api.route(
      "POST",
      "/machines-test",
      async ({ body, locale }) => {
        let machine: MachineConfig;
        try {
          machine = validateMachine({ ...((body ?? {}) as object), id: "draft" }, locale);
        } catch (err) {
          if (err instanceof HttpError) return { ok: false, message: err.message };
          throw err;
        }
        try {
          const hello = await call<MachineHello>(machine, "hello", {}, 12_000);
          if ((hello.version ?? 0) < BRIDGE_VERSION) return { ok: false, message: messages.t(locale, "bridgeOld") };
          const parts = [
            hello.herdr ? messages.t(locale, "herdrVersion", { version: hello.herdr }) : messages.t(locale, "noHerdr"),
          ];
          if (!hello.claude) parts.push(messages.t(locale, "noClaude"));
          return {
            ok: true,
            message: messages.t(locale, "connected", {
              hostname: hello.hostname,
              herdr: parts.join("。"),
            }),
          };
        } catch (err) {
          return {
            ok: false,
            message: describeFailure(err, locale, machine.host ?? ""),
            fingerprint: err instanceof BridgeFailure ? err.observedFingerprint : undefined,
          };
        } finally {
          dropConnection("draft");
        }
      },
      ADMIN,
    );

    // 相手に足してもらう鍵の1行と、仲介スクリプトの入れ方
    api.route(
      "GET",
      "/ssh-key",
      async () => {
        const { publicKey } = await ensureKeyPair(api.dataDir);
        return {
          publicKey: publicKey.trim(),
          authorizedKeysLine: authorizedKeysLine(publicKey),
          command: REMOTE_COMMAND,
          bridgeFile: BRIDGE_FILE,
        };
      },
      ADMIN,
    );

    // 仲介スクリプトそのもの（保存して相手の ~/.local/bin に置く）
    api.route("GET", "/bridge", () => api.file(new TextEncoder().encode(BRIDGE_SOURCE), "text/x-python"), ADMIN);
  },
});
