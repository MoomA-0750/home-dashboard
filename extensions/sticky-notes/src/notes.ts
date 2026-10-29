// 付箋のデータの形。サーバーと画面の両方から読む
export const NOTE_COLORS = ["yellow", "pink", "blue", "green"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

/** いつはがれるか。none は手ではがすまで残る */
export const NOTE_EXPIRES = ["none", "today", "tomorrow", "week"] as const;
export type NoteExpires = (typeof NOTE_EXPIRES)[number];

/** 文字を横のどこに揃えるか */
export const NOTE_ALIGN_X = ["start", "center", "end"] as const;
export type NoteAlignX = (typeof NOTE_ALIGN_X)[number];

/** 文字を縦のどこに揃えるか */
export const NOTE_ALIGN_Y = ["top", "middle", "bottom"] as const;
export type NoteAlignY = (typeof NOTE_ALIGN_Y)[number];

/**
 * 付箋そのものの動き（iMessage の吹き出しの効果にならう）。貼られたときに、それぞれの画面で 1 回動く。
 * - slam: 上から叩きつける / loud: 大きくなって震える / gentle: 小さく出てそっと広がる
 * - ink: 見えないインク。押すまで文字がぼやけて読めない
 */
export const NOTE_BUBBLES = ["none", "slam", "loud", "gentle", "ink"] as const;
export type NoteBubble = (typeof NOTE_BUBBLES)[number];

/** 画面いっぱいの効果（iMessage の画面効果にならう）。貼られたときに、ウィジェットを置いた画面で 1 回出る */
export const NOTE_SCREENS = ["none", "confetti", "balloons", "hearts"] as const;
export type NoteScreen = (typeof NOTE_SCREENS)[number];

export interface StickyNote {
  id: string;
  text: string;
  /** 書いた人（任意） */
  from: string;
  color: NoteColor;
  alignX: NoteAlignX;
  alignY: NoteAlignY;
  bubble: NoteBubble;
  screen: NoteScreen;
  /** 付箋の動きを、貼った後もときどき（REPEAT_MS ごとに）繰り返す。だれも見ていない間に貼られても気付けるように */
  repeat: boolean;
  createdAt: string;
  /** この時刻を過ぎたら出さない。null は期限なし */
  expiresAt: string | null;
}

export const MAX_TEXT = 200;
export const MAX_FROM = 20;
export const MAX_NOTES = 40;
export const REPEAT_MS = 5 * 60 * 1000;

const pick = <T extends string>(choices: readonly T[], value: unknown, fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;

/** 送られた値・前の版で保存した付箋（揃えや効果を持たない）を、今の形に揃える */
export function noteStyle(raw: Record<string, unknown>) {
  return {
    color: pick(NOTE_COLORS, raw.color, "yellow"),
    alignX: pick(NOTE_ALIGN_X, raw.alignX, "start"),
    alignY: pick(NOTE_ALIGN_Y, raw.alignY, "top"),
    bubble: pick(NOTE_BUBBLES, raw.bubble, "none"),
    screen: pick(NOTE_SCREENS, raw.screen, "none"),
    repeat: raw.repeat === true,
  };
}

export const noteExpires = (value: unknown): NoteExpires => pick(NOTE_EXPIRES, value, "none");
