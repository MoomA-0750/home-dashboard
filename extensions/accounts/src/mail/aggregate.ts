import { HttpError, type FeatureProvider } from "@home-dashboard/extension-sdk";
import type { Mailbox, MailboxFolder, MailBackend, MailDraft, MailSummary, SourceError, Viewer } from "./types";
import { jaText } from "../serverMessages";

/**
 * 機能の口「mail」に入っているもの（インターネットアカウントなど）をまとめて、1つのメールのように扱う。
 * 画面に渡す id には、入っている拡張機能の id を頭に付ける（「accounts:…」）
 */

type Providers = FeatureProvider<MailBackend>[];

function providerOf(providers: Providers, id: string): [FeatureProvider<MailBackend>, string] {
  const index = String(id).indexOf(":");
  if (index <= 0) throw new HttpError(400, jaText("badId"));
  const provider = providers.find((p) => p.extensionId === id.slice(0, index));
  if (!provider) throw new HttpError(404, jaText("mailNotFound"));
  return [provider, id.slice(index + 1)];
}

const failed = (provider: FeatureProvider<unknown>, err: unknown): SourceError => ({
  source: provider.name,
  message: err instanceof Error ? err.message : String(err),
});

export function aggregate(providers: () => Providers): MailBackend {
  return {
    async listMailboxes(viewer: Viewer) {
      const results = await Promise.all(
        providers().map(async (p) => {
          try {
            const r = await p.implementation.listMailboxes(viewer);
            return { mailboxes: r.mailboxes.map((m): Mailbox => ({ ...m, id: `${p.extensionId}:${m.id}` })), errors: r.errors };
          } catch (err) {
            return { mailboxes: [], errors: [failed(p, err)] };
          }
        }),
      );
      return { mailboxes: results.flatMap((r) => r.mailboxes), errors: results.flatMap((r) => r.errors) };
    },

    async listFolders(viewer: Viewer, mailboxId?: string) {
      let targets = providers();
      let inner: string | undefined;
      if (mailboxId) {
        const [provider, id] = providerOf(targets, mailboxId);
        targets = [provider];
        inner = id;
      }
      const results = await Promise.all(
        targets.map(async (p) => {
          if (!p.implementation.listFolders) return { folders: [], errors: [] };
          try {
            const r = await p.implementation.listFolders(viewer, inner);
            return {
              folders: r.folders.map((f): MailboxFolder => ({ ...f, mailboxId: `${p.extensionId}:${f.mailboxId}` })),
              errors: r.errors,
            };
          } catch (err) {
            return { folders: [], errors: [failed(p, err)] };
          }
        }),
      );
      return { folders: results.flatMap((r) => r.folders), errors: results.flatMap((r) => r.errors) };
    },

    async listMessages(viewer, { mailboxId, unreadOnly, limit, folder }) {
      const count = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
      let targets = providers();
      let inner: string | undefined;
      if (mailboxId) {
        const [provider, id] = providerOf(targets, mailboxId);
        targets = [provider];
        inner = id;
      }
      const results = await Promise.all(
        targets.map(async (p) => {
          try {
            const r = await p.implementation.listMessages(viewer, { mailboxId: inner, unreadOnly, limit: count, folder });
            const prefix = (m: MailSummary): MailSummary => ({
              ...m,
              id: `${p.extensionId}:${m.id}`,
              mailboxId: `${p.extensionId}:${m.mailboxId}`,
            });
            return { messages: r.messages.map(prefix), errors: r.errors };
          } catch (err) {
            return { messages: [], errors: [failed(p, err)] };
          }
        }),
      );
      const messages = results
        .flatMap((r) => r.messages)
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, count);
      return { messages, errors: results.flatMap((r) => r.errors) };
    },

    async getMessage(viewer, id) {
      const [provider, inner] = providerOf(providers(), id);
      const message = await provider.implementation.getMessage(viewer, inner);
      return { ...message, id, mailboxId: `${provider.extensionId}:${message.mailboxId}` };
    },

    async setRead(viewer, id, read) {
      const [provider, inner] = providerOf(providers(), id);
      await provider.implementation.setRead(viewer, inner, read);
    },

    async move(viewer, id, target, from) {
      const [provider, inner] = providerOf(providers(), id);
      if (!provider.implementation.move) throw new HttpError(400, jaText("cannotMove"));
      await provider.implementation.move(viewer, inner, target, from);
    },

    async send(viewer, draft: MailDraft) {
      const [provider, mailboxId] = providerOf(providers(), draft.mailboxId);
      let replyTo: string | null = null;
      if (draft.replyTo) {
        const [replyProvider, inner] = providerOf(providers(), draft.replyTo);
        if (replyProvider.extensionId !== provider.extensionId)
          throw new HttpError(400, jaText("replySameAccount"));
        replyTo = inner;
      }
      const to = (draft.to ?? []).map((a) => String(a).trim()).filter(Boolean);
      if (to.length === 0) throw new HttpError(400, jaText("toRequired"));
      if (!String(draft.text ?? "").trim()) throw new HttpError(400, jaText("bodyRequired"));
      await provider.implementation.send(viewer, {
        mailboxId,
        to,
        cc: (draft.cc ?? []).map((a) => String(a).trim()).filter(Boolean),
        subject: String(draft.subject ?? "").slice(0, 500),
        text: String(draft.text).slice(0, 100_000),
        replyTo,
      });
    },
  };
}
