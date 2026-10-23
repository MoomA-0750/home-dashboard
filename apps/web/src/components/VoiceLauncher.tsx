import { defineMessages } from "@home-dashboard/widget-sdk";
import { ACTIVE_VOICE_STATES, type VoicePersonas, type VoiceSnapshot } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

const messages = defineMessages({
  ja: { talkTo: "{name}に話しかける", talkToAssistant: "音声アシスタントに話しかける", hint: "「{hint}」" },
  en: { talkTo: "Talk to {name}", talkToAssistant: "Talk to the voice assistant", hint: "“{hint}”" },
});

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
  const t = messages.useT();
  if (!snapshot?.connected || ACTIVE_VOICE_STATES.includes(snapshot.state)) return null;
  const persona = personas?.personas.find((p) => p.id === personas.defaultPersonaId);
  const hint = persona?.wakePhrase;

  return (
    <button
      type="button"
      className="voice-launcher"
      onClick={onListen}
      aria-label={persona ? t("talkTo", { name: persona.name }) : t("talkToAssistant")}
    >
      <Icon name="mic" />
      {hint && <span className="voice-launcher__hint">{t("hint", { hint })}</span>}
    </button>
  );
}
