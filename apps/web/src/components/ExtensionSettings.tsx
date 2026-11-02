import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  BackButton,
  Button,
  defineMessages,
  List,
  ListItem,
  Message,
  Note,
  Notice,
  SectionTitle,
  ToggleSwitch,
  useLocale,
  type ExtensionSettingsPanelProps,
  type SettingsLink,
} from "@home-dashboard/widget-sdk";
import type { ComponentType } from "react";
import type { ExtensionInfo, LoadedExtensions } from "../lib/extensions";
import { ConnectionSection } from "./ConnectionSettings";
import { ExtensionSources, ExtensionTrustPanel, ExtensionUpdatePanel } from "./ExtensionSources";
import { localizeExtension } from "../lib/manifestText";

const messages = defineMessages({
  ja: {
    requestFailed: "うまくいきませんでした（{status}）",
    turnedOn: "{name}を入れました",
    turnedOff: "{name}を切りました",
    installedButFailed: "{name} を入れましたが、動きませんでした: {error}",
    unknownReason: "理由は分かりません",
    installed: "{name} {version} を入れました",
    removed: "{name}を消しました",
    badgeUpdate: "更新あり",
    badgeZip: "持ち込み",
    notRunning: "動いていません: {reason}",
    turnOff: "{name}を切る",
    turnOn: "{name}を入れる",
    adminOnly: "拡張機能を入れたり切ったりできるのは管理者だけです。",
    updatesNotice: "更新が {n} 件あります。",
    view: "見る",
    extensions: "拡張機能",
    slotOf: "{owner}の{slot}",
    listSeparator: "・",
    orphans: "入る先の無い拡張機能",
    installUpdate: "入れる・更新する",
    repositories: "リポジトリ",
    updatesCount: "更新が {n} 件あります",
    repositoriesDetail: "Git のリポジトリから拡張機能を入れる・更新する（自動の更新もここで確かめます）",
    installing: "入れています…",
    installZip: "拡張機能を持ち込む（ZIP）",
    installZipNote:
      "持ち込んだ拡張機能はこのサーバーの中で動き、接続設定のトークンにも触れられます。作った人を信頼できるものだけを入れてください。 同じ名前のものを入れると入れ替わります。作り方は docs/extensions.md にあります。",
    turnOnForSettings: "入れると、接続設定が出ます。",
    pressAgain: "もう一度押して確かめる",
    revertToBuiltin: "本体の版（{version}）に戻す",
    removeExtension: "この拡張機能を消す",
    unusedReason: "{owners}が切ってあるので使われていません",
    providersTitle: "{name}（ここへ入る拡張機能）",
    providerOff: "切ってあります",
    joinedAs: "{list}として入っています。",
    unusedSuffix: " {reason}。",
    originBuiltin: "本体に入っている拡張機能（切れますが消せません）",
    originZip: "ZIP で持ち込んだ拡張機能",
    originRepoOverride: "リポジトリから入れた版（{commit}）。本体の {version} の代わりに動いています",
    originRepo: "リポジトリから入れた拡張機能（{commit}）",
  },
  en: {
    requestFailed: "Something went wrong ({status})",
    turnedOn: "Turned on {name}",
    turnedOff: "Turned off {name}",
    installedButFailed: "Installed {name}, but it didn't start: {error}",
    unknownReason: "unknown reason",
    installed: "Installed {name} {version}",
    removed: "Removed {name}",
    badgeUpdate: "Update",
    badgeZip: "Sideloaded",
    notRunning: "Not running: {reason}",
    turnOff: "Turn off {name}",
    turnOn: "Turn on {name}",
    adminOnly: "Only admins can turn extensions on or off.",
    updatesNotice: (p) => (p.n === 1 ? "1 update available." : `${p.n} updates available.`),
    view: "View",
    extensions: "Extensions",
    slotOf: "{owner} · {slot}",
    listSeparator: ", ",
    orphans: "Extensions with nowhere to plug in",
    installUpdate: "Install & update",
    repositories: "Repositories",
    updatesCount: (p) => (p.n === 1 ? "1 update available" : `${p.n} updates available`),
    repositoriesDetail: "Install and update extensions from Git repositories (automatic updates are checked here too)",
    installing: "Installing…",
    installZip: "Add extension from ZIP",
    installZipNote:
      "Added extensions run inside this server and can access the tokens in connection settings. Only install extensions from people you trust. Installing one with the same name replaces it. See docs/extensions.md to build your own.",
    turnOnForSettings: "Turn it on to see its connection settings.",
    pressAgain: "Press again to confirm",
    revertToBuiltin: "Revert to built-in version ({version})",
    removeExtension: "Remove this extension",
    unusedReason: "Not in use because {owners} is turned off",
    providersTitle: "{name} (extensions that plug in here)",
    providerOff: "Turned off",
    joinedAs: "Plugs into {list}.",
    unusedSuffix: " {reason}.",
    originBuiltin: "Built-in extension (can be turned off, but not removed)",
    originZip: "Extension added from a ZIP",
    originRepoOverride: "Version from a repository ({commit}), running in place of built-in {version}",
    originRepo: "Extension from a repository ({commit})",
  },
});

type T = ReturnType<typeof messages.useT>;

interface ExtensionSettingsProps {
  apiBaseUrl: string;
  extensions: LoadedExtensions;
  isAdmin: boolean;
  /** ほかの所から頼まれた、開く拡張機能（openSettings の extension） */
  link?: SettingsLink | null;
}

async function request(apiBaseUrl: string, path: string, init: RequestInit) {
  const res = await fetch(`${apiBaseUrl}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body;
}

/**
 * 設定画面の「拡張機能」。Spotify・Home Assistant などの連携を、トグルスイッチで入／切する。
 * 行を押すとその拡張機能の詳細（説明・接続設定・消す）を開く。外から持ち込んだ拡張機能（ZIP）もここで足す。
 * ほかの拡張機能の機能の口へ入るもの（Media の音楽アプリなど）は、その口ごとにまとめて下に並べる。
 * 入／切・持ち込み・削除・接続設定の変更は管理者だけ。どの端末で変えても、つないでいるすべての画面がすぐ読み直す。
 */
export function ExtensionSettings({ apiBaseUrl, extensions, isAdmin, link }: ExtensionSettingsProps) {
  const t = messages.useT();
  const locale = useLocale();
  // 名前・説明・機能の口の名前を画面の言語に合わせたもの
  const all = extensions.extensions.map((ext) => localizeExtension(ext, locale));
  const [openId, setOpenId] = useState<string | null>(link?.extension ?? null);
  useEffect(() => {
    if (link?.extension) {
      setSourcesOpen(false);
      setOpenId(link.extension);
    }
  }, [link]);
  // リポジトリ（拡張機能を入れる・更新する）の画面を開いているか
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (key: string, task: () => Promise<string>) => {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await task() });
      extensions.reload();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (ext: ExtensionInfo, enabled: boolean) =>
    run(ext.id, async () => {
      await request(apiBaseUrl, `/api/extensions/${encodeURIComponent(ext.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      return t(enabled ? "turnedOn" : "turnedOff", { name: ext.name });
    });

  const install = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run("install", async () => {
      const body = await request(apiBaseUrl, "/api/extensions", {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: file,
      });
      const ext = body.extension as { name: string; version: string; active: boolean; error: string | null };
      if (!ext.active)
        throw new Error(t("installedButFailed", { name: ext.name, error: ext.error ?? t("unknownReason") }));
      return t("installed", { name: ext.name, version: ext.version });
    });
  };

  if (sourcesOpen) {
    return (
      <ExtensionSources
        apiBaseUrl={apiBaseUrl}
        extensions={all}
        onBack={() => setSourcesOpen(false)}
        onChanged={() => extensions.reload()}
      />
    );
  }

  const opened = all.find((ext) => ext.id === openId) ?? null;
  if (opened) {
    return (
      <ExtensionDetail
        apiBaseUrl={apiBaseUrl}
        ext={opened}
        failure={opened.error ?? extensions.failures[opened.id] ?? null}
        Panel={extensions.settingsPanels[opened.id]}
        isAdmin={isAdmin}
        busy={busy !== null}
        message={message}
        onToggle={(enabled) => void toggle(opened, enabled)}
        onRemoved={() => {
          setOpenId(null);
          void run(opened.id, async () => {
            await request(apiBaseUrl, `/api/extensions/${encodeURIComponent(opened.id)}`, { method: "DELETE" });
            return t("removed", { name: opened.name });
          });
        }}
        onBack={() => {
          setOpenId(null);
          setMessage(null);
        }}
        all={all}
        onChanged={() => extensions.reload()}
        onOpen={(id) => {
          setOpenId(id);
          setMessage(null);
        }}
      />
    );
  }

  const row = (ext: ExtensionInfo) => {
    const failure = ext.error ?? extensions.failures[ext.id] ?? null;
    const unused = unusedReason(ext, all, t);
    return (
      <ListItem
        key={ext.id}
        title={ext.name}
        badge={ext.update ? t("badgeUpdate") : ext.origin.kind === "zip" ? t("badgeZip") : undefined}
        detail={failure ? t("notRunning", { reason: failure }) : (unused ?? ext.description)}
        error={Boolean(failure || unused)}
        off={!ext.enabled}
        onClick={() => {
          setOpenId(ext.id);
          setMessage(null);
        }}
        trailing={
          <ToggleSwitch
            checked={ext.enabled}
            disabled={!isAdmin || busy !== null}
            label={t(ext.enabled ? "turnOff" : "turnOn", { name: ext.name })}
            onChange={(enabled) => void toggle(ext, enabled)}
          />
        }
      />
    );
  };

  const { standalone, slots, orphans } = groupExtensions(all);
  const updateCount = all.filter((ext) => ext.update).length;
  return (
    <div>
      {!isAdmin && <Notice>{t("adminOnly")}</Notice>}
      {isAdmin && updateCount > 0 && (
        <Notice>
          {t("updatesNotice", { n: updateCount })}
          <button type="button" className="ml-2 cursor-pointer text-accent-soft" onClick={() => setSourcesOpen(true)}>
            {t("view")}
          </button>
        </Notice>
      )}
      <List boxed label={t("extensions")}>{standalone.map(row)}</List>
      {slots.map((slot) => (
        <section key={`${slot.owner.id}:${slot.id}`}>
          <SectionTitle>{t("slotOf", { owner: slot.owner.name, slot: slot.name })}</SectionTitle>
          {slot.description && <Note>{slot.description}</Note>}
          <List boxed label={t("slotOf", { owner: slot.owner.name, slot: slot.name })}>{slot.providers.map(row)}</List>
        </section>
      ))}
      {orphans.length > 0 && (
        <section>
          <SectionTitle>{t("orphans")}</SectionTitle>
          <List boxed label={t("orphans")}>{orphans.map(row)}</List>
        </section>
      )}
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      {isAdmin && (
        <section>
          <SectionTitle>{t("installUpdate")}</SectionTitle>
          <List boxed label={t("installUpdate")}>
            <ListItem
              title={t("repositories")}
              detail={
                updateCount > 0
                  ? t("updatesCount", { n: updateCount })
                  : t("repositoriesDetail")
              }
              badge={updateCount > 0 ? t("badgeUpdate") : undefined}
              onClick={() => setSourcesOpen(true)}
            />
          </List>
        </section>
      )}
      {isAdmin && (
        <div className="flex flex-col items-start gap-2">
          <Button icon="add" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
            {busy === "install" ? t("installing") : t("installZip")}
          </Button>
          <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={install} />
          <Note>{t("installZipNote")}</Note>
        </div>
      )}
    </div>
  );
}

function ExtensionDetail({
  apiBaseUrl,
  ext,
  failure,
  isAdmin,
  busy,
  message,
  onToggle,
  onRemoved,
  onBack,
  onChanged,
  Panel,
  all,
  onOpen,
}: {
  apiBaseUrl: string;
  ext: ExtensionInfo;
  failure: string | null;
  /** 拡張機能が持っている、接続設定の下に出す欄（Home Assistant の「計測に使うセンサー」など） */
  Panel?: ComponentType<ExtensionSettingsPanelProps>;
  isAdmin: boolean;
  busy: boolean;
  message: { ok: boolean; text: string } | null;
  onToggle: (enabled: boolean) => void;
  onRemoved: () => void;
  onBack: () => void;
  /** 更新した（一覧を読み直す） */
  onChanged: () => void;
  /** すべての拡張機能（機能の口の入る先・入っているものを出すため） */
  all: ExtensionInfo[];
  onOpen: (id: string) => void;
}) {
  // 消すのは、うっかり押しても消えないよう、もう一度押して確かめる
  const [deleting, setDeleting] = useState(false);
  const t = messages.useT();
  return (
    <div>
      <BackButton label={t("extensions")} onClick={onBack} />
      <List boxed label={ext.name}>
        <ListItem
          title={<span className="text-title font-semibold">{ext.name}</span>}
          detail={`${ext.version} · ${originText(ext, t)}`}
          trailing={
            <ToggleSwitch
              checked={ext.enabled}
              disabled={!isAdmin || busy}
              label={t(ext.enabled ? "turnOff" : "turnOn", { name: ext.name })}
              onChange={onToggle}
            />
          }
        />
      </List>
      {ext.description && <p className="mb-2 text-label leading-normal text-muted">{ext.description}</p>}
      <SlotSummary ext={ext} all={all} onOpen={onOpen} />
      <ExtensionUpdatePanel apiBaseUrl={apiBaseUrl} ext={ext} isAdmin={isAdmin} onChanged={onChanged} />
      <ExtensionTrustPanel apiBaseUrl={apiBaseUrl} ext={ext} isAdmin={isAdmin} onChanged={onChanged} />
      {failure && <Message tone="error">{t("notRunning", { reason: failure })}</Message>}
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      {ext.active ? (
        // 入／切や入れ替えで中身が変わったら読み直す
        <>
          <ConnectionSection
            key={`${ext.id}:${ext.revision}:${ext.active}`}
            apiBaseUrl={apiBaseUrl}
            sectionId={ext.id}
          />
          {Panel && <Panel key={`panel:${ext.revision}`} ctx={{ apiBaseUrl }} isAdmin={isAdmin} />}
        </>
      ) : (
        <Note>{t("turnOnForSettings")}</Note>
      )}
      {!ext.builtin && isAdmin && (
        <Button
          variant={deleting ? "danger" : "default"}
          className={deleting ? "mt-6" : "mt-6 text-danger"}
          disabled={busy}
          onClick={() => (deleting ? onRemoved() : setDeleting(true))}
        >
          {deleting
            ? t("pressAgain")
            : ext.builtinVersion
              ? t("revertToBuiltin", { version: ext.builtinVersion })
              : t("removeExtension")}
        </Button>
      )}
    </div>
  );
}

interface SlotGroup {
  id: string;
  name: string;
  description: string | null;
  owner: ExtensionInfo;
  providers: ExtensionInfo[];
}

/** 一覧の並べ方。機能の口へ入らないもの、口ごとに入るもの、入る先の口がどこにも無いもの */
export function groupExtensions(all: ExtensionInfo[]) {
  const slots: SlotGroup[] = all.flatMap((owner) =>
    owner.features.map((feature) => ({
      ...feature,
      owner,
      providers: all.filter((ext) => ext.provides.includes(feature.id)),
    })),
  );
  const known = new Set(slots.map((slot) => slot.id));
  return {
    standalone: all.filter((ext) => ext.provides.length === 0),
    slots: slots.filter((slot) => slot.providers.length > 0),
    orphans: all.filter((ext) => ext.provides.length > 0 && !ext.provides.some((id) => known.has(id))),
  };
}

/** 入る先の口を持つ拡張機能が切ってあって、入っていても使われないときの理由 */
function unusedReason(ext: ExtensionInfo, all: ExtensionInfo[], t: T): string | null {
  if (!ext.enabled || ext.provides.length === 0) return null;
  const owners = all.filter((other) => other.features.some((f) => ext.provides.includes(f.id)));
  if (owners.length === 0 || owners.some((owner) => owner.active)) return null;
  return t("unusedReason", { owners: owners.map((owner) => owner.name).join(t("listSeparator")) });
}

/** 詳細に出す、機能の口のつながり（持っている口に入っているもの・入っている先） */
function SlotSummary({ ext, all, onOpen }: { ext: ExtensionInfo; all: ExtensionInfo[]; onOpen: (id: string) => void }) {
  // 入っている拡張機能があるときだけ出す（まだ何も入っていない口は、詳細を長くするだけなので出さない）
  const t = messages.useT();
  const owned = ext.features
    .map((feature) => ({ feature, providers: all.filter((other) => other.provides.includes(feature.id)) }))
    .filter(({ providers }) => providers.length > 0);
  const joined = ext.provides.flatMap((id) =>
    all.flatMap((owner) => owner.features.filter((f) => f.id === id).map((feature) => ({ owner, feature }))),
  );
  const unused = unusedReason(ext, all, t);
  return (
    <>
      {owned.map(({ feature, providers }) => (
        <section key={feature.id}>
          <SectionTitle>{t("providersTitle", { name: feature.name })}</SectionTitle>
          {feature.description && <Note>{feature.description}</Note>}
          <List boxed label={feature.name}>
            {providers.map((provider) => (
              <ListItem
                key={provider.id}
                title={provider.name}
                detail={provider.enabled ? provider.description : t("providerOff")}
                off={!provider.enabled}
                onClick={() => onOpen(provider.id)}
              />
            ))}
          </List>
        </section>
      ))}
      {joined.length > 0 && (
        <p className={unused ? "mb-2.5 text-note leading-normal text-danger" : "mb-2.5 text-note leading-normal text-muted"}>
          {t("joinedAs", {
            list: joined
              .map(({ owner, feature }) => t("slotOf", { owner: owner.name, slot: feature.name }))
              .join(t("listSeparator")),
          })}
          {unused && t("unusedSuffix", { reason: unused })}
        </p>
      )}
    </>
  );
}

/** 拡張機能がどこから来たか（詳細の名前の下に出す） */
function originText(ext: ExtensionInfo, t: T): string {
  if (ext.origin.kind === "builtin") return t("originBuiltin");
  if (ext.origin.kind === "zip") return t("originZip");
  const commit = ext.origin.commit.slice(0, 7);
  return ext.builtinVersion
    ? t("originRepoOverride", { commit, version: ext.builtinVersion })
    : t("originRepo", { commit });
}
