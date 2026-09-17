import { ACTIVE_VOICE_STATES, type VoicePersonas, type VoiceSnapshot } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

interface VoiceLauncherProps {
  snapshot: VoiceSnapshot | null;
  personas: VoicePersonas | null;
  onListen: () => void;
}

/**
 * 音声アシスタントが待機中であることを示す、画面左下の小さなボタン。
 * 声を出さずに（ウェイクワード無しで）話し始めたいときはタップする。応答するのは設定画面で選んだ既定のキャラクター。
 * エージェントが接続していない間は出さない（押しても何も起きないので）。
 */
export function VoiceLauncher({ snapshot, personas, onListen }: VoiceLauncherProps) {
  if (!snapshot?.connected || ACTIVE_VOICE_STATES.includes(snapshot.state)) return null;
  const persona = personas?.personas.find((p) => p.id === personas.defaultPersonaId);
  const hint = persona?.wakePhrase;

  return (
    <button
      type="button"
      className="voice-launcher"
      onClick={onListen}
      aria-label={persona ? `${persona.name}に話しかける` : "音声アシスタントに話しかける"}
    >
      <Icon name="mic" />
      {hint && <span className="voice-launcher__hint">「{hint}」</span>}
    </button>
  );
}
