import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import type { VoiceState } from "../lib/useVoiceAssistant";
import { beatPulse, fractalNoise, SecondOrder } from "./dynamics";
import { MOTIONS, REST_POSE, STATE_POSES, type Pose } from "./motions";
import { bendChain, humanoidAxis, setHumanoidRotation, type AvatarRig, type Chain } from "./rig";

/**
 * アバターを動かす。設計は docs/avatar-motion.md。
 *
 * - 身振りは「ストローク → 保持 → 腕を戻す」の段階で進み、腕を下ろしても気分（姿勢）は少し残す
 * - 各関節は2次系の動きで目標へ追従する。関節ごとに速さ・行き過ぎ・予備動作を変え、目標の切り替えも根元から先へ時間差を付ける
 * - 腕のねじりが大きく違う身振りへ移るときは、腕を下ろした姿勢を中継して体を突き抜けないようにする
 * - 読み上げのアクセント（ビート）に合わせて、うなずきと小さな手の振りを重ねる
 * - 揺れはノイズで不規則にし、ときどき重心を移したり、よそを見たりする
 */

export interface SpeechTiming {
  /** 文ごとに変わる値（新しい文が始まったかを見分ける） */
  id: number;
  /** この文の読み上げが始まった時刻（アニメーションの経過秒） */
  startT: number;
  /** 強調の時刻（読み上げ開始からの秒）と強さ */
  beats: [number, number][];
}

export interface AnimatorInputs {
  state: VoiceState;
  /** 返答の（表情名）から決まった身振りの名前（motions.ts の MOTIONS）。無ければ状態の姿勢 */
  motion: string | null;
  /** VRMの表情名と重み。無ければ状態に応じた控えめな表情 */
  expression: Record<string, number> | null;
  /** いま口にしている母音（a/i/u/e/o）。話していなければ null */
  vowel: string | null;
  /** いま読み上げている文のタイミング */
  speech: SpeechTiming | null;
  /** 変わったら、同じ身振りでもストロークをやり直す（動きの確認画面の「もう一度」） */
  restroke?: number;
}

type Vec3 = [number, number, number];

const VOWEL_EXPRESSIONS: Record<string, string> = { a: "aa", i: "ih", u: "ou", e: "ee", o: "oh" };
const MOUTH_EXPRESSIONS = Object.values(VOWEL_EXPRESSIONS);
const BLINK_DURATION_S = 0.16;
const DEFAULT_HOLD_S = 2.5;
const RESTROKE_AFTER_S = 4;
const VIA_REST_S = 0.25;
const VIA_TWIST_DEGREES = 60;

type BoneGroup = "core" | "head" | "upperArm" | "lowerArm" | "hand";

/** 関節の性格（2次系の f・ζ・r）と、身振りが変わったときに新しい目標へ切り替わるまでの遅れ（秒） */
const GROUPS: Record<BoneGroup, { f: number; zeta: number; r: number }> = {
  core: { f: 1.4, zeta: 0.9, r: -0.2 },
  head: { f: 2.2, zeta: 0.6, r: 0 },
  upperArm: { f: 1.8, zeta: 0.8, r: -0.3 },
  lowerArm: { f: 2.2, zeta: 0.65, r: 0 },
  hand: { f: 2.6, zeta: 0.5, r: 0 },
};

const BONES: Partial<Record<VRMHumanBoneName, { group: BoneGroup; delay: number; posture: boolean }>> = {
  hips: { group: "core", delay: 0, posture: true },
  spine: { group: "core", delay: 0, posture: true },
  chest: { group: "core", delay: 0.03, posture: true },
  neck: { group: "head", delay: 0.05, posture: true },
  head: { group: "head", delay: 0.08, posture: true },
  leftShoulder: { group: "upperArm", delay: 0, posture: true },
  rightShoulder: { group: "upperArm", delay: 0, posture: true },
  leftUpperArm: { group: "upperArm", delay: 0.04, posture: false },
  rightUpperArm: { group: "upperArm", delay: 0.04, posture: false },
  leftLowerArm: { group: "lowerArm", delay: 0.1, posture: false },
  rightLowerArm: { group: "lowerArm", delay: 0.1, posture: false },
  leftHand: { group: "hand", delay: 0.16, posture: false },
  rightHand: { group: "hand", delay: 0.16, posture: false },
};
const BONE_NAMES = Object.keys(BONES) as VRMHumanBoneName[];
/** 腕を戻した後も、体幹・頭・肩に残す身振りの割合（しょんぼりの猫背などの気分は続ける） */
const POSTURE_KEEP = 0.6;

interface Gesture {
  motion: string;
  pose: Pose;
  startedAt: number;
  /** 腕のねじりが大きく変わるので、腕を下ろした姿勢を中継する */
  viaRest: boolean;
}

interface BoneState {
  axes: [SecondOrder, SecondOrder, SecondOrder];
  /** 時間差を付けて切り替える目標の予定（[切り替える時刻, 目標]） */
  queue: [number, Vec3][];
  target: Vec3 | null;
  lastDesired: Vec3 | null;
}

const rad = THREE.MathUtils.degToRad;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function bonePose(pose: Pose, bone: VRMHumanBoneName): Vec3 {
  return pose.bones[bone] ?? REST_POSE.bones[bone] ?? [0, 0, 0];
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function same(a: Vec3 | null, b: Vec3): boolean {
  return !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export class AvatarAnimator {
  private readonly bones = new Map<VRMHumanBoneName, BoneState>();
  private readonly weights = new Map<string, number>();
  private readonly touchedExpressions = new Set<string>();
  private readonly resolvedNames = new Map<string, string | null>();
  private readonly hipsRest = new THREE.Vector3();
  private nextBlinkAt = 1.5;
  private blinkStartedAt = -1;

  /**
   * 身振りの段階・時間差・ときどきの動きに使う時計（1コマの経過秒の和）。描画の遅い端末で1コマが上限で切られても、
   * 腕が届く前に保持の時間が過ぎてしまわないよう、実時間ではなくこちらで進める
   */
  private clock = 0;
  private gesture: Gesture | null = null;
  private lastMotion: string | null = null;
  private lastRestroke: number | undefined;
  private lastSpeechId = -1;
  private readonly hop = new SecondOrder(2.5, 0.35, 0);

  // ときどきの重心移動とよそ見
  private readonly weightShift = new SecondOrder(0.6, 1, 0);
  private weightShiftTarget = 0;
  private nextWeightShiftAt = 4;
  private readonly glance = new SecondOrder(1.2, 0.8, 0);
  private glanceTarget = 0;
  private glanceUntil = 0;
  private nextGlanceAt = 7;

  // 耳・尻尾
  private readonly ears = {
    lift: new SecondOrder(2.4, 0.45, 0),
    spread: new SecondOrder(2.4, 0.5, 0),
    forward: new SecondOrder(2.4, 0.45, 0),
  };
  private readonly earTwitch = { left: new SecondOrder(6, 0.3, 0), right: new SecondOrder(6, 0.3, 0) };
  private nextTwitchAt = { left: 3, right: 5 };
  private readonly earLag = new SecondOrder(1.5, 0.3, 0);
  private lastHeadYaw = 0;
  private readonly tail = { wag: new SecondOrder(0.8, 1, 0), speed: new SecondOrder(0.8, 1, 0), lift: new SecondOrder(1, 0.7, 0) };
  private tailPhase = 0;

  private speechEnergy = 0;
  private readonly headRight = new THREE.Vector3();
  private readonly headForward = new THREE.Vector3();
  private readonly hipsUp = new THREE.Vector3();
  private readonly hipsRight = new THREE.Vector3();

  constructor(
    private readonly vrm: VRM,
    private readonly rig: AvatarRig,
  ) {
    const rest = vrm.humanoid.normalizedRestPose.hips?.position;
    if (rest) this.hipsRest.fromArray(rest);
  }

  private bone(name: VRMHumanBoneName): BoneState {
    let state = this.bones.get(name);
    if (!state) {
      const { f, zeta, r } = GROUPS[BONES[name]!.group];
      state = {
        axes: [new SecondOrder(f, zeta, r), new SecondOrder(f, zeta, r), new SecondOrder(f, zeta, r)],
        queue: [],
        target: null,
        lastDesired: null,
      };
      this.bones.set(name, state);
    }
    return state;
  }

  private statePose(state: VoiceState): Pose {
    return STATE_POSES[state] ?? REST_POSE;
  }

  /** 身振りの開始・やり直しを決める */
  private updateGesture(t: number, inputs: AnimatorInputs) {
    const motion = inputs.motion && MOTIONS[inputs.motion] ? inputs.motion : null;
    const speechStarted = inputs.speech && inputs.speech.id !== this.lastSpeechId;
    if (inputs.speech) this.lastSpeechId = inputs.speech.id;

    let start = false;
    if (motion !== this.lastMotion) {
      start = motion !== null;
      if (!motion) this.gesture = null;
    } else if (motion && inputs.restroke !== this.lastRestroke) {
      start = true;
    } else if (motion && speechStarted && this.gesture) {
      // 同じ表情のまま次の文へ進んだとき、腕を戻して少し経っていれば、もう一度身振りをする
      const holdS = this.gesture.pose.holdS ?? DEFAULT_HOLD_S;
      start = t - this.gesture.startedAt > Math.max(holdS, RESTROKE_AFTER_S);
    }
    this.lastMotion = motion;
    this.lastRestroke = inputs.restroke;
    if (!start || !motion) return;

    const pose = MOTIONS[motion];
    // いま目指している腕のねじりと、新しい身振りの腕のねじりが大きく違えば、腕を下ろした姿勢を経由する
    const viaRest = (["leftUpperArm", "rightUpperArm"] as const).some((arm) => {
      const current = this.bones.get(arm)?.target ?? bonePose(REST_POSE, arm);
      return Math.abs(bonePose(pose, arm)[0] - current[0]) > VIA_TWIST_DEGREES;
    });
    this.gesture = { motion, pose, startedAt: t, viaRest };
    if (pose.hop) this.hop.kick(pose.hop * 12);
  }

  /** 各関節の、いま目指す角度（時間差を付ける前） */
  private desiredPose(t: number, state: VoiceState): Map<VRMHumanBoneName, Vec3> {
    const base = this.statePose(state);
    const gesture = this.gesture;
    const desired = new Map<VRMHumanBoneName, Vec3>();
    for (const name of BONE_NAMES) {
      const baseAngles = bonePose(base, name);
      if (!gesture) {
        desired.set(name, baseAngles);
        continue;
      }
      const elapsed = t - gesture.startedAt;
      const posture = BONES[name]!.posture;
      const gestureAngles = bonePose(gesture.pose, name);
      if (!posture && gesture.viaRest && elapsed < VIA_REST_S) {
        desired.set(name, bonePose(REST_POSE, name));
      } else if (elapsed < (gesture.pose.holdS ?? DEFAULT_HOLD_S)) {
        desired.set(name, gestureAngles);
      } else {
        desired.set(name, posture ? lerp3(baseAngles, gestureAngles, POSTURE_KEEP) : baseAngles);
      }
    }
    return desired;
  }

  /** 人型の骨・表情を決める。vrm.update() の前に呼ぶ */
  updateBody(delta: number, t: number, inputs: AnimatorInputs) {
    this.clock += delta;
    const clock = this.clock;
    this.updateGesture(clock, inputs);
    const desired = this.desiredPose(clock, inputs.state);
    const pose = this.gesture?.pose ?? this.statePose(inputs.state);
    const idle = inputs.state === "idle" || inputs.state === "listening";

    this.updateIdleEvents(clock, idle);
    this.speechEnergy += ((inputs.vowel ? 1 : 0) - this.speechEnergy) * Math.min(1, delta * 8);

    const sway = pose.sway ?? REST_POSE.sway!;
    const swayAngle = sway.amount * fractalNoise(t * sway.speed * 2, 1) + this.weightShift.update(delta, this.weightShiftTarget);
    const breath = Math.sin(t * 1.6) * (0.8 + 0.3 * fractalNoise(t * 0.2, 2));
    // ビートは読み上げの音と揃える必要があるので、実時間で見る
    const beat = this.beatAmount(t, inputs.speech);
    const lateBeat = this.beatAmount(t - 0.05, inputs.speech);
    const glance = this.glance.update(delta, t < this.glanceUntil ? this.glanceTarget : 0);

    const current = new Map<VRMHumanBoneName, Vec3>();
    for (const name of BONE_NAMES) {
      const state = this.bone(name);
      const angles = desired.get(name)!;
      // 目標が変わったら、関節ごとの遅れの後に切り替える（肩が先に動き、手が遅れてついてくる）
      if (!same(state.lastDesired, angles)) {
        state.lastDesired = angles;
        state.queue.push([clock + BONES[name]!.delay, angles]);
      }
      while (state.queue.length > 0 && state.queue[0][0] <= clock) state.target = state.queue.shift()![1];
      const target = state.target ?? angles;
      state.target = target;
      current.set(name, [
        state.axes[0].update(delta, target[0]),
        state.axes[1].update(delta, target[1]),
        state.axes[2].update(delta, target[2]),
      ]);
    }

    for (const name of BONE_NAMES) {
      const [x, y, z] = current.get(name)!;
      let [dx, dy, dz] = [0, 0, 0];
      switch (name) {
        case "hips":
          dz = swayAngle * 0.6;
          break;
        case "spine":
          dx = breath * 0.8;
          dz = -swayAngle * 0.4;
          break;
        case "chest":
          dx = breath * 0.6 + beat * 1.5;
          break;
        case "head":
          dx = beat * 5 + fractalNoise(t * 0.25, 3) * 1.5 + (pose.wobble ?? 0) * Math.sin(t * 5);
          dy = fractalNoise(t * 0.15, 4) * 3 + glance;
          dz = swayAngle * 0.4 + fractalNoise(t * 0.2, 5) * 1.5 + (pose.wobble ?? 0) * Math.cos(t * 5);
          break;
        // 腕を上げたら肩も少し上がる
        case "leftShoulder":
          dz = (current.get("leftUpperArm")![2] - bonePose(REST_POSE, "leftUpperArm")[2]) * 0.12;
          break;
        case "rightShoulder":
          dz = (current.get("rightUpperArm")![2] - bonePose(REST_POSE, "rightUpperArm")[2]) * 0.12;
          break;
        // ビートで前腕を小さく振る（右は少し遅らせて、左右が揃いすぎないようにする）
        case "leftLowerArm":
          dy = -(beat * 6 + this.speechEnergy * 3);
          break;
        case "rightLowerArm":
          dy = lateBeat * 6 + this.speechEnergy * 3;
          break;
      }
      if (pose.jitter && (name === "head" || name.endsWith("UpperArm"))) {
        dz += fractalNoise(t * 12, name.length) * pose.jitter;
      }
      setHumanoidRotation(this.vrm, this.rig, name, [x + dx, y + dy, z + dz]);
    }

    const hips = this.vrm.humanoid.getNormalizedBoneNode("hips");
    if (hips) {
      hips.position.set(this.hipsRest.x, this.hipsRest.y + Math.max(0, this.hop.update(delta, 0)), this.hipsRest.z);
    }

    this.updateFace(delta, t, inputs);
  }

  /** 読み上げのビートによる動きの量（強さを掛けて足し合わせたもの） */
  private beatAmount(t: number, speech: SpeechTiming | null): number {
    if (!speech) return 0;
    let amount = 0;
    for (const [time, strength] of speech.beats) amount += strength * beatPulse(t - (speech.startT + time));
    return amount;
  }

  private updateIdleEvents(t: number, idle: boolean) {
    if (t >= this.nextWeightShiftAt) {
      this.weightShiftTarget = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.5);
      this.nextWeightShiftAt = t + 4 + Math.random() * 5;
    }
    if (idle && t >= this.nextGlanceAt) {
      this.glanceTarget = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6);
      this.glanceUntil = t + 1 + Math.random() * 1.2;
      this.nextGlanceAt = t + 6 + Math.random() * 7;
    }
    if (!idle) this.glanceUntil = 0;
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
      // ときどき2回続けてまばたきする
      this.nextBlinkAt = Math.random() < 0.15 ? t + 0.3 : t + 2 + Math.random() * 4;
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
    const pose = this.gesture?.pose ?? this.statePose(inputs.state);
    const { vrm, rig } = this;

    humanoidAxis(vrm, rig, "head", X, this.headRight);
    humanoidAxis(vrm, rig, "head", Z, this.headForward);
    const ears = pose.ears ?? {};
    const lift = this.ears.lift.update(delta, ears.lift ?? 0);
    const spread = this.ears.spread.update(delta, ears.spread ?? 0);
    const forward = this.ears.forward.update(delta, ears.forward ?? 0);

    // 頭を振ると、耳が少し遅れてついてくる
    const headYaw = Math.atan2(this.headForward.x, this.headForward.z);
    const yawVelocity = delta > 0 ? (headYaw - this.lastHeadYaw) / delta : 0;
    this.lastHeadYaw = headYaw;
    this.earLag.kick(-yawVelocity * 0.5);
    const lag = this.earLag.update(delta, 0);

    for (const side of ["left", "right"] as const) {
      // ときどきピクッと動かす
      if (t >= this.nextTwitchAt[side]) {
        this.earTwitch[side].kick(120);
        this.nextTwitchAt[side] = t + 3 + Math.random() * 6;
      }
      const twitch = this.earTwitch[side].update(delta, 0);
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
    const wag = this.tail.wag.update(delta, tail.wag ?? 0);
    const speed = this.tail.speed.update(delta, tail.speed ?? 0.3);
    const tailLift = this.tail.lift.update(delta, tail.lift ?? 0);
    this.tailPhase = (this.tailPhase + delta * speed * Math.PI * 2) % (Math.PI * 2);
    for (const chain of rig.tails) this.bendTail(chain, wag, tailLift);
  }

  private bendTail(chain: Chain, wag: number, lift: number) {
    const count = Math.max(1, chain.bones.length);
    bendChain(chain, (index) => [
      [this.hipsUp, rad(wag * Math.sin(this.tailPhase - index * 0.55)) / Math.sqrt(count)],
      [this.hipsRight, rad(lift) / count],
    ]);
  }
}
