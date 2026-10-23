import { join } from "node:path";
import { cachedLoader, defineServerExtension, HttpError } from "@home-dashboard/extension-sdk";
import { HostStore, validateHost } from "./hosts";
import { readHost, testHost } from "./resources";
import { authorizedKeysLine, ensureKeyPair, REMOTE_COMMAND } from "./ssh";

/**
 * homelab の拡張機能のサーバー側。設定画面で登録したホストの、リソース（CPU・メモリ・ディスク・連続稼働時間）を読む。
 * - GET /status … ウィジェットが読む。全ホストの今の様子
 * - /hosts … 設定画面のホストの登録（管理者だけ。Proxmox のトークンのシークレットは返さない）
 */

export default defineServerExtension({
  register(api) {
    // 前は config/homelab-hosts.json に書いていた。初めて読むときに「応答の確認だけ」のホストとして取り込む
    const store = new HostStore(api.dataDir, join(api.configDir, "homelab-hosts.json"));

    // 何台もの画面が読むたびに、全ホストへ SSH・Proxmox でつなぎ直さない（言語ごとに覚える）
    const status = cachedLoader(10_000);
    api.route("GET", "/status", async ({ locale }) =>
      status(locale, async () => {
        const hosts = await store.list();
        return { hosts: await Promise.all(hosts.map((host) => readHost(host, api.dataDir, locale))) };
      }),
    );

    api.route("GET", "/hosts", async () => ({ hosts: await store.listPublic() }), { adminOnly: true });
    // SSH の種類で使う、ダッシュボードの公開鍵と、相手の authorized_keys に足す1行（無ければ鍵を作る）
    api.route(
      "GET",
      "/ssh-key",
      async () => {
        const { publicKey } = await ensureKeyPair(api.dataDir);
        return {
          publicKey: publicKey.trim(),
          authorizedKeysLine: authorizedKeysLine(publicKey),
          command: REMOTE_COMMAND,
        };
      },
      { adminOnly: true },
    );
    api.route("POST", "/hosts", ({ body, locale }) => store.create(body, locale), { adminOnly: true });
    api.route("PUT", "/hosts/:id", ({ params, body, locale }) => store.update(params.id, body, locale), {
      adminOnly: true,
    });
    api.route(
      "DELETE",
      "/hosts/:id",
      async ({ params, locale }) => {
        await store.remove(params.id, locale);
        return { ok: true };
      },
      { adminOnly: true },
    );
    api.route(
      "PUT",
      "/hosts-order",
      async ({ body }) => {
        await store.reorder((body as { ids?: unknown } | null)?.ids);
        return { ok: true };
      },
      { adminOnly: true },
    );
    // 保存する前の値で確かめる。シークレットを空で送ったときは、登録済みのもの（id が同じ）を使う
    api.route(
      "POST",
      "/hosts-test",
      async ({ body, locale }) => {
        const input = (body ?? {}) as Record<string, unknown>;
        const previous = typeof input.id === "string" ? await store.get(input.id) : undefined;
        let host;
        try {
          host = validateHost({ ...input, id: previous?.id ?? "draft" }, previous, locale);
        } catch (err) {
          if (err instanceof HttpError) return { ok: false, message: err.message };
          throw err;
        }
        return testHost(host, api.dataDir, locale);
      },
      { adminOnly: true },
    );
  },
});
