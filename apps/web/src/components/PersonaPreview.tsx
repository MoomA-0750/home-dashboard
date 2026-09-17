import { lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { MOTION_NAMES } from "../avatar/motions";
import type { AvatarRig } from "../avatar/rig";
import type { VoicePersona, VoiceState } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

// three.js を含むので、開いたときだけ読み込む
const VoiceAvatar = lazy(() => import("./VoiceAvatar"));

const STATES: [VoiceState, string][] = [
  ["idle", "待機"],
  ["listening", "聞いている"],
  ["thinking", "考えている"],
  ["speaking", "話している"],
  ["error", "エラー"],
];

/** ポーズは正面だけだと分からないので、回り込んで見られるようにする */
const VIEWS: [number, string][] = [
  [0, "正面"],
  [35, "斜め"],
  [85, "横"],
  [180, "後ろ"],
];

interface PersonaPreviewProps {
  persona: VoicePersona;
  modelUrl: string;
  onClose: () => void;
}

/**
 * キャラクターの動きの確認。状態・表情・身振りを切り替えて、アバターの表情や耳・尻尾・体の動きを見る。
 * 取り込んだキャラクターの表情の割り当てや、耳・尻尾の骨が見つかっているかを確かめるのに使う
 */
export function PersonaPreview({ persona, modelUrl, onClose }: PersonaPreviewProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [expression, setExpression] = useState<string | null>(null);
  const [motion, setMotion] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [restroke, setRestroke] = useState(0);
  const [viewAngle, setViewAngle] = useState(0);
  const [rig, setRig] = useState<AvatarRig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec = expression ? persona.expressions[expression] : null;
  // 身振りを直接選んだらそれを、表情を選んだらその表情の身振りを使う
  const activeMotion = motion ?? spec?.motion ?? null;
  const boneNames = (chains: AvatarRig["tails"]) => chains.map((chain) => chain.bones[0]?.name).join("・") || "見つかりません";

  // 設定パネルは backdrop-filter で固定配置の基準になってしまうので、画面全体に出すため body 直下に描く
  return createPortal(
    <div className="persona-preview" role="dialog" aria-label={`${persona.name}の動きを確認`}>
      <div className="persona-preview__panel">
        <div className="persona-preview__header">
          <h3>{persona.name}の動き</h3>
          <button type="button" className="settings-panel__close" onClick={onClose} aria-label="閉じる">
            <Icon name="dismiss" />
          </button>
        </div>
        <div className="persona-preview__body">
          <div className="persona-preview__stage">
            {error ? (
              <p className="settings-panel__voice-error">{error}</p>
            ) : (
              <Suspense fallback={null}>
                <VoiceAvatar
                  modelUrl={modelUrl}
                  state={state}
                  socket={null}
                  rig={persona.rig ?? undefined}
                  override={{ motion: activeMotion, expression: spec?.avatar ?? null, talking, restroke, viewAngle }}
                  onReady={setRig}
                  onError={(err) => setError(`アバターを読み込めませんでした: ${err}`)}
                />
              </Suspense>
            )}
          </div>
          <div className="persona-preview__controls">
            <h4>状態</h4>
            <div className="persona-preview__buttons">
              {STATES.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}>
                  {label}
                </button>
              ))}
              <button type="button" aria-pressed={talking} onClick={() => setTalking((v) => !v)}>
                口パク・強調
              </button>
              <button type="button" onClick={() => setRestroke((n) => n + 1)}>
                身振りをもう一度
              </button>
            </div>
            <h4>見る向き</h4>
            <div className="persona-preview__buttons">
              {VIEWS.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={viewAngle === value} onClick={() => setViewAngle(value)}>
                  {label}
                </button>
              ))}
            </div>
            <h4>表情（返答の（表情名））</h4>
            <div className="persona-preview__buttons">
              <button type="button" aria-pressed={expression === null} onClick={() => setExpression(null)}>
                指定なし
              </button>
              {Object.entries(persona.expressions).map(([name, value]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={expression === name}
                  title={value.motion ? `身振り: ${value.motion}` : "身振りなし"}
                  onClick={() => {
                    setExpression(name);
                    setMotion(null);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <h4>身振りだけ</h4>
            <div className="persona-preview__buttons">
              <button type="button" aria-pressed={motion === null} onClick={() => setMotion(null)}>
                表情に合わせる
              </button>
              {MOTION_NAMES.map((name) => (
                <button key={name} type="button" aria-pressed={motion === name} onClick={() => setMotion(name)}>
                  {name}
                </button>
              ))}
            </div>
            {rig && (
              <dl className="persona-preview__rig">
                <dt>耳（左）</dt>
                <dd>{boneNames(rig.ears.left)}</dd>
                <dt>耳（右）</dt>
                <dd>{boneNames(rig.ears.right)}</dd>
                <dt>尻尾</dt>
                <dd>{boneNames(rig.tails)}</dd>
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
