import type * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

/**
 * 表情どうしの重なりを、モデルの形から決める。
 *
 * 笑顔（happy）が目を閉じる（^^）モデル、なごみ顔が「まばたき」そのものなモデル、笑顔に口を開ける形が入っているモデルがある。
 * VRM 1.0 なら表情ごとに「まばたき・口を止めるか」（override）を書けるが、VRM 0.x には無く、書いてあっても
 * 「表情の間は口がまったく動かない」のように極端になる。そこで読み込んだときに、各表情が目をどれだけ閉じ、
 * 口をどれだけ開けるかを、モーフの頂点の動きがまばたき・「あ」の口とどれだけ同じ向きかで測り、
 * まばたきと口の動き（リップシンク）をその分だけ弱める（どのモデルでも同じ決まりで動く）。
 */

export interface FaceProfile {
  /** 表情ごとの、目を閉じる度合い（0〜1。まばたきを1としたとき） */
  eyeClose: Map<string, number>;
  /** 表情ごとの、口を開ける度合い（0〜1。「あ」の口を1としたとき） */
  mouthOpen: Map<string, number>;
}

type Deltas = Map<THREE.BufferGeometry, Float32Array>;

/** 表情を最大にしたときの、頂点の動き（ジオメトリごと） */
function expressionDeltas(vrm: VRM, name: string): Deltas | null {
  const expression = vrm.expressionManager?.getExpression(name);
  if (!expression) return null;
  const result: Deltas = new Map();
  for (const bind of expression.binds) {
    const morph = bind as { primitives?: THREE.Mesh[]; index?: number; weight?: number };
    if (!morph.primitives || morph.index === undefined || morph.weight === undefined) continue;
    for (const mesh of morph.primitives) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const target = geometry.morphAttributes.position?.[morph.index];
      if (!target) continue;
      const source = target.array as ArrayLike<number>;
      let sum = result.get(geometry);
      if (!sum) {
        sum = new Float32Array(source.length);
        result.set(geometry, sum);
      }
      for (let i = 0; i < source.length; i++) sum[i] += source[i] * morph.weight;
    }
  }
  return result.size > 0 ? result : null;
}

/** a を b の向きに写した長さを、b の長さで割ったもの（b と同じ動きなら1、関係なければ0、逆向きなら負） */
function projection(a: Deltas, b: Deltas): number {
  let dot = 0;
  let norm = 0;
  for (const [geometry, bv] of b) {
    const av = a.get(geometry);
    for (let i = 0; i < bv.length; i++) {
      norm += bv[i] * bv[i];
      if (av) dot += av[i] * bv[i];
    }
  }
  return norm > 0 ? dot / norm : 0;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 読み込んだモデルの表情を測る。あわせて、モデルに書かれたまばたき・口の止め方は使わない（ここで測った分で弱める） */
export function analyzeFace(vrm: VRM): FaceProfile {
  const profile: FaceProfile = { eyeClose: new Map(), mouthOpen: new Map() };
  const manager = vrm.expressionManager;
  if (!manager) return profile;
  const blink = expressionDeltas(vrm, "blink");
  const aa = expressionDeltas(vrm, "aa");
  for (const expression of manager.expressions) {
    const name = expression.expressionName;
    expression.overrideBlink = "none";
    expression.overrideMouth = "none";
    if (["blink", "blinkLeft", "blinkRight", "aa", "ih", "ou", "ee", "oh"].includes(name)) continue;
    const deltas = expressionDeltas(vrm, name);
    if (!deltas) continue;
    if (blink) profile.eyeClose.set(name, clamp01(projection(deltas, blink)));
    if (aa) profile.mouthOpen.set(name, clamp01(projection(deltas, aa)));
  }
  return profile;
}

/**
 * 目の骨の動く範囲を広げる。モデルによっては、視線を向けても目が 0.1° ほどしか動かない設定（単位の取り違えと見られる）や、
 * 90° 向いてやっと 10° 動く設定になっていて、目が頭に貼り付いたように見える。カメラとの角度（数度〜十数度）で
 * 目がはっきり動くよう、30° で上限に達し、左右は 12°・上下は 8° まで動くようにする（モデルの値が大きければそちらを使う）
 */
export function widenLookAt(vrm: VRM): void {
  const applier = vrm.lookAt?.applier as
    | {
        rangeMapHorizontalInner?: { inputMaxValue: number; outputScale: number };
        rangeMapHorizontalOuter?: { inputMaxValue: number; outputScale: number };
        rangeMapVerticalDown?: { inputMaxValue: number; outputScale: number };
        rangeMapVerticalUp?: { inputMaxValue: number; outputScale: number };
      }
    | undefined;
  // 目の骨を回すモデルだけ（表情で目線を出すモデルは、出力が角度ではなく表情の重み）
  if (!applier || (applier.constructor as { type?: string }).type !== "bone") return;
  const widen = (map: { inputMaxValue: number; outputScale: number } | undefined, degrees: number) => {
    if (!map) return;
    const current = (map.outputScale / map.inputMaxValue) * 30;
    map.inputMaxValue = 30;
    map.outputScale = Math.max(degrees, Math.min(current, 20));
  };
  widen(applier.rangeMapHorizontalInner, 12);
  widen(applier.rangeMapHorizontalOuter, 12);
  widen(applier.rangeMapVerticalDown, 8);
  widen(applier.rangeMapVerticalUp, 8);
}
