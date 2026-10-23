import type { VoicePersona } from "./useVoiceAssistant";

/** チャットに出すキャラクターのアイコン（サーバーの config/voice-personas/<id>/icon.png） */

export const ICON_SIZE = 256;

/** アイコンのURL。置き換えると iconVersion が変わるので、同じURLの間はキャッシュを使える。無ければ null */
export function personaIconUrl(apiBaseUrl: string, persona: Pick<VoicePersona, "id" | "iconVersion">): string | null {
  return persona.iconVersion
    ? `${apiBaseUrl}/api/voice/personas/${encodeURIComponent(persona.id)}/icon?v=${persona.iconVersion}`
    : null;
}

export async function uploadPersonaIcon(apiBaseUrl: string, personaId: string, png: Blob): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/personas/${encodeURIComponent(personaId)}/icon`, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `icon upload error: ${res.status}`);
}

export async function deletePersonaIcon(apiBaseUrl: string, personaId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/voice/personas/${encodeURIComponent(personaId)}/icon`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `icon delete error: ${res.status}`);
}

/** 選んだ画像を、中央を正方形に切り抜いて ICON_SIZE のPNGにする（大きな写真をそのまま送らないように） */
export async function imageFileToIcon(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を読み込めませんでした");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    ICON_SIZE,
    ICON_SIZE,
  );
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像を読み込めませんでした"))), "image/png"),
  );
}
