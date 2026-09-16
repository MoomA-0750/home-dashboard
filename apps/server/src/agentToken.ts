import { timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

/**
 * 音声エージェント向けのエンドポイント（/ws/voice-agent・/mcp）で使う共有トークンの照合。
 * VOICE_AGENT_TOKEN が未設定なら照合しない（既存の /api/* と同じく、LAN内からは誰でも使える扱い）。
 */
export function agentTokenMatches(given: string | undefined): boolean {
  const expected = config.voice.agentToken;
  if (!expected) return true;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
