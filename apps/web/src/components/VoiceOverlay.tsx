import { useEffect, useRef, useState } from "react";
import { ACTIVE_VOICE_STATES, type VoiceSnapshot, type VoiceState } from "../lib/useVoiceAssistant";
import { Icon } from "./Icon";

/** 返答し終えてから、返答を画面に残しておく時間 */
const RESPONSE_LINGER_MS = 15_000;
const ERROR_LINGER_MS = 6_000;

const STATUS_LABELS: Record<VoiceState, string> = {
  idle: "Claude",
  listening: "聞いています",
  transcribing: "聞き取っています",
  thinking: "考えています",
  speaking: "Claude",
  error: "うまくいきませんでした",
};

interface VoiceOverlayProps {
  snapshot: VoiceSnapshot | null;
  onCancel: () => void;
}

/**
 * ウェイクワードを聞いてから返答し終えるまで、画面の手前に出すパネル。
 * 読み上げが終わったあともしばらく返答を残し、タップするか時間が経つと消える。
 */
export function VoiceOverlay({ snapshot, onCancel }: VoiceOverlayProps) {
  const [visible, setVisible] = useState(false);
  const wasActiveRef = useRef(false);
  const responseRef = useRef<HTMLParagraphElement>(null);

  const state = snapshot?.state ?? "idle";
  const active = ACTIVE_VOICE_STATES.includes(state);
  const hasResponse = Boolean(snapshot?.response);

  useEffect(() => {
    if (active) {
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
    const timer = setTimeout(() => setVisible(false), lingerMs);
    return () => clearTimeout(timer);
  }, [active, state, hasResponse, snapshot?.turnId]);

  // 長い返答は流れてくるのに合わせて末尾を追う
  useEffect(() => {
    const el = responseRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snapshot?.response]);

  if (!visible || !snapshot) return null;

  const prompt =
    state === "listening" && !snapshot.transcript ? "どうぞ、話しかけてください" : snapshot.transcript;
  const status = state === "listening" && snapshot.followUp ? "続けてどうぞ" : STATUS_LABELS[state];

  return (
    <div className="voice-overlay" data-state={state} onClick={() => !active && setVisible(false)}>
      <section
        className="voice-panel"
        role="status"
        aria-live="polite"
        aria-label="音声アシスタント"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="voice-orb" data-state={state} aria-hidden="true">
          <Icon name="mic" />
        </div>
        <div className="voice-panel__body">
          <p className="voice-panel__status">{status}</p>
          {prompt && <p className="voice-panel__transcript">{prompt}</p>}
          {state === "error" && snapshot.error && <p className="voice-panel__error">{snapshot.error}</p>}
          {snapshot.response && (
            <p ref={responseRef} className="voice-panel__response">
              {snapshot.response}
            </p>
          )}
        </div>
        <button
          type="button"
          className="voice-panel__close"
          aria-label={active ? "中止" : "閉じる"}
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
