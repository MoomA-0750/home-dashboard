import { useRef, useState, type ChangeEvent } from "react";
import { MOTION_NAMES } from "../avatar/motions";
import { deletePersonaIcon, imageFileToIcon, uploadPersonaIcon } from "../lib/personaIcons";
import {
  PersonaImportConflict,
  type PersonaImportResult,
  type VoicePersona,
  type VoicePersonas,
} from "../lib/useVoiceAssistant";
import { PersonaIcon } from "./PersonaIcon";
import { PersonaPreview } from "./PersonaPreview";
import {
  BackButton,
  Badge,
  Button,
  ButtonLink,
  ButtonRow,
  defineMessages,
  Group,
  List,
  ListItem,
  Message,
  Note,
  SectionTitle,
  ToggleSwitch,
} from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    motionMissing: "表情「{name}」の身振り {motion} がありません（使えるもの: {available}）",
    listSeparator: "・",
    turnedOn: "「{name}」を入れました",
    turnedOff: "「{name}」を切りました（呼びかけに反応しません）",
    added: "「{name}」を追加しました",
    replaced: "「{name}」を上書きしました",
    noAvatar: "アバターがありません",
    iconFromAvatar: "「{name}」のアイコンをアバターから作りました",
    iconChanged: "「{name}」のアイコンを変えました",
    iconRemoved: "「{name}」のアイコンを消しました",
    deleted: "「{name}」を削除しました",
    characters: "キャラクター",
    callWith: "「{phrase}」で呼びかける",
    turnOff: "{name}を切る",
    turnOn: "{name}を入れる",
    tagDefault: "既定",
    tagAvatar: "アバター",
    tagPrompt: "キャラクター設定",
    tagPlain: "素のアシスタント",
    tagOff: "切ってある",
    builtInNote: "キャラクターの設定が無いときの素のアシスタントです。キャラクターを追加すると入れ替わります。",
    avatarMotion: "アバターの動き",
    iconSettings: "アイコン設定",
    makeFromAvatar: "アバターから作る",
    chooseImage: "画像を選ぶ",
    remove: "消す",
    package: "パッケージ",
    exportZip: "書き出し（ZIP）",
    confirmDelete: "削除する",
    cancel: "やめる",
    delete: "削除",
    needsReview: "確かめてほしいことがあります（開いて見てください）",
    wakePhrase: "「{phrase}」",
    withAvatar: "・アバター",
    working: "処理中…",
    importZip: "キャラクターを追加（ZIP）",
    overwrite: "上書きする",
  },
  en: {
    motionMissing: "Expression “{name}” uses motion {motion}, which doesn't exist (available: {available})",
    listSeparator: ", ",
    turnedOn: "Turned on “{name}”",
    turnedOff: "Turned off “{name}” (it won't respond when called)",
    added: "Added “{name}”",
    replaced: "Replaced “{name}”",
    noAvatar: "There's no avatar",
    iconFromAvatar: "Created the icon for “{name}” from its avatar",
    iconChanged: "Changed the icon for “{name}”",
    iconRemoved: "Removed the icon for “{name}”",
    deleted: "Deleted “{name}”",
    characters: "Characters",
    callWith: "Say “{phrase}” to call",
    turnOff: "Turn off {name}",
    turnOn: "Turn on {name}",
    tagDefault: "Default",
    tagAvatar: "Avatar",
    tagPrompt: "Character prompt",
    tagPlain: "Plain assistant",
    tagOff: "Off",
    builtInNote: "The plain assistant used when no character is set up. Adding a character replaces it.",
    avatarMotion: "Avatar motion",
    iconSettings: "Icon",
    makeFromAvatar: "Create from avatar",
    chooseImage: "Choose image",
    remove: "Remove",
    package: "Package",
    exportZip: "Export (ZIP)",
    confirmDelete: "Delete",
    cancel: "Cancel",
    delete: "Delete",
    needsReview: "Something needs checking (open to see)",
    wakePhrase: "“{phrase}”",
    withAvatar: " · Avatar",
    working: "Working…",
    importZip: "Add character (ZIP)",
    overwrite: "Replace",
  },
});

type T = ReturnType<typeof messages.useT>;
type IconMessage = "iconFromAvatar" | "iconChanged" | "iconRemoved";

/** 表情に指定された身振りの名前が、画面の身振りの一覧にあるか */
function motionWarnings(persona: VoicePersona, t: T): string[] {
  return Object.entries(persona.expressions)
    .filter(([, spec]) => spec.motion && !MOTION_NAMES.includes(spec.motion))
    .map(([name, spec]) =>
      t("motionMissing", { name, motion: spec.motion!, available: MOTION_NAMES.join(t("listSeparator")) }),
    );
}

interface PersonaManagerProps {
  personas: VoicePersonas;
  onImport: (file: File, replace: boolean) => Promise<PersonaImportResult>;
  onDelete: (personaId: string) => Promise<void>;
  onSetEnabled: (personaId: string, enabled: boolean) => Promise<void>;
  /** 詳細を開いた・閉じた（開いているあいだ、設定画面はほかの項目を隠して詳細だけを出す） */
  onDetailChange?: (open: boolean) => void;
  exportUrl: (personaId: string) => string;
  avatarUrlFor: (personaId: string) => string | null;
  apiBaseUrl: string;
}

/** 確かめてほしいこと（表情の割り当てが無いなど）の1行 */
const WARNING = "leading-normal text-warn";

type Notice =
  | { kind: "done"; message: string; warnings: string[] }
  | { kind: "conflict"; message: string; file: File }
  | { kind: "error"; message: string };

/**
 * 設定画面の「キャラクター」。一覧の行のトグルで入／切し、行を押すとそのキャラクターの詳細
 * （アバターの動きの確認・アイコンの設定・書き出し・削除）を開く。キャラクターの追加は ZIP のインポートで行う。
 * パッケージは persona.json・prompt.md・avatar.vrm を入れたZIP（書き出したものをそのまま取り込める）。
 */
export function PersonaManager({
  personas,
  onImport,
  onDelete,
  onSetEnabled,
  onDetailChange,
  exportUrl,
  avatarUrlFor,
  apiBaseUrl,
}: PersonaManagerProps) {
  const t = messages.useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);
  // 画像を選ぶアイコンの持ち主（ファイル選択は1つの input を使い回す）
  const iconTargetRef = useRef<VoicePersona | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  // 詳細を開いているキャラクター
  const [openId, setOpenIdState] = useState<string | null>(null);
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    onDetailChange?.(id !== null);
  };

  const toggle = async (persona: VoicePersona, enabled: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      await onSetEnabled(persona.id, enabled);
      setNotice({
        kind: "done",
        message: t(enabled ? "turnedOn" : "turnedOff", { name: persona.name }),
        warnings: [],
      });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (file: File, replace: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await onImport(file, replace);
      setNotice({
        kind: "done",
        message: t(result.replaced ? "replaced" : "added", { name: result.name }),
        warnings: result.warnings,
      });
    } catch (err) {
      if (err instanceof PersonaImportConflict) setNotice({ kind: "conflict", message: err.message, file });
      else setNotice({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void runImport(file, false);
  };

  const runIcon = async (persona: VoicePersona, task: () => Promise<void>, message: IconMessage) => {
    setBusy(true);
    setNotice(null);
    try {
      await task();
      setNotice({ kind: "done", message: t(message, { name: persona.name }), warnings: [] });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  /** VRMから顔のアップを撮ってアイコンにする（three.js を含むので、押したときに読み込む） */
  const makeIconFromAvatar = (persona: VoicePersona) =>
    runIcon(
      persona,
      async () => {
        const modelUrl = avatarUrlFor(persona.id);
        if (!modelUrl) throw new Error(t("noAvatar"));
        const { renderAvatarIcon } = await import("./avatarIcon");
        await uploadPersonaIcon(apiBaseUrl, persona.id, await renderAvatarIcon(modelUrl, persona.rig ?? {}));
      },
      "iconFromAvatar",
    );

  const handleIconFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const persona = iconTargetRef.current;
    event.target.value = "";
    if (!file || !persona) return;
    void runIcon(
      persona,
      async () => uploadPersonaIcon(apiBaseUrl, persona.id, await imageFileToIcon(file)),
      "iconChanged",
    );
  };

  const handleDelete = async (personaId: string, name: string) => {
    setConfirmingDelete(null);
    setOpenId(null);
    setBusy(true);
    try {
      await onDelete(personaId);
      setNotice({ kind: "done", message: t("deleted", { name }), warnings: [] });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const opened = personas.personas.find((persona) => persona.id === openId) ?? null;

  const warningsOf = (persona: VoicePersona) => [...persona.warnings, ...motionWarnings(persona, t)];

  return (
    <div>
      {opened ? (
        <div>
          <BackButton
            label={t("characters")}
            onClick={() => {
              setOpenId(null);
              setNotice(null);
              setConfirmingDelete(null);
            }}
          />
          <List boxed label={opened.name}>
            <ListItem
              leading={<PersonaIcon apiBaseUrl={apiBaseUrl} persona={opened} />}
              title={<span className="text-title font-semibold">{opened.name}</span>}
              detail={t("callWith", { phrase: opened.wakePhrase })}
              trailing={
                <ToggleSwitch
                  checked={opened.enabled}
                  disabled={busy || opened.builtIn}
                  label={t(opened.enabled ? "turnOff" : "turnOn", { name: opened.name })}
                  onChange={(enabled) => void toggle(opened, enabled)}
                />
              }
            />
          </List>
          <div className="flex flex-wrap gap-1">
            {opened.id === personas.defaultPersonaId && <Badge>{t("tagDefault")}</Badge>}
            {opened.hasAvatar && <Badge>{t("tagAvatar")}</Badge>}
            {opened.hasPrompt ? <Badge>{t("tagPrompt")}</Badge> : <Badge>{t("tagPlain")}</Badge>}
            {!opened.enabled && <Badge>{t("tagOff")}</Badge>}
          </div>
          {warningsOf(opened).map((warning) => (
            <p key={warning} className={WARNING}>
              {warning}
            </p>
          ))}
          {opened.builtIn ? (
            <Note>{t("builtInNote")}</Note>
          ) : (
            <>
              {opened.hasAvatar && avatarUrlFor(opened.id) && (
                <>
                  <SectionTitle>{t("avatarMotion")}</SectionTitle>
                  <PersonaPreview key={opened.id} persona={opened} modelUrl={avatarUrlFor(opened.id)!} />
                </>
              )}
              <SectionTitle>{t("iconSettings")}</SectionTitle>
              {/* 今のアイコンと、それを変えるボタンを横に並べる */}
              <div className="flex items-center gap-5">
                <PersonaIcon apiBaseUrl={apiBaseUrl} persona={opened} size="large" />
                <ButtonRow>
                  {opened.hasAvatar && (
                    <Button disabled={busy} onClick={() => makeIconFromAvatar(opened)}>
                      {t("makeFromAvatar")}
                    </Button>
                  )}
                  <Button
                    disabled={busy}
                    onClick={() => {
                      iconTargetRef.current = opened;
                      iconFileRef.current?.click();
                    }}
                  >
                    {t("chooseImage")}
                  </Button>
                  {opened.iconVersion && (
                    <Button
                      disabled={busy}
                      onClick={() => runIcon(opened, () => deletePersonaIcon(apiBaseUrl, opened.id), "iconRemoved")}
                    >
                      {t("remove")}
                    </Button>
                  )}
                </ButtonRow>
              </div>
              <SectionTitle>{t("package")}</SectionTitle>
              <ButtonRow>
                <ButtonLink href={exportUrl(opened.id)} download={`${opened.id}.zip`}>
                  {t("exportZip")}
                </ButtonLink>
                {confirmingDelete === opened.id ? (
                  <>
                    <Button variant="danger" disabled={busy} onClick={() => handleDelete(opened.id, opened.name)}>
                      {t("confirmDelete")}
                    </Button>
                    <Button onClick={() => setConfirmingDelete(null)}>{t("cancel")}</Button>
                  </>
                ) : (
                  <Button disabled={busy} onClick={() => setConfirmingDelete(opened.id)}>
                    {t("delete")}
                  </Button>
                )}
              </ButtonRow>
            </>
          )}
        </div>
      ) : (
        <>
          <List boxed label={t("characters")}>
            {personas.personas.map((persona) => (
              <ListItem
                key={persona.id}
                leading={<PersonaIcon apiBaseUrl={apiBaseUrl} persona={persona} />}
                title={persona.name}
                badge={persona.id === personas.defaultPersonaId ? t("tagDefault") : undefined}
                detail={
                  warningsOf(persona).length > 0
                    ? t("needsReview")
                    : `${t("wakePhrase", { phrase: persona.wakePhrase })}${persona.hasAvatar ? t("withAvatar") : ""}`
                }
                error={warningsOf(persona).length > 0}
                off={!persona.enabled}
                onClick={() => {
                  setOpenId(persona.id);
                  setNotice(null);
                }}
                trailing={
                  <ToggleSwitch
                    checked={persona.enabled}
                    disabled={busy || persona.builtIn}
                    label={t(persona.enabled ? "turnOff" : "turnOn", { name: persona.name })}
                    onChange={(enabled) => void toggle(persona, enabled)}
                  />
                }
              />
            ))}
          </List>
          <Button icon="add" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t("working") : t("importZip")}
          </Button>
        </>
      )}

      <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={handleFile} />
      <input ref={iconFileRef} type="file" accept="image/*" hidden onChange={handleIconFile} />

      {notice?.kind === "done" && (
        <Group className="mt-3 flex flex-col gap-2 text-label leading-normal">
          <p>{notice.message}</p>
          {notice.warnings.map((warning) => (
            <p key={warning} className={WARNING}>
              {warning}
            </p>
          ))}
        </Group>
      )}
      {notice?.kind === "conflict" && (
        <Group className="mt-3 flex flex-col gap-2 text-label leading-normal">
          <p>{notice.message}</p>
          <ButtonRow>
            <Button variant="danger" disabled={busy} onClick={() => runImport(notice.file, true)}>
              {t("overwrite")}
            </Button>
            <Button onClick={() => setNotice(null)}>{t("cancel")}</Button>
          </ButtonRow>
        </Group>
      )}
      {notice?.kind === "error" && <Message tone="error">{notice.message}</Message>}
    </div>
  );
}
