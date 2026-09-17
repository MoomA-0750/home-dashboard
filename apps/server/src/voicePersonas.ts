import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { config } from "./config.js";

/**
 * 音声アシスタントのキャラクター（ウェイクワードごとに呼び分ける）。
 *
 * 設定は config/voice-personas.json で、音声エージェント（apps/voice-agent/voice_agent/personas.py）と同じファイルを読む。
 * サーバーが使うのは画面に出す名前・ウェイクワードとアバターのファイルだけで、プロンプトや声はエージェントが使う。
 * ファイルが無ければ、エージェント側と同じく「Claude」1人だけ（アバターは VOICE_AVATAR_PATH）。
 *
 * どのキャラクターを既定にするか（画面のマイクボタン・文字入力で応答する相手）は画面から変えるので、
 * 設定ファイルではなく data/voice-settings.json に保存する。
 */

export interface PersonaInfo {
  id: string;
  name: string;
  /** 表示用のウェイクワード（例: 「ねえプラム」）。Vosk の表記（「甘夏」）や別表記ではなく、名前で出す */
  wakePhrase: string;
  avatarPath: string | null;
}

interface PersonasFile {
  wakePrefix?: string;
  personas: { id: string; name: string; wakeWords: string[]; avatar?: string }[];
}

const settingsPath = join(config.dataDir, "voice-settings.json");

const fallbackPersonas = (): PersonaInfo[] => [
  { id: "claude", name: "Claude", wakePhrase: "ねえクロード", avatarPath: config.voice.avatarPath },
];

export async function readPersonas(): Promise<PersonaInfo[]> {
  let raw: string;
  try {
    raw = await readFile(config.voice.personasPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallbackPersonas();
    throw err;
  }
  const data = JSON.parse(raw) as PersonasFile;
  const base = dirname(config.voice.personasPath);
  const prefix = data.wakePrefix ?? "ねえ";
  return data.personas.map((persona) => ({
    id: persona.id,
    name: persona.name,
    wakePhrase: `${prefix}${persona.name}`.replace(/\s+/g, ""),
    avatarPath: persona.avatar ? resolve(base, persona.avatar) : null,
  }));
}

export async function readDefaultPersonaId(personas: PersonaInfo[]): Promise<string> {
  try {
    const saved = JSON.parse(await readFile(settingsPath, "utf-8")) as { defaultPersonaId?: string };
    if (personas.some((persona) => persona.id === saved.defaultPersonaId)) return saved.defaultPersonaId!;
  } catch {
    // 未保存・壊れている場合は先頭のキャラクター
  }
  return personas[0].id;
}

export async function writeDefaultPersonaId(personaId: string): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(settingsPath, JSON.stringify({ defaultPersonaId: personaId }, null, 2), "utf-8");
}
