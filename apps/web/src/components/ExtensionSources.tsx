import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BackButton,
  Button,
  ButtonRow,
  Field,
  Group,
  List,
  ListItem,
  Message,
  Note,
  SectionTitle,
  ToggleSwitch,
  defineMessages,
  useLocale,
} from "@home-dashboard/widget-sdk";
import type { ExtensionInfo } from "../lib/extensions";
import {
  addSource,
  checkSources,
  fetchSources,
  formatChecked,
  installFromSource,
  removeSource,
  setAutoUpdate,
  setExtensionTrusted,
  updateSource,
  type ExtensionSource,
} from "../lib/extensionSources";

const messages = defineMessages({
  ja: {
    installedButFailed: "{name} を入れましたが、動きませんでした: {error}",
    updatedTo: "{name} を {version} に更新しました",
    installed: "{name} {version} を入れました",
    saved: "変えました",
    sourceRemoved: "{name} の登録を外しました（入れた拡張機能はそのまま残ります）",
    extensions: "拡張機能",
    intro:
      "拡張機能を置いている Git のリポジトリを登録すると、そこから拡張機能を入れたり更新したりできます。リポジトリには、拡張機能を公開する道具（pnpm publish:extensions）で組み立て済みのものを置きます。6時間ごとに新しい版を確かめます。",
    updatesAvailable: "更新があります",
    updatableExtensions: "更新がある拡張機能",
    update: "更新する",
    updateDetail: "{from} → {to}（{source}）",
    repositories: "リポジトリ",
    loading: "読み込んでいます…",
    noneYet: "まだ登録していません。",
    badgeUpdate: "更新あり",
    addedButUnreadable: "{name} を登録しましたが、読めませんでした: {error}",
    added: "{name} を登録しました",
    addRepository: "リポジトリを足す",
    checkedAndUpdated: "確かめて、自動で更新しました: {list}",
    listSeparator: "、",
    checked: "確かめました",
    checking: "確かめています…",
    checkNow: "今すぐ確かめる",
    urlHint: "https://github.com/<名前>/<リポジトリ>.git の形",
    branch: "枝",
    branchHint: "拡張機能を公開する道具が置く枝（既定は dist-extensions）",
    tokenPrivate: "読むためのトークン（非公開のリポジトリだけ）",
    tokenHint: "GitHub なら、そのリポジトリの Contents を読むだけの fine-grained token。画面には戻りません",
    nameOptional: "名前（空なら URL から）",
    fetching: "取ってきています…",
    register: "登録する",
    cancel: "やめる",
    sourceExtensions: "このリポジトリの拡張機能",
    installedState: "入っています",
    installedVersion: "（入っているのは {version}）",
    install: "入れる",
    registration: "登録",
    token: "読むためのトークン",
    tokenSet: "設定済み。変えるときだけ入れてください",
    tokenForPrivate: "非公開のリポジトリなら入れてください",
    saveAndCheck: "保存して確かめる",
    removeToken: "トークンを消す",
    pressAgainToRemove: "もう一度押して外す",
    removeSource: "このリポジトリの登録を外す",
    newVersion: "新しい版 {version} が {source} にあります（入っているのは {current}）。",
    updatedToVersion: "{version} に更新しました",
    updating: "更新しています…",
    updateToVersion: "{version} に更新する",
    updates: "更新",
    autoUpdate: "自動で更新する",
    autoUpdateDetail: "登録したリポジトリに新しい版があれば、確かめたときに入れ替えます",
    autoUpdateOn: "{name}を自動で更新する",
    autoUpdateOff: "{name}を自動で更新しない",
    autoUpdateEnabled: "自動で更新します",
    autoUpdateDisabled: "自動では更新しません",
    autoUpdateTrusted: "本体と同じ権限で動かしているので、自動では更新しません。新しい版は中身を確かめてから更新を押してください",
    trust: "本体と同じ権限で動かす",
    trustSandboxed:
      "いまは別のプロセスで動いています。読み書きできるのはこの拡張機能の置き場だけで、家の秘密（アカウント・トークン）やほかの拡張機能には触れません。動かないときだけ入れてください",
    trustTrusted: "本体と同じ権限で動いています。この拡張機能は家の秘密にも触れられます。自動では更新しません",
    trustOn: "{name}を本体と同じ権限で動かす",
    trustOff: "{name}を別のプロセスで動かす",
    trustedNow: "本体と同じ権限で動かします",
    sandboxedNow: "別のプロセスで動かします",
  },
  en: {
    installedButFailed: "Installed {name}, but it didn't start: {error}",
    updatedTo: "Updated {name} to {version}",
    installed: "Installed {name} {version}",
    saved: "Saved",
    sourceRemoved: "Removed {name} (extensions installed from it stay installed)",
    extensions: "Extensions",
    intro:
      "Add a Git repository that hosts extensions to install and update them from it. The repository holds extensions already built with the publishing tool (pnpm publish:extensions). New versions are checked every 6 hours.",
    updatesAvailable: "Updates available",
    updatableExtensions: "Extensions with updates",
    update: "Update",
    updateDetail: "{from} → {to} ({source})",
    repositories: "Repositories",
    loading: "Loading…",
    noneYet: "No repositories yet.",
    badgeUpdate: "Update",
    addedButUnreadable: "Added {name}, but couldn't read it: {error}",
    added: "Added {name}",
    addRepository: "Add repository",
    checkedAndUpdated: "Checked and updated automatically: {list}",
    listSeparator: ", ",
    checked: "Checked",
    checking: "Checking…",
    checkNow: "Check now",
    urlHint: "In the form https://github.com/<owner>/<repository>.git",
    branch: "Branch",
    branchHint: "The branch the publishing tool writes to (default: dist-extensions)",
    tokenPrivate: "Read token (private repositories only)",
    tokenHint: "On GitHub, a fine-grained token that can only read Contents of that repository. It's never shown again",
    nameOptional: "Name (taken from the URL if empty)",
    fetching: "Fetching…",
    register: "Add",
    cancel: "Cancel",
    sourceExtensions: "Extensions in this repository",
    installedState: "Installed",
    installedVersion: " (installed: {version})",
    install: "Install",
    registration: "Repository settings",
    token: "Read token",
    tokenSet: "Set. Enter one only to change it",
    tokenForPrivate: "Required for private repositories",
    saveAndCheck: "Save and check",
    removeToken: "Remove token",
    pressAgainToRemove: "Press again to remove",
    removeSource: "Remove this repository",
    newVersion: "Version {version} is available from {source} (installed: {current}).",
    updatedToVersion: "Updated to {version}",
    updating: "Updating…",
    updateToVersion: "Update to {version}",
    updates: "Updates",
    autoUpdate: "Update automatically",
    autoUpdateDetail: "When a newer version appears in the added repository, it's swapped in at the next check",
    autoUpdateOn: "Update {name} automatically",
    autoUpdateOff: "Stop updating {name} automatically",
    autoUpdateEnabled: "Automatic updates on",
    autoUpdateDisabled: "Automatic updates off",
    autoUpdateTrusted: "It runs with full access, so it isn't updated automatically. Check a new version, then press update",
    trust: "Run with full access",
    trustSandboxed:
      "It runs in a separate process. It can only read and write its own folder, and can't touch household secrets (accounts, tokens) or other extensions. Turn this on only if it doesn't work",
    trustTrusted: "It runs with the same access as the dashboard and can reach household secrets. It isn't updated automatically",
    trustOn: "Run {name} with full access",
    trustOff: "Run {name} in a separate process",
    trustedNow: "Now runs with full access",
    sandboxedNow: "Now runs in a separate process",
  },
});

/**
 * 設定画面の「拡張機能 → リポジトリ」。拡張機能を置いている Git のリポジトリ（公開用の枝。scripts/publish-extensions.mjs が置く）を登録し、
 * そこにある拡張機能を入れたり更新したりする。管理者だけが使う。
 */
export function ExtensionSources({
  apiBaseUrl,
  extensions,
  onBack,
  onChanged,
}: {
  apiBaseUrl: string;
  extensions: ExtensionInfo[];
  onBack: () => void;
  /** 入れた・更新した（拡張機能の一覧を読み直す） */
  onChanged: () => void;
}) {
  const t = messages.useT();
  const locale = useLocale();
  const [sources, setSources] = useState<ExtensionSource[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setSources(await fetchSources(apiBaseUrl));
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await task();
      if (text) setMessage({ ok: true, text });
      await load();
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const install = (source: ExtensionSource, id: string, name: string, update: boolean) =>
    run(async () => {
      const { extension } = await installFromSource(apiBaseUrl, source.id, id);
      if (!extension.active && extension.error) throw new Error(t("installedButFailed", { name, error: extension.error }));
      return update
        ? t("updatedTo", { name, version: extension.version })
        : t("installed", { name, version: extension.version });
    });

  const opened = sources?.find((source) => source.id === openId) ?? null;
  if (opened) {
    return (
      <SourceDetail
        apiBaseUrl={apiBaseUrl}
        source={opened}
        busy={busy}
        message={message}
        onBack={() => {
          setOpenId(null);
          setMessage(null);
        }}
        onInstall={(id, name, update) => void install(opened, id, name, update)}
        onSave={(input) =>
          void run(async () => {
            const next = await updateSource(apiBaseUrl, opened.id, input);
            return next.error ? null : t("saved");
          })
        }
        onRemove={() =>
          void run(async () => {
            await removeSource(apiBaseUrl, opened.id);
            setOpenId(null);
            return t("sourceRemoved", { name: opened.name });
          })
        }
      />
    );
  }

  const updates = extensions.filter((ext) => ext.update);
  return (
    <div className="extension-sources">
      <BackButton label={t("extensions")} onClick={onBack} />
      <Note>{t("intro")}</Note>
      {updates.length > 0 && (
        <>
          <SectionTitle>{t("updatesAvailable")}</SectionTitle>
          <List boxed label={t("updatableExtensions")}>
            {updates.map((ext) => (
              <ListItem
                key={ext.id}
                title={ext.name}
                detail={t("updateDetail", { from: ext.version, to: ext.update!.version, source: ext.update!.sourceName })}
                trailing={
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => {
                      const source = sources?.find((s) => s.id === ext.update!.sourceId);
                      if (source) void install(source, ext.id, ext.name, true);
                    }}
                  >
                    {t("update")}
                  </Button>
                }
              />
            ))}
          </List>
        </>
      )}
      <SectionTitle>{t("repositories")}</SectionTitle>
      {sources === null && !message && <Note>{t("loading")}</Note>}
      {sources && sources.length === 0 && <Note>{t("noneYet")}</Note>}
      {sources && sources.length > 0 && (
        <List boxed label={t("repositories")}>
          {sources.map((source) => (
            <ListItem
              key={source.id}
              title={source.name}
              detail={source.error ?? `${source.url} · ${source.branch} · ${formatChecked(source.checkedAt, locale)}`}
              error={Boolean(source.error)}
              badge={source.extensions.some((e) => e.updatable) ? t("badgeUpdate") : undefined}
              onClick={() => {
                setOpenId(source.id);
                setMessage(null);
              }}
            />
          ))}
        </List>
      )}
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      {adding ? (
        <AddSourceForm
          busy={busy}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            void run(async () => {
              const source = await addSource(apiBaseUrl, input);
              setAdding(false);
              return source.error
                ? t("addedButUnreadable", { name: source.name, error: source.error })
                : t("added", { name: source.name });
            })
          }
        />
      ) : (
        <ButtonRow>
          <Button icon="add" disabled={busy} onClick={() => setAdding(true)}>
            {t("addRepository")}
          </Button>
          <Button
            icon="arrow-sync"
            disabled={busy || !sources?.length}
            onClick={() =>
              void run(async () => {
                const { updated } = await checkSources(apiBaseUrl);
                const done = updated.filter((u) => !u.error).map((u) => `${u.id} ${u.version}`);
                return done.length > 0
                  ? t("checkedAndUpdated", { list: done.join(t("listSeparator")) })
                  : t("checked");
              })
            }
          >
            {busy ? t("checking") : t("checkNow")}
          </Button>
        </ButtonRow>
      )}
    </div>
  );
}

function AddSourceForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (input: { url: string; branch: string; token: string; name: string }) => void;
  onCancel: () => void;
}) {
  const t = messages.useT();
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("dist-extensions");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ url, branch, token, name });
  };
  return (
    <form className="ui-group" onSubmit={submit}>
      <fieldset className="extension-sources__fields" disabled={busy}>
        <Field label="URL" hint={t("urlHint")}>
          <input value={url} autoComplete="off" spellCheck={false} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Field label={t("branch")} hint={t("branchHint")}>
          <input value={branch} autoComplete="off" spellCheck={false} onChange={(e) => setBranch(e.target.value)} />
        </Field>
        <Field
          label={t("tokenPrivate")}
          hint={t("tokenHint")}
        >
          <input type="password" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
        </Field>
        <Field label={t("nameOptional")}>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ButtonRow>
          <Button variant="primary" type="submit" disabled={!url.trim()}>
            {busy ? t("fetching") : t("register")}
          </Button>
          <Button onClick={onCancel}>{t("cancel")}</Button>
        </ButtonRow>
      </fieldset>
    </form>
  );
}

function SourceDetail({
  source,
  busy,
  message,
  onBack,
  onInstall,
  onSave,
  onRemove,
}: {
  apiBaseUrl: string;
  source: ExtensionSource;
  busy: boolean;
  message: { ok: boolean; text: string } | null;
  onBack: () => void;
  onInstall: (id: string, name: string, update: boolean) => void;
  onSave: (input: { name?: string; branch?: string; token?: string | null }) => void;
  onRemove: () => void;
}) {
  const t = messages.useT();
  const locale = useLocale();
  const [branch, setBranch] = useState(source.branch);
  const [token, setToken] = useState("");
  const [removing, setRemoving] = useState(false);
  return (
    <div className="extension-sources">
      <BackButton label={t("repositories")} onClick={onBack} />
      <SectionTitle>{source.name}</SectionTitle>
      <Note>
        {source.url} · {source.branch} · {formatChecked(source.checkedAt, locale)}
        {source.commit && (locale === "ja" ? `（${source.commit.slice(0, 7)}）` : ` (${source.commit.slice(0, 7)})`)}
      </Note>
      {source.error && <Message tone="error">{source.error}</Message>}
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}

      {source.extensions.length > 0 && (
        <>
          <SectionTitle>{t("sourceExtensions")}</SectionTitle>
          <List boxed label={t("sourceExtensions")}>
            {source.extensions.map((ext) => (
              <ListItem
                key={ext.id}
                title={ext.name}
                detail={
                  ext.installedVersion === null
                    ? `${ext.version} · ${ext.description ?? ""}`
                    : ext.updatable
                      ? `${ext.installedVersion} → ${ext.version}`
                      : `${ext.version} · ${t("installedState")}${ext.installedVersion !== ext.version ? t("installedVersion", { version: ext.installedVersion }) : ""}`
                }
                trailing={
                  ext.installedVersion === null ? (
                    <Button disabled={busy} onClick={() => onInstall(ext.id, ext.name, false)}>
                      {t("install")}
                    </Button>
                  ) : ext.updatable ? (
                    <Button variant="primary" disabled={busy} onClick={() => onInstall(ext.id, ext.name, true)}>
                      {t("update")}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </List>
        </>
      )}

      <SectionTitle>{t("registration")}</SectionTitle>
      <Group>
        <Field label={t("branch")}>
          <input value={branch} autoComplete="off" spellCheck={false} onChange={(e) => setBranch(e.target.value)} />
        </Field>
        <Field
          label={t("token")}
          hint={source.hasToken ? t("tokenSet") : t("tokenForPrivate")}
        >
          <input type="password" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
        </Field>
        <ButtonRow>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              onSave({ branch, token });
              setToken("");
            }}
          >
            {t("saveAndCheck")}
          </Button>
          {source.hasToken && (
            <Button disabled={busy} onClick={() => onSave({ token: null })}>
              {t("removeToken")}
            </Button>
          )}
        </ButtonRow>
      </Group>
      <ButtonRow>
        <Button variant="danger" disabled={busy} onClick={() => (removing ? onRemove() : setRemoving(true))}>
          {removing ? t("pressAgainToRemove") : t("removeSource")}
        </Button>
      </ButtonRow>
    </div>
  );
}

/** 拡張機能の詳細に出す、出どころと更新（更新のボタン・自動で更新する） */
export function ExtensionUpdatePanel({
  apiBaseUrl,
  ext,
  isAdmin,
  onChanged,
}: {
  apiBaseUrl: string;
  ext: ExtensionInfo;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = messages.useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // 更新が来るのは、リポジトリから入れたものと、本体に入っているもの（ZIP で持ち込んだものは来ない）
  const updatable = ext.origin.kind !== "zip";
  // 本体と同じ権限で動かしている持ち込んだものは、自動では更新しない
  const trustedNotBuiltin = !ext.builtin && !ext.sandboxed;

  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await task() });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!updatable) return null;
  return (
    <>
      {ext.update && (
        <Group>
          <Note>
            {t("newVersion", { version: ext.update.version, source: ext.update.sourceName, current: ext.version })}
          </Note>
          <ButtonRow>
            <Button
              variant="primary"
              disabled={!isAdmin || busy}
              onClick={() =>
                void run(async () => {
                  await installFromSource(apiBaseUrl, ext.update!.sourceId, ext.id);
                  return t("updatedToVersion", { version: ext.update!.version });
                })
              }
            >
              {busy ? t("updating") : t("updateToVersion", { version: ext.update.version })}
            </Button>
          </ButtonRow>
        </Group>
      )}
      <List boxed label={t("updates")}>
        <ListItem
          title={t("autoUpdate")}
          detail={trustedNotBuiltin ? t("autoUpdateTrusted") : t("autoUpdateDetail")}
          trailing={
            <ToggleSwitch
              checked={ext.autoUpdate}
              disabled={!isAdmin || busy || trustedNotBuiltin}
              label={t(ext.autoUpdate ? "autoUpdateOff" : "autoUpdateOn", { name: ext.name })}
              onChange={(enabled) =>
                void run(async () => {
                  await setAutoUpdate(apiBaseUrl, ext.id, enabled);
                  return enabled ? t("autoUpdateEnabled") : t("autoUpdateDisabled");
                })
              }
            />
          }
        />
      </List>
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
    </>
  );
}

/** 持ち込んだ拡張機能を、本体と同じ権限で動かす（信頼する）か、別のプロセスで動かすか。変えられるのは管理者だけ */
export function ExtensionTrustPanel({
  apiBaseUrl,
  ext,
  isAdmin,
  onChanged,
}: {
  apiBaseUrl: string;
  ext: ExtensionInfo;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const t = messages.useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if (ext.builtin) return null;
  const trusted = !ext.sandboxed;

  const change = async (next: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await setExtensionTrusted(apiBaseUrl, ext.id, next);
      setMessage({ ok: true, text: t(next ? "trustedNow" : "sandboxedNow") });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="extension-trust">
      <List boxed label={t("trust")}>
        <ListItem
          title={t("trust")}
          detail={t(trusted ? "trustTrusted" : "trustSandboxed")}
          trailing={
            <ToggleSwitch
              checked={trusted}
              disabled={!isAdmin || busy}
              label={t(trusted ? "trustOff" : "trustOn", { name: ext.name })}
              onChange={(next) => void change(next)}
            />
          }
        />
      </List>
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
    </div>
  );
}
