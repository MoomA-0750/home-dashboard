import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { defineMessages, motionMs } from "@home-dashboard/widget-sdk";
import { ACTIVE_VOICE_STATES, type VoicePersona, type VoiceSnapshot, type VoiceState } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

// three.js を含むので、アバターを出すときだけ読み込む
const VoiceAvatar = lazy(() => import("./VoiceAvatar"));

/** 返答し終えてから、返答を画面に残しておく時間 */
const RESPONSE_LINGER_MS = 15_000;
const ERROR_LINGER_MS = 6_000;

const messages = defineMessages({
  ja: {
    listening: "聞いています",
    transcribing: "聞き取っています",
    thinking: "考えています",
    error: "うまくいきませんでした",
    speakNow: "どうぞ、話しかけてください",
    goOn: "続けてどうぞ",
    voiceAssistant: "音声アシスタント",
    cancel: "中止",
    close: "閉じる",
  },
  en: {
    listening: "Listening",
    transcribing: "Transcribing",
    thinking: "Thinking",
    error: "Something went wrong",
    speakNow: "Go ahead, I'm listening",
    goOn: "Go on",
    voiceAssistant: "Voice assistant",
    cancel: "Cancel",
    close: "Close",
  },
});

const STATUS_LABELS: Record<VoiceState, "listening" | "transcribing" | "thinking" | "error" | null> = {
  idle: null,
  listening: "listening",
  transcribing: "transcribing",
  thinking: "thinking",
  speaking: null,
  error: "error",
};

interface VoiceOverlayProps {
  snapshot: VoiceSnapshot | null;
  /** VRMアバターのURL。無ければ状態を表す円だけを出す */
  avatarUrl: string | null;
  /** 耳・尻尾の骨の名前の指定（persona.json の rig） */
  avatarRig?: VoicePersona["rig"];
  socket: WebSocket | null;
  onCancel: () => void;
}

function VoiceOrb({ state, badge = false }: { state: VoiceState; badge?: boolean }) {
  return (
    <div className={`voice-orb${badge ? " voice-orb--badge" : ""}`} data-state={state} aria-hidden="true">
      <Icon name="mic" />
    </div>
  );
}

/**
 * ウェイクワードを聞いてから返答し終えるまで、画面の手前に出すパネル。
 * 読み上げが終わったあともしばらく返答を残し、タップするか時間が経つと消える。
 */
export function VoiceOverlay({ snapshot, avatarUrl, avatarRig, socket, onCancel }: VoiceOverlayProps) {
  const [visible, setVisible] = useState(false);
  // 余韻のあと・タップで閉じるときは、薄くなってから消す（自分で開け閉めするので、消える動きを付けられる）
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const t = messages.useT();
  // 読み込みに失敗したアバター（キャラクターごとに別なので、URLで覚える）
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const wasActiveRef = useRef(false);
  const responseRef = useRef<HTMLParagraphElement>(null);

  const state = snapshot?.state ?? "idle";
  const active = ACTIVE_VOICE_STATES.includes(state);
  const hasResponse = Boolean(snapshot?.response);

  const close = () => {
    clearTimeout(closeTimerRef.current);
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, motionMs("base"));
  };
  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  useEffect(() => {
    if (active) {
      clearTimeout(closeTimerRef.current);
      setClosing(false);
      wasActiveRef.current = true;
      setVisible(true);
      return;
    }
    // 画面を開いた時点で終わっていたやり取りは出さない。この画面で見ていたやり取りの余韻だけ残す
    const lingerMs = state === "error" ? ERROR_LINGER_MS : hasResponse ? RESPONSE_LINGER_MS : 0;
    if (!wasActiveRef.current || lingerMs === 0) {
      wasActiveRef.current = false;
      setVisible(false);
      return;
    }
    wasActiveRef.current = false;
    const timer = setTimeout(close, lingerMs);
    return () => clearTimeout(timer);
  }, [active, state, hasResponse, snapshot?.turnId]);

  // 長い返答は流れてくるのに合わせて末尾を追う
  useEffect(() => {
    const el = responseRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snapshot?.response]);

  if (!visible || !snapshot) return null;

  const prompt = state === "listening" && !snapshot.transcript ? t("speakNow") : snapshot.transcript;
  const personaName = snapshot.personaName ?? "Claude";
  const status =
    state === "listening" && snapshot.followUp
      ? t("goOn")
      : state === "idle" || state === "speaking"
        ? personaName
        : STATUS_LABELS[state]
          ? t(STATUS_LABELS[state]!)
          : "";

  return (
    <div
      className={`voice-overlay${closing ? " voice-overlay--closing" : ""}`}
      data-state={state}
      onClick={() => !active && close()}
    >
      <section
        className="voice-panel"
        role="status"
        aria-live="polite"
        aria-label={t("voiceAssistant")}
        onClick={(event) => event.stopPropagation()}
      >
        {avatarUrl && avatarUrl !== failedAvatarUrl ? (
          <div className="voice-figure">
            <Suspense fallback={null}>
              <VoiceAvatar
                modelUrl={avatarUrl}
                rig={avatarRig ?? undefined}
                state={state}
                socket={socket}
                onError={(err) => {
                  console.error("failed to load avatar", err);
                  setFailedAvatarUrl(avatarUrl);
                }}
              />
            </Suspense>
            <VoiceOrb state={state} badge />
          </div>
        ) : (
          <VoiceOrb state={state} />
        )}
        <div className="voice-panel__body">
          <p className="voice-panel__status">{status}</p>
          {prompt && <p className="voice-panel__transcript">{prompt}</p>}
          {state === "error" && snapshot.error && <p className="voice-panel__error">{snapshot.error}</p>}
          {/* 返答の途中の文は改行から始まることがあるので、前後の改行を落として出す（上に余白が出ないように） */}
          {snapshot.response?.trim() && (
            <p ref={responseRef} className="voice-panel__response">
              {snapshot.response.trim()}
            </p>
          )}
        </div>
        <button
          type="button"
          className="voice-panel__close"
          aria-label={active ? t("cancel") : t("close")}
          onClick={() => {
            if (active) onCancel();
            setVisible(false);
          }}
        >
          <Icon name="dismiss" />
        </button>
      </section>
    </div>
  );
}
