import { useCallback, useEffect, useRef, useState } from "react";
import { cx, defineMessages, Icon, IconButton, motionMs, useSnackbars, type SnackbarMessage } from "@home-dashboard/widget-sdk";

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
    // 画面の下の中央（サイドバーの右の幅の中）。スマホではタブバーの上
    <div className="pointer-events-none fixed right-0 bottom-8 left-(--sidebar-width) layer-snackbar flex justify-center px-4 phone:left-0 phone:above-tabbar">
      <div
        key={shown.id}
        className={cx(
          "glass pointer-events-auto flex max-w-140 min-h-12 items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-4 text-label leading-normal text-text",
          "animate-enter closing:animate-exit closing:pointer-events-none",
          shown.tone === "error" && "border-danger/45",
          shown.closing && "is-closing",
        )}
        role={shown.tone === "error" ? "alert" : "status"}
        onPointerEnter={hold}
        onPointerLeave={release}
      >
        {shown.tone === "error" && <Icon name="warning" className="shrink-0 text-danger" />}
        <span className="min-w-0 untrim wrap-anywhere">{shown.text}</span>
        <IconButton icon="dismiss" label={t("close")} onClick={() => close(shown.id)} />
      </div>
    </div>
  );
}
