import { useEffect, useState } from "react";
import { defineMessages, type WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { CLIENT_ID, type ReplySpeech } from "./browserVoice";

const messages = defineMessages({
  ja: {
    toggleFailed: "キャラクターを切り替えられませんでした（{status}）",
    agentDown: "音声エージェントが起動していません",
  },
  en: {
    toggleFailed: "Couldn't turn the character on or off ({status})",
    agentDown: "The voice agent isn't running",
  },
});

/** 音声アシスタント（apps/voice-agent）の状態。サーバーの /api/voice/state と WebSocket の "voice" メッセージで届く */
export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

export interface VoiceSnapshot {
  /** エージェントがサーバーに接続しているか */
  connected: boolean;
  state: VoiceState;
  /** ウェイクワードを聞いてから返答し終えるまでの1回のやり取りのID */
  turnId: string | null;
  transcript: string;
  response: string;
  error: string | null;
  /** 返答の直後で、ウェイクワード無しで続けて話せる間 */
  followUp: boolean;
  /** いま応答しているキャラクター */
  personaId: string | null;
  personaName: string | null;
  /** いまのやり取りの会話（Claude Code の会話のID） */
  conversationId: string | null;
}

export const ACTIVE_VOICE_STATES: VoiceState[] = ["listening", "transcribing", "thinking", "speaking"];

export function useVoiceAssistant(ctx: WidgetRuntimeContext): VoiceSnapshot | null {
  const [snapshot, setSnapshot] = useState<VoiceSnapshot | null>(null);

  // WebSocketが（再）接続されるたびに取り直す。切れている間の変化を取りこぼさないため
  useEffect(() => {
    let cancelled = false;
    fetch(`${ctx.apiBaseUrl}/api/voice/state`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: VoiceSnapshot | null) => {
        if (!cancelled && data) setSnapshot(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket]);

  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "voice") setSnapshot(message.snapshot);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket]);

  return snapshot;
}

const AVATAR_ENABLED_STORAGE_KEY = "home-dashboard:voice-avatar";

/**
 * この端末でVRMアバターを出すか。非力な端末（LD290EJS 等）では描画が重いので、端末ごとに切れるようにする。
 * 端末ごとの好みなのでサーバーには保存しない
 */
export function useAvatarEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(AVATAR_ENABLED_STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const update = (next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(AVATAR_ENABLED_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // 保存できなくてもこの表示中は反映される
    }
  };
  return [enabled, update];
}

export interface VoicePersona {
  id: string;
  name: string;
  /** 表示用のウェイクワード（例: 「ねえプラム」） */
  wakePhrase: string;
  hasAvatar: boolean;
  /** チャットに出すアイコンの版（置き換えると変わる）。無ければ null で、名前の頭文字を出す */
  iconVersion: number | null;
  hasPrompt: boolean;
  /** 設定ファイルが無いときの「Claude」。書き出し・削除はできない */
  builtIn: boolean;
  /** 入っているか。切ったキャラクターはウェイクワードに反応せず、話し相手にも出ない */
  enabled: boolean;
  /** 呼べない・表情が変わらないなどの問題（ウェイクワードが音声認識の語彙に無い、VRMに無い表情名 など） */
  warnings: string[];
  /** 耳・尻尾の骨の名前の指定（persona.json の rig） */
  rig: { ears?: { left?: string[]; right?: string[] }; tail?: string[] } | null;
  /** （表情名）ごとの VRM の表情と身振り */
  expressions: Record<string, { avatar?: Record<string, number>; motion?: string | null }>;
}

export interface VoicePersonas {
  /** 画面のマイクボタン・文字入力で応答するキャラクター（設定画面で変えられる） */
  defaultPersonaId: string;
  personas: VoicePersona[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** ウェイクワードごとに呼び分けるキャラクターの一覧。既定のキャラクターが（他の端末で）変わったら取り直す */
export function useVoicePersonas(ctx: WidgetRuntimeContext): VoicePersonas | null {
  const [personas, setPersonas] = useState<VoicePersonas | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchJson<VoicePersonas>(`${ctx.apiBaseUrl}/api/voice/personas`).then((data) => {
      if (!cancelled && data) setPersonas(data);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket, version]);

  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data).type === "voice-personas") setVersion((v) => v + 1);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket]);

  return personas;
}

export function avatarUrlFor(
  apiBaseUrl: string,
  personas: VoicePersonas | null,
  personaId: string | null,
): string | null {
  const persona = personas?.personas.find((p) => p.id === personaId);
  return persona?.hasAvatar ? `${apiBaseUrl}/api/voice/avatars/${encodeURIComponent(persona.id)}` : null;
}

export interface PersonaImportResult {
  id: string;
  name: string;
  replaced: boolean;
  warnings: string[];
}

export class PersonaImportConflict extends Error {}

/** キャラクターのパッケージ（ZIP）を取り込む。同じIDがあれば PersonaImportConflict（replace で上書き） */
export async function importPersona(apiBaseUrl: string, file: File, replace = false): Promise<PersonaImportResult> {
  const res = await fetch(`${apiBaseUrl}/api/voice/personas/import${replace ? "?replace=true" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: file,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) throw new PersonaImportConflict(body.error);
  if (!res.ok) throw new Error(body.error ?? `import error: ${res.status}`);
  return body as PersonaImportResult;
}

export async function deletePersona(apiBaseUrl: string, personaId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/personas/${encodeURIComponent(personaId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `delete error: ${res.status}`);
}

export function personaExportUrl(apiBaseUrl: string, personaId: string): string {
  return `${apiBaseUrl}/api/voice/personas/${encodeURIComponent(personaId)}/export`;
}

export async function setDefaultPersona(apiBaseUrl: string, personaId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultPersonaId: personaId }),
  });
  if (!res.ok) throw new Error(`voice settings error: ${res.status}`);
}

/** キャラクターを入／切する（最後の1人は切れない） */
export async function setPersonaEnabled(apiBaseUrl: string, personaId: string, enabled: boolean): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/personas/${encodeURIComponent(personaId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("toggleFailed", { status: res.status }));
}

export type VoiceTurnSource = "wake" | "follow-up" | "button" | "text" | "browser-mic";

/** 誰に・どこから・何と話しかけられ、どの表情で何と答えたかの記録（サーバーの data/voice-history.jsonl） */
export interface VoiceTurnRecord {
  id: string | null;
  at: string;
  /** Claude Code の会話のID。同じ値のやり取りは同じ会話の中で続けて話したもの */
  conversationId: string | null;
  persona: { id: string; name: string };
  input: { source: VoiceTurnSource; text: string; attachments?: VoiceAttachmentRef[] };
  output: { text: string; segments: { expression: string | null; text: string }[] };
  status: "answered" | "cancelled" | "error";
}

/** チャットに添えたファイル（中身は /api/voice/attachments/:id） */
export interface VoiceAttachmentRef {
  id: string;
  name: string;
  type: string;
}

export const voiceAttachmentUrl = (apiBaseUrl: string, id: string) =>
  `${apiBaseUrl}/api/voice/attachments/${encodeURIComponent(id)}`;

// Claude は長い辺が 1568px を超える画像を縮めて読むので、送る前にそこまで縮める（大きな写真でも速く・上限内で送れる）
const IMAGE_MAX_EDGE = 1568;
const IMAGE_SHRINK_BYTES = 4 * 1024 * 1024;

async function shrinkImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= IMAGE_SHRINK_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  return blob ?? file;
}

/** チャットに添えるファイルを1つ置き、話しかけるときに渡す id を返す（画像は送る前に縮める） */
export async function uploadVoiceAttachment(apiBaseUrl: string, file: File): Promise<VoiceAttachmentRef> {
  const res = await fetch(`${apiBaseUrl}/api/voice/attachments?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: await shrinkImage(file),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `voice API error: ${res.status}`);
  return body.attachment as VoiceAttachmentRef;
}

function voiceApiError(status: number): Error {
  return new Error(status === 503 ? messages.t("agentDown") : `voice API error: ${status}`);
}

/** 話しかける相手と会話（チャットから）。省くと既定のキャラクターが、ウェイクワードと同じ今の会話で答える */
export interface VoiceAskTarget {
  personaId?: string | null;
  conversationId?: string | null;
}

/** 文字で話しかける。speech を省くと、返答はこれまでどおりホストのスピーカーで読み上げる。attachmentIds は uploadVoiceAttachment で置いたもの */
export async function askVoiceAssistant(
  apiBaseUrl: string,
  text: string,
  speech?: ReplySpeech,
  target: VoiceAskTarget = {},
  attachmentIds: string[] = [],
): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      ...(speech ? { speech, clientId: CLIENT_ID } : {}),
      ...(target.personaId ? { personaId: target.personaId } : {}),
      ...(target.conversationId ? { conversationId: target.conversationId } : {}),
      ...(attachmentIds.length ? { attachments: attachmentIds } : {}),
    }),
  });
  if (!res.ok) {
    // 添えたファイルが見つからないときなどは、サーバーの理由をそのまま出す
    const body = await res.json().catch(() => ({}));
    throw res.status !== 503 && typeof body.error === "string" ? new Error(body.error) : voiceApiError(res.status);
  }
}

export async function listenVoiceAssistant(apiBaseUrl: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/voice/listen`, { method: "POST" });
}

export async function cancelVoiceAssistant(apiBaseUrl: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/voice/cancel`, { method: "POST" });
}
