import { lazy, Suspense, useState } from "react";
import { MOTION_NAMES } from "../avatar/motions";
import type { AvatarRig } from "../avatar/rig";
import type { VoicePersona, VoiceState } from "../lib/useVoiceAssistant";
import { defineMessages } from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    idle: "待機",
    listening: "聞いている",
    thinking: "考えている",
    speaking: "話している",
    error: "エラー",
    front: "正面",
    angled: "斜め",
    side: "横",
    back: "後ろ",
    notFound: "見つかりません",
    listSeparator: "・",
    previewLabel: "{name}の動きを確認",
    loadFailed: "アバターを読み込めませんでした: {error}",
    state: "状態",
    talking: "口パク・強調",
    replayMotion: "身振りをもう一度",
    view: "見る向き",
    expression: "表情（返答の（表情名））",
    noExpression: "指定なし",
    motionOf: "身振り: {motion}",
    noMotion: "身振りなし",
    motionOnly: "身振りだけ",
    followExpression: "表情に合わせる",
    earLeft: "耳（左）",
    earRight: "耳（右）",
    tail: "尻尾",
  },
  en: {
    idle: "Idle",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    error: "Error",
    front: "Front",
    angled: "Angled",
    side: "Side",
    back: "Back",
    notFound: "Not found",
    listSeparator: ", ",
    previewLabel: "Preview {name}'s motion",
    loadFailed: "Couldn't load the avatar: {error}",
    state: "State",
    talking: "Lip sync & emphasis",
    replayMotion: "Replay gesture",
    view: "View angle",
    expression: "Expression (the (expression) tag in replies)",
    noExpression: "None",
    motionOf: "Gesture: {motion}",
    noMotion: "No gesture",
    motionOnly: "Gesture only",
    followExpression: "Match expression",
    earLeft: "Ear (left)",
    earRight: "Ear (right)",
    tail: "Tail",
  },
});

// three.js を含むので、開いたときだけ読み込む
const VoiceAvatar = lazy(() => import("./VoiceAvatar"));

const STATES = [
  ["idle", "idle"],
  ["listening", "listening"],
  ["thinking", "thinking"],
  ["speaking", "speaking"],
  ["error", "error"],
] as const satisfies readonly (readonly [VoiceState, string])[];

/** ポーズは正面だけだと分からないので、回り込んで見られるようにする */
const VIEWS = [
  [0, "front"],
  [35, "angled"],
  [85, "side"],
  [180, "back"],
] as const;

interface PersonaPreviewProps {
  persona: VoicePersona;
  modelUrl: string;
}

/**
 * キャラクターの動きの確認。状態・表情・身振りを切り替えて、アバターの表情や耳・尻尾・体の動きを見る。
 * 取り込んだキャラクターの表情の割り当てや、耳・尻尾の骨が見つかっているかを確かめるのに使う。
 * 設定画面のキャラクターの詳細に、そのまま埋め込んで出す
 */
export function PersonaPreview({ persona, modelUrl }: PersonaPreviewProps) {
  const t = messages.useT();
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
  const boneNames = (chains: AvatarRig["tails"]) =>
    chains.map((chain) => chain.bones[0]?.name).join(t("listSeparator")) || t("notFound");

  return (
    <div className="persona-preview" aria-label={t("previewLabel", { name: persona.name })}>
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
                  onError={(err) => setError(t("loadFailed", { error: String(err) }))}
                />
              </Suspense>
            )}
          </div>
          <div className="persona-preview__controls">
            <h4>{t("state")}</h4>
            <div className="persona-preview__buttons">
              {STATES.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={state === value} onClick={() => setState(value)}>
                  {t(label)}
                </button>
              ))}
              <button type="button" aria-pressed={talking} onClick={() => setTalking((v) => !v)}>
                {t("talking")}
              </button>
              <button type="button" onClick={() => setRestroke((n) => n + 1)}>
                {t("replayMotion")}
              </button>
            </div>
            <h4>{t("view")}</h4>
            <div className="persona-preview__buttons">
              {VIEWS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={viewAngle === value}
                  onClick={() => setViewAngle(value)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <h4>{t("expression")}</h4>
            <div className="persona-preview__buttons">
              <button type="button" aria-pressed={expression === null} onClick={() => setExpression(null)}>
                {t("noExpression")}
              </button>
              {Object.entries(persona.expressions).map(([name, value]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={expression === name}
                  title={value.motion ? t("motionOf", { motion: value.motion }) : t("noMotion")}
                  onClick={() => {
                    setExpression(name);
                    setMotion(null);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <h4>{t("motionOnly")}</h4>
            <div className="persona-preview__buttons">
              <button type="button" aria-pressed={motion === null} onClick={() => setMotion(null)}>
                {t("followExpression")}
              </button>
              {MOTION_NAMES.map((name) => (
                <button key={name} type="button" aria-pressed={motion === name} onClick={() => setMotion(name)}>
                  {name}
                </button>
              ))}
            </div>
            {rig && (
              <dl className="persona-preview__rig">
                <dt>{t("earLeft")}</dt>
                <dd>{boneNames(rig.ears.left)}</dd>
                <dt>{t("earRight")}</dt>
                <dd>{boneNames(rig.ears.right)}</dd>
                <dt>{t("tail")}</dt>
                <dd>{boneNames(rig.tails)}</dd>
              </dl>
            )}
          </div>
        </div>
    </div>
  );
}
