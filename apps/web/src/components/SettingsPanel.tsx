import { useState, type FormEvent } from "react";
import type { WidgetRegistry } from "@home-dashboard/widget-sdk";
import type { VoiceSnapshot } from "../lib/useVoiceAssistant";
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
  avatarAvailable: boolean;
  avatarEnabled: boolean;
  onToggleAvatar: () => void;
}

/** 音声アシスタントの接続状況と、声の代わりにテキストで話しかける入力欄（マイクの無い端末・動作確認用） */
function VoiceSection({ voice, onAsk, avatarAvailable, avatarEnabled, onToggleAvatar }: VoiceSectionProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const connected = Boolean(voice?.connected);

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
          ? `待機中（「${voice?.wakePhrase ?? "ウェイクワード"}」で呼び出せます）`
          : "音声エージェントが起動していません"}
      </p>
      <form className="settings-panel__voice-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="テキストで話しかける"
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
    </section>
  );
}
