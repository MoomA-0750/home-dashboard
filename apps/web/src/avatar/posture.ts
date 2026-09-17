import type { VRMHumanBoneName } from "@pixiv/three-vrm";

/**
 * ポーズを人の体らしく見せるための決まりごと。身振りのデータ（motions.ts）には「見せたい形」だけを書き、
 * ここで体の理屈（重心・肩の連動・首と頭の分担・可動域）を足す。詳しくは docs/avatar-pose.md。
 */

type Vec3 = [number, number, number];

/**
 * 関節の可動域（度）。身振りの数値を間違えて人体に無い角度を作っても、ここで止める。
 * 整形外科で使われる標準的な可動域（AAOS）を、余裕を見て少し狭めた値
 */
export const LIMITS: Partial<Record<VRMHumanBoneName, [Vec3, Vec3]>> = {
  // [最小(x,y,z), 最大(x,y,z)]
  spine: [[-25, -20, -25], [40, 20, 25]],
  chest: [[-20, -40, -25], [25, 40, 25]],
  neck: [[-30, -35, -25], [30, 35, 25]],
  head: [[-30, -35, -25], [30, 35, 25]],
  leftShoulder: [[-15, -20, -25], [15, 20, 25]],
  rightShoulder: [[-15, -20, -25], [15, 20, 25]],
  leftUpperArm: [[-120, -90, -100], [120, 90, 20]],
  rightUpperArm: [[-120, -90, -20], [120, 90, 100]],
  // ひじは曲げるだけ（左は y のマイナス、右はプラス）。反対に曲がらないように
  leftLowerArm: [[-5, -150, -5], [5, 0, 5]],
  rightLowerArm: [[-5, 0, -5], [5, 150, 5]],
  leftHand: [[-20, -25, -70], [20, 25, 70]],
  rightHand: [[-20, -25, -70], [20, 25, 70]],
  leftUpperLeg: [[-30, -25, -30], [90, 25, 30]],
  rightUpperLeg: [[-30, -25, -30], [90, 25, 30]],
  leftLowerLeg: [[-120, -10, -10], [0, 10, 10]],
  rightLowerLeg: [[-120, -10, -10], [0, 10, 10]],
};

export function clampToLimits(name: VRMHumanBoneName, angles: Vec3): Vec3 {
  const limit = LIMITS[name];
  if (!limit) return angles;
  const [min, max] = limit;
  return [
    Math.min(max[0], Math.max(min[0], angles[0])),
    Math.min(max[1], Math.max(min[1], angles[1])),
    Math.min(max[2], Math.max(min[2], angles[2])),
  ];
}

/** 腕を下ろしているときの上腕の角度（この角度から離れた分を「腕を上げた量」とみなす） */
const ARM_DOWN_Z = 72;
/** この角度までは肩甲骨（肩の骨）は動かない。超えた分の半分を肩に回す（肩甲上腕リズム） */
const SHOULDER_FREE_DEGREES = 30;
const SHOULDER_SHARE = 0.5;
const SHOULDER_MAX = 14;

/**
 * 腕を上げたときに肩を連動させる量（度）。
 * 腕が体から30度以上離れたら、超えた分の半分を肩が担う
 */
export function shoulderFollow(upperArmZ: number, side: "left" | "right"): number {
  const sign = side === "left" ? -1 : 1;
  // z の絶対値が小さいほど腕が上がっている
  const raised = ARM_DOWN_Z - Math.abs(upperArmZ);
  const excess = Math.max(0, raised - SHOULDER_FREE_DEGREES);
  return sign * Math.min(SHOULDER_MAX, excess * SHOULDER_SHARE);
}

/**
 * 首と頭の分担。身振りには「頭をどう向けるか」だけを書き、その半分を首が担う。
 * 首の回旋の約半分は頭のすぐ下（環軸関節）で起きるので、首だけ・頭だけを回すと不自然になる
 */
export const NECK_SHARE = 0.5;

/** 体幹のひねりは胸が主役（胸椎47度 : 腰椎15度）。腰にはごく少しだけ配る */
export const SPINE_TWIST_SHARE = 0.25;

export interface Stance {
  /** どちらの足に体重を乗せているか（-1 で左、+1 で右） */
  side: number;
  /** 立ち方の強さ（0 で左右均等） */
  amount: number;
}

/**
 * 片足に体重を乗せた立ち方（コントラポスト）。
 * 体重を乗せた側の骨盤が上がり、肩のラインは骨盤と逆に傾く。遊んでいる脚はひざが軽く曲がる。
 * 健康な人でも立っているときの骨盤の傾きは平均2度ほどで、完全に水平なほうがむしろ不自然
 */
export function stancePose(stance: Stance): {
  bones: Partial<Record<VRMHumanBoneName, Vec3>>;
  hipsRoll: number;
  shoulderTilt: number;
  hipsShift: number;
} {
  const s = Math.max(-1, Math.min(1, stance.side)) * stance.amount;
  const support = s >= 0 ? "right" : "left";
  const free = support === "right" ? "left" : "right";
  const bend = Math.abs(s);
  const bones: Partial<Record<VRMHumanBoneName, Vec3>> = {
    // 体重を乗せた脚はまっすぐ、遊んでいる脚はひざを軽く曲げて少し外へ
    [`${support}UpperLeg`]: [0, 0, 0],
    [`${support}LowerLeg`]: [0, 0, 0],
    [`${free}UpperLeg`]: [3 * bend, 0, (free === "left" ? -1 : 1) * 2 * bend],
    [`${free}LowerLeg`]: [-10 * bend, 0, 0],
  };
  return {
    bones,
    // 骨盤は体重を乗せた側が上がる（2〜3度）
    hipsRoll: -2.5 * s,
    // 肩のラインは骨盤と逆へ
    shoulderTilt: 1.8 * s,
    // 重心は支えている足の上へ寄せる（メートル）
    hipsShift: 0.012 * s,
  };
}
