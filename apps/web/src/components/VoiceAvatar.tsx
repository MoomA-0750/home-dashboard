import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { VoiceState } from "../lib/useVoiceAssistant";
import { AvatarAnimator, type AnimatorInputs, type SpeechTiming } from "../avatar/animator";
import { prepareRig, type AvatarRig, type RigOverrides } from "../avatar/rig";

/**
 * 応答パネルに出すVRMアバター。three.js を含むので、App からは React.lazy で読み込む
 * （アバターを置いていない環境や、応答パネルを開くまでは読み込まない）。
 *
 * 口パクは音声を解析するのではなく、エージェントが送ってくる「読み上げ開始からの秒数と母音」の時系列
 * （VOICEVOX の audio_query の音素の長さから計算したもの）に合わせる。音声はホスト側のスピーカーで鳴り、
 * この画面では鳴らないため。受け取った時刻を再生開始とみなす（LAN内なので遅れは数十ms）。
 */

interface LipsyncMessage {
  type: "voice-lipsync";
  cues: [number, string][];
  /** 強調の時刻（読み上げ開始からの秒）と強さ */
  beats?: [number, number][];
  durationS: number;
  /** その文を読み上げる間の表情（返答の（表情名）から）。VRMの表情名と重み、身振りの名前 */
  expression: { name: string; avatar: Record<string, number>; motion?: string | null } | null;
}

/** スピーカーから音が出るまでの遅れの見込み。口が声より先に動いて見えないよう、少しだけ遅らせる */
const PLAYBACK_LATENCY_S = 0.08;

const models = new Map<string, Promise<VRM>>();

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

/**
 * GLB の JSON チャンクにある NaN / Infinity を 0 に置き換える。
 * 書き出しツールによっては揺れもののコライダーの半径などに NaN を書くことがあり（JSONとして不正）、
 * そのままだと GLTFLoader が読めない（あまなつのモデルで実際に起きた）。
 */
function sanitizeGlb(buffer: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(16, true) !== JSON_CHUNK) return buffer;
  const jsonLength = view.getUint32(12, true);
  const json = new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength));
  const fixed = json.replace(/(?<=[:,[]\s*)-?(?:NaN|Infinity)(?=\s*[,}\]])/g, "0");
  if (fixed === json) return buffer;

  let encoded = new TextEncoder().encode(fixed);
  const padded = Math.ceil(encoded.length / 4) * 4;
  if (padded !== encoded.length) {
    const withSpaces = new Uint8Array(padded).fill(0x20);
    withSpaces.set(encoded);
    encoded = withSpaces;
  }
  const rest = new Uint8Array(buffer, 20 + jsonLength);
  const output = new Uint8Array(20 + encoded.length + rest.length);
  const out = new DataView(output.buffer);
  out.setUint32(0, GLB_MAGIC, true);
  out.setUint32(4, view.getUint32(4, true), true);
  out.setUint32(8, output.length, true);
  out.setUint32(12, encoded.length, true);
  out.setUint32(16, JSON_CHUNK, true);
  output.set(encoded, 20);
  output.set(rest, 20 + encoded.length);
  return output.buffer;
}

/** モデルは数十MBあるので、一度読んだものをキャラクター（URL）ごとに使い回す（パネルを閉じても捨てない） */
export function loadAvatar(url: string): Promise<VRM> {
  let model = models.get(url);
  if (!model) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    model = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`avatar fetch error: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => loader.parseAsync(sanitizeGlb(buffer), ""))
      .then((gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.rotateVRM0(vrm);
        // 揺れものやアニメーションでバウンディングボックスから外れた部分が消えないように
        vrm.scene.traverse((object) => {
          object.frustumCulled = false;
        });
        return vrm;
      })
      .catch((err) => {
        models.delete(url);
        throw err;
      });
    models.set(url, model);
  }
  return model;
}

export interface AvatarOverride {
  motion: string | null;
  expression: Record<string, number> | null;
  /** 口パクと強調（ビート）の確認用に、疑似的な文を読み上げ続ける */
  talking: boolean;
  /** 変わったら、同じ身振りでもやり直す */
  restroke?: number;
}

interface VoiceAvatarProps {
  modelUrl: string;
  state: VoiceState;
  socket: WebSocket | null;
  /** 耳・尻尾の骨の名前（persona.json の rig。省略時は名前から探す） */
  rig?: RigOverrides;
  /** 動きの確認画面から、表情・身振りを直接指定する（このときは WebSocket の口パクを使わない） */
  override?: AvatarOverride;
  onError: (err: unknown) => void;
  /** モデルを読み込み、耳・尻尾の骨を見つけたとき（動きの確認画面で、見つかった骨を出すため） */
  onReady?: (rig: AvatarRig) => void;
}

const DEMO_VOWELS = ["a", "i", "u", "e", "o", "a", null, "o", "e", null];
// 確認画面の疑似的な文（3秒ごと）と、その中の強調
const DEMO_SENTENCE_S = 3;
const DEMO_BEATS: [number, number][] = [
  [0.25, 0.8],
  [0.9, 0.5],
  [1.6, 1],
  [2.3, 0.4],
];

export default function VoiceAvatar({ modelUrl, state, socket, rig, override, onError, onReady }: VoiceAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const overrideRef = useRef(override);
  overrideRef.current = override;
  const lipsyncRef = useRef<{
    cues: [number, string][];
    beats: [number, number][];
    durationS: number;
    receivedAt: number;
  } | null>(null);
  // いまの表情と身振り。次の指定が来るか、新しいやり取りが始まるまで保つ
  const expressionRef = useRef<{ avatar: Record<string, number>; motion: string | null } | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const rigRef = useRef(rig);
  rigRef.current = rig;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as LipsyncMessage;
        if (message.type !== "voice-lipsync") return;
        lipsyncRef.current = {
          cues: message.cues,
          beats: message.beats ?? [],
          durationS: message.durationS,
          receivedAt: performance.now(),
        };
        if (message.expression) {
          expressionRef.current = { avatar: message.expression.avatar, motion: message.expression.motion ?? null };
        }
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket]);

  // 新しいやり取りが始まったら、前の返答の表情を持ち越さない
  useEffect(() => {
    if (state === "listening" || state === "transcribing" || state === "thinking") expressionRef.current = null;
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frame = 0;
    let vrm: VRM | null = null;
    let animator: AvatarAnimator | null = null;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // 非力な端末で重くなりすぎないよう、高DPIでも描画解像度は抑える
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(0.5, 1, 1.5);
    scene.add(light);

    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget);

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const timer = new THREE.Timer();
    const lookGoal = new THREE.Vector3();

    const speechTiming = (t: number): SpeechTiming | null => {
      const demo = overrideRef.current;
      if (demo) {
        if (!demo.talking) return null;
        const index = Math.floor(t / DEMO_SENTENCE_S);
        return { id: index, startT: index * DEMO_SENTENCE_S, beats: DEMO_BEATS };
      }
      const lipsync = lipsyncRef.current;
      if (!lipsync || stateRef.current !== "speaking") return null;
      const sinceReceived = (performance.now() - lipsync.receivedAt) / 1000;
      if (sinceReceived > lipsync.durationS + 1) return null;
      return { id: lipsync.receivedAt, startT: t - sinceReceived + PLAYBACK_LATENCY_S, beats: lipsync.beats };
    };

    const currentVowel = (t: number): string | null => {
      const demo = overrideRef.current;
      if (demo) return demo.talking ? DEMO_VOWELS[Math.floor(t * 7) % DEMO_VOWELS.length] : null;
      const lipsync = lipsyncRef.current;
      if (!lipsync || stateRef.current !== "speaking") return null;
      const elapsed = (performance.now() - lipsync.receivedAt) / 1000 - PLAYBACK_LATENCY_S;
      if (elapsed < 0 || elapsed > lipsync.durationS) return null;
      let vowel: string | null = null;
      for (const [time, v] of lipsync.cues) {
        if (time > elapsed) break;
        vowel = v;
      }
      return vowel;
    };

    const animate = (timestamp?: number) => {
      frame = requestAnimationFrame(animate);
      timer.update(timestamp);
      // 2次系の動きは1コマが長くても発散しないので、描画の遅い端末でも実時間に近く進むよう上限を大きめにする
      const delta = Math.min(timer.getDelta(), 0.25);
      const t = timer.getElapsed();
      if (!vrm || !animator) return;
      const current = stateRef.current;
      const demo = overrideRef.current;
      const inputs: AnimatorInputs = {
        state: current,
        motion: demo ? demo.motion : (expressionRef.current?.motion ?? null),
        expression: demo ? demo.expression : (expressionRef.current?.avatar ?? null),
        vowel: currentVowel(t),
        speech: speechTiming(t),
        restroke: demo?.restroke,
      };

      // 視線: ふだんはこちら（カメラ）を見て、考えている間は少し上の方を見る
      const thinking = current === "thinking" || current === "transcribing";
      lookGoal.set(camera.position.x + (thinking ? 0.25 : 0), camera.position.y + (thinking ? 0.3 : 0), camera.position.z);
      lookTarget.position.lerp(lookGoal, Math.min(1, delta * 3));

      animator.updateBody(delta, t, inputs);
      vrm.update(delta);
      animator.updateEarsAndTail(delta, t, inputs);
      renderer.render(scene, camera);
    };

    loadAvatar(modelUrl)
      .then((loaded) => {
        if (disposed) return;
        vrm = loaded;
        scene.add(vrm.scene);
        const avatarRig = prepareRig(vrm, rigRef.current);
        animator = new AvatarAnimator(vrm, avatarRig);
        onReadyRef.current?.(avatarRig);
        vrm.update(0);

        // 頭の上（耳・髪を含めて首の付け根から約0.3m）から腰の上までが収まるように、頭の位置からカメラを決める
        const headPosition = new THREE.Vector3();
        vrm.humanoid.getNormalizedBoneNode("head")?.getWorldPosition(headPosition);
        const centerY = headPosition.y - 0.12;
        camera.position.set(0, centerY, 2.0);
        camera.lookAt(0, centerY, 0);
        lookTarget.position.copy(camera.position);
        if (vrm.lookAt) vrm.lookAt.target = lookTarget;

        animate();
      })
      .catch((err) => {
        if (!disposed) onErrorRef.current(err);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      // モデル自体は次に開いたときに使い回すので捨てない。シーンから外して描画資源だけ解放する
      if (vrm) scene.remove(vrm.scene);
      timer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelUrl]);

  return <div ref={containerRef} className="voice-avatar" aria-hidden="true" />;
}
