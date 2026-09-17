import { useRef, useState, type ChangeEvent } from "react";
import { PersonaImportConflict, type PersonaImportResult, type VoicePersonas } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

interface PersonaManagerProps {
  personas: VoicePersonas;
  onImport: (file: File, replace: boolean) => Promise<PersonaImportResult>;
  onDelete: (personaId: string) => Promise<void>;
  exportUrl: (personaId: string) => string;
}

type Notice =
  | { kind: "done"; message: string; warnings: string[] }
  | { kind: "conflict"; message: string; file: File }
  | { kind: "error"; message: string };

/**
 * キャラクターの追加（ZIPのインポート）・書き出し・削除。
 * パッケージは persona.json・prompt.md・avatar.vrm を入れたZIP（書き出したものをそのまま取り込める）。
 */
export function PersonaManager({ personas, onImport, onDelete, exportUrl }: PersonaManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const runImport = async (file: File, replace: boolean) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await onImport(file, replace);
      setNotice({
        kind: "done",
        message: `「${result.name}」を${result.replaced ? "上書き" : "追加"}しました`,
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

  const handleDelete = async (personaId: string, name: string) => {
    setConfirmingDelete(null);
    setBusy(true);
    try {
      await onDelete(personaId);
      setNotice({ kind: "done", message: `「${name}」を削除しました`, warnings: [] });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="persona-manager">
      <h4 className="settings-panel__voice-history-title">キャラクター</h4>
      <ul className="persona-manager__list">
        {personas.personas.map((persona) => (
          <li key={persona.id} className="persona-manager__item">
            <div className="persona-manager__head">
              <strong>{persona.name}</strong>
              <span className="persona-manager__wake">「{persona.wakePhrase}」</span>
            </div>
            <div className="persona-manager__tags">
              {persona.id === personas.defaultPersonaId && <span>既定</span>}
              {persona.hasAvatar && <span>アバター</span>}
              {persona.hasPrompt ? <span>キャラクター設定</span> : <span>素のアシスタント</span>}
            </div>
            {persona.warnings.map((warning) => (
              <p key={warning} className="persona-manager__warning">
                {warning}
              </p>
            ))}
            {!persona.builtIn && (
              <div className="persona-manager__actions">
                <a href={exportUrl(persona.id)} download={`${persona.id}.zip`}>
                  書き出し
                </a>
                {confirmingDelete === persona.id ? (
                  <>
                    <button type="button" className="persona-manager__danger" disabled={busy} onClick={() => handleDelete(persona.id, persona.name)}>
                      削除する
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(null)}>
                      やめる
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={busy} onClick={() => setConfirmingDelete(persona.id)}>
                    削除
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={handleFile} />
      <button type="button" className="persona-manager__import" disabled={busy} onClick={() => fileRef.current?.click()}>
        <Icon name="add" />
        <span>{busy ? "処理中…" : "キャラクターを追加（ZIP）"}</span>
      </button>

      {notice?.kind === "done" && (
        <div className="persona-manager__notice">
          <p>{notice.message}</p>
          {notice.warnings.map((warning) => (
            <p key={warning} className="persona-manager__warning">
              {warning}
            </p>
          ))}
        </div>
      )}
      {notice?.kind === "conflict" && (
        <div className="persona-manager__notice">
          <p>{notice.message}</p>
          <div className="persona-manager__actions">
            <button type="button" className="persona-manager__danger" disabled={busy} onClick={() => runImport(notice.file, true)}>
              上書きする
            </button>
            <button type="button" onClick={() => setNotice(null)}>
              やめる
            </button>
          </div>
        </div>
      )}
      {notice?.kind === "error" && <p className="settings-panel__voice-error">{notice.message}</p>}
    </div>
  );
}
