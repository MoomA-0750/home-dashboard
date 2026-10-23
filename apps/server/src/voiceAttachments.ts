import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { ServiceError } from "./serviceError.js";

/**
 * 音声アシスタントのチャットに添えたファイル（画像・PDF・テキスト）。
 * 画面から1つずつ受け取って data/voice-attachments/ に置き、話しかけるときは id だけを渡す。
 * エージェントは id でここから取ってきて、Claude にそのまま見せる（画像・PDF はそのもの、テキストは本文として）。
 * やり取りの記録から見返せるよう、しばらく残し、古いものは置くたびに消す。
 * 置いた人（owner）を覚え、自分の画面から置いたものはその人にしか見せない（ダッシュボード端末から置いたものは家族みんなのもの）。
 */

export const MAX_ATTACHMENTS_PER_ASK = 5;
/** 受け取る大きさの上限（送るとき Claude に渡せる大きさに合わせる） */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 512 * 1024;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const NAME_MAX = 120;

export type AttachmentKind = "image" | "pdf" | "text";

export interface AttachmentInfo {
  id: string;
  name: string;
  /** 中身から決めた種類（画面の言い分は使わない） */
  type: string;
  kind: AttachmentKind;
  size: number;
  /** 置いた人（アカウントの ID）。家族みんなのものは null */
  owner: string | null;
}

interface StoredMeta extends AttachmentInfo {
  createdAt: string;
}

const attachmentsDir = () => join(config.dataDir, "voice-attachments");
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const IMAGE_TYPES: { type: string; magic: number[]; offset?: number; also?: { offset: number; bytes: number[] } }[] = [
  { type: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { type: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { type: "image/webp", magic: [0x52, 0x49, 0x46, 0x46], also: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

function hasBytes(data: Uint8Array, offset: number, bytes: number[]): boolean {
  return bytes.every((byte, i) => data[offset + i] === byte);
}

/** 中身から種類を決める。画像・PDF・UTF-8 のテキストのどれでもなければ null */
export function sniffAttachment(data: Buffer): { type: string; kind: AttachmentKind } | null {
  for (const image of IMAGE_TYPES) {
    if (hasBytes(data, 0, image.magic) && (!image.also || hasBytes(data, image.also.offset, image.also.bytes)))
      return { type: image.type, kind: "image" };
  }
  if (hasBytes(data, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { type: "application/pdf", kind: "pdf" };
  if (data.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return { type: "text/plain; charset=utf-8", kind: "text" };
  } catch {
    return null;
  }
}

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim() : "";
  return (name || "file").slice(0, NAME_MAX);
}

async function prune(now: number): Promise<void> {
  let names: string[];
  try {
    names = await readdir(attachmentsDir());
  } catch {
    return;
  }
  for (const name of names) {
    const path = join(attachmentsDir(), name);
    const info = await stat(path).catch(() => null);
    if (info && now - info.mtimeMs > KEEP_MS) await rm(path, { force: true });
  }
}

/** 添えるファイルを1つ置く */
export async function saveAttachment(data: unknown, name: unknown, owner: string | null): Promise<AttachmentInfo> {
  if (!Buffer.isBuffer(data) || data.length === 0)
    throw new ServiceError(400, "ファイルが空です", "The file is empty");
  if (data.length > MAX_ATTACHMENT_BYTES)
    throw new ServiceError(413, "ファイルが大きすぎます（20MB まで）", "The file is too large (20 MB max)");
  const sniffed = sniffAttachment(data);
  if (!sniffed)
    throw new ServiceError(
      415,
      "添えられるのは画像（PNG・JPEG・GIF・WebP）・PDF・テキストのファイルです",
      "You can attach images (PNG, JPEG, GIF, WebP), PDFs, and text files",
    );
  if (sniffed.kind === "image" && data.length > MAX_IMAGE_BYTES)
    throw new ServiceError(413, "画像が大きすぎます（5MB まで）", "The image is too large (5 MB max)");
  if (sniffed.kind === "text" && data.length > MAX_TEXT_BYTES)
    throw new ServiceError(413, "テキストが長すぎます（512KB まで）", "The text file is too large (512 KB max)");

  const now = Date.now();
  await mkdir(attachmentsDir(), { recursive: true, mode: 0o700 });
  await prune(now);
  const meta: StoredMeta = {
    id: randomUUID(),
    name: cleanName(name),
    ...sniffed,
    size: data.length,
    owner,
    createdAt: new Date(now).toISOString(),
  };
  await writeFile(join(attachmentsDir(), meta.id), data, { mode: 0o600 });
  await writeFile(join(attachmentsDir(), `${meta.id}.json`), JSON.stringify(meta), { mode: 0o600 });
  return toInfo(meta);
}

function toInfo(meta: StoredMeta): AttachmentInfo {
  return { id: meta.id, name: meta.name, type: meta.type, kind: meta.kind, size: meta.size, owner: meta.owner ?? null };
}

/** その人（viewer。ダッシュボード端末なら null）が見てよいファイルか */
export function attachmentVisibleTo(info: AttachmentInfo, viewer: string | null): boolean {
  return info.owner === null || info.owner === viewer;
}

/** 置いてあるファイルの情報。無ければ null */
export async function attachmentInfo(id: unknown): Promise<AttachmentInfo | null> {
  if (typeof id !== "string" || !ID.test(id)) return null;
  try {
    return toInfo(JSON.parse(await readFile(join(attachmentsDir(), `${id}.json`), "utf-8")) as StoredMeta);
  } catch {
    return null;
  }
}

/** 置いてあるファイルの中身。無ければ null */
export async function readAttachment(id: string): Promise<{ info: AttachmentInfo; data: Buffer } | null> {
  const info = await attachmentInfo(id);
  if (!info) return null;
  const data = await readFile(join(attachmentsDir(), info.id)).catch(() => null);
  return data ? { info, data } : null;
}

/** 話しかけるときに添えた id の並びを確かめて、情報にする */
export async function resolveAttachments(value: unknown, viewer: string | null): Promise<AttachmentInfo[]> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS_PER_ASK)
    throw new ServiceError(
      400,
      `添えられるのは${MAX_ATTACHMENTS_PER_ASK}つまでです`,
      `You can attach up to ${MAX_ATTACHMENTS_PER_ASK} files`,
    );
  const infos: AttachmentInfo[] = [];
  for (const id of new Set(value)) {
    const info = await attachmentInfo(id);
    if (!info || !attachmentVisibleTo(info, viewer))
      throw new ServiceError(
        404,
        "添えたファイルが見つかりません。もう一度添えてください",
        "An attached file is missing. Attach it again",
      );
    infos.push(info);
  }
  return infos;
}
