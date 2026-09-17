import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import type { VoiceState } from "../lib/useVoiceAssistant";
import { MOTIONS, REST_POSE, STATE_POSES, type Pose } from "./motions";
import { bendChain, humanoidAxis, setHumanoidRotation, type AvatarRig, type Chain } from "./rig";

/**
 * アバターを動かす。毎フレーム、いまの状態・表情から目標の姿勢を決め、ばねのように追従させてから、
 * 呼吸・揺れ・うなずき・耳のピクつき・尻尾の振りなどを重ねる。
 */

export interface AnimatorInputs {
  state: VoiceState;
  /** 返答の（表情名）から決まった身振りの名前（motions.ts の MOTIONS）。無ければ状態の姿勢 */
  motion: string | null;
  /** VRMの表情名と重み。無ければ状態に応じた控えめな表情 */
  expression: Record<string, number> | null;
  /** いま口にしている母音（a/i/u/e/o）。話していなければ null */
  vowel: string | null;
}

const VOWEL_EXPRESSIONS: Record<string, string> = { a: "aa", i: "ih", u: "ou", e: "ee", o: "oh" };
const MOUTH_EXPRESSIONS = Object.values(VOWEL_EXPRESSIONS);
const BLINK_DURATION_S = 0.16;
const BODY_BONES = new Set<VRMHumanBoneName>(["hips", "spine", "chest", "neck", "head"]);
for (const pose of [REST_POSE, ...Object.values(STATE_POSES), ...Object.values(MOTIONS)]) {
  for (const bone of Object.keys(pose.bones)) BODY_BONES.add(bone as VRMHumanBoneName);
}

/**
 * 行き過ぎずに目標へ収まるばね（臨界減衰）。stiffness が大きいほど速く追いつく。
 * 素朴に速度と位置を足していくと、描画が遅い端末（1コマが0.1秒近い）で硬いばねが発散して骨が吹き飛んだので、
 * 1コマの長さによらず安定する厳密な解の式で進める
 */
class Spring {
  value = 0;
  velocity = 0;
  step(target: number, stiffness: number, delta: number) {
    const omega = Math.sqrt(stiffness);
    const offset = this.value - target;
    const j = this.velocity + omega * offset;
    const decay = Math.exp(-omega * delta);
    this.value = target + (offset + j * delta) * decay;
    this.velocity = (this.velocity - omega * j * delta) * decay;
    if (!Number.isFinite(this.value) || !Number.isFinite(this.velocity)) {
      this.value = target;
      this.velocity = 0;
    }
    return this.value;
  }
}

const rad = THREE.MathUtils.degToRad;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class AvatarAnimator {
  private readonly springs = new Map<string, Spring>();
  private readonly weights = new Map<string, number>();
  private readonly touchedExpressions = new Set<string>();
  private readonly resolvedNames = new Map<string, string | null>();
  private readonly hipsRest = new THREE.Vector3();
  private nextBlinkAt = 1.5;
  private blinkStartedAt = -1;
  private lastMotion: string | null = null;
  private readonly hop = new Spring();
  private readonly earTwitch = { left: new Spring(), right: new Spring() };
  private nextTwitchAt = { left: 3, right: 5 };
  private speechEnergy = 0;
  private readonly headRight = new THREE.Vector3();
  private readonly headForward = new THREE.Vector3();
  private readonly hipsUp = new THREE.Vector3();
  private readonly hipsRight = new THREE.Vector3();
  private lastHeadYaw = 0;
  private readonly earLag = new Spring();

  constructor(
    private readonly vrm: VRM,
    private readonly rig: AvatarRig,
  ) {
    const rest = vrm.humanoid.normalizedRestPose.hips?.position;
    if (rest) this.hipsRest.fromArray(rest);
  }

  private spring(key: string): Spring {
    let spring = this.springs.get(key);
    if (!spring) {
      spring = new Spring();
      this.springs.set(key, spring);
    }
    return spring;
  }

  /** 人型の骨・表情を決める。vrm.update() の前に呼ぶ */
  updateBody(delta: number, t: number, inputs: AnimatorInputs) {
    const pose: Pose = (inputs.motion && MOTIONS[inputs.motion]) || STATE_POSES[inputs.state] || REST_POSE;

    // 身振りが変わった瞬間に一度だけ跳ねる
    if (inputs.motion !== this.lastMotion) {
      if (pose.hop) this.hop.velocity += pose.hop * 14;
      this.lastMotion = inputs.motion;
    }

    // 話している間は、母音が出ているほどうなずき・手ぶりを大きくする
    this.speechEnergy += ((inputs.vowel ? 1 : 0) - this.speechEnergy) * Math.min(1, delta * 8);
    const sway = pose.sway ?? REST_POSE.sway!;
    const swayAngle = sway.amount * Math.sin(t * Math.PI * 2 * sway.speed);
    const breath = Math.sin(t * 1.6);

    for (const bone of BODY_BONES) {
      const target = pose.bones[bone] ?? [0, 0, 0];
      const [x, y, z] = target.map((value, axis) => this.spring(`${bone}.${axis}`).step(value, 60, delta));
      let [dx, dy, dz] = [0, 0, 0];
      switch (bone) {
        case "hips":
          dz = swayAngle * 0.6;
          break;
        case "spine":
          dx = breath * 0.8;
          dz = -swayAngle * 0.4;
          break;
        case "chest":
          dx = breath * 0.6 - this.speechEnergy * 1.5;
          break;
        case "head":
          dx = this.speechEnergy * 4 * Math.max(0, Math.sin(t * 7)) + (pose.wobble ?? 0) * Math.sin(t * 5);
          dy = Math.sin(t * 0.5) * 2.5;
          dz = swayAngle * 0.5 + (pose.wobble ?? 0) * Math.cos(t * 5);
          break;
        case "leftLowerArm":
          dy = -this.speechEnergy * 10 * (0.5 + 0.5 * Math.sin(t * 2.3));
          break;
        case "rightLowerArm":
          dy = this.speechEnergy * 10 * (0.5 + 0.5 * Math.sin(t * 2.9 + 1));
          break;
      }
      if (pose.jitter && (bone === "head" || bone.endsWith("UpperArm"))) {
        dz += (Math.random() - 0.5) * pose.jitter * 2;
      }
      setHumanoidRotation(this.vrm, this.rig, bone, [x + dx, y + dy, z + dz]);
    }

    const hips = this.vrm.humanoid.getNormalizedBoneNode("hips");
    if (hips) hips.position.set(this.hipsRest.x, this.hipsRest.y + Math.max(0, this.hop.step(0, 120, delta)), this.hipsRest.z);

    this.updateFace(delta, t, inputs);
  }

  private resolveName(name: string): string | null {
    const manager = this.vrm.expressionManager;
    if (!manager) return null;
    if (!this.resolvedNames.has(name)) {
      // VRM 0.x のカスタム表情は「Surprised」のように大文字始まりのことがある
      const found =
        manager.getExpression(name)?.expressionName ??
        manager.expressions.find((e) => e.expressionName.toLowerCase() === name.toLowerCase())?.expressionName ??
        null;
      this.resolvedNames.set(name, found);
    }
    return this.resolvedNames.get(name) ?? null;
  }

  private approach(name: string, target: number, rate: number, delta: number) {
    const current = this.weights.get(name) ?? 0;
    const next = current + (target - current) * Math.min(1, delta * rate);
    this.weights.set(name, next);
    this.vrm.expressionManager?.setValue(name, next);
  }

  private updateFace(delta: number, t: number, inputs: AnimatorInputs) {
    const manager = this.vrm.expressionManager;
    if (!manager) return;

    if (t >= this.nextBlinkAt) {
      this.blinkStartedAt = t;
      this.nextBlinkAt = t + 2 + Math.random() * 4;
    }
    const blinkPhase = (t - this.blinkStartedAt) / BLINK_DURATION_S;
    manager.setValue("blink", blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) : 0);

    for (const name of MOUTH_EXPRESSIONS) {
      this.approach(name, inputs.vowel && VOWEL_EXPRESSIONS[inputs.vowel] === name ? 0.75 : 0, 22, delta);
    }

    // 返答で（表情名）の指定があればそれを、無ければ状態に応じた控えめな表情にする（joy 系は目を閉じるモデルが多い）
    const targets = inputs.expression ?? {
      happy: inputs.state === "speaking" || inputs.state === "idle" ? 0.2 : 0,
      sad: inputs.state === "error" ? 0.5 : 0,
    };
    const resolvedTargets = new Map<string, number>();
    for (const [name, weight] of Object.entries(targets)) {
      const resolved = this.resolveName(name);
      if (!resolved) continue;
      resolvedTargets.set(resolved, weight);
      this.touchedExpressions.add(resolved);
    }
    for (const name of this.touchedExpressions) this.approach(name, resolvedTargets.get(name) ?? 0, 6, delta);
  }

  /** 耳と尻尾を動かす。vrm.update() で人型の骨が反映された後に呼ぶ */
  updateEarsAndTail(delta: number, t: number, inputs: AnimatorInputs) {
    const pose: Pose = (inputs.motion && MOTIONS[inputs.motion]) || STATE_POSES[inputs.state] || REST_POSE;
    const { vrm, rig } = this;

    humanoidAxis(vrm, rig, "head", X, this.headRight);
    humanoidAxis(vrm, rig, "head", Z, this.headForward);
    const ears = pose.ears ?? {};
    const lift = this.spring("ears.lift").step(ears.lift ?? 0, 40, delta);
    const spread = this.spring("ears.spread").step(ears.spread ?? 0, 40, delta);
    const forward = this.spring("ears.forward").step(ears.forward ?? 0, 40, delta);

    // 頭を振ると、耳が少し遅れてついてくる
    const headYaw = Math.atan2(this.headForward.x, this.headForward.z);
    const yawVelocity = delta > 0 ? (headYaw - this.lastHeadYaw) / delta : 0;
    this.lastHeadYaw = headYaw;
    this.earLag.velocity -= yawVelocity * 0.5;
    const lag = this.earLag.step(0, 30, delta);

    for (const side of ["left", "right"] as const) {
      // ときどきピクッと動かす
      if (t >= this.nextTwitchAt[side]) {
        this.earTwitch[side].velocity += 260;
        this.nextTwitchAt[side] = t + 3 + Math.random() * 6;
      }
      const twitch = this.earTwitch[side].step(0, 260, delta);
      const outward = side === "left" ? -1 : 1;
      const pitch = rad(forward + lift * 0.7 + twitch * 0.5);
      const roll = rad((spread + Math.max(0, -lift) * 0.5 + twitch * 0.3) * outward) + lag * 0.02;
      const shares = [0.6, 0.3, 0.2, 0.15];
      for (const chain of rig.ears[side]) {
        bendChain(chain, (index) => {
          const share = shares[index] ?? 0.1;
          return [
            [this.headRight, pitch * share],
            [this.headForward, roll * share],
          ];
        });
      }
    }

    humanoidAxis(vrm, rig, "hips", Y, this.hipsUp);
    humanoidAxis(vrm, rig, "hips", X, this.hipsRight);
    const tail = pose.tail ?? {};
    const wag = this.spring("tail.wag").step(tail.wag ?? 0, 20, delta);
    const speed = this.spring("tail.speed").step(tail.speed ?? 0.3, 20, delta);
    const tailLift = this.spring("tail.lift").step(tail.lift ?? 0, 20, delta);
    this.tailPhase = (this.tailPhase + delta * speed * Math.PI * 2) % (Math.PI * 2);
    for (const chain of rig.tails) this.bendTail(chain, wag, tailLift);
  }

  private tailPhase = 0;

  private bendTail(chain: Chain, wag: number, lift: number) {
    const count = Math.max(1, chain.bones.length);
    bendChain(chain, (index) => [
      [this.hipsUp, rad(wag * Math.sin(this.tailPhase - index * 0.55)) / Math.sqrt(count)],
      [this.hipsRight, rad(lift) / count],
    ]);
  }
}
