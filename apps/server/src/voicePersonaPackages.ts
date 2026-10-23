import { open, readFile, rename, rm, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { unzipSync, zipSync, type Zippable } from "fflate";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";
import {
  PERSONA_FILES,
  PERSONA_ID,
  personaDir,
  readCommon,
  readPersonas,
  writeCommon,
  type PersonaFile,
  type PersonaInfo,
  VOICE_ENGINES,
  type VoiceEngine,
} from "./voicePersonas.js";

/**
 * キャラクターのパッケージ（ZIP）のインポート・書き出し・削除。
 *
 * パッケージは 1人分のディレクトリをそのままZIPにしたもの（persona.json・prompt.md・avatar.vrm・icon.png。直下でも、
 * 1階層のフォルダの中でもよい）。ZIPの中のパスは書き込み先に使わず、決まった4つのファイル名だけを取り出す
 * （「../」などを含むパスで config/ の外へ書かれないように）。
 *
 * このダッシュボードはLANに認証なしで公開される前提なので、誰でもキャラクターを追加できる。
 * ただしキャラクターのプロンプトで Claude Code のツールや権限は変わらないので、既存の /api/* でできる以上のことはできない。
 */

// アイコンは画面で 256px 四方に縮めてから送ってもらう（大きな写真をそのまま置かれても重くならないように）
export const MAX_ICON_BYTES = 512 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

const MAX_SIZES = {
  [PERSONA_FILES.meta]: 200 * 1024,
  [PERSONA_FILES.prompt]: 200 * 1024,
  [PERSONA_FILES.avatar]: 120 * 1024 * 1024,
  [PERSONA_FILES.icon]: MAX_ICON_BYTES,
};

type Loose = Record<string, unknown>;

function fail(message: string): never {
  throw new ServiceError(400, message);
}

function strings(value: unknown, field: string, { min = 0, max = 50, maxLength = 32 } = {}): string[] {
  if (value === undefined && min === 0) return [];
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${field} は${min > 0 ? `${min}個以上` : ""}${max}個までの文字列の配列にしてください`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > maxLength) {
      fail(`${field} に空の値か ${maxLength} 文字を超える値があります`);
    }
    return item.trim();
  });
}

function voice(value: unknown, field: string): PersonaFile["voice"] {
  if (value === undefined) return undefined;
  const v = value as Loose;
  if (typeof v !== "object" || v === null) fail(`${field} はオブジェクトにしてください`);
  if (v.speaker !== undefined && !(Number.isInteger(v.speaker) && (v.speaker as number) >= 0)) {
    fail(`${field}.speaker は話者ID（0以上の整数）にしてください`);
  }
  if (v.speed !== undefined && !(typeof v.speed === "number" && v.speed >= 0.5 && v.speed <= 2)) {
    fail(`${field}.speed は 0.5〜2 の数にしてください`);
  }
  if (v.engine !== undefined && !VOICE_ENGINES.includes(v.engine as VoiceEngine)) {
    fail(`${field}.engine は ${VOICE_ENGINES.join(" / ")} のどれかにしてください`);
  }
  return {
    speaker: v.speaker as number | undefined,
    speed: v.speed as number | undefined,
    ...(v.engine !== undefined ? { engine: v.engine as VoiceEngine } : {}),
  };
}

/** persona.json の形を確かめる（エージェントが読めない設定を置かないように） */
export function parsePersonaFile(raw: string): PersonaFile {
  let data: Loose;
  try {
    data = JSON.parse(raw) as Loose;
  } catch {
    fail("persona.json が正しいJSONではありません");
  }
  if (typeof data.id !== "string" || !PERSONA_ID.test(data.id)) {
    fail("persona.json の id は、英小文字・数字・-・_ で32文字までにしてください（例: plum）");
  }
  if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 32) {
    fail("persona.json の name（表示名）を32文字までで書いてください");
  }
  if (
    data.wakeLabel !== undefined &&
    (typeof data.wakeLabel !== "string" || !data.wakeLabel.trim() || data.wakeLabel.length > 32)
  ) {
    fail("persona.json の wakeLabel（画面に出す呼び名）は32文字までの文字列にしてください");
  }
  const expressions: PersonaFile["expressions"] = {};
  const rawExpressions = (data.expressions ?? {}) as Loose;
  if (typeof rawExpressions !== "object" || Object.keys(rawExpressions).length > 50) {
    fail("expressions は50個までのオブジェクトにしてください");
  }
  for (const [name, spec] of Object.entries(rawExpressions)) {
    if (!name.trim() || name.length > 16 || /[（）()]/.test(name)) {
      fail(`表情名「${name}」は、括弧を含まない16文字までにしてください`);
    }
    const s = (spec ?? {}) as Loose;
    const avatar: Record<string, number> = {};
    for (const [expression, weight] of Object.entries((s.avatar ?? {}) as Loose)) {
      if (typeof weight !== "number" || weight < 0 || weight > 1) {
        fail(`表情「${name}」の avatar.${expression} は 0〜1 の数にしてください`);
      }
      avatar[expression] = weight;
    }
    if (s.motion !== undefined && (typeof s.motion !== "string" || !/^[a-z][a-zA-Z0-9_-]{0,31}$/.test(s.motion))) {
      fail(`表情「${name}」の motion は身振りの名前（英字。例: happy）にしてください`);
    }
    expressions[name] = {
      avatar,
      voice: voice(s.voice, `表情「${name}」の voice`),
      keywords: strings(s.keywords, `表情「${name}」の keywords`, { max: 30, maxLength: 16 }),
      motion: s.motion as string | undefined,
    };
  }
  let rig: PersonaFile["rig"];
  if (data.rig !== undefined) {
    const r = (data.rig ?? {}) as Loose;
    const ears = (r.ears ?? {}) as Loose;
    rig = {
      ears:
        r.ears === undefined
          ? undefined
          : {
              left: strings(ears.left, "rig.ears.left", { max: 10, maxLength: 64 }),
              right: strings(ears.right, "rig.ears.right", { max: 10, maxLength: 64 }),
            },
      tail: r.tail === undefined ? undefined : strings(r.tail, "rig.tail", { max: 10, maxLength: 64 }),
    };
  }
  return {
    id: data.id,
    name: data.name.trim(),
    rig,
    wakeWords: strings(data.wakeWords, "wakeWords", { min: 1, max: 10 }),
    wakeLabel: typeof data.wakeLabel === "string" ? data.wakeLabel.trim() : undefined,
    decoys: strings(data.decoys, "decoys"),
    voice: voice(data.voice, "voice"),
    expressions,
  };
}

// three-vrm は VRM 0.x のプリセット表情を 1.0 の名前に読み替える（joy → happy など）
const VRM0_PRESETS: Record<string, string> = {
  a: "aa",
  i: "ih",
  u: "ou",
  e: "ee",
  o: "oh",
  joy: "happy",
  sorrow: "sad",
  fun: "relaxed",
  blink_l: "blinkLeft",
  blink_r: "blinkRight",
  lookup: "lookUp",
  lookdown: "lookDown",
  lookleft: "lookLeft",
  lookright: "lookRight",
};

/** VRM（GLB）の JSON チャンクから、画面側で使える表情名を取り出す。VRMとして読めなければ null */
export function vrmExpressionNames(json: string): Set<string> | null {
  let gltf: Loose;
  try {
    // 書き出しツールによっては NaN を書く（画面側でも同じく置き換えて読んでいる）
    gltf = JSON.parse(json.replace(/(?<=[:,[]\s*)-?(?:NaN|Infinity)(?=\s*[,}\]])/g, "0")) as Loose;
  } catch {
    return null;
  }
  const extensions = (gltf.extensions ?? {}) as Loose;
  const names = new Set<string>();
  const vrm1 = extensions.VRMC_vrm as { expressions?: { preset?: Loose; custom?: Loose } } | undefined;
  const vrm0 = extensions.VRM as
    { blendShapeMaster?: { blendShapeGroups?: { presetName?: string; name?: string }[] } } | undefined;
  if (vrm1) {
    for (const name of [
      ...Object.keys(vrm1.expressions?.preset ?? {}),
      ...Object.keys(vrm1.expressions?.custom ?? {}),
    ]) {
      names.add(name.toLowerCase());
    }
  } else if (vrm0) {
    for (const group of vrm0.blendShapeMaster?.blendShapeGroups ?? []) {
      const preset = group.presetName?.toLowerCase();
      if (preset && preset !== "unknown") names.add((VRM0_PRESETS[preset] ?? preset).toLowerCase());
      else if (group.name) names.add(group.name.toLowerCase());
    }
  } else {
    return null;
  }
  return names;
}

function glbJson(bytes: Uint8Array): string | null {
  if (bytes.length < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(16, true) !== 0x4e4f534a) return null;
  const length = view.getUint32(12, true);
  if (20 + length > bytes.length) return null;
  return new TextDecoder().decode(bytes.subarray(20, 20 + length));
}

async function readGlbJson(path: string): Promise<string | null> {
  const file = await open(path);
  try {
    const header = new Uint8Array(20);
    await file.read(header, 0, 20, 0);
    const length = new DataView(header.buffer).getUint32(12, true);
    if (length > 64 * 1024 * 1024) return null;
    const bytes = new Uint8Array(20 + length);
    await file.read(bytes, 0, bytes.length, 0);
    return glbJson(bytes);
  } finally {
    await file.close();
  }
}

/** 表情の割り当てが、VRMに実在する表情を指しているか */
export function expressionWarnings(meta: PersonaFile, names: Set<string> | null, hasAvatar: boolean): string[] {
  if (!hasAvatar) return [];
  if (!names) return ["avatar.vrm をVRMとして読めませんでした"];
  const warnings: string[] = [];
  for (const [expression, spec] of Object.entries(meta.expressions ?? {})) {
    const missing = Object.keys(spec.avatar ?? {}).filter((name) => !names.has(name.toLowerCase()));
    if (missing.length > 0) {
      warnings.push(`表情「${expression}」の ${missing.join("・")} がVRMにありません（その表情でも顔が変わりません）`);
    }
  }
  return warnings;
}

/** 一覧に出す、サーバーで確かめられる警告（表情の割り当て） */
export async function personaWarnings(persona: PersonaInfo): Promise<string[]> {
  if (!persona.meta) return [];
  const names = persona.avatarPath
    ? vrmExpressionNames((await readGlbJson(persona.avatarPath).catch(() => null)) ?? "")
    : null;
  return expressionWarnings(persona.meta, names, persona.avatarPath !== null);
}

function extractPackage(
  zip: Uint8Array,
): Partial<Record<(typeof PERSONA_FILES)[keyof typeof PERSONA_FILES], Uint8Array>> {
  const wanted = new Set<string>(Object.values(PERSONA_FILES));
  let folder: string | null = null;
  let entries;
  try {
    entries = unzipSync(zip, {
      filter: (file) => {
        const parts = file.name.split("/");
        const base = parts.at(-1) ?? "";
        if (parts.length > 2 || !wanted.has(base) || file.name.startsWith("__MACOSX")) return false;
        const dir = parts.length === 2 ? parts[0] : "";
        if (folder !== null && folder !== dir)
          fail("ZIPにキャラクターが2人以上入っています（1人ずつインポートしてください）");
        folder = dir;
        // 展開する前に大きさを見る（圧縮率の高いZIPで展開後に膨れ上がるのを防ぐ）
        if (file.originalSize > MAX_SIZES[base as keyof typeof MAX_SIZES]) fail(`${base} が大きすぎます`);
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    fail("ZIPファイルとして読めませんでした");
  }
  const files: Partial<Record<string, Uint8Array>> = {};
  for (const [name, data] of Object.entries(entries)) files[name.split("/").at(-1)!] = data;
  return files;
}

export interface ImportResult {
  id: string;
  name: string;
  replaced: boolean;
  warnings: string[];
}

export async function importPersonaPackage(zip: Uint8Array, { replace = false } = {}): Promise<ImportResult> {
  const files = extractPackage(zip);
  const metaBytes = files[PERSONA_FILES.meta];
  if (!metaBytes) fail("ZIPに persona.json がありません");
  const meta = parsePersonaFile(new TextDecoder().decode(metaBytes));

  const avatar = files[PERSONA_FILES.avatar];
  const avatarJson = avatar ? glbJson(avatar) : null;
  if (avatar && !avatarJson) fail("avatar.vrm がVRM（GLB）ファイルではありません");
  const icon = files[PERSONA_FILES.icon];
  if (icon && !isPng(icon)) fail("icon.png がPNG画像ではありません");

  const target = personaDir(meta.id);
  const existing = (await readPersonas()).find((persona) => persona.id === meta.id && !persona.builtIn);
  if (existing && !replace) {
    throw new ServiceError(409, `「${existing.name}」（${meta.id}）はすでにあります。上書きしますか？`, `"${existing.name}" (${meta.id}) already exists. Replace it?`);
  }

  // 書きかけのディレクトリをエージェントに読まれないよう、別名で書いてから差し替える
  const root = config.voice.personasDir;
  const staging = join(root, `.import-${randomUUID()}`);
  await mkdir(staging, { recursive: true });
  try {
    await writeFile(join(staging, PERSONA_FILES.meta), `${JSON.stringify(meta, null, 2)}\n`, "utf-8");
    const prompt = files[PERSONA_FILES.prompt];
    if (prompt) await writeFile(join(staging, PERSONA_FILES.prompt), prompt);
    if (avatar) await writeFile(join(staging, PERSONA_FILES.avatar), avatar);
    if (icon) await writeFile(join(staging, PERSONA_FILES.icon), icon);
    if (existing) await rm(target, { recursive: true, force: true });
    await rename(staging, target);
  } catch (err) {
    await rm(staging, { recursive: true, force: true });
    throw err;
  }

  const common = await readCommon();
  if (!(common.order ?? []).includes(meta.id)) {
    await writeCommon({ ...common, order: [...(common.order ?? []), meta.id] });
  }
  return {
    id: meta.id,
    name: meta.name,
    replaced: Boolean(existing),
    warnings: expressionWarnings(meta, avatarJson ? vrmExpressionNames(avatarJson) : null, Boolean(avatar)),
  };
}

export async function exportPersonaPackage(id: string): Promise<{ name: string; zip: Uint8Array }> {
  const persona = (await readPersonas()).find((p) => p.id === id && !p.builtIn);
  if (!persona) throw new ServiceError(404, "キャラクターが見つかりません", "Character not found");
  const dir = personaDir(id);
  const files: Zippable = { [PERSONA_FILES.meta]: await readFile(join(dir, PERSONA_FILES.meta)) };
  if (persona.hasPrompt) files[PERSONA_FILES.prompt] = await readFile(join(dir, PERSONA_FILES.prompt));
  // VRMは大きく、圧縮してもあまり縮まないので無圧縮で入れる
  if (persona.avatarPath) files[PERSONA_FILES.avatar] = [await readFile(persona.avatarPath), { level: 0 }];
  if (persona.iconPath) files[PERSONA_FILES.icon] = [await readFile(persona.iconPath), { level: 0 }];
  return { name: persona.name, zip: zipSync({ [id]: files }) };
}

export async function deletePersona(id: string): Promise<void> {
  const persona = (await readPersonas()).find((p) => p.id === id && !p.builtIn);
  if (!persona) throw new ServiceError(404, "キャラクターが見つかりません", "Character not found");
  await rm(personaDir(id), { recursive: true, force: true });
  const common = await readCommon();
  if (common.order?.includes(id)) await writeCommon({ ...common, order: common.order.filter((o) => o !== id) });
}

/** チャットに出すアイコンを置き換える（PNG）。書きかけを読まれないよう別名で書いてから差し替える */
export async function writePersonaIcon(id: string, png: Uint8Array): Promise<void> {
  const persona = (await readPersonas()).find((p) => p.id === id && !p.builtIn);
  if (!persona) throw new ServiceError(404, "キャラクターが見つかりません", "Character not found");
  if (!isPng(png)) fail("アイコンはPNG画像にしてください");
  if (png.length > MAX_ICON_BYTES) fail("アイコンが大きすぎます（512KBまで）");
  const path = join(personaDir(id), PERSONA_FILES.icon);
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, png);
  await rename(tmp, path);
}

export async function deletePersonaIcon(id: string): Promise<void> {
  const persona = (await readPersonas()).find((p) => p.id === id && !p.builtIn);
  if (!persona) throw new ServiceError(404, "キャラクターが見つかりません", "Character not found");
  await rm(join(personaDir(id), PERSONA_FILES.icon), { force: true });
}
