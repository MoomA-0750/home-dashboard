/**
 * imsg-web の API の形（imsg-web の src/shared/web-types.ts から、ここで使う分を写したもの）。
 * id はどれも imsg-web の今の「epoch」の中でだけ通じる。imsg-web が再起動すると変わるので、覚えて使い回さない
 */

export type Capability = { state: "available" | "unavailable" | "unknown"; reasonCode: string };
export type PreviewView = { text: string; trimmed: boolean; fromMe: boolean };
/** faces は会話の顔写真の id（1人なら1つ、グループは人数分。写真の無い人は null） */
export type ChatView = {
  id: string;
  name: string;
  service: string;
  isGroup: boolean | null;
  unreadCount: number | null;
  lastMessageAt: string | null;
  trimmed: boolean;
  preview: PreviewView | null;
  faces: (string | null)[];
};
/** id があるものだけ /api/attachments/:id で取れる（画像・録音。preview は Messages が持っている縮小版） */
export type AttachmentView = { id: string | null; kind: "image" | "audio" | "video" | "file"; sticker: boolean; preview: boolean };
export type LinkView = { url: string; title: string; summary: string; siteName: string; image: AttachmentView | null };
export type ReplyView = { sender: string | null; text: string; trimmed: boolean; messageId: string };
export type ReactionView = { emoji: string; kind: string; senders: string[]; fromMe: boolean; count: number };
export type MessageView = {
  id: string;
  text: string;
  isFromMe: boolean;
  sender: string | null;
  avatarId: string | null;
  attachments: AttachmentView[];
  link: LinkView | null;
  replyTo: ReplyView | null;
  reactions: ReactionView[];
  createdAt: string | null;
  trimmed: boolean;
};
export type ChatSnapshot = { epoch: string; chats: ChatView[]; limit: number };
export type HistorySnapshot = { epoch: string; messages: MessageView[]; limit: number };
export type CapabilitySnapshot = { epoch: string; mode: string; features: Record<string, Capability> };
/**
 * 送った結果。sent: 送れた。failed: 始まらなかった（送り直してよい）。unknown: 送れたか分からない（自動で送り直さない）。
 * dry_run: imsg-web が試しの設定で、何も送っていない
 */
export type SendState = "sent" | "failed" | "unknown" | "dry_run";
export type SendResult = { state: SendState; sent?: number; total?: number };
export type UploadResult = { uploadId: string; bytes: number; name: string };
