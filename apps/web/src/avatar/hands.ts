import type { VRMHumanBoneName } from "@pixiv/three-vrm";

/**
 * 手の形。指をまっすぐ伸ばしたままだと人形のように見えるので、ふだんは軽く曲げておく。
 *
 * VRM のT字の姿勢では、指は腕と同じ向き（左手なら +X）へ伸び、手のひらは下（-Y）を向く。
 * 指を曲げる＝手のひら側へ回すので、左手は z のマイナス、右手は z のプラスになる（左右で符号が逆）。
 * 親指だけはT字の姿勢で45度開いた向きに付いているので、別の軸で曲げる。
 *
 * 曲げる角度は、力を抜いて座っているときの指の角度の実測（示指・中指・環指・小指の順）に合わせている。
 * MCP（付け根）27/33/29/26度、PIP（第2関節）39/41/45/43度、DIP（第1関節）14/14/14/16度
 * （Varghese et al., J Clin Diagn Res 2020）。小指ほど深い、という教科書的な並びとは違い、
 * 実測では PIP は環指、MCP は中指が最も深い。
 */

export type HandShape = "relaxed" | "open" | "soft" | "fist" | "point";

type Fingers = "Index" | "Middle" | "Ring" | "Little";
const FINGERS: Fingers[] = ["Index", "Middle", "Ring", "Little"];
const JOINTS = ["Proximal", "Intermediate", "Distal"] as const;

/** 指ごとの [付け根, 第2関節, 第1関節] の曲げ角（度） */
type Curl = Record<Fingers, [number, number, number]>;

const RELAXED: Curl = {
  Index: [27, 39, 14],
  Middle: [33, 41, 14],
  Ring: [29, 45, 14],
  Little: [26, 43, 16],
};

/** 力を抜いた形を基準に、全体の曲げ具合と親指の開きだけを変える */
const SHAPES: Record<HandShape, { curl: number; thumb: [number, number, number] }> = {
  // ふだん（腕を下ろしている・体の前で組む）
  relaxed: { curl: 1, thumb: [10, 12, 8] },
  // 手を開いて見せる（驚く・わたわたする）。完全にまっすぐにはしない
  open: { curl: 0.25, thumb: [4, 2, 2] },
  // ふんわり（胸の前で合わせる・あごの下）
  soft: { curl: 0.7, thumb: [12, 16, 10] },
  // 握る
  fist: { curl: 2.1, thumb: [24, 30, 22] },
  // 人差し指だけ伸ばす
  point: { curl: 2.1, thumb: [20, 24, 16] },
};

export type HandBones = Partial<Record<VRMHumanBoneName, [number, number, number]>>;

/**
 * 手の形を、指の骨ごとの角度にする。
 * side は左右（曲げる向きの符号が逆）、shape は上の形の名前
 */
export function handBones(side: "left" | "right", shape: HandShape): HandBones {
  const { curl, thumb } = SHAPES[shape];
  const sign = side === "left" ? -1 : 1;
  const bones: HandBones = {};
  for (const finger of FINGERS) {
    const angles = RELAXED[finger];
    for (const [index, joint] of JOINTS.entries()) {
      // 人差し指だけ伸ばす形では、人差し指は曲げない
      const amount = shape === "point" && finger === "Index" ? 0.15 : curl;
      const name = `${side}${finger}${joint}` as VRMHumanBoneName;
      bones[name] = [0, 0, sign * angles[index] * amount];
    }
  }
  // 親指は付いている向きが違うので、手のひら側へ寄せる回転（y）で曲げる
  const thumbJoints: VRMHumanBoneName[] = [
    `${side}ThumbMetacarpal` as VRMHumanBoneName,
    `${side}ThumbProximal` as VRMHumanBoneName,
    `${side}ThumbDistal` as VRMHumanBoneName,
  ];
  // VRM 0.x は同じ骨を Proximal / Intermediate / Distal と呼ぶ（three-vrm が 1.0 の名前へ読み替える）
  thumbJoints.forEach((name, index) => {
    bones[name] = [0, sign * thumb[index], 0];
  });
  return bones;
}

/** 指の骨の名前（左右・親指を含む） */
export const FINGER_BONE_NAMES: VRMHumanBoneName[] = (["left", "right"] as const).flatMap((side) => [
  ...FINGERS.flatMap((finger) => JOINTS.map((joint) => `${side}${finger}${joint}` as VRMHumanBoneName)),
  `${side}ThumbMetacarpal` as VRMHumanBoneName,
  `${side}ThumbProximal` as VRMHumanBoneName,
  `${side}ThumbDistal` as VRMHumanBoneName,
]);
