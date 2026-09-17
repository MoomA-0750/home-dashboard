import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";

/**
 * 音声アシスタントのキャラクター（ウェイクワードごとに呼び分ける）。
 *
 * config/voice-personas/ に1人1ディレクトリで置き、音声エージェント（apps/voice-agent/voice_agent/personas.py）と
 * 同じものを読む。サーバーが使うのは画面に出す名前・ウェイクワード・アバターと、表情の割り当ての確認だけで、
 * プロンプトや声はエージェントが使う。1人もいなければ、エージェント側と同じく「Claude」1人だけ（アバターは VOICE_AVATAR_PATH）。
 *
 *     common.json          wakePrefix・commonDecoys・並び順（order）
 *     world.md             キャラクターたちの共通の設定
 *     <id>/persona.json    名前・ウェイクワード・おとり・声・表情
 *     <id>/prompt.md       振る舞い・口調
 *     <id>/avatar.vrm      VRMアバター
 *
 * どのキャラクターを既定にするか（画面のマイクボタン・文字入力で応答する相手）は画面から変えるので、
 * data/voice-settings.json に保存する。
 */

export const PERSONA_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const PERSONA_FILES = { meta: "persona.json", prompt: "prompt.md", avatar: "avatar.vrm" } as const;

export interface ExpressionSpec {
  avatar?: Record<string, number>;
  voice?: { speaker?: number; speed?: number };
  keywords?: string[];
  /** 体の身振りの名前（apps/web/src/avatar/motions.ts） */
  motion?: string;
}

/** 耳・尻尾の骨の名前。省略時は画面側が名前から探す */
export interface RigSpec {
  ears?: { left?: string[]; right?: string[] };
  tail?: string[];
}

export interface PersonaFile {
  id: string;
  name: string;
  wakeWords: string[];
  /** 画面に出す呼び名。省略時は表示名（ウェイクワードが表示名と違う読みのときに書く） */
  wakeLabel?: string;
  decoys?: string[];
  voice?: { speaker?: number; speed?: number };
  expressions?: Record<string, ExpressionSpec>;
  rig?: RigSpec;
}

export interface CommonFile {
  wakePrefix?: string;
  commonDecoys?: string[];
  order?: string[];
}

export interface PersonaInfo {
  id: string;
  name: string;
  /** 表示用のウェイクワード（例: 「ねえプラム」）。Vosk の表記（「甘夏」）や別表記ではなく、名前で出す */
  wakePhrase: string;
  avatarPath: string | null;
  hasPrompt: boolean;
  /** 設定ファイルが無いときの「Claude」。書き出し・削除はできない */
  builtIn: boolean;
  meta: PersonaFile | null;
}

const settingsPath = join(config.dataDir, "voice-settings.json");
const commonPath = () => join(config.voice.personasDir, "common.json");

export function personaDir(id: string): string {
  return join(config.voice.personasDir, id);
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isFile(),
    () => false,
  );
}

export async function readCommon(): Promise<CommonFile> {
  try {
    return JSON.parse(await readFile(commonPath(), "utf-8")) as CommonFile;
  } catch {
    return {};
  }
}

export async function writeCommon(common: CommonFile): Promise<void> {
  await mkdir(config.voice.personasDir, { recursive: true });
  await writeFile(commonPath(), `${JSON.stringify(common, null, 2)}\n`, "utf-8");
}

const fallbackPersonas = async (): Promise<PersonaInfo[]> => [
  {
    id: "claude",
    name: "Claude",
    wakePhrase: "ねえクロード",
    avatarPath: (await exists(config.voice.avatarPath)) ? config.voice.avatarPath : null,
    hasPrompt: false,
    builtIn: true,
    meta: null,
  },
];

export async function readPersonas(): Promise<PersonaInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(config.voice.personasDir);
  } catch {
    return fallbackPersonas();
  }
  const common = await readCommon();
  const prefix = common.wakePrefix ?? "ねえ";
  const personas: PersonaInfo[] = [];
  for (const id of entries.filter((entry) => PERSONA_ID.test(entry))) {
    const dir = personaDir(id);
    let meta: PersonaFile;
    try {
      meta = JSON.parse(await readFile(join(dir, PERSONA_FILES.meta), "utf-8")) as PersonaFile;
    } catch {
      continue; // persona.json の無いディレクトリや壊れたものは、エージェントと同じく飛ばす
    }
    const avatarPath = join(dir, PERSONA_FILES.avatar);
    personas.push({
      id,
      name: meta.name,
      wakePhrase: `${prefix}${meta.wakeLabel ?? meta.name}`.replace(/\s+/g, ""),
      avatarPath: (await exists(avatarPath)) ? avatarPath : null,
      hasPrompt: await exists(join(dir, PERSONA_FILES.prompt)),
      builtIn: false,
      meta,
    });
  }
  if (personas.length === 0) return fallbackPersonas();
  const order = common.order ?? [];
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  return personas.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
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
