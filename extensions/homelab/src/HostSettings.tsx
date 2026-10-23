import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BackButton,
  Button,
  ButtonRow,
  CodeBlock,
  Field,
  List,
  ListItem,
  Message,
  Note,
  SectionTitle,
  defineMessages,
  textFor,
  useLocale,
  type ExtensionSettingsPanelProps,
  type Locale,
  type LocalizedText,
} from "@home-dashboard/widget-sdk";

/**
 * 設定画面の「拡張機能 → homelab」に出す、ホストの登録。行を押すとそのホストの設定を開く。
 * 種類ごとに要る項目が違う（この機械は何も要らない。SSH は宛先・ユーザー・ホスト鍵の指紋、node_exporter は URL、
 * Proxmox は URL とトークンと指紋、応答だけは宛先と口）。
 * 変えられるのは管理者だけ。Proxmox のトークンのシークレットはサーバーから返らないので、変えるときだけ入れる。
 */

type HostType = "self" | "ssh" | "node-exporter" | "proxmox" | "tcp";

interface Host {
  id: string;
  name: string;
  type: HostType;
  host?: string;
  port?: number;
  url?: string;
  node?: string;
  username?: string;
  tokenId?: string;
  fingerprint?: string;
  hasTokenSecret?: boolean;
}

type Draft = Omit<Host, "id" | "port"> & { id?: string; port?: string; tokenSecret?: string };

export const TYPE_LABELS: Record<HostType, LocalizedText> = {
  self: { ja: "この機械", en: "This machine" },
  ssh: "SSH",
  "node-exporter": "node_exporter",
  proxmox: "Proxmox VE",
  tcp: { ja: "応答の確認だけ", en: "Reachability only" },
};

const TYPE_NOTES: Record<HostType, LocalizedText> = {
  self: {
    ja: "このダッシュボードが動いている機械の、CPU・メモリ・ディスク・連続稼働時間を読みます。何も入れなくて使えます。",
    en: "Reads CPU, memory, disk and uptime of the machine this dashboard runs on. Nothing to install.",
  },
  ssh: {
    ja: "SSH でつないで、/proc と df からリソースを読みます（Linux）。相手には何も入れず、下の1行を、つなぐユーザーの ~/.ssh/authorized_keys に足すだけです。この1行はリソースを読むコマンドしか動かせないように固定してあります。ホスト鍵は指紋で確かめます。空のまま「接続を確かめる」を押すと今の指紋が出ます。相手で ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub を動かして、同じかを確かめてから使ってください。",
    en: 'Connects over SSH and reads resources from /proc and df (Linux). Nothing to install on the host: just add the line below to ~/.ssh/authorized_keys of the user you connect as. That line is locked to the command that reads resources. The host key is checked by fingerprint. Press "Test connection" with it empty to see the current fingerprint, then run ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub on the host and confirm they match before using it.',
  },
  "node-exporter": {
    ja: "相手の機械に node_exporter を入れて読みます（Debian・Ubuntu なら apt install prometheus-node-exporter）。URL は http://<機械>:9100/metrics です。",
    en: "Install node_exporter on the machine to read it (on Debian/Ubuntu: apt install prometheus-node-exporter). The URL is http://<machine>:9100/metrics.",
  },
  proxmox: {
    ja: "Proxmox の画面の「データセンター → アクセス権限 → API トークン」で、読むだけの権限（PVEAuditor）のトークンを作って入れます。証明書は Proxmox 自身の発行なので指紋で確かめます。空のまま「接続を確かめる」を押すと今の指紋が出ます。Proxmox の画面（ノード → システム → 証明書）の指紋と同じかを確かめてから使ってください。",
    en: 'In Proxmox, create a read-only (PVEAuditor) token under Datacenter → Permissions → API Tokens and enter it here. Proxmox issues its own certificate, so it\'s checked by fingerprint. Press "Test connection" with it empty to see the current fingerprint, and confirm it matches the one in Proxmox (Node → System → Certificates) before using it.',
  },
  tcp: {
    ja: "リソースは読まず、決めた口（SSH の 22 など）に TCP でつながるかだけを見ます。",
    en: "Doesn't read resources; only checks whether a TCP connection to the given port (such as 22 for SSH) succeeds.",
  },
};

const messages = defineMessages({
  ja: {
    loadFailed: "ホストを読めませんでした（{status}）",
    requestFailed: "うまくいきませんでした（{status}）",
    hosts: "ホスト",
    adminOnly: "ホストを登録できるのは管理者のアカウントだけです。",
    intro: "ホームラボのウィジェットに出す機械です。上から順に出します。押すと設定を開きます。",
    loading: "読み込んでいます…",
    addHost: "ホストを追加",
    type: "種類",
    name: "名前",
    namePlaceholder: "mooma-lpve など",
    address: "宛先（IP かホスト名）",
    port: "口の番号",
    username: "ユーザー名",
    hostKeyFingerprint: "ホスト鍵の指紋",
    tokenId: "API トークンの ID",
    tokenSecret: "API トークンのシークレット",
    secretSet: "設定済み（変えるときだけ入力）",
    certFingerprint: "証明書の指紋（SHA-256）",
    node: "ノード（空なら最初のノード）",
    add: "追加",
    save: "保存",
    test: "接続を確かめる",
    fingerprintSet: "指紋を入れました。もう一度確かめてから保存してください",
    useFingerprint: "この指紋を使う",
    confirmDelete: "もう一度押して消す",
    deleteHost: "このホストを消す",
    authorizedKeysLine: "相手の ~/.ssh/authorized_keys に足す1行",
    copied: "コピーしました",
    copy: "コピー",
  },
  en: {
    loadFailed: "Couldn't load hosts ({status})",
    requestFailed: "Something went wrong ({status})",
    hosts: "Hosts",
    adminOnly: "Only admin accounts can register hosts.",
    intro: "Machines shown in the homelab widget, in this order. Tap one to open its settings.",
    loading: "Loading…",
    addHost: "Add host",
    type: "Type",
    name: "Name",
    namePlaceholder: "e.g. mooma-lpve",
    address: "Address (IP or host name)",
    port: "Port",
    username: "User name",
    hostKeyFingerprint: "Host key fingerprint",
    tokenId: "API token ID",
    tokenSecret: "API token secret",
    secretSet: "Set (enter only to change)",
    certFingerprint: "Certificate fingerprint (SHA-256)",
    node: "Node (empty for the first node)",
    add: "Add",
    save: "Save",
    test: "Test connection",
    fingerprintSet: "Fingerprint filled in. Test again before saving",
    useFingerprint: "Use this fingerprint",
    confirmDelete: "Press again to delete",
    deleteHost: "Delete this host",
    authorizedKeysLine: "Line to add to ~/.ssh/authorized_keys on the host",
    copied: "Copied",
    copy: "Copy",
  },
});

const emptyDraft = (type: HostType, locale: Locale): Draft => ({
  name: type === "self" ? textFor(TYPE_LABELS.self, locale) : "",
  type,
  url: type === "node-exporter" ? "http://" : type === "proxmox" ? "https://" : "",
  port: type === "tcp" || type === "ssh" ? "22" : "",
});

const toDraft = (host: Host): Draft => ({ ...host, port: host.port ? String(host.port) : "", tokenSecret: "" });

function toBody(draft: Draft) {
  return { ...draft, port: draft.port ? Number(draft.port) : undefined };
}

export function HostSettings({ ctx, isAdmin }: ExtensionSettingsPanelProps) {
  const t = messages.useT();
  const locale = useLocale();
  const base = `${ctx.apiBaseUrl}/api/ext/homelab`;
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${base}/hosts`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? messages.t("loadFailed", { status: res.status }));
      setHosts(body.hosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [base, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    return (
      <section className="homelab-settings">
        <SectionTitle>{t("hosts")}</SectionTitle>
        <Note>{t("adminOnly")}</Note>
      </section>
    );
  }

  if (editing) {
    return (
      <HostEditor
        base={base}
        draft={editing}
        onDone={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  return (
    <section className="homelab-settings">
      <SectionTitle>{t("hosts")}</SectionTitle>
      <Note>{t("intro")}</Note>
      {error && <Message tone="error">{error}</Message>}
      {hosts === null && !error && <Note>{t("loading")}</Note>}
      {hosts && hosts.length > 0 && (
        <List>
          {hosts.map((host) => (
            <ListItem
              key={host.id}
              title={host.name}
              detail={
                <>
                  {textFor(TYPE_LABELS[host.type], locale)}
                  {host.type === "tcp" && ` · ${host.host}:${host.port}`}
                  {host.type === "ssh" && ` · ${host.username}@${host.host}`}
                  {(host.type === "node-exporter" || host.type === "proxmox") && host.url && ` · ${host.url}`}
                </>
              }
              onClick={() => setEditing(toDraft(host))}
            />
          ))}
        </List>
      )}
      <ButtonRow>
        <Button
          icon="add"
          onClick={() =>
            setEditing(emptyDraft(hosts?.some((h) => h.type === "self") ? "node-exporter" : "self", locale))
          }
        >
          {t("addHost")}
        </Button>
      </ButtonRow>
    </section>
  );
}

function HostEditor({ base, draft: initial, onDone }: { base: string; draft: Draft; onDone: () => void }) {
  const t = messages.useT();
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [observedFingerprint, setObservedFingerprint] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isNew = !draft.id;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const call = async (path: string, init: RequestInit) => {
    const res = await fetch(`${base}${path}`, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
    return body;
  };
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isNew) await call("/hosts", json("POST", toBody(draft)));
      else await call(`/hosts/${draft.id}`, json("PUT", toBody(draft)));
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMessage(null);
    setObservedFingerprint(null);
    try {
      const result = await call("/hosts-test", json("POST", toBody(draft)));
      setMessage({ ok: result.ok, text: result.message });
      if (result.fingerprint) setObservedFingerprint(result.fingerprint);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return setDeleting(true);
    setBusy(true);
    try {
      await call(`/hosts/${draft.id}`, { method: "DELETE" });
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof Draft, options: { placeholder?: string; secret?: boolean } = {}) => (
    <Field label={label}>
      <input
        type={options.secret ? "password" : "text"}
        autoComplete="off"
        spellCheck={false}
        placeholder={options.placeholder ?? ""}
        value={String(draft[key] ?? "")}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)}
      />
    </Field>
  );

  return (
    <section className="homelab-settings">
      <BackButton label={t("hosts")} onClick={onDone} />
      <SectionTitle>{isNew ? t("addHost") : draft.name}</SectionTitle>
      <form className="ui-group" onSubmit={save}>
        <fieldset className="homelab-settings__fields" disabled={busy}>
          <Field label={t("type")}>
            <select
              value={draft.type}
              onChange={(e) => {
                const type = e.target.value as HostType;
                // 種類を替えたら、その種類の項目の既定に入れ替える（名前は残す）
                setDraft({
                  ...emptyDraft(type, locale),
                  id: draft.id,
                  name: draft.name || emptyDraft(type, locale).name,
                });
                setMessage(null);
                setObservedFingerprint(null);
              }}
            >
              {(Object.keys(TYPE_LABELS) as HostType[]).map((type) => (
                <option key={type} value={type}>
                  {textFor(TYPE_LABELS[type], locale)}
                </option>
              ))}
            </select>
          </Field>
          <Note>{textFor(TYPE_NOTES[draft.type], locale)}</Note>
          {field(t("name"), "name", { placeholder: t("namePlaceholder") })}
          {draft.type === "tcp" && (
            <>
              {field(t("address"), "host", { placeholder: "192.168.1.10" })}
              {field(t("port"), "port", { placeholder: "22" })}
            </>
          )}
          {draft.type === "ssh" && (
            <>
              {field(t("address"), "host", { placeholder: "192.168.1.10" })}
              {field(t("port"), "port", { placeholder: "22" })}
              {field(t("username"), "username", { placeholder: "monitor" })}
              {field(t("hostKeyFingerprint"), "fingerprint", { placeholder: "SHA256:…" })}
              <SshKeyHint base={base} />
            </>
          )}
          {draft.type === "node-exporter" && field("URL", "url", { placeholder: "http://192.168.1.10:9100/metrics" })}
          {draft.type === "proxmox" && (
            <>
              {field("URL", "url", { placeholder: "https://192.168.1.10:8006" })}
              {field(t("tokenId"), "tokenId", { placeholder: "root@pam!dashboard" })}
              {field(t("tokenSecret"), "tokenSecret", {
                secret: true,
                placeholder: draft.hasTokenSecret ? t("secretSet") : "",
              })}
              {field(t("certFingerprint"), "fingerprint", { placeholder: "AB:CD:…" })}
              {field(t("node"), "node", { placeholder: "mooma-lpve" })}
            </>
          )}
          <ButtonRow>
            <Button variant="primary" type="submit">
              {isNew ? t("add") : t("save")}
            </Button>
            <Button onClick={() => void test()}>{t("test")}</Button>
          </ButtonRow>
        </fieldset>
        {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
        {observedFingerprint && (
          <div className="homelab-settings__fingerprint">
            <CodeBlock>{observedFingerprint}</CodeBlock>
            <ButtonRow>
              <Button
                onClick={() => {
                  set({ fingerprint: observedFingerprint });
                  setObservedFingerprint(null);
                  setMessage({ ok: true, text: t("fingerprintSet") });
                }}
              >
                {t("useFingerprint")}
              </Button>
            </ButtonRow>
          </div>
        )}
      </form>
      {!isNew && (
        <ButtonRow>
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>
            {deleting ? t("confirmDelete") : t("deleteHost")}
          </Button>
        </ButtonRow>
      )}
    </section>
  );
}

/** SSH の種類で、相手の authorized_keys に足す1行を出す（コピーできる） */
function SshKeyHint({ base }: { base: string }) {
  const t = messages.useT();
  const [line, setLine] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch(`${base}/ssh-key`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body && setLine(body.authorizedKeysLine))
      .catch(() => undefined);
  }, [base]);
  if (!line) return null;
  return (
    <div className="homelab-settings__key">
      <Field label={t("authorizedKeysLine")}>
        <CodeBlock>{line}</CodeBlock>
      </Field>
      <ButtonRow>
        <Button
          onClick={() =>
            void navigator.clipboard?.writeText(line).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          {copied ? t("copied") : t("copy")}
        </Button>
      </ButtonRow>
    </div>
  );
}
