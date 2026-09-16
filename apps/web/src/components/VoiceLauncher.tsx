import { ACTIVE_VOICE_STATES, type VoiceSnapshot } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

interface VoiceLauncherProps {
  snapshot: VoiceSnapshot | null;
  onListen: () => void;
}

/**
 * 音声アシスタントが待機中であることを示す、画面左下の小さなボタン。
 * 声を出さずに（ウェイクワード無しで）話し始めたいときはタップする。
 * エージェントが接続していない間は出さない（押しても何も起きないので）。
 */
export function VoiceLauncher({ snapshot, onListen }: VoiceLauncherProps) {
  if (!snapshot?.connected || ACTIVE_VOICE_STATES.includes(snapshot.state)) return null;

  return (
    <button type="button" className="voice-launcher" onClick={onListen} aria-label="音声アシスタントに話しかける">
      <Icon name="mic" />
      {snapshot.wakePhrase && <span className="voice-launcher__hint">「{snapshot.wakePhrase}」</span>}
    </button>
  );
}
