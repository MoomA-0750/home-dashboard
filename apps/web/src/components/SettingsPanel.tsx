import { useState, type FormEvent } from "react";
import type { WidgetRegistry } from "@home-dashboard/widget-sdk";
import type { VoicePersonas, VoiceSnapshot, VoiceTurnRecord, VoiceTurnSource } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

interface SettingsPanelProps {
  registry: WidgetRegistry;
  /** 画面に固定表示していてレールには追加できないウィジェット（時刻・天気） */
  hiddenWidgetIds: string[];
  editMode: boolean;
  onToggleEditMode: () => void;
  onAdd: (widgetId: string) => void;
  voice: VoiceSnapshot | null;
  onAskVoice: (text: string) => Promise<void>;
  personas: VoicePersonas | null;
  onSelectDefaultPersona: (personaId: string) => Promise<void>;
  history: VoiceTurnRecord[];
  /** サーバーにVRMアバターが置かれているか（置かれていなければ切り替えを出さない） */
  avatarAvailable: boolean;
  avatarEnabled: boolean;
  onToggleAvatar: () => void;
  onClose: () => void;
}

/**
 * サイドバーの Settings から開くパネル。
 * 設計図のサイドバーはアイコン5つで固定なので、編集モードの切り替えはここに置いている。
 */
export function SettingsPanel({
  registry,
  hiddenWidgetIds,
  editMode,
  onToggleEditMode,
  onAdd,
  voice,
  onAskVoice,
  personas,
  onSelectDefaultPersona,
  history,
  avatarAvailable,
  avatarEnabled,
  onToggleAvatar,
  onClose,
}: SettingsPanelProps) {
  const addable = registry.getAll().filter((def) => !hiddenWidgetIds.includes(def.id));

  return (
    <div className="settings-panel">
      <div className="settings-panel__header">
        <h2>設定</h2>
        <button type="button" className="settings-panel__close" onClick={onClose} aria-label="閉じる">
          <Icon name="dismiss" />
        </button>
      </div>

      <button
        type="button"
        className={`settings-panel__edit-toggle${editMode ? " settings-panel__edit-toggle--on" : ""}`}
        aria-pressed={editMode}
        onClick={onToggleEditMode}
      >
        <Icon name="edit" />
        <span>{editMode ? "編集モードを終了" : "編集モード（並べ替え・削除）"}</span>
      </button>

      <VoiceSection
        voice={voice}
        onAsk={onAskVoice}
        personas={personas}
        onSelectDefaultPersona={onSelectDefaultPersona}
        history={history}
        avatarAvailable={avatarAvailable}
        avatarEnabled={avatarEnabled}
        onToggleAvatar={onToggleAvatar}
      />

      <h3 className="settings-panel__section-title">ウィジェットを追加</h3>
      <ul className="settings-panel__list">
        {addable.map((def) => (
          <li key={def.id}>
            <button type="button" className="settings-panel__item" onClick={() => onAdd(def.id)}>
              <span className="settings-panel__name">{def.name}</span>
              {def.description && <span className="settings-panel__desc">{def.description}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface VoiceSectionProps {
  voice: VoiceSnapshot | null;
  onAsk: (text: string) => Promise<void>;
  personas: VoicePersonas | null;
  onSelectDefaultPersona: (personaId: string) => Promise<void>;
  history: VoiceTurnRecord[];
  avatarAvailable: boolean;
  avatarEnabled: boolean;
  onToggleAvatar: () => void;
}

/** 音声アシスタントの接続状況と、声の代わりにテキストで話しかける入力欄（マイクの無い端末・動作確認用） */
const SOURCE_LABELS: Record<VoiceTurnSource, string> = {
  wake: "声",
  "follow-up": "続けて",
  button: "ボタン",
  text: "文字",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function VoiceSection({
  voice,
  onAsk,
  personas,
  onSelectDefaultPersona,
  history,
  avatarAvailable,
  avatarEnabled,
  onToggleAvatar,
}: VoiceSectionProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const connected = Boolean(voice?.connected);
  const defaultPersona = personas?.personas.find((persona) => persona.id === personas.defaultPersonaId);
  const wakePhrases = personas?.personas.map((persona) => persona.wakePhrase) ?? [];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAsk(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="settings-panel__voice">
      <h3 className="settings-panel__section-title">音声アシスタント</h3>
      <p className="settings-panel__voice-status">
        <span className={`status-dot${connected ? " status-dot--ok" : ""}`} aria-hidden="true" />
        {connected
          ? `待機中（${wakePhrases.map((phrase) => `「${phrase}」`).join("")}で呼び出せます）`
          : "音声エージェントが起動していません"}
      </p>
      {personas && personas.personas.length > 1 && (
        <label className="settings-panel__voice-persona">
          <span>ボタン・文字入力で応答するキャラクター</span>
          <select
            value={personas.defaultPersonaId}
            onChange={(event) => {
              onSelectDefaultPersona(event.target.value).catch((err) =>
                setError(err instanceof Error ? err.message : String(err)),
              );
            }}
          >
            {personas.personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <form className="settings-panel__voice-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={defaultPersona ? `${defaultPersona.name}に文字で話しかける` : "テキストで話しかける"}
          aria-label="音声アシスタントへのメッセージ"
          disabled={!connected}
        />
        <button type="submit" aria-label="送信" disabled={!connected || sending || !text.trim()}>
          <Icon name="send" />
        </button>
      </form>
      {error && <p className="settings-panel__voice-error">{error}</p>}
      {avatarAvailable && (
        <label className="settings-panel__voice-option">
          <input type="checkbox" checked={avatarEnabled} onChange={onToggleAvatar} />
          <span>この端末でアバターを表示（重い端末では切る）</span>
        </label>
      )}
      {history.length > 0 && (
        <>
          <h4 className="settings-panel__voice-history-title">最近のやり取り</h4>
          <ol className="settings-panel__voice-history">
            {history.map((record, index) => (
              <li key={`${record.at}-${index}`} className="voice-history-item">
                <div className="voice-history-item__head">
                  <strong>{record.personaName}</strong>
                  <span>
                    {SOURCE_LABELS[record.source] ?? record.source}・{formatTime(record.at)}
                    {record.status === "cancelled" && "・中止"}
                    {record.status === "error" && "・エラー"}
                  </span>
                </div>
                <p className="voice-history-item__transcript">{record.transcript}</p>
                {record.response && <p className="voice-history-item__response">{record.response}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
