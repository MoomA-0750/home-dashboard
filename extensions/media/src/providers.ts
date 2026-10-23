import { useCallback, useEffect, useMemo, useState } from "react";
import { textFor, useFeatureProviders, useLocale } from "@home-dashboard/widget-sdk";

/**
 * Media 画面とメディアのウィジェットが共有する「どの音楽アプリを見るか」。
 * 選べる音楽アプリは、機能の口「music」に入っている拡張機能（本体が渡す）。選んだものは端末ごとに覚える。
 * 画面で選び直すと、同じ端末のウィジェットもすぐ切り替わる（同じタブの中は知らせ、ほかのタブは storage で気づく）。
 */

export interface MediaProviderOption {
  extensionId: string;
  name: string;
}

const PROVIDER_STORAGE_KEY = "home-dashboard:media-provider";
const CHANGE_EVENT = "home-dashboard:media-provider-changed";

function readStoredProvider(): string | null {
  try {
    return localStorage.getItem(PROVIDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 選んでいる音楽アプリと、選び直す関数。選んだものが無くなっていれば（切った拡張機能など）先頭のものを使う */
export function useSelectedMusicProvider(
  providers: MediaProviderOption[],
): [MediaProviderOption | null, (extensionId: string) => void] {
  const [selected, setSelected] = useState<string | null>(readStoredProvider);

  useEffect(() => {
    const sync = () => setSelected(readStoredProvider());
    const onStorage = (event: StorageEvent) => event.key === PROVIDER_STORAGE_KEY && sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const choose = useCallback((extensionId: string) => {
    setSelected(extensionId);
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, extensionId);
    } catch {
      // 覚えられなくても、選んだものはこの表示のあいだ使える
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [providers.find((p) => p.extensionId === selected) ?? providers[0] ?? null, choose];
}

/** 選べる音楽アプリの一覧（機能の口「music」に入っている拡張機能） */
export function useMusicProviders(): MediaProviderOption[] {
  const locale = useLocale();
  const providers = useFeatureProviders("music");
  return useMemo(() => providers.map((p) => ({ ...p, name: textFor(p.name, locale) })), [providers, locale]);
}
