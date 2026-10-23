import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineServerExtension, type ExtensionAccount } from "@home-dashboard/extension-sdk";
import { ImsgClient, ImsgError, localizeError, messages, normalizePem, type ImsgConfig } from "./client";

/**
 * iMessage の拡張機能のサーバー側。Mac の imsg-web（https://<Mac>:8787）の API を、ここから呼んで画面へ渡す
 * （imsg-web はブラウザからの呼び出しを断るので、画面は直接呼べない）。
 * - /status … つながるか・送れるか
 * - /chats・/chats/:id/messages … 会話の一覧と履歴（画面が15秒ごとに読む。./client が10秒覚えて、端末どうしで使い回す）
 * - /attachments/:id・/avatars/:id … 画像・録音と顔写真
 * - /uploads・/send … 送る（トークンが「読む＋送る」のときだけ）
 * 会話は個人のものなので、管理者のアカウントにだけ見せる（接続設定の「メンバーにも見せる」で広げる）
 */

const MAX_UPLOADS = 10;
// imsg-web が受け取る本文（JSON）は 2KiB まで。日本語ならおよそ600文字
const MAX_SEND_BYTES = 2048;

export default defineServerExtension({
  register(api) {
    const certFile = join(api.configDir, "imessage", "cert.pem");

    const config = (): ImsgConfig | null => {
      const url = String(api.settings.url ?? "").trim();
      const token = String(api.settings.token ?? "").trim();
      if (!url || !token) return null;
      if (!url.startsWith("https://")) throw new ImsgError(400, "httpsOnly");
      const pasted = String(api.settings.cert ?? "").trim();
      if (pasted) {
        const ca = normalizePem(pasted);
        if (!ca) throw new ImsgError(400, "badCert");
        return { url, token, ca };
      }
      let ca: string | null = null;
      try {
        ca = normalizePem(readFileSync(certFile, "utf-8"));
      } catch {
        ca = null;
      }
      return { url, token, ca };
    };

    const client = new ImsgClient(config);
    api.onSettingsChange(() => client.reset());

    const allowed = (account: ExtensionAccount | null) =>
      account !== null && (account.role === "admin" || api.settings.members === true);
    const guard = (account: ExtensionAccount | null) => {
      if (!allowed(account)) throw new ImsgError(403, "forbidden");
    };
    // client・config が投げるエラーの理由を、呼んだ画面の言語にする
    const route = (...[method, path, handler, options]: Parameters<typeof api.route>) =>
      api.route(
        method,
        path,
        async (ctx) => {
          try {
            return await handler(ctx);
          } catch (err) {
            throw localizeError(err, ctx.locale);
          }
        },
        options,
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
          error: null,
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
          const sending =
            send?.state !== "available"
              ? messages.t(locale, "cannotSend")
              : send.reasonCode === "SEND_DRY_RUN"
                ? messages.t(locale, "dryRun")
                : messages.t(locale, "canSend");
          return { ok: true, message: messages.t(locale, "connected", { chats, sending }) };
        } catch (err) {
          const shown = localizeError(err, locale);
          return { ok: false, message: shown instanceof Error ? shown.message : String(shown) };
        }
      },
      { adminOnly: true },
    );

    route("GET", "/chats", async ({ account }) => {
      guard(account);
      const { chats } = await client.chats();
      return { chats };
    });

    route("GET", "/chats/:id/messages", async ({ account, params }) => {
      guard(account);
      const { messages } = await client.messages(params.id);
      return { messages };
    });

    for (const kind of ["attachments", "avatars"] as const) {
      route("GET", `/${kind}/:id`, async ({ account, params }) => {
        guard(account);
        const file = await client.file(kind, params.id);
        // id は imsg-web が再起動するまで同じものを指すので、しばらく端末に覚えさせる
        return api.file(file.body, file.type, { cacheSeconds: 3600 });
      });
    }

    // 画面はファイルをそのまま（application/octet-stream で）送ってくる。1つずつ imsg-web へ渡し、uploadId を返す
    route("POST", "/uploads", async ({ account, query, body }) => {
      guard(account);
      if (!Buffer.isBuffer(body) || body.length === 0) throw new ImsgError(400, "emptyFile");
      const name = String(query.name ?? "file").slice(0, 120) || "file";
      return client.upload(name, body);
    });

    route("POST", "/send", async ({ account, body }) => {
      guard(account);
      const raw = (body ?? {}) as { chatId?: unknown; text?: unknown; uploadIds?: unknown };
      const chatId = typeof raw.chatId === "string" ? raw.chatId : "";
      const text = typeof raw.text === "string" ? raw.text.trim() : "";
      const uploadIds = Array.isArray(raw.uploadIds) ? raw.uploadIds.filter((id): id is string => typeof id === "string") : [];
      if (!chatId) throw new ImsgError(400, "noChat");
      if (!text && uploadIds.length === 0) throw new ImsgError(400, "nothingToSend");
      if (uploadIds.length > MAX_UPLOADS) throw new ImsgError(400, "tooManyFiles", { max: MAX_UPLOADS });
      const payload = { chatId, ...(text ? { text } : {}), ...(uploadIds.length ? { uploadIds } : {}) };
      if (Buffer.byteLength(JSON.stringify(payload)) > MAX_SEND_BYTES) {
        throw new ImsgError(400, "tooLong");
      }
      // 結果が unknown（送れたか分からない）でも、ここでは送り直さない。画面がそのまま伝える
      return client.send(payload);
    });
  },
});
