import type { VRMHumanBoneName } from "@pixiv/three-vrm";

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
 */

export type BonePose = Partial<Record<VRMHumanBoneName, [number, number, number]>>;

export interface Pose {
  bones: BonePose;
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
}

/** 腕を下ろして立っている、何もしていないときの姿勢 */
export const REST_POSE: Pose = {
  bones: {
    leftUpperArm: [0, -6, -72],
    rightUpperArm: [0, 6, 72],
    leftLowerArm: [0, -12, 0],
    rightLowerArm: [0, 12, 0],
    leftHand: [0, 0, -6],
    rightHand: [0, 0, 6],
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
    bones: { ...REST_POSE.bones, spine: [4, 0, 0], chest: [3, 0, 0], head: [2, 0, 8] },
    ears: { lift: 12, forward: 18 },
    tail: { wag: 4, speed: 0.3, lift: 5 },
    sway: { amount: 0.6, speed: 0.15 },
  },
  transcribing: {
    bones: { ...REST_POSE.bones, spine: [3, 0, 0], head: [0, 0, 5] },
    ears: { lift: 10, forward: 10 },
    tail: { wag: 3, speed: 0.3 },
  },
  // 少し上を見て首をかしげ、片手をあごへ
  thinking: {
    bones: {
      ...REST_POSE.bones,
      head: [-6, -6, -7],
      rightUpperArm: [-45, 25, 72],
      rightLowerArm: [0, 125, 0],
      rightHand: [0, 0, 15],
    },
    ears: { lift: 4, spread: 6 },
    tail: { wag: 10, speed: 0.25, lift: -4 },
    sway: { amount: 1.5, speed: 0.12 },
  },
  speaking: {
    bones: { ...REST_POSE.bones, leftLowerArm: [0, -25, 0], rightLowerArm: [0, 25, 0] },
    ears: { lift: 6 },
    tail: { wag: 10, speed: 0.6, lift: 4 },
    sway: { amount: 1.2, speed: 0.25 },
  },
  error: {
    bones: { ...REST_POSE.bones, head: [12, 0, 0], chest: [6, 0, 0] },
    ears: { lift: -35, spread: 10 },
    tail: { wag: 0, lift: -15 },
  },
};

/** 表情の（表情名）ごとの身振り。persona.json の expressions の motion で名前を選ぶ */
export const MOTIONS: Record<string, Pose> = {
  neutral: STATE_POSES.speaking,
  happy: {
    bones: { ...REST_POSE.bones, chest: [-3, 0, 0], head: [-2, 0, 7], leftUpperArm: [0, -10, -64], rightUpperArm: [0, 10, 64] },
    ears: { lift: 14 },
    tail: { wag: 24, speed: 1.6, lift: 10 },
    sway: { amount: 3, speed: 0.6 },
    hop: 0.015,
  },
  surprised: {
    bones: {
      ...REST_POSE.bones,
      chest: [-6, 0, 0],
      head: [-8, 0, 0],
      leftShoulder: [0, 0, 6],
      rightShoulder: [0, 0, -6],
      leftUpperArm: [-90, 0, -74],
      rightUpperArm: [-90, 0, 74],
      leftLowerArm: [0, -50, 0],
      rightLowerArm: [0, 50, 0],
    },
    ears: { lift: 25, spread: -6 },
    tail: { wag: 0, lift: 25 },
    hop: 0.04,
  },
  sad: {
    bones: {
      ...REST_POSE.bones,
      spine: [5, 0, 0],
      chest: [8, 0, 0],
      head: [16, 0, -4],
      leftShoulder: [0, 0, -5],
      rightShoulder: [0, 0, 5],
      leftUpperArm: [0, -12, -78],
      rightUpperArm: [0, 12, 78],
    },
    ears: { lift: -45, spread: 24 },
    tail: { wag: 0, speed: 0.2, lift: -25 },
    sway: { amount: 0.5, speed: 0.1 },
  },
  // 腰に手を当てて、耳を後ろに伏せる
  angry: {
    bones: {
      ...REST_POSE.bones,
      chest: [-4, 0, 0],
      head: [6, -10, 0],
      leftUpperArm: [90, 0, -50],
      rightUpperArm: [90, 0, 50],
      leftLowerArm: [0, -100, 0],
      rightLowerArm: [0, 100, 0],
    },
    ears: { lift: -20, forward: -25, spread: 10 },
    tail: { wag: 14, speed: 0.9, lift: 18 },
  },
  relaxed: {
    bones: { ...REST_POSE.bones, head: [2, 0, -6], chest: [2, 0, 0] },
    ears: { lift: -8, spread: 4 },
    tail: { wag: 8, speed: 0.3 },
    sway: { amount: 3.5, speed: 0.2 },
  },
  // 胸を張って、あごを上げ、腰に手を当てる
  proud: {
    bones: {
      ...REST_POSE.bones,
      spine: [-4, 0, 0],
      chest: [-8, 0, 0],
      head: [-12, 6, 4],
      leftUpperArm: [90, 0, -50],
      rightUpperArm: [90, 0, 50],
      leftLowerArm: [0, -100, 0],
      rightLowerArm: [0, 100, 0],
    },
    ears: { lift: 22 },
    tail: { wag: 16, speed: 1.1, lift: 20 },
  },
  // うつむき気味に首をかしげ、お腹の前で両手を合わせてもじもじする
  shy: {
    bones: {
      ...REST_POSE.bones,
      head: [12, -8, 10],
      leftShoulder: [0, 0, 5],
      rightShoulder: [0, 0, -5],
      leftUpperArm: [-20, -35, -80],
      rightUpperArm: [-20, 35, 80],
      leftLowerArm: [0, -95, 0],
      rightLowerArm: [0, 95, 0],
    },
    ears: { lift: -18, spread: 8 },
    tail: { wag: 8, speed: 0.8, lift: -6 },
    sway: { amount: 4, speed: 0.7 },
  },
  // 両手を胸の前で合わせる
  love: {
    bones: {
      ...REST_POSE.bones,
      head: [0, 0, 9],
      leftUpperArm: [-30, -25, -78],
      rightUpperArm: [-30, 25, 78],
      leftLowerArm: [0, -105, 0],
      rightLowerArm: [0, 105, 0],
    },
    ears: { lift: 16 },
    tail: { wag: 26, speed: 1.4, lift: 12 },
    sway: { amount: 3, speed: 0.4 },
  },
  // 両手を上げてわたわたする
  flustered: {
    bones: {
      ...REST_POSE.bones,
      head: [0, 0, 0],
      leftUpperArm: [-90, 0, -58],
      rightUpperArm: [-90, 0, 58],
      leftLowerArm: [0, -70, 0],
      rightLowerArm: [0, 70, 0],
    },
    ears: { lift: -10, spread: 12 },
    tail: { wag: 20, speed: 2.2 },
    jitter: 3,
  },
  dizzy: {
    bones: { ...REST_POSE.bones, leftUpperArm: [0, -8, -60], rightUpperArm: [0, 8, 60] },
    ears: { lift: -25, spread: 20 },
    tail: { wag: 30, speed: 0.5, lift: -10 },
    sway: { amount: 6, speed: 0.5 },
    wobble: 10,
  },
  // 前かがみになって、片手を口元へ
  whisper: {
    bones: {
      ...REST_POSE.bones,
      spine: [6, 0, 0],
      chest: [6, 0, 0],
      head: [6, 10, -5],
      rightUpperArm: [-50, 15, 70],
      rightLowerArm: [0, 118, 0],
    },
    ears: { lift: 4, forward: 20 },
    tail: { wag: 4, speed: 0.4 },
  },
  // 体を傾けて、片手を頭の後ろへ（てへぺろ・いたずら）
  playful: {
    bones: {
      ...REST_POSE.bones,
      spine: [0, 0, 4],
      head: [0, 8, -12],
      leftUpperArm: [-90, -10, -15],
      leftLowerArm: [0, -140, 0],
    },
    ears: { lift: 8, spread: 10 },
    tail: { wag: 22, speed: 1.3, lift: 12 },
    sway: { amount: 2.5, speed: 0.5 },
  },
  // あごの下で両手を合わせて首をかしげる
  cute: {
    bones: {
      ...REST_POSE.bones,
      head: [4, 0, 14],
      leftUpperArm: [-40, -30, -72],
      rightUpperArm: [-40, 30, 72],
      leftLowerArm: [0, -125, 0],
      rightLowerArm: [0, 125, 0],
    },
    ears: { lift: 12, spread: -4 },
    tail: { wag: 18, speed: 1, lift: 8 },
    sway: { amount: 4, speed: 0.45 },
  },
};

export const MOTION_NAMES = Object.keys(MOTIONS);
