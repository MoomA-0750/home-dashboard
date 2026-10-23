/**
 * 持ち込んだ拡張機能を、本体とは別のプロセスで動かす側（sandbox.ts が Node の権限の仕組みを付けて起動する）。
 *
 * このプロセスが読めるのは拡張機能のファイルと、その拡張機能のデータの置き場だけで、書けるのはデータの置き場だけ。
 * 子プロセス・ワーカー・ネイティブのアドオンは使えず、環境変数（.env の秘密）も渡されない。
 * 本体とは IPC でやり取りし、拡張機能が足した道・道具・機能の口は本体の側に写しを作って、呼ばれたらここへ回してもらう。
 */
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type {
  ExtensionManifest,
  FeatureProvider,
  HttpMethod,
  RouteHandler,
  RouteOptions,
  ServerExtension,
  ServerExtensionApi,
  SettingValue,
  ToolDefinition,
} from "@home-dashboard/extension-sdk";

/** 本体から届くもの */
export type ToChild =
  | {
      t: "init";
      manifest: ExtensionManifest;
      serverPath: string;
      dataDir: string;
      configDir: string;
      settings: Record<string, SettingValue>;
    }
  | { t: "settings"; settings: Record<string, SettingValue> }
  | { t: "call"; id: number; kind: CallKind; ref: number; method?: string; args: unknown[] }
  | { t: "result"; id: number; ok: boolean; value?: unknown; error?: SerializedError }
  | { t: "dispose" };

/** 本体へ送るもの */
export type FromChild =
  | { t: "ready" }
  | { t: "failed"; error: string }
  | { t: "route"; ref: number; method: HttpMethod; path: string; options: RouteOptions }
  | {
      t: "tool";
      ref: number;
      name: string;
      description: string | null;
      inputSchema: Record<string, unknown> | null;
      readOnly: boolean;
      risk: ToolDefinition["risk"] extends infer R ? (R extends (...args: never[]) => unknown ? never : R) | "dynamic" : never;
      personal: boolean;
      untrusted: boolean;
      describe: boolean;
    }
  | { t: "provide"; ref: number; feature: string; methods: string[] }
  | { t: "broadcast"; type: string; payload: unknown }
  | { t: "log"; level: "info" | "warn" | "error"; message: string; detail: unknown }
  | { t: "call"; id: number; kind: "updateSettings"; args: unknown[] }
  | { t: "result"; id: number; ok: boolean; value?: unknown; error?: SerializedError };

export type CallKind = "route" | "tool" | "risk" | "describe" | "description" | "provision";

export interface SerializedError {
  message: string;
  statusCode: number | null;
}

/** 道の返り値を、本体へ送れる形にしたもの */
export type SerializedRouteResult =
  | { kind: "json"; body: unknown }
  | { kind: "redirect"; url: string }
  | { kind: "text"; body: string; statusCode: number }
  | { kind: "file"; body: Uint8Array; contentType: string; cacheSeconds: number };

// 開発でも Node が型を消すだけで読めるよう、TypeScript だけの書き方（引数で持つ readonly など）は使わない
class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

class RouteResponse {
  result: SerializedRouteResult;
  constructor(result: SerializedRouteResult) {
    this.result = result;
  }
}

function send(message: FromChild): void {
  process.send?.(message);
}

function serializeError(err: unknown): SerializedError {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  return {
    message: err instanceof Error ? err.message : String(err),
    statusCode: typeof status === "number" && status >= 400 && status < 600 ? status : null,
  };
}

// 本体へ頼んだことの答え待ち
let nextCallId = 1;
const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();

function callParent(kind: "updateSettings", args: unknown[]): Promise<unknown> {
  const id = nextCallId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    send({ t: "call", id, kind, args });
  });
}

// 本体から呼ばれるもの（道・道具・機能の口）を番号で覚える
let nextRef = 1;
const routes = new Map<number, RouteHandler>();
const tools = new Map<number, ToolDefinition>();
const provisions = new Map<number, Record<string, unknown>>();
const disposers: Array<() => void> = [];
let settings: Record<string, SettingValue> = {};
const settingsListeners: Array<() => void> = [];

async function routeResult(value: unknown): Promise<SerializedRouteResult> {
  const result = await value;
  if (result instanceof RouteResponse) return result.result;
  return { kind: "json", body: result ?? { ok: true } };
}

async function handleCall(message: Extract<ToChild, { t: "call" }>): Promise<unknown> {
  switch (message.kind) {
    case "route": {
      const handler = routes.get(message.ref);
      if (!handler) throw new Error("route not found");
      return routeResult(handler(message.args[0] as Parameters<RouteHandler>[0]));
    }
    case "tool":
    case "risk":
    case "describe":
    case "description": {
      const tool = tools.get(message.ref);
      if (!tool) throw new Error("tool not found");
      const args = (message.args[0] ?? {}) as never;
      if (message.kind === "tool") return tool.handler(args, message.args[1] as never);
      if (message.kind === "risk") return typeof tool.risk === "function" ? tool.risk(args) : tool.risk;
      if (message.kind === "describe") return tool.describe?.(args);
      return typeof tool.description === "function" ? tool.description() : tool.description;
    }
    case "provision": {
      const target = provisions.get(message.ref);
      const method = message.method ? target?.[message.method] : undefined;
      if (typeof method !== "function") throw new Error("method not found");
      return method.apply(target, message.args);
    }
  }
}

/** 機能の口に渡すものの、呼べるもの（自分のものと、クラスの持つもの）の名前 */
function methodNames(value: Record<string, unknown>): string[] {
  const names = new Set<string>();
  for (let o: object | null = value; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const name of Object.getOwnPropertyNames(o)) {
      if (name !== "constructor" && typeof (value as Record<string, unknown>)[name] === "function") names.add(name);
    }
  }
  return [...names];
}

function makeApi(init: Extract<ToChild, { t: "init" }>): ServerExtensionApi {
  const prefix = `[ext:${init.manifest.id}]`;
  return {
    manifest: init.manifest,
    dataDir: init.dataDir,
    // 渡すが、読む権限は無い（家だけの設定を読ませない）
    configDir: init.configDir,
    get settings() {
      return settings;
    },
    onSettingsChange: (listener) => settingsListeners.push(listener),
    updateSettings: async (values) => {
      await callParent("updateSettings", [values]);
    },
    route: (method, path, handler, options = {}) => {
      const ref = nextRef++;
      routes.set(ref, handler);
      send({ t: "route", ref, method, path, options });
    },
    tool: (definition) => {
      const ref = nextRef++;
      const tool = definition as unknown as ToolDefinition;
      tools.set(ref, tool);
      const shape = tool.inputSchema?.(z);
      send({
        t: "tool",
        ref,
        name: tool.name,
        description: typeof tool.description === "string" ? tool.description : null,
        // 引数の形は JSON Schema にして渡し、本体の側で zod に戻す
        inputSchema: shape ? (z.toJSONSchema(z.object(shape)) as Record<string, unknown>) : null,
        readOnly: tool.readOnly === true,
        risk: typeof tool.risk === "function" ? "dynamic" : tool.risk,
        personal: tool.personal === true,
        untrusted: tool.untrusted === true,
        describe: typeof tool.describe === "function",
      } as FromChild);
    },
    provide: (feature, implementation) => {
      const ref = nextRef++;
      const target = implementation as Record<string, unknown>;
      provisions.set(ref, target);
      send({ t: "provide", ref, feature, methods: methodNames(target) });
    },
    // ほかの拡張機能の機能の口は使えない（入っている拡張機能の秘密を、本体を通して読み出させないため）。
    // 機能の口を「持つ」側（provide）にはなれる
    providers: <T>(feature: string): FeatureProvider<T>[] => {
      send({
        t: "log",
        level: "warn",
        message: `別のプロセスで動く拡張機能からは、ほかの拡張機能の機能の口（${feature}）を使えません`,
        detail: null,
      });
      return [];
    },
    broadcast: (type, payload) => send({ t: "broadcast", type, payload }),
    error: (statusCode, message) => new HttpError(statusCode, message),
    redirect: (url) => new RouteResponse({ kind: "redirect", url }),
    text: (body, statusCode = 200) => new RouteResponse({ kind: "text", body, statusCode }),
    file: (body, contentType, options) =>
      new RouteResponse({ kind: "file", body, contentType, cacheSeconds: Math.max(0, Math.floor(options?.cacheSeconds ?? 0)) }),
    log: {
      info: (message, detail) => send({ t: "log", level: "info", message, detail: detail ?? null }),
      warn: (message, detail) => send({ t: "log", level: "warn", message, detail: detail ?? null }),
      error: (message, detail) => send({ t: "log", level: "error", message, detail: detail ?? null }),
    },
    onDispose: (listener) => disposers.push(listener),
  };
}

async function start(init: Extract<ToChild, { t: "init" }>): Promise<void> {
  settings = init.settings;
  try {
    const module = (await import(pathToFileURL(init.serverPath).href)) as { default?: ServerExtension };
    if (typeof module.default?.register !== "function") throw new Error("server.js の default export に register がありません");
    await module.default.register(makeApi(init));
    send({ t: "ready" });
  } catch (err) {
    send({ t: "failed", error: err instanceof Error ? err.message : String(err) });
  }
}

process.on("message", (message: ToChild) => {
  switch (message.t) {
    case "init":
      void start(message);
      return;
    case "settings":
      settings = message.settings;
      for (const listener of settingsListeners) {
        try {
          listener();
        } catch (err) {
          send({ t: "log", level: "error", message: "接続設定の変化の受け取りに失敗しました", detail: String(err) });
        }
      }
      return;
    case "call":
      handleCall(message).then(
        (value) => send({ t: "result", id: message.id, ok: true, value }),
        (err) => send({ t: "result", id: message.id, ok: false, error: serializeError(err) }),
      );
      return;
    case "result": {
      const pending = waiting.get(message.id);
      waiting.delete(message.id);
      if (!pending) return;
      if (message.ok) pending.resolve(message.value);
      else pending.reject(Object.assign(new Error(message.error?.message ?? "failed"), { statusCode: message.error?.statusCode }));
      return;
    }
    case "dispose":
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          // 後片付けの失敗で止まらない
        }
      }
      process.exit(0);
  }
});

// 本体が先に終わったら、こちらも終わる
process.on("disconnect", () => process.exit(0));
