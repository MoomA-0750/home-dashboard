import { useCallback, useEffect, useRef, useState } from "react";
import { defineMessages, Icon, motionMs, useSnackbars, type SnackbarMessage } from "@home-dashboard/widget-sdk";

/**
 * スナックバーを出す場所（画面の下の中央。スマホではタブバーの上）。拡張機能や本体の showSnackbar で出し、
 * 少しのあいだで消える（失敗は少し長く）。×で閉じられる。指を乗せている間（マウスなら上にある間）は消さない。
 * 続けて出すと入れ替える
 */

const messages = defineMessages({
  ja: { close: "閉じる" },
  en: { close: "Close" },
});

const SHOW_MS = 4_000;
const SHOW_ERROR_MS = 7_000;

interface Shown extends SnackbarMessage {
  id: number;
  closing: boolean;
}

export function SnackbarHost() {
  const t = messages.useT();
  const [shown, setShown] = useState<Shown | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);

  const close = useCallback((id: number) => {
    clearTimeout(timer.current);
    setShown((s) => (s && s.id === id ? { ...s, closing: true } : s));
    // 薄くなってから外す
    timer.current = setTimeout(() => setShown((s) => (s && s.id === id ? null : s)), motionMs("base"));
  }, []);

  const schedule = useCallback(
    (item: Shown) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!held.current) close(item.id);
      }, item.tone === "error" ? SHOW_ERROR_MS : SHOW_MS);
    },
    [close],
  );

  useSnackbars(
    useCallback(
      (message: SnackbarMessage) => {
        const item: Shown = { ...message, id: nextId.current++, closing: false };
        setShown(item);
        schedule(item);
      },
      [schedule],
    ),
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!shown) return null;
  const hold = () => {
    held.current = true;
    clearTimeout(timer.current);
  };
  const release = () => {
    held.current = false;
    if (!shown.closing) schedule(shown);
  };
  return (
    <div className="snackbar-area">
      <div
        key={shown.id}
        className={`snackbar${shown.tone === "error" ? " snackbar--error" : ""}${shown.closing ? " snackbar--closing" : ""}`}
        role={shown.tone === "error" ? "alert" : "status"}
        onPointerEnter={hold}
        onPointerLeave={release}
      >
        {shown.tone === "error" && <Icon name="warning" className="snackbar__icon" />}
        <span className="snackbar__text">{shown.text}</span>
        <button type="button" className="snackbar__close" aria-label={t("close")} onClick={() => close(shown.id)}>
          <Icon name="dismiss" />
        </button>
      </div>
    </div>
  );
}
