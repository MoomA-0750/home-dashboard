import { useEffect } from "react";

/**
 * スナックバー（画面の下に少しのあいだ出て消える知らせ）を出す。操作の結果（「1通をゴミ箱へ移しました」）や、操作の失敗を伝える。
 * 画面の中に置く知らせ（ScreenNotice）と違い、読み終えたら消えるので、出しっぱなしにならない。
 * 続けて出すと、新しいものに入れ替わる（積み上げない）
 */
export interface SnackbarMessage {
  text: string;
  /** 失敗を伝える（少し長く出す） */
  tone?: "error";
}

const EVENT = "home-dashboard:snackbar";

export function showSnackbar(message: SnackbarMessage | string): void {
  const detail: SnackbarMessage = typeof message === "string" ? { text: message } : message;
  window.dispatchEvent(new CustomEvent<SnackbarMessage>(EVENT, { detail }));
}

/** 本体が受け取る（画面の下に出す） */
export function useSnackbars(listener: (message: SnackbarMessage) => void): void {
  useEffect(() => {
    const onShow = (event: Event) => listener((event as CustomEvent<SnackbarMessage>).detail);
    window.addEventListener(EVENT, onShow);
    return () => window.removeEventListener(EVENT, onShow);
  }, [listener]);
}
