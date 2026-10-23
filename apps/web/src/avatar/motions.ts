import type { VRMHumanBoneName } from "@pixiv/three-vrm";
import type { HandShape } from "./hands";

/**
 * アバターの身振り。角度はすべて度で、VRM 1.0 の向き（モデルが +Z を向き、左手が +X、上が +Y）で書く。
 *
 * 向きの目安（正規化された骨の X→Y→Z の順の回転）:
 * - 頭・背骨の x: + でうつむく・前かがみ、- で上を向く・胸を張る
 * - 頭の y: + で自分の左を向く / z: + で自分の右へ首をかしげる
 * - 左上腕の z: -72 くらいで腕を下ろした状態。0 に近づくほど横に上がる（右上腕は符号が逆）
 * - 左上腕の y: - で腕が前に出る（右上腕は + で前）
 * - 左前腕の y: - でひじを曲げる（右前腕は +）
 * - 上腕の x（腕のねじり）で、ひじを曲げたときに手がどこへ行くかが変わる（左右とも同じ符号）:
 *   0 前後 → 手が体の前へ / -30〜-50 → 胸・口元へ / +90 → ひじが外に張り手が腰へ / -90 → 手が頭の横へ上がる
 * （数値は「動きを確認」の画面でモデルに当てながら決めた）
 *
 * ポーズを作るときの決まりごと（詳しくは docs/avatar-pose.md）:
 * - 左右を同じ角度にしない。数度の差でも「人形っぽさ」が消える
 * - 頭は「かしげる」と「向ける」を混ぜる。かしげるのは15度まで
 * - 腕は体から少し離す（下ろした腕がスカートに潜らないように）
 * - 手が体に触れる身振り（腰に手・胸の前）は、横から見て届いているか確かめる
 * - 首と肩の連動・ひねりの配分・重心の片寄せは posture.ts が自動で足すので、ここには書かない
 */

export type BonePose = Partial<Record<VRMHumanBoneName, [number, number, number]>>;

export interface Pose {
  bones: BonePose;
  /** 手の形（省略時は力を抜いた形）。指をまっすぐにしたままだと人形に見える */
  hands?: { left?: HandShape; right?: HandShape };
  /** 耳。lift: + で立てる（- で伏せる）、spread: + で外へ開く、forward: + で前へ向ける（度） */
  ears?: { lift?: number; spread?: number; forward?: number };
  /** 尻尾。wag: 振り幅（度）、speed: 1秒あたりの往復回数、lift: + で持ち上げる（度） */
  tail?: { wag?: number; speed?: number; lift?: number };
  /** 体を左右に揺らす大きさ（度）と速さ（1秒あたりの往復回数） */
  sway?: { amount: number; speed: number };
  /** 小刻みに震える（あせあせ）大きさ（度） */
  jitter?: number;
  /** 頭をぐるぐる回す大きさ（度） */
  wobble?: number;
  /** その身振りに入ったときに、一度だけ跳ねる高さ（メートル） */
  hop?: number;
  /** 身振りを保つ秒数。過ぎたら腕を戻す（体幹・頭の気分は少し残す）。既定 2.5 秒 */
  holdS?: number;
}

/** 腕を下ろして立っている、何もしていないときの姿勢 */
export const REST_POSE: Pose = {
  bones: {
    // 左右をわずかに違える。前腕の外向き（ひじの運搬角）で腕が体から離れる
    leftUpperArm: [2, -7, -68],
    rightUpperArm: [-1, 5, 66],
    leftLowerArm: [0, -14, 0],
    rightLowerArm: [0, 11, 0],
    leftHand: [0, 0, -6],
    rightHand: [0, 0, 4],
    head: [0, 2, -2],
  },
  ears: { lift: 0, spread: 0, forward: 0 },
  tail: { wag: 6, speed: 0.35, lift: 0 },
  sway: { amount: 1.2, speed: 0.18 },
};

/** 状態ごとの姿勢（表情の指定が無いとき） */
export const STATE_POSES: Record<string, Pose> = {
  idle: REST_POSE,
  // 身を乗り出して首をかしげ、耳をこちらへ向ける
  listening: {
    bones: { ...REST_POSE.bones, spine: [4, 0, 0], chest: [3, 3, 0], head: [2, 5, 9] },
    ears: { lift: 12, forward: 18 },
    tail: { wag: 4, speed: 0.3, lift: 5 },
    sway: { amount: 0.6, speed: 0.15 },
  },
  transcribing: {
    bones: { ...REST_POSE.bones, spine: [3, 0, 0], chest: [2, 2, 0], head: [0, 3, 6] },
    ears: { lift: 10, forward: 10 },
    tail: { wag: 3, speed: 0.3 },
  },
  // 少し上を見て首をかしげ、右手をあごへ、左手はその肘を支える
  thinking: {
    bones: {
      ...REST_POSE.bones,
      chest: [-2, -6, 0],
      head: [-7, -7, -8],
      leftUpperArm: [20, -26, -58],
      leftLowerArm: [0, -88, 0],
      leftHand: [0, 0, -10],
      rightUpperArm: [-42, 16, 58],
      rightLowerArm: [0, 126, 0],
      rightHand: [0, 0, 14],
    },
    hands: { left: "relaxed", right: "soft" },
    ears: { lift: 4, spread: 6 },
    tail: { wag: 10, speed: 0.25, lift: -4 },
    sway: { amount: 1.5, speed: 0.12 },
  },
  speaking: {
    bones: {
      ...REST_POSE.bones,
      chest: [0, 2, 0],
      head: [0, 3, -3],
      leftLowerArm: [0, -30, 0],
      rightLowerArm: [0, 23, 0],
    },
    ears: { lift: 6 },
    tail: { wag: 10, speed: 0.6, lift: 4 },
    sway: { amount: 1.2, speed: 0.25 },
  },
  error: {
    bones: {
      ...REST_POSE.bones,
      spine: [8, 0, 0],
      chest: [5, -3, 0],
      head: [12, -4, 3],
      leftShoulder: [0, 0, -6],
      rightShoulder: [0, 0, 4],
    },
    ears: { lift: -35, spread: 10 },
    tail: { wag: 0, lift: -15 },
  },
};

/** 表情の（表情名）ごとの身振り。persona.json の expressions の motion で名前を選ぶ */
export const MOTIONS: Record<string, Pose> = {
  neutral: STATE_POSES.speaking,
  // 両手を軽く開いて弾む。左をわずかに高く
  happy: {
    bones: {
      ...REST_POSE.bones,
      chest: [-3, -4, 0],
      head: [-3, -5, 8],
      leftUpperArm: [-8, -14, -52],
      rightUpperArm: [-2, 11, 60],
      leftLowerArm: [0, -34, 0],
      rightLowerArm: [0, 26, 0],
    },
    hands: { left: "soft", right: "soft" },
    ears: { lift: 14 },
    tail: { wag: 24, speed: 1.6, lift: 10 },
    sway: { amount: 3, speed: 0.6 },
    hop: 0.015,
  },
  // 両手を上げて仰け反る。左右で高さと開きを変える
  surprised: {
    bones: {
      ...REST_POSE.bones,
      chest: [-6, 3, 0],
      head: [-9, 4, -4],
      leftShoulder: [0, 0, 7],
      rightShoulder: [0, 0, -5],
      leftUpperArm: [-88, -6, -66],
      rightUpperArm: [-96, 4, 74],
      leftLowerArm: [0, -58, 0],
      rightLowerArm: [0, 46, 0],
    },
    hands: { left: "open", right: "open" },
    ears: { lift: 25, spread: -6 },
    tail: { wag: 0, lift: 25 },
    hop: 0.04,
  },
  // 背中を丸めて肩を落とし、うつむく
  sad: {
    bones: {
      ...REST_POSE.bones,
      spine: [9, 0, 0],
      chest: [6, -4, 0],
      head: [15, -6, -5],
      leftShoulder: [0, 0, -7],
      rightShoulder: [0, 0, 5],
      leftUpperArm: [8, -16, -72],
      rightUpperArm: [5, 13, 70],
      leftLowerArm: [0, -22, 0],
      rightLowerArm: [0, 16, 0],
    },
    ears: { lift: -45, spread: 24 },
    tail: { wag: 0, speed: 0.2, lift: -25 },
    sway: { amount: 0.5, speed: 0.1 },
  },
  // 腰に手を当てて、耳を後ろに伏せる。顔をそむけ気味に
  angry: {
    bones: {
      ...REST_POSE.bones,
      chest: [-4, 6, 0],
      head: [5, -12, 4],
      leftUpperArm: [72, 6, -46],
      rightUpperArm: [78, -4, 49],
      leftLowerArm: [0, -108, 0],
      rightLowerArm: [0, 104, 0],
      leftHand: [0, 0, -12],
      rightHand: [0, 0, 10],
    },
    ears: { lift: -20, forward: -25, spread: 10 },
    tail: { wag: 14, speed: 0.9, lift: 18 },
  },
  // 力を抜いて片側へ体重、首をかしげる
  relaxed: {
    bones: {
      ...REST_POSE.bones,
      chest: [2, -3, 0],
      head: [2, -6, -7],
      leftUpperArm: [3, -9, -66],
      rightUpperArm: [-2, 6, 69],
      leftLowerArm: [0, -20, 0],
      rightLowerArm: [0, 13, 0],
    },
    ears: { lift: -8, spread: 4 },
    tail: { wag: 8, speed: 0.3 },
    sway: { amount: 3.5, speed: 0.2 },
  },
  // 胸を張って、あごを上げ、腰に手を当てる
  proud: {
    bones: {
      ...REST_POSE.bones,
      spine: [-3, 0, 0],
      chest: [-7, -5, 0],
      head: [-11, 8, 5],
      leftUpperArm: [74, 5, -44],
      rightUpperArm: [80, -5, 47],
      leftLowerArm: [0, -110, 0],
      rightLowerArm: [0, 106, 0],
      leftHand: [0, 0, -12],
      rightHand: [0, 0, 10],
    },
    ears: { lift: 22 },
    tail: { wag: 16, speed: 1.1, lift: 20 },
  },
  // うつむき気味に首をかしげ、お腹の前で両手を合わせてもじもじする
  shy: {
    bones: {
      ...REST_POSE.bones,
      spine: [4, 0, 0],
      head: [11, -9, 11],
      leftShoulder: [0, 0, 5],
      rightShoulder: [0, 0, -4],
      leftUpperArm: [-16, -34, -74],
      rightUpperArm: [-22, 31, 77],
      leftLowerArm: [0, -92, 0],
      rightLowerArm: [0, 98, 0],
    },
    hands: { left: "soft", right: "soft" },
    ears: { lift: -18, spread: 8 },
    tail: { wag: 8, speed: 0.8, lift: -6 },
    sway: { amount: 4, speed: 0.7 },
  },
  // 両手を胸の前で合わせる
  love: {
    bones: {
      ...REST_POSE.bones,
      chest: [-2, -3, 0],
      head: [-1, -4, 10],
      leftUpperArm: [-28, -23, -74],
      rightUpperArm: [-33, 26, 76],
      leftLowerArm: [0, -102, 0],
      rightLowerArm: [0, 108, 0],
    },
    hands: { left: "soft", right: "soft" },
    ears: { lift: 16 },
    tail: { wag: 26, speed: 1.4, lift: 12 },
    sway: { amount: 3, speed: 0.4 },
  },
  // 両手を上げてわたわたする
  flustered: {
    bones: {
      ...REST_POSE.bones,
      chest: [-2, 4, 0],
      head: [-2, 6, -6],
      leftUpperArm: [-84, -8, -54],
      rightUpperArm: [-92, 6, 60],
      leftLowerArm: [0, -66, 0],
      rightLowerArm: [0, 74, 0],
    },
    hands: { left: "open", right: "open" },
    ears: { lift: -10, spread: 12 },
    tail: { wag: 20, speed: 2.2 },
    jitter: 3,
  },
  // 目を回して体が揺れる
  dizzy: {
    bones: {
      ...REST_POSE.bones,
      chest: [2, 0, 0],
      leftUpperArm: [4, -10, -58],
      rightUpperArm: [-3, 7, 62],
      leftLowerArm: [0, -18, 0],
      rightLowerArm: [0, 10, 0],
    },
    ears: { lift: -25, spread: 20 },
    tail: { wag: 30, speed: 0.5, lift: -10 },
    sway: { amount: 6, speed: 0.5 },
    wobble: 10,
  },
  // 前かがみになって、右手を口元へ
  whisper: {
    bones: {
      ...REST_POSE.bones,
      spine: [6, 0, 0],
      chest: [5, 7, 0],
      head: [5, 12, -6],
      leftUpperArm: [6, -12, -70],
      leftLowerArm: [0, -24, 0],
      rightUpperArm: [-46, 14, 64],
      rightLowerArm: [0, 122, 0],
      rightHand: [0, 0, 12],
    },
    hands: { right: "soft" },
    ears: { lift: 4, forward: 20 },
    tail: { wag: 4, speed: 0.4 },
  },
  // 体を傾けて、左手を頭の後ろへ（てへぺろ・いたずら）
  playful: {
    bones: {
      ...REST_POSE.bones,
      spine: [0, 0, 4],
      chest: [-2, -5, 0],
      head: [-1, 9, -13],
      leftShoulder: [0, 0, 6],
      leftUpperArm: [-86, -12, -18],
      leftLowerArm: [0, -134, 0],
      rightUpperArm: [4, 8, 64],
      rightLowerArm: [0, 18, 0],
    },
    ears: { lift: 8, spread: 10 },
    tail: { wag: 22, speed: 1.3, lift: 12 },
    sway: { amount: 2.5, speed: 0.5 },
  },
  // あごの下で両手を合わせて首をかしげる
  cute: {
    bones: {
      ...REST_POSE.bones,
      chest: [-1, 3, 0],
      head: [3, -3, 13],
      leftUpperArm: [-38, -28, -68],
      rightUpperArm: [-43, 32, 71],
      leftLowerArm: [0, -122, 0],
      rightLowerArm: [0, 128, 0],
    },
    hands: { left: "soft", right: "soft" },
    ears: { lift: 12, spread: -4 },
    tail: { wag: 18, speed: 1, lift: 8 },
    sway: { amount: 4, speed: 0.45 },
  },
};

export const MOTION_NAMES = Object.keys(MOTIONS);
