import * as THREE from "three";
import { VRMUtils } from "@pixiv/three-vrm";
import { AvatarAnimator, type AnimatorInputs } from "../avatar/animator";
import { prepareRig, type RigOverrides } from "../avatar/rig";
import { ICON_SIZE } from "../lib/personaIcons";
import { fetchAvatar } from "./VoiceAvatar";

/**
 * VRMアバターの顔のアップを撮って、チャットのアイコン（PNG）にする。
 * VRMのサムネイルはモデルによって全身・Tポーズ・無しとまちまちなので、どのキャラクターも同じ構図で撮る。
 * 表示中のアバターと取り合わないよう、モデルは別に読み込み、撮ったら捨てる。three.js を含むので遅延読み込みで使う
 */

// 待機中の姿勢（腕を下ろす・呼吸）が落ち着くまで進める時間
const SETTLE_S = 2;
const STEP_S = 1 / 30;

export async function renderAvatarIcon(modelUrl: string, rig: RigOverrides = {}): Promise<Blob> {
  const vrm = await fetchAvatar(modelUrl);
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(ICON_SIZE, ICON_SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(0.5, 1, 1.5);
    scene.add(light);
    scene.add(vrm.scene);

    const animator = new AvatarAnimator(vrm, prepareRig(vrm, rig));
    // 少し笑った顔で。口・まばたきは animator が待機中の控えめな動きにする
    const inputs: AnimatorInputs = {
      state: "idle",
      motion: null,
      expression: { happy: 0.35 },
      vowel: null,
      speech: null,
    };
    vrm.update(0);

    // 頭の骨を中心に、髪・耳まで入るように少し上から撮る。こちらを見させる
    const head = new THREE.Vector3();
    vrm.humanoid.getNormalizedBoneNode("head")?.getWorldPosition(head);
    const camera = new THREE.PerspectiveCamera(20, 1, 0.05, 10);
    const center = new THREE.Vector3(head.x, head.y + 0.06, head.z);
    camera.position.set(center.x, center.y + 0.03, center.z + 1.15);
    camera.lookAt(center);
    const lookTarget = new THREE.Object3D();
    lookTarget.position.copy(camera.position);
    scene.add(lookTarget);
    if (vrm.lookAt) vrm.lookAt.target = lookTarget;

    for (let t = 0; t < SETTLE_S; t += STEP_S) {
      animator.updateBody(STEP_S, t, inputs);
      vrm.update(STEP_S);
      animator.updateEarsAndTail(STEP_S, t, inputs);
    }
    // まばたきの途中を撮らないよう、目は開けておく
    vrm.expressionManager?.setValue("blink", 0);
    vrm.expressionManager?.update();
    renderer.render(scene, camera);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("アイコンを画像にできませんでした"))),
        "image/png",
      ),
    );
  } finally {
    renderer.forceContextLoss();
    renderer.dispose();
    VRMUtils.deepDispose(vrm.scene);
  }
}
