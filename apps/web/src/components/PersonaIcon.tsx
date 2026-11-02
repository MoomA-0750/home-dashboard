import { personaIconUrl } from "../lib/personaIcons";
import type { VoicePersona } from "../lib/useVoiceAssistant";
import { Avatar } from "@home-dashboard/widget-sdk";

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
  /** large はキャラクターの詳細の「アイコン設定」で、今のアイコンを大きめに見せる */
  size?: "small" | "medium" | "large";
}

/** チャットの吹き出し・話す相手・会話の一覧に出すキャラクターのアイコン（部品の Avatar に、アイコンの URL と頭文字の色を渡す） */
export function PersonaIcon({ apiBaseUrl, persona, size = "medium" }: PersonaIconProps) {
  const url = personaIconUrl(apiBaseUrl, { id: persona.id, iconVersion: persona.iconVersion ?? null });
  return <Avatar src={url} name={persona.name} hue={hueFor(persona.id)} size={size === "large" ? "xlarge" : size} />;
}
