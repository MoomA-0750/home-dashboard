import { createRequire as __hdCreateRequire } from 'node:module'; import { fileURLToPath as __hdFileURLToPath } from 'node:url'; import { dirname as __hdDirnameOf } from 'node:path'; const require = __hdCreateRequire(import.meta.url); const __hdFilename = __hdFileURLToPath(import.meta.url); const __hdDirname = __hdDirnameOf(__hdFilename);

// extensions/imessage/src/server.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

// packages/extension-sdk/src/index.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
};
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

// extensions/imessage/src/client.ts
import { request as httpsRequest } from "node:https";
var TIMEOUT_MS = 15e3;
var MAX_RESPONSE_BYTES = 110 * 1024 * 1024;
var httpsTransport = (req, ca) => new Promise((resolve, reject) => {
  const r = httpsRequest(
    req.url,
    {
      method: req.method,
      headers: req.headers,
      // undefined なら Node の持っている CA で確かめる（Tailscale Serve の本物の証明書）
      ca: ca ?? void 0,
      timeout: TIMEOUT_MS
    },
    (res) => {
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          res.destroy(new Error("response too large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on(
        "end",
        () => resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers["content-type"] ?? ""),
          body: Buffer.concat(chunks)
        })
      );
      res.on("error", reject);
    }
  );
  r.on("timeout", () => r.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
  r.on("error", reject);
  r.end(req.body);
});
function normalizePem(text) {
  const blocks = [...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)];
  if (blocks.length === 0) return null;
  const pems = blocks.map((block) => {
    const base64 = block[1].replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) return null;
    const lines = base64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN CERTIFICATE-----
${lines.join("\n")}
-----END CERTIFICATE-----
`;
  });
  return pems.includes(null) ? null : pems.join("");
}
var messages = defineServerMessages({
  ja: {
    badToken: "imsg-web \u304C\u30C8\u30FC\u30AF\u30F3\u3092\u53D7\u3051\u4ED8\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002Mac \u3067\u767A\u884C\u3057\u76F4\u3057\u3066\u3001\u63A5\u7D9A\u8A2D\u5B9A\u306B\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    fromBrowser: "imsg-web \u304C\u30D6\u30E9\u30A6\u30B6\u304B\u3089\u306E\u547C\u3073\u51FA\u3057\u3068\u307F\u306A\u3057\u3066\u65AD\u308A\u307E\u3057\u305F",
    readOnly: "\u3053\u306E\u30C8\u30FC\u30AF\u30F3\u3067\u306F\u3067\u304D\u307E\u305B\u3093\uFF08\u8AAD\u3080\u3060\u3051\u306E\u30C8\u30FC\u30AF\u30F3\u3067\u3059\uFF09",
    notFound: "\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F",
    stale: "\u4F1A\u8A71\u306E\u4E00\u89A7\u304C\u65B0\u3057\u304F\u306A\u308A\u307E\u3057\u305F\u3002\u8AAD\u307F\u76F4\u3057\u307E\u3059",
    tooLarge: "\u30D5\u30A1\u30A4\u30EB\u304C\u5927\u304D\u3059\u304E\u307E\u3059",
    busy: "imsg-web \u304C\u6DF7\u3093\u3067\u3044\u307E\u3059\uFF08\u9001\u308B\u306E\u306F1\u5206\u306B10\u4EF6\u307E\u3067\uFF09\u3002\u5C11\u3057\u5F85\u3063\u3066\u304F\u3060\u3055\u3044",
    failed: (p) => `imsg-web \u3067\u3046\u307E\u304F\u3044\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08${p.status}${p.code ? ` ${p.code}` : ""}\uFF09`,
    certName: "imsg-web \u306E\u8A3C\u660E\u66F8\u304C\u3053\u306E URL \u306E\u540D\u524D\u3092\u542B\u3093\u3067\u3044\u307E\u305B\u3093\u3002\u8A3C\u660E\u66F8\u3092\u4F5C\u3063\u305F\u3068\u304D\u306E\u540D\u524D\u304B IP \u30A2\u30C9\u30EC\u30B9\u3067\u3064\u306A\u3044\u3067\u304F\u3060\u3055\u3044",
    certUnverified: "imsg-web \u306E\u8A3C\u660E\u66F8\u3092\u78BA\u304B\u3081\u3089\u308C\u307E\u305B\u3093\u3002Mac \u306E state/tls/cert.pem \u3092\u63A5\u7D9A\u8A2D\u5B9A\u306E\u300C\u8A3C\u660E\u66F8\u300D\u306B\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    timeout: "imsg-web \u304B\u3089\u8FD4\u4E8B\u304C\u3042\u308A\u307E\u305B\u3093",
    unreachable: (p) => `imsg-web \u306B\u3064\u306A\u304C\u308A\u307E\u305B\u3093${p.code ? `\uFF08${p.code}\uFF09` : ""}`,
    notConfigured: "imsg-web \u306E URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u3001\u62E1\u5F35\u6A5F\u80FD\u300CiMessage\u300D\u306E\u63A5\u7D9A\u8A2D\u5B9A\u306B\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    rateLimited: "imsg-web \u3078\u306E\u554F\u3044\u5408\u308F\u305B\u304C\u591A\u3059\u304E\u308B\u306E\u3067\u3001\u5C11\u3057\u5F85\u3063\u3066\u3044\u307E\u3059",
    badResponse: "imsg-web \u306E\u7B54\u3048\u304C\u8AAD\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
    // ./server
    httpsOnly: "imsg-web \u306E URL \u306F https:// \u304B\u3089\u59CB\u3081\u3066\u304F\u3060\u3055\u3044",
    badCert: "\u63A5\u7D9A\u8A2D\u5B9A\u306E\u8A3C\u660E\u66F8\u304C\u8AAD\u3081\u307E\u305B\u3093\u3002cert.pem \u306E\u4E2D\u8EAB\u3092 BEGIN \u304B\u3089 END \u307E\u3067\u8CBC\u3063\u3066\u304F\u3060\u3055\u3044",
    forbidden: "\u3053\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u3067\u306F iMessage \u3092\u898B\u3089\u308C\u307E\u305B\u3093",
    needUrlToken: "URL \u3068\u30C8\u30FC\u30AF\u30F3\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044",
    canRead: "\u4F1A\u8A71\u3092\u8AAD\u3081\u307E\u3059",
    cannotRead: "\u4F1A\u8A71\u3092\u8AAD\u3081\u306A\u3044\u72B6\u614B\u3067\u3059",
    cannotSend: "\u9001\u308C\u307E\u305B\u3093\uFF08\u8AAD\u3080\u3060\u3051\u306E\u30C8\u30FC\u30AF\u30F3\uFF09",
    dryRun: "\u9001\u308B\u64CD\u4F5C\u306F\u8A66\u3057\u3060\u3051\uFF08imsg-web \u304C dry-run\uFF09",
    canSend: "\u9001\u308C\u307E\u3059",
    connected: "\u3064\u306A\u304C\u308A\u307E\u3057\u305F\u3002{chats}\u3002{sending}",
    emptyFile: "\u30D5\u30A1\u30A4\u30EB\u304C\u7A7A\u3067\u3059",
    noChat: "\u9001\u308B\u4F1A\u8A71\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044",
    nothingToSend: "\u9001\u308B\u3082\u306E\u304C\u3042\u308A\u307E\u305B\u3093",
    tooManyFiles: "\u30D5\u30A1\u30A4\u30EB\u306F{max}\u500B\u307E\u3067\u3067\u3059",
    tooLong: "\u6587\u304C\u9577\u3059\u304E\u307E\u3059\uFF08\u65E5\u672C\u8A9E\u3067\u304A\u3088\u305D600\u6587\u5B57\u307E\u3067\uFF09\u3002\u5206\u3051\u3066\u9001\u3063\u3066\u304F\u3060\u3055\u3044"
  },
  en: {
    badToken: "imsg-web didn't accept the token. Issue a new one on the Mac and enter it in the connection settings",
    fromBrowser: "imsg-web refused the request as coming from a browser",
    readOnly: "This token can't do that (it's read-only)",
    notFound: "Not found",
    stale: "The conversation list changed. Reloading",
    tooLarge: "The file is too large",
    busy: "imsg-web is busy (up to 10 sends per minute). Please wait a moment",
    failed: (p) => `imsg-web ran into a problem (${p.status}${p.code ? ` ${p.code}` : ""})`,
    certName: "imsg-web's certificate doesn't include this URL's host name. Connect using the name or IP address the certificate was made for",
    certUnverified: `Couldn't verify imsg-web's certificate. Put the Mac's state/tls/cert.pem in the "Certificate" connection setting`,
    timeout: "No response from imsg-web",
    unreachable: (p) => `Can't connect to imsg-web${p.code ? ` (${p.code})` : ""}`,
    notConfigured: "Enter the imsg-web URL and token in the iMessage extension's connection settings",
    rateLimited: "Too many requests to imsg-web; waiting a moment",
    badResponse: "Couldn't read imsg-web's response",
    httpsOnly: "The imsg-web URL must start with https://",
    badCert: "Couldn't read the certificate in the connection settings. Paste the contents of cert.pem from BEGIN to END",
    forbidden: "This account can't view iMessage",
    needUrlToken: "Enter the URL and token",
    canRead: "Conversations can be read",
    cannotRead: "Conversations can't be read right now",
    cannotSend: "Can't send (read-only token)",
    dryRun: "Sending is a dry run only (imsg-web is in dry-run mode)",
    canSend: "Can send",
    connected: "Connected. {chats}. {sending}",
    emptyFile: "The file is empty",
    noChat: "Choose a conversation to send to",
    nothingToSend: "Nothing to send",
    tooManyFiles: "Up to {max} files",
    tooLong: "The message is too long (about 2,000 English characters max). Split it into several messages"
  }
});
var ImsgError = class extends HttpError {
  constructor(statusCode, key, params) {
    super(statusCode, messages.t("ja", key, params));
    this.key = key;
    this.params = params;
  }
};
function localizeError(err, locale) {
  return err instanceof ImsgError && locale !== "ja" ? new HttpError(err.statusCode, messages.t(locale, err.key, err.params)) : err;
}
function describeFailure(status, code) {
  switch (status) {
    case 401:
      return new ImsgError(502, "badToken");
    case 403:
      return code === "CLIENT_FROM_BROWSER" ? new ImsgError(502, "fromBrowser") : new ImsgError(403, "readOnly");
    case 404:
      return new ImsgError(404, "notFound");
    case 409:
      return new ImsgError(409, "stale");
    case 413:
      return new ImsgError(413, "tooLarge");
    case 429:
      return new ImsgError(429, "busy");
    default:
      return new ImsgError(502, "failed", { status, code: code ?? "" });
  }
}
var CERT_ERRORS = /* @__PURE__ */ new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID"
]);
function describeNetworkError(err) {
  const code = err?.code ?? "";
  if (CERT_ERRORS.has(code)) {
    return new ImsgError(502, code === "ERR_TLS_CERT_ALTNAME_INVALID" ? "certName" : "certUnverified");
  }
  if (code === "ETIMEDOUT") return new ImsgError(504, "timeout");
  return new ImsgError(502, "unreachable", { code });
}
var RateBudget = class {
  constructor(limit = 110, now = Date.now) {
    this.limit = limit;
    this.now = now;
  }
  stamps = [];
  /** 使えるなら数えて true。bulk（顔写真・画像）は上限の 3/4 まで */
  take(bulk) {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => s > t - 6e4);
    if (this.stamps.length >= (bulk ? Math.floor(this.limit * 3 / 4) : this.limit)) return false;
    this.stamps.push(t);
    return true;
  }
};
var FILE_CACHE_BYTES = 64 * 1024 * 1024;
var LIST_TTL_MS = 1e4;
var ImsgClient = class {
  constructor(config, transport = httpsTransport, budget = new RateBudget(), now = Date.now) {
    this.config = config;
    this.transport = transport;
    this.budget = budget;
    this.now = now;
  }
  chatsCache = null;
  historyCache = /* @__PURE__ */ new Map();
  capabilitiesCache = null;
  files = /* @__PURE__ */ new Map();
  filesBytes = 0;
  epoch = null;
  inflight = /* @__PURE__ */ new Map();
  /** 接続設定が変わったとき */
  reset() {
    this.chatsCache = null;
    this.capabilitiesCache = null;
    this.forgetEpoch();
  }
  forgetEpoch() {
    this.historyCache.clear();
    this.files.clear();
    this.filesBytes = 0;
  }
  /** epoch が変わったら、前の epoch の id で覚えているものを捨てる */
  seeEpoch(epoch) {
    if (this.epoch !== null && this.epoch !== epoch) this.forgetEpoch();
    this.epoch = epoch;
  }
  async call(method, path, options = {}) {
    const config = this.config();
    if (!config) throw new ImsgError(503, "notConfigured");
    if (!this.budget.take(options.bulk ?? false)) {
      throw new ImsgError(429, "rateLimited");
    }
    const headers = { authorization: `Bearer ${config.token}`, accept: "application/json, */*" };
    if (options.contentType) headers["content-type"] = options.contentType;
    let res;
    try {
      res = await this.transport({ method, url: new URL(path, config.url), headers, body: options.body }, config.ca);
    } catch (err) {
      throw describeNetworkError(err);
    }
    if (res.status >= 200 && res.status < 300) return res;
    let code;
    try {
      code = JSON.parse(res.body.toString("utf-8")).code;
    } catch {
      code = void 0;
    }
    if (res.status === 409) this.reset();
    throw describeFailure(res.status, code);
  }
  async json(method, path, body) {
    const res = await this.call(method, path, {
      body: body === void 0 ? void 0 : Buffer.from(JSON.stringify(body)),
      contentType: body === void 0 ? void 0 : "application/json"
    });
    try {
      return JSON.parse(res.body.toString("utf-8"));
    } catch {
      throw new ImsgError(502, "badResponse");
    }
  }
  /** 同じものを同時に何台もが求めたら、1回だけ問い合わせる */
  once(key, task) {
    const running = this.inflight.get(key);
    if (running) return running;
    const promise = task().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
  async capabilities() {
    if (this.capabilitiesCache && this.capabilitiesCache.expiresAt > this.now()) return this.capabilitiesCache.value;
    return this.once("capabilities", async () => {
      const value = await this.json("GET", "/api/capabilities");
      this.seeEpoch(value.epoch);
      this.capabilitiesCache = { value, expiresAt: this.now() + 6e4 };
      return value;
    });
  }
  async chats() {
    if (this.chatsCache && this.chatsCache.expiresAt > this.now()) return this.chatsCache.value;
    return this.once("chats", async () => {
      const value = await this.json("GET", "/api/chats?limit=50");
      this.seeEpoch(value.epoch);
      this.chatsCache = { value, expiresAt: this.now() + LIST_TTL_MS };
      return value;
    });
  }
  async messages(chatId) {
    const hit = this.historyCache.get(chatId);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    return this.once(`messages:${chatId}`, async () => {
      const value = await this.json("GET", `/api/chats/${encodeURIComponent(chatId)}/messages?limit=50`);
      this.seeEpoch(value.epoch);
      this.historyCache.set(chatId, { value, expiresAt: this.now() + LIST_TTL_MS });
      return value;
    });
  }
  /** 画像・録音（attachments）と顔写真（avatars）。覚えておいて、何台もの端末に同じものを配る */
  async file(kind, id) {
    const key = `${kind}/${id}`;
    const hit = this.files.get(key);
    if (hit) return hit;
    return this.once(key, async () => {
      const res = await this.call("GET", `/api/${kind}/${encodeURIComponent(id)}`, { bulk: true });
      const file = { type: res.contentType, body: res.body };
      if (res.body.length <= FILE_CACHE_BYTES / 4) {
        this.files.set(key, file);
        this.filesBytes += res.body.length;
        for (const [oldKey, old] of this.files) {
          if (this.filesBytes <= FILE_CACHE_BYTES) break;
          this.files.delete(oldKey);
          this.filesBytes -= old.body.length;
        }
      }
      return file;
    });
  }
  async upload(name, bytes) {
    const res = await this.call("POST", `/api/uploads?name=${encodeURIComponent(name)}`, {
      body: bytes,
      contentType: "application/octet-stream"
    });
    return JSON.parse(res.body.toString("utf-8"));
  }
  /** 送る。結果がどうであれ、一覧とその会話の履歴は次に読み直す */
  async send(input) {
    try {
      return await this.json("POST", "/api/send", input);
    } finally {
      this.chatsCache = null;
      this.historyCache.delete(input.chatId);
    }
  }
};

// extensions/imessage/src/server.ts
var MAX_UPLOADS = 10;
var MAX_SEND_BYTES = 2048;
var server_default = defineServerExtension({
  register(api) {
    const certFile = join(api.configDir, "imessage", "cert.pem");
    const config = () => {
      const url = String(api.settings.url ?? "").trim();
      const token = String(api.settings.token ?? "").trim();
      if (!url || !token) return null;
      if (!url.startsWith("https://")) throw new ImsgError(400, "httpsOnly");
      const pasted = String(api.settings.cert ?? "").trim();
      if (pasted) {
        const ca2 = normalizePem(pasted);
        if (!ca2) throw new ImsgError(400, "badCert");
        return { url, token, ca: ca2 };
      }
      let ca = null;
      try {
        ca = normalizePem(readFileSync(certFile, "utf-8"));
      } catch {
        ca = null;
      }
      return { url, token, ca };
    };
    const client = new ImsgClient(config);
    api.onSettingsChange(() => client.reset());
    const allowed = (account) => account !== null && (account.role === "admin" || api.settings.members === true);
    const guard = (account) => {
      if (!allowed(account)) throw new ImsgError(403, "forbidden");
    };
    const route = (...[method, path, handler, options]) => api.route(
      method,
      path,
      async (ctx) => {
        try {
          return await handler(ctx);
        } catch (err) {
          throw localizeError(err, ctx.locale);
        }
      },
      options
    );
    route("GET", "/status", async ({ account, locale }) => {
      if (!allowed(account)) return { allowed: false, configured: false, canSend: false, error: null };
      let configured = false;
      try {
        configured = config() !== null;
        if (!configured) return { allowed: true, configured, canSend: false, error: null };
        const caps = await client.capabilities();
        const send = caps.features.send;
        return {
          allowed: true,
          configured,
          canSend: send?.state === "available",
          dryRun: send?.reasonCode === "SEND_DRY_RUN",
          error: null
        };
      } catch (err) {
        const shown = localizeError(err, locale);
        return { allowed: true, configured, canSend: false, error: shown instanceof Error ? shown.message : String(shown) };
      }
    });
    route(
      "POST",
      "/test",
      async ({ locale }) => {
        try {
          if (!config()) return { ok: false, message: messages.t(locale, "needUrlToken") };
          client.reset();
          const caps = await client.capabilities();
          const send = caps.features.send;
          const chats = messages.t(locale, caps.features.chats?.state === "available" ? "canRead" : "cannotRead");
          const sending = send?.state !== "available" ? messages.t(locale, "cannotSend") : send.reasonCode === "SEND_DRY_RUN" ? messages.t(locale, "dryRun") : messages.t(locale, "canSend");
          return { ok: true, message: messages.t(locale, "connected", { chats, sending }) };
        } catch (err) {
          const shown = localizeError(err, locale);
          return { ok: false, message: shown instanceof Error ? shown.message : String(shown) };
        }
      },
      { adminOnly: true }
    );
    route("GET", "/chats", async ({ account }) => {
      guard(account);
      const { chats } = await client.chats();
      return { chats };
    });
    route("GET", "/chats/:id/messages", async ({ account, params }) => {
      guard(account);
      const { messages: messages2 } = await client.messages(params.id);
      return { messages: messages2 };
    });
    for (const kind of ["attachments", "avatars"]) {
      route("GET", `/${kind}/:id`, async ({ account, params }) => {
        guard(account);
        const file = await client.file(kind, params.id);
        return api.file(file.body, file.type, { cacheSeconds: 3600 });
      });
    }
    route("POST", "/uploads", async ({ account, query, body }) => {
      guard(account);
      if (!Buffer.isBuffer(body) || body.length === 0) throw new ImsgError(400, "emptyFile");
      const name = String(query.name ?? "file").slice(0, 120) || "file";
      return client.upload(name, body);
    });
    route("POST", "/send", async ({ account, body }) => {
      guard(account);
      const raw = body ?? {};
      const chatId = typeof raw.chatId === "string" ? raw.chatId : "";
      const text = typeof raw.text === "string" ? raw.text.trim() : "";
      const uploadIds = Array.isArray(raw.uploadIds) ? raw.uploadIds.filter((id) => typeof id === "string") : [];
      if (!chatId) throw new ImsgError(400, "noChat");
      if (!text && uploadIds.length === 0) throw new ImsgError(400, "nothingToSend");
      if (uploadIds.length > MAX_UPLOADS) throw new ImsgError(400, "tooManyFiles", { max: MAX_UPLOADS });
      const payload = { chatId, ...text ? { text } : {}, ...uploadIds.length ? { uploadIds } : {} };
      if (Buffer.byteLength(JSON.stringify(payload)) > MAX_SEND_BYTES) {
        throw new ImsgError(400, "tooLong");
      }
      return client.send(payload);
    });
  }
});
export {
  server_default as default
};
