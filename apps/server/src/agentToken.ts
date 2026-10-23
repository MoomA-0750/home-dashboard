import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

/**
 * 音声エージェント向けの共有トークン（VOICE_AGENT_TOKEN）の照合。/ws/voice-agent・/mcp と、/api/* の Bearer で使う。
 * 未設定なら誰も通さない（ログインの外にある道なので、トークンが無いまま開けると家の誰でも・外のページからでも使えてしまう）。
 */
export function agentTokenMatches(given: string | undefined): boolean {
  const expected = config.voice.agentToken;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Authorization ヘッダーの Bearer を照合する */
export function agentBearerMatches(header: string | undefined): boolean {
  return agentTokenMatches(header?.match(/^Bearer (.+)$/)?.[1]);
}
