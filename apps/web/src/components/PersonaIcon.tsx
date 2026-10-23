import { useState } from "react";
import { personaIconUrl } from "../lib/personaIcons";
import type { VoicePersona } from "../lib/useVoiceAssistant";

// アイコンが無いキャラクターは、名前の頭文字をキャラクターごとに決まった色の丸で出す
const FALLBACK_HUES = [330, 200, 35, 150, 270, 0, 95];

function hueFor(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_HUES[hash % FALLBACK_HUES.length];
}

interface PersonaIconProps {
  apiBaseUrl: string;
  /** 記録にだけ残っていて今はいないキャラクターでも、名前で頭文字を出す */
  persona: Pick<VoicePersona, "id" | "name"> & { iconVersion?: number | null };
  size?: "small" | "medium" | "large";
}

/** チャットの吹き出し・話す相手・会話の一覧に出すキャラクターのアイコン */
export function PersonaIcon({ apiBaseUrl, persona, size = "medium" }: PersonaIconProps) {
  const url = personaIconUrl(apiBaseUrl, { id: persona.id, iconVersion: persona.iconVersion ?? null });
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const className = `persona-icon persona-icon--${size}`;
  if (url && failedUrl !== url) {
    return <img className={className} src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} />;
  }
  return (
    <span
      className={`${className} persona-icon--initial`}
      style={{ "--persona-hue": hueFor(persona.id) } as React.CSSProperties}
      aria-hidden="true"
    >
      {[...persona.name][0] ?? "?"}
    </span>
  );
}
