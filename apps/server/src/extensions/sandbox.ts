import { fork, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { RouteContext, ServerExtensionApi, ToolDefinition, ToolRisk } from "@home-dashboard/extension-sdk";
import type { CallKind, FromChild, SerializedError, SerializedRouteResult, ToChild } from "./sandboxRunner.js";

/**
 * 持ち込んだ拡張機能（ZIP・リポジトリから入れたもの）を、本体とは別のプロセスで動かす。
 *
 * 拡張機能のリポジトリが乗っ取られて悪い版が入っても、本体の秘密（アカウント・.env・ほかの拡張機能のトークン）に触れないよう、
 * Node の権限の仕組み（--permission）で、読めるのは拡張機能のファイルとそのデータの置き場、書けるのはデータの置き場だけにする。
 * 子プロセス・ワーカー・ネイティブのアドオンは使えず、環境変数も渡さない（接続設定はその拡張機能の分だけ IPC で渡す）。
 * ネットへの通信は止められない（Node の権限の仕組みに無い）。
 *
 * 拡張機能が足した道・道具・機能の口は、本体の側に写しを作って api に登録し、呼ばれたら子へ回す。
 */

const here = dirname(fileURLToPath(import.meta.url));
// 本番ではビルドした .js、開発では .ts のまま起動する（Node 22 は型を消して読める。tsx は使わない。
// tsx は読み込むファイルの上の階層の package.json などを探すので、データの置き場の外を読もうとして止められる）
const RUNNER = existsSync(join(here, "sandboxRunner.js")) ? join(here, "sandboxRunner.js") : join(here, "sandboxRunner.ts");
// 子が読む必要のある本体のもの（起動する側のファイルと、それが読む zod などの部品）。apps/server の .env などは含めない
const SERVER_ROOT = resolve(here, "../..");
// package.json は、起動する側のファイルを ES モジュールとして読むために要る
const READABLE_FOR_RUNNER = [
  here,
  join(SERVER_ROOT, "package.json"),
  join(SERVER_ROOT, "node_modules"),
  resolve(SERVER_ROOT, "../../node_modules"),
];

/** 呼んだ答えが返るまでの上限（道具の確かめで画面の許可を待つのは本体の側なので、ここは長くしない） */
const CALL_TIMEOUT_MS = 60_000;
/** 読み込み（register）の上限 */
const START_TIMEOUT_MS = 20_000;

export interface SandboxHandle {
  /** 接続設定が変わったら送り直す */
  sendSettings(settings: ServerExtensionApi["settings"]): void;
  /** 後片付けをさせてから止める */
  stop(): void;
}

class SandboxError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

/** 道の返り値の、本体の側の形（host.ts の api.redirect などで作り直す） */
export type RouteResultFactory = (result: SerializedRouteResult) => unknown;

/**
 * 拡張機能を別のプロセスで読み込み、足したものを api に写す。読み込みに失敗したら投げる。
 * onExit は、途中で止まった（落ちた・止めた）ときに呼ぶ
 */
export async function startSandbox(
  api: ServerExtensionApi,
  options: {
    dir: string;
    toRouteResult: RouteResultFactory;
    onExit: (reason: string) => void;
  },
): Promise<SandboxHandle> {
  const { manifest } = api;
  const prefix = `[ext:${manifest.id}]`;
  const readable = [options.dir, api.dataDir, ...READABLE_FOR_RUNNER];
  const child: ChildProcess = fork(RUNNER, [], {
    execArgv: [
      // 開発で .ts のまま読むときの「型を消すのは試験中」の知らせを出さない
      "--disable-warning=ExperimentalWarning",
      "--permission",
      // 場所ごとに1つずつ渡す（カンマでつなぐ書き方は Node 22 で使えなくなった）
      ...readable.map((path) => `--allow-fs-read=${path}`),
      `--allow-fs-write=${api.dataDir}`,
    ],
    // 本体の環境変数（.env の秘密）は渡さない
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: process.env.NODE_ENV ?? "",
      TZ: process.env.TZ ?? "",
      LANG: process.env.LANG ?? "",
    },
    serialization: "advanced",
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });

  let nextCallId = 1;
  const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }>();
  let exited = false;

  const post = (message: ToChild) => {
    if (!exited && child.connected) child.send(message);
  };

  const call = (kind: CallKind, ref: number, args: unknown[], method?: string): Promise<unknown> => {
    if (exited) return Promise.reject(new SandboxError(`${manifest.name} は止まっています`, 503));
    const id = nextCallId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(new SandboxError(`${manifest.name} が時間内に答えませんでした`, 504));
      }, CALL_TIMEOUT_MS);
      waiting.set(id, { resolve, reject, timer });
      post({ t: "call", id, kind, ref, method, args });
    });
  };

  const fail = (error: SerializedError | undefined) =>
    new SandboxError(error?.message ?? "failed", error?.statusCode ?? undefined);

  const toTool = (message: Extract<FromChild, { t: "tool" }>): ToolDefinition => {
    // 子から届いた JSON Schema を zod に戻す（MCP の道具の一覧に出す引数の形）
    const shape = message.inputSchema ? (z.fromJSONSchema(message.inputSchema) as z.ZodObject).shape : null;
    const dynamicRisk = message.risk === "dynamic";
    return {
      name: message.name,
      description: message.description ?? (() => call("description", message.ref, []).then(String)),
      inputSchema: shape ? () => shape : undefined,
      readOnly: message.readOnly,
      // 引数で変わる危なさは子に尋ねる（道具の確かめは待てるので、答えは Promise でよい）
      risk: dynamicRisk
        ? ((args: unknown) => call("risk", message.ref, [args]) as Promise<ToolRisk>) as unknown as ToolDefinition["risk"]
        : (message.risk as ToolRisk | undefined),
      personal: message.personal,
      untrusted: message.untrusted,
      describe: message.describe ? (args) => call("describe", message.ref, [args]).then(String) : undefined,
      handler: (args, context) => call("tool", message.ref, [args, context]),
    };
  };

  const onMessage = (message: FromChild) => {
    switch (message.t) {
      case "route":
        api.route(message.method, message.path, async (ctx: RouteContext) => {
          const result = (await call("route", message.ref, [ctx])) as SerializedRouteResult;
          return options.toRouteResult(result);
        }, message.options);
        return;
      case "tool":
        api.tool(toTool(message));
        return;
      case "provide": {
        // 機能の口を持つ本体の拡張機能からは、ふつうのオブジェクトに見せる（呼ぶと Promise が返る）
        const implementation = Object.fromEntries(
          message.methods.map((method) => [method, (...args: unknown[]) => call("provision", message.ref, args, method)]),
        );
        api.provide(message.feature, implementation);
        return;
      }
      case "broadcast":
        api.broadcast(message.type, message.payload);
        return;
      case "log":
        api.log[message.level](message.message, message.detail ?? undefined);
        return;
      case "call":
        if (message.kind === "updateSettings") {
          api.updateSettings(message.args[0] as Parameters<ServerExtensionApi["updateSettings"]>[0]).then(
            () => post({ t: "result", id: message.id, ok: true }),
            (err: Error) => post({ t: "result", id: message.id, ok: false, error: { message: err.message, statusCode: null } }),
          );
        }
        return;
      case "result": {
        const pending = waiting.get(message.id);
        if (!pending) return;
        waiting.delete(message.id);
        clearTimeout(pending.timer);
        if (message.ok) pending.resolve(message.value);
        else pending.reject(fail(message.error));
        return;
      }
    }
  };

  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("読み込みが時間内に終わりませんでした")), START_TIMEOUT_MS);
    child.on("message", (message: FromChild) => {
      if (message.t === "ready") {
        clearTimeout(timer);
        resolve();
      } else if (message.t === "failed") {
        clearTimeout(timer);
        reject(new Error(message.error));
      } else {
        try {
          onMessage(message);
        } catch (err) {
          console.error(prefix, "別のプロセスからの登録を受けられませんでした:", err);
        }
      }
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`別のプロセスが止まりました（${signal ?? code}）`));
    });
  });

  child.on("exit", (code, signal) => {
    exited = true;
    for (const { reject, timer } of waiting.values()) {
      clearTimeout(timer);
      reject(new SandboxError(`${manifest.name} は止まりました`, 503));
    }
    waiting.clear();
    options.onExit(`別のプロセスが止まりました（${signal ?? `code ${code}`}）`);
  });
  child.on("error", (err) => console.error(prefix, "別のプロセスを動かせませんでした:", err));
  // 子が動いていることだけで本体を終われなくしない（本体が終われば、子は IPC が切れて自分で終わる）
  child.unref();
  child.channel?.unref();

  post({
    t: "init",
    manifest,
    serverPath: join(options.dir, "server.js"),
    dataDir: api.dataDir,
    configDir: api.configDir,
    settings: { ...api.settings },
  });

  try {
    await ready;
  } catch (err) {
    child.kill("SIGKILL");
    throw err;
  }

  return {
    sendSettings: (settings) => post({ t: "settings", settings: { ...settings } }),
    stop: () => {
      if (exited) return;
      post({ t: "dispose" });
      // 後片付けが終わらなければ止める
      setTimeout(() => !exited && child.kill("SIGKILL"), 2_000).unref();
    },
  };
}
