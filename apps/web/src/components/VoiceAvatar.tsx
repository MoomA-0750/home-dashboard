import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { VoiceState } from "../lib/useVoiceAssistant";

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
  durationS: number;
  /** その文を読み上げる間の表情（返答の（表情名）から）。VRMの表情名と重み */
  expression: { name: string; avatar: Record<string, number> } | null;
}

const VOWEL_EXPRESSIONS: Record<string, string> = { a: "aa", i: "ih", u: "ou", e: "ee", o: "oh" };
const MOUTH_EXPRESSIONS = Object.values(VOWEL_EXPRESSIONS);
/** スピーカーから音が出るまでの遅れの見込み。口が声より先に動いて見えないよう、少しだけ遅らせる */
const PLAYBACK_LATENCY_S = 0.08;
const BLINK_DURATION_S = 0.16;

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

interface VoiceAvatarProps {
  modelUrl: string;
  state: VoiceState;
  socket: WebSocket | null;
  onError: (err: unknown) => void;
}

export default function VoiceAvatar({ modelUrl, state, socket, onError }: VoiceAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lipsyncRef = useRef<{ cues: [number, string][]; durationS: number; receivedAt: number } | null>(null);
  // いまの表情（VRMの表情名と重み）。次の指定が来るか、新しいやり取りが始まるまで保つ
  const expressionRef = useRef<Record<string, number> | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as LipsyncMessage;
        if (message.type !== "voice-lipsync") return;
        lipsyncRef.current = { cues: message.cues, durationS: message.durationS, receivedAt: performance.now() };
        if (message.expression) expressionRef.current = message.expression.avatar;
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
    const motion = { nextBlinkAt: 1.5, blinkStartedAt: -1 };
    const weights = new Map<string, number>();

    // 目標の重みへなめらかに寄せる（口の形が音素ごとにパタパタ切り替わらないように）
    const approach = (name: string, target: number, rate: number, delta: number) => {
      const current = weights.get(name) ?? 0;
      const next = current + (target - current) * Math.min(1, delta * rate);
      weights.set(name, next);
      vrm?.expressionManager?.setValue(name, next);
    };

    // 設定の表情名をモデルの表情名に合わせる（VRM 0.x のカスタム表情は「Surprised」のように大文字始まりのことがある）
    const resolvedNames = new Map<string, string | null>();
    const resolveName = (name: string): string | null => {
      if (!vrm?.expressionManager) return null;
      if (!resolvedNames.has(name)) {
        const manager = vrm.expressionManager;
        const found =
          manager.getExpression(name)?.expressionName ??
          manager.expressions.find((e) => e.expressionName.toLowerCase() === name.toLowerCase())?.expressionName ??
          null;
        resolvedNames.set(name, found);
      }
      return resolvedNames.get(name) ?? null;
    };
    // これまでに動かした表情（指定が変わったら0へ戻すため）
    const touchedExpressions = new Set<string>();

    const currentVowel = (): string | null => {
      const lipsync = lipsyncRef.current;
      if (!lipsync || stateRef.current !== "speaking") return null;
      const elapsed = (performance.now() - lipsync.receivedAt) / 1000 - PLAYBACK_LATENCY_S;
      if (elapsed < 0 || elapsed > lipsync.durationS) return null;
      let vowel: string | null = null;
      for (const [t, v] of lipsync.cues) {
        if (t > elapsed) break;
        vowel = v;
      }
      return vowel;
    };

    const animate = (timestamp?: number) => {
      frame = requestAnimationFrame(animate);
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.1);
      const t = timer.getElapsed();
      if (!vrm) return;
      const humanoid = vrm.humanoid;
      const current = stateRef.current;

      // 呼吸と、ゆっくりした頭の揺れ
      const spine = humanoid.getNormalizedBoneNode("spine");
      if (spine) spine.rotation.x = Math.sin(t * 1.6) * 0.015;
      const head = humanoid.getNormalizedBoneNode("head");
      if (head) {
        const tilt = current === "listening" ? 0.09 : 0;
        head.rotation.z += (tilt + Math.sin(t * 0.7) * 0.02 - head.rotation.z) * Math.min(1, delta * 4);
        head.rotation.y = Math.sin(t * 0.5) * 0.04;
        head.rotation.x = current === "speaking" ? Math.sin(t * 3.1) * 0.015 : 0;
      }

      // 視線: ふだんはこちら（カメラ）を見て、考えている間は少し上の方を見る
      const thinking = current === "thinking" || current === "transcribing";
      lookGoal.set(camera.position.x + (thinking ? 0.25 : 0), camera.position.y + (thinking ? 0.3 : 0), camera.position.z);
      lookTarget.position.lerp(lookGoal, Math.min(1, delta * 3));

      // まばたき
      if (t >= motion.nextBlinkAt) {
        motion.blinkStartedAt = t;
        motion.nextBlinkAt = t + 2 + Math.random() * 4;
      }
      const blinkPhase = (t - motion.blinkStartedAt) / BLINK_DURATION_S;
      vrm.expressionManager?.setValue("blink", blinkPhase >= 0 && blinkPhase <= 1 ? Math.sin(blinkPhase * Math.PI) : 0);

      // 口パク
      const vowel = currentVowel();
      for (const name of MOUTH_EXPRESSIONS) {
        approach(name, vowel && VOWEL_EXPRESSIONS[vowel] === name ? 0.75 : 0, 22, delta);
      }

      // 表情。返答で（表情名）の指定があればそれを、無ければ状態に応じた控えめな表情にする
      // （joy 系は目を閉じるモデルが多いので、既定は控えめにする）
      const targets: Record<string, number> = expressionRef.current
        ? { ...expressionRef.current }
        : { happy: current === "speaking" || current === "idle" ? 0.2 : 0, sad: current === "error" ? 0.5 : 0 };
      for (const name of Object.keys(targets)) {
        const resolved = resolveName(name);
        if (resolved) touchedExpressions.add(resolved);
      }
      const resolvedTargets = new Map<string, number>();
      for (const [name, weight] of Object.entries(targets)) {
        const resolved = resolveName(name);
        if (resolved) resolvedTargets.set(resolved, weight);
      }
      for (const name of touchedExpressions) {
        approach(name, resolvedTargets.get(name) ?? 0, 6, delta);
      }

      vrm.update(delta);
      renderer.render(scene, camera);
    };

    loadAvatar(modelUrl)
      .then((loaded) => {
        if (disposed) return;
        vrm = loaded;
        scene.add(vrm.scene);

        // Tポーズのままだと腕が画面に入るので下ろす
        const humanoid = vrm.humanoid;
        const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
        const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
        // VRM 0.x（rotateVRM0 で向きを揃えたもの）と 1.0 とで、腕を下ろす回転の向きが逆になる
        const armDown = vrm.meta.metaVersion === "0" ? 1.25 : -1.25;
        if (leftUpperArm) leftUpperArm.rotation.z = armDown;
        if (rightUpperArm) rightUpperArm.rotation.z = -armDown;
        vrm.update(0);

        // 頭の上（耳・髪を含めて首の付け根から約0.3m）から胸元までが収まるように、頭の位置からカメラを決める
        const headPosition = new THREE.Vector3();
        humanoid.getNormalizedBoneNode("head")?.getWorldPosition(headPosition);
        const centerY = headPosition.y - 0.03;
        camera.position.set(0, centerY, 1.55);
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
