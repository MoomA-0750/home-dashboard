import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BackButton,
  Button,
  ButtonLink,
  ButtonRow,
  CodeBlock,
  Field,
  Group,
  List,
  ListItem,
  Message,
  Note,
  SectionTitle,
  type ExtensionSettingsPanelProps,
} from "@home-dashboard/widget-sdk";
import { bridgeUrl, deleteMachine, fetchMachines, fetchSshKey, saveMachine, testMachine, type SshKeyInfo } from "./api";
import { strings } from "./i18n";
import type { MachineConfig, MachineType } from "./types";

/**
 * 設定画面の「拡張機能 → Claude Code」に出す、機械の登録と、機械の側の準備（仲介スクリプトと鍵の1行）。
 * 変えられるのは管理者だけ。行を押すとその機械の設定を開く
 */

type Draft = Omit<MachineConfig, "id" | "port"> & { id?: string; port?: string };
type Ctx = ExtensionSettingsPanelProps["ctx"];

const emptyDraft = (): Draft => ({ name: "", type: "ssh", host: "", port: "22", username: "", fingerprint: "" });
const toDraft = (m: MachineConfig): Draft => ({ ...m, port: m.port ? String(m.port) : "" });
const toBody = (d: Draft): Partial<MachineConfig> => ({ ...d, port: d.port ? Number(d.port) : undefined });

export function MachineSettings({ ctx, isAdmin }: ExtensionSettingsPanelProps) {
  const t = strings.useT();
  const [machines, setMachines] = useState<MachineConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setMachines(await fetchMachines(ctx));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [ctx, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    return (
      <section className="mt-5 flex flex-col gap-3">
        <SectionTitle>{t("machinesTitle")}</SectionTitle>
        <Note>{t("adminOnly")}</Note>
      </section>
    );
  }

  if (editing) {
    return (
      <MachineEditor
        ctx={ctx}
        draft={editing}
        onDone={() => {
          setEditing(null);
          void load();
        }}
      />
    );
  }

  return (
    <section className="mt-5 flex flex-col gap-3">
      <SectionTitle>{t("machinesTitle")}</SectionTitle>
      <Note>{t("machinesNote")}</Note>
      {error && <Message tone="error">{error}</Message>}
      {machines === null && !error && <Note>{t("loading")}</Note>}
      {machines && machines.length > 0 && (
        <List>
          {machines.map((machine) => (
            <ListItem
              key={machine.id}
              title={machine.name}
              detail={
                machine.type === "ssh"
                  ? t("machineSsh", { user: machine.username ?? "", host: machine.host ?? "" })
                  : t("machineSelf")
              }
              onClick={() => setEditing(toDraft(machine))}
            />
          ))}
        </List>
      )}
      <ButtonRow>
        <Button icon="add" onClick={() => setEditing(emptyDraft())}>
          {t("addMachine")}
        </Button>
      </ButtonRow>
      <SetupGuide ctx={ctx} />
    </section>
  );
}

function MachineEditor({ ctx, draft: initial, onDone }: { ctx: Ctx; draft: Draft; onDone: () => void }) {
  const t = strings.useT();
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [observed, setObserved] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isNew = !draft.id;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveMachine(ctx, toBody(draft));
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMessage(null);
    setObserved(null);
    try {
      const result = await testMachine(ctx, toBody(draft));
      setMessage({ ok: result.ok, text: result.message });
      if (result.fingerprint) setObserved(result.fingerprint);
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    if (!deleting) return setDeleting(true);
    setBusy(true);
    try {
      await deleteMachine(ctx, draft.id);
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
      setBusy(false);
    }
  };

  const field = (label: string, key: "name" | "host" | "port" | "username" | "fingerprint", placeholder = "", hint?: string) => (
    <Field label={label} hint={hint}>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        placeholder={placeholder}
        value={String(draft[key] ?? "")}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </Field>
  );

  return (
    <section className="mt-5 flex flex-col gap-3">
      <BackButton label={t("machinesTitle")} onClick={onDone} />
      <SectionTitle>{isNew ? t("addMachine") : draft.name}</SectionTitle>
      <Group>
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <Field label={t("type")}>
              <select
                value={draft.type}
                onChange={(e) => {
                  set({ type: e.target.value as MachineType });
                  setMessage(null);
                  setObserved(null);
                }}
              >
                <option value="ssh">{t("typeSsh")}</option>
                <option value="self">{t("typeSelf")}</option>
              </select>
            </Field>
            {field(t("name"), "name", "mooma-lpve")}
            {draft.type === "ssh" && (
              <>
                {field(t("host"), "host", "192.168.1.10")}
                {field(t("port"), "port", "22")}
                {field(t("username"), "username", "mooma")}
                {field(t("fingerprint"), "fingerprint", "SHA256:…", t("fingerprintHint"))}
              </>
            )}
            <ButtonRow>
              <Button variant="primary" type="submit">
                {t("save")}
              </Button>
              <Button onClick={() => void test()}>{busy ? t("testing") : t("test")}</Button>
            </ButtonRow>
          </fieldset>
          {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
          {observed && (
            <div className="my-3 flex flex-col gap-2">
              <CodeBlock>{observed}</CodeBlock>
              <ButtonRow>
                <Button
                  onClick={() => {
                    set({ fingerprint: observed });
                    setObserved(null);
                    setMessage({ ok: true, text: t("fingerprintSet") });
                  }}
                >
                  {t("useFingerprint")}
                </Button>
              </ButtonRow>
            </div>
          )}
        </form>
      </Group>
      {!isNew && (
        <ButtonRow>
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>
            {deleting ? t("removeConfirm", { name: draft.name }) : t("remove")}
          </Button>
        </ButtonRow>
      )}
    </section>
  );
}

/** 機械の側の準備（仲介スクリプトを置く・鍵の1行を足す・Herdr） */
function SetupGuide({ ctx }: { ctx: Ctx }) {
  const t = strings.useT();
  const [key, setKey] = useState<SshKeyInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    fetchSshKey(ctx)
      .then(setKey)
      .catch(() => undefined);
  }, [ctx]);
  const copy = (id: string, value: string) =>
    void navigator.clipboard?.writeText(value).then(
      () => setCopied(id),
      () => undefined,
    );
  const install = key
    ? `mkdir -p ~/.local/bin ~/.ssh && mv ~/Downloads/${key.bridgeFile} ~/.local/bin/ && chmod 755 ~/.local/bin/${key.bridgeFile}`
    : "";
  return (
    <Group title={t("setupTitle")}>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-label leading-normal">
        <li className="flex flex-col gap-2">
          <span>{t("setupStep1", { file: key?.bridgeFile ?? "hd-claude-bridge.py" })}</span>
          <ButtonRow>
            <ButtonLink href={bridgeUrl(ctx)} download={key?.bridgeFile ?? "hd-claude-bridge.py"}>
              {t("saveScript")}
            </ButtonLink>
          </ButtonRow>
          {install && (
            <Field label={t("installCommand")}>
              <CodeBlock>{install}</CodeBlock>
            </Field>
          )}
        </li>
        <li className="flex flex-col gap-2">
          <span>{t("setupStep2")}</span>
          {key && (
            <>
              <CodeBlock>{key.authorizedKeysLine}</CodeBlock>
              <ButtonRow>
                <Button onClick={() => copy("key", key.authorizedKeysLine)}>{copied === "key" ? t("copied") : t("copy")}</Button>
              </ButtonRow>
            </>
          )}
        </li>
        <li>{t("setupStep3")}</li>
      </ol>
    </Group>
  );
}
