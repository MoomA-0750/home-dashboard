import { useState } from "react";

/** Chat 画面で選んでいるチャットアプリ。音声アシスタントは ASSISTANT_CHAT、ほかは入っている拡張機能の id */
export const ASSISTANT_CHAT = "assistant";

const STORAGE_KEY = "home-dashboard:chat-app";

function readChatApp(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ASSISTANT_CHAT;
  } catch {
    return ASSISTANT_CHAT;
  }
}

/** 端末ごとに覚える（壁の端末は音声アシスタント、スマホは iMessage、など） */
export function useChatApp(): [string, (id: string) => void] {
  const [chatApp, setChatApp] = useState(readChatApp);
  const update = (id: string) => {
    setChatApp(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // 保存できなくてもこの表示中は反映される
    }
  };
  return [chatApp, update];
}
