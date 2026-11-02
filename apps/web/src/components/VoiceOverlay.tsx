import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { cx, defineMessages, IconButton, motionMs } from "@home-dashboard/widget-sdk";
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
    <div className="voice-orb" data-state={state} data-badge={badge || undefined} aria-hidden="true">
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
      className={cx(
        "voice-backdrop fixed inset-0 layer-voice flex items-center justify-center p-8",
        "animate-fade closing:animate-fade-out closing:pointer-events-none",
        closing && "is-closing",
      )}
      data-state={state}
      onClick={() => !active && close()}
    >
      <section
        className="glass relative flex w-full max-w-275 max-h-full items-center gap-10 overflow-hidden rounded-card py-10 pr-22 pl-10 animate-pop tablet:flex-col tablet:items-start tablet:gap-6 tablet:p-8"
        role="status"
        aria-live="polite"
        aria-label={t("voiceAssistant")}
        onClick={(event) => event.stopPropagation()}
      >
        {avatarUrl && avatarUrl !== failedAvatarUrl ? (
          // パネルの下端から生えているように見せる（下はパネルの縁まで伸ばす）
          <div className="relative -mb-10 -ml-2.5 min-h-75 w-62 shrink-0 self-stretch tablet:-mt-8 tablet:mb-0 tablet:min-h-47 tablet:w-37">
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
        <div className="voice-body flex min-w-0 flex-col gap-4.5">
          <p className="text-voice-accent text-title font-semibold">{status}</p>
          {prompt && <p className="text-heading leading-normal text-muted untrim">{prompt}</p>}
          {state === "error" && snapshot.error && <p className="text-title text-muted">{snapshot.error}</p>}
          {/* 返答の途中の文は改行から始まることがあるので、前後の改行を落として出す（上に余白が出ないように） */}
          {snapshot.response?.trim() && (
            // 対応するブラウザでは文節の途中で改行しない
            <p ref={responseRef} className="min-h-0 overflow-y-auto text-card leading-normal whitespace-pre-line untrim break-phrase tablet:text-heading">
              {snapshot.response.trim()}
            </p>
          )}
        </div>
        <IconButton
          icon="dismiss"
          className="absolute top-8 right-8"
          label={active ? t("cancel") : t("close")}
          onClick={() => {
            if (active) onCancel();
            setVisible(false);
          }}
        />
      </section>
    </div>
  );
}
