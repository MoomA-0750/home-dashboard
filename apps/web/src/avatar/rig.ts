import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";

/**
 * VRMの骨の扱い。
 *
 * - 人型の骨（頭・腕など）は three-vrm の「正規化された骨」を回す。VRM 1.0 はモデルが +Z を向いた座標で回転を書けるが、
 *   VRM 0.x は rotateVRM0 で180度回して向きを揃えているので、X軸・Z軸まわりの回転の向きが逆になる（setHumanoidRotation で吸収する）
 * - 耳・尻尾は人型の骨ではなく、軸の向きがモデルごとにばらばらなので、「頭（腰）から見てどちらへ倒すか」で回す
 * - 耳・尻尾は多くのモデルで揺れもの（spring bone）になっていて、そのままだと物理演算が回転を上書きする。
 *   動かす骨は揺れものから外し、揺れはこちらのばねの計算で付ける
 */

export interface RigOverrides {
  /** 耳の骨の名前（左右それぞれの根元。省略時は名前から探す） */
  ears?: { left?: string[]; right?: string[] };
  /** 尻尾の骨の名前（根元。省略時は名前から探す） */
  tail?: string[];
}

export interface Chain {
  bones: THREE.Bone[];
  rest: THREE.Quaternion[];
}

export interface AvatarRig {
  facing: 1 | -1;
  ears: { left: Chain[]; right: Chain[] };
  tails: Chain[];
}

const EAR = /(?:^|[^a-z])(?:cat\s*)?ear(?![a-z]*ring)|mimi|耳/i;
const TAIL = /(?:^|[^a-z])tail|しっぽ|尻尾/i;
const NOT_TAIL = /twin|hair|pony/i;
const LEFT = /(?:^|[_.\s-])(?:l|left)(?:$|[_.\s\d(-])|left/i;
const RIGHT = /(?:^|[_.\s-])(?:r|right)(?:$|[_.\s\d(-])|right/i;

function isBone(object: THREE.Object3D): object is THREE.Bone {
  return (object as THREE.Bone).isBone === true;
}

/** 根元から、骨の子を1本ずつたどった鎖（「_end」で終わる先端の骨は動かしても意味が無いので含めない） */
function chainFrom(root: THREE.Bone): Chain {
  const bones: THREE.Bone[] = [];
  let current: THREE.Object3D | undefined = root;
  while (current && isBone(current) && !/_end$/i.test(current.name)) {
    bones.push(current);
    current = current.children.find(isBone);
  }
  return { bones, rest: bones.map((bone) => bone.quaternion.clone()) };
}

/** 名前で指定された骨を根元にした鎖（名前に一致する子を順にたどる） */
function chainsByName(scene: THREE.Object3D, names: string[]): Chain[] {
  const wanted = new Set(names);
  const roots: THREE.Bone[] = [];
  scene.traverse((object) => {
    if (isBone(object) && wanted.has(object.name)) roots.push(object);
  });
  return roots.map((root) => chainFrom(root));
}

/** 名前に ear/tail を含む骨の鎖の根元を探す（同じ種類の骨を親に持たないもの） */
function findChains(scene: THREE.Object3D, pattern: RegExp, exclude?: RegExp): THREE.Bone[] {
  const roots: THREE.Bone[] = [];
  const matches = (object: THREE.Object3D | null): object is THREE.Bone =>
    !!object && isBone(object) && pattern.test(object.name) && !(exclude?.test(object.name) ?? false);
  scene.traverse((object) => {
    if (matches(object) && !/_end$/i.test(object.name) && !matches(object.parent)) roots.push(object);
  });
  return roots;
}

function sideOf(name: string): "left" | "right" | null {
  if (LEFT.test(name)) return "left";
  if (RIGHT.test(name)) return "right";
  return null;
}

const rigs = new WeakMap<VRM, AvatarRig>();

/**
 * 耳・尻尾の骨を探し、揺れものから外す。モデルは画面を開き直しても使い回すので、1体につき1回だけ行う
 */
export function prepareRig(vrm: VRM, overrides: RigOverrides = {}): AvatarRig {
  const cached = rigs.get(vrm);
  if (cached) return cached;

  const ears: AvatarRig["ears"] = { left: [], right: [] };
  if (overrides.ears) {
    ears.left = chainsByName(vrm.scene, overrides.ears.left ?? []);
    ears.right = chainsByName(vrm.scene, overrides.ears.right ?? []);
  } else {
    for (const root of findChains(vrm.scene, EAR)) {
      // 「Ear_Root」のように左右の区別の無い根元は、その下の左右の骨をそれぞれ鎖として扱う
      const candidates = sideOf(root.name) ? [root] : root.children.filter(isBone);
      for (const bone of candidates) {
        const side = sideOf(bone.name);
        if (side) ears[side].push(chainFrom(bone));
      }
    }
  }
  const tails = overrides.tail
    ? chainsByName(vrm.scene, overrides.tail)
    : findChains(vrm.scene, TAIL, NOT_TAIL).map((root) => chainFrom(root));

  const controlled = new Set<THREE.Object3D>();
  for (const chain of [...ears.left, ...ears.right, ...tails]) chain.bones.forEach((bone) => controlled.add(bone));
  const springs = vrm.springBoneManager;
  if (springs) {
    for (const joint of [...springs.joints]) {
      if (controlled.has(joint.bone)) springs.deleteJoint(joint);
    }
  }

  const rig: AvatarRig = { facing: vrm.meta.metaVersion === "0" ? -1 : 1, ears, tails };
  rigs.set(vrm, rig);
  return rig;
}

const euler = new THREE.Euler();

/** 人型の骨を、VRM 1.0 の向き（モデルが +Z を向き、左手が +X）で書いた角度（度）で回す */
export function setHumanoidRotation(vrm: VRM, rig: AvatarRig, name: VRMHumanBoneName, degrees: [number, number, number]) {
  const node = vrm.humanoid.getNormalizedBoneNode(name);
  if (!node) return;
  const [x, y, z] = degrees.map((d) => THREE.MathUtils.degToRad(d));
  node.quaternion.setFromEuler(euler.set(x * rig.facing, y, z * rig.facing, "XYZ"));
}

const parentWorld = new THREE.Quaternion();
const parentInverse = new THREE.Quaternion();
const delta = new THREE.Quaternion();
const axisQuaternion = new THREE.Quaternion();

/**
 * 骨の鎖を、ワールド空間の軸まわりに回す。節ごとに角度を変えられるので、根元ほど大きく先ほど遅らせて曲げると、しなって見える。
 * rotations(index) は、その節に掛ける [軸, 角度（ラジアン）] の組
 */
export function bendChain(chain: Chain, rotations: (index: number) => [THREE.Vector3, number][]) {
  chain.bones.forEach((bone, index) => {
    const parent = bone.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(parentWorld);
    parentInverse.copy(parentWorld).invert();
    delta.identity();
    for (const [axis, angle] of rotations(index)) {
      delta.multiply(axisQuaternion.setFromAxisAngle(axis, angle));
    }
    // local' = parentWorld⁻¹ · delta · parentWorld · rest
    bone.quaternion.copy(parentInverse).multiply(delta).multiply(parentWorld).multiply(chain.rest[index]);
  });
}

const tmpQuaternion = new THREE.Quaternion();

/** 人型の骨から見た向き（VRM 1.0 の向きで書いた軸を、いまのワールド空間の向きにしたもの） */
export function humanoidAxis(vrm: VRM, rig: AvatarRig, name: VRMHumanBoneName, local: THREE.Vector3, out: THREE.Vector3) {
  const node = vrm.humanoid.getNormalizedBoneNode(name);
  out.set(local.x * rig.facing, local.y, local.z * rig.facing);
  if (!node) return out;
  node.updateWorldMatrix(true, false);
  return out.applyQuaternion(node.getWorldQuaternion(tmpQuaternion));
}
