import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * 読み直してよいか。本体は、ホームを隠している間（Media・設定などを開いている間）はウィジェットに false を渡す。
 * false の間は読まず、true に戻ったらすぐ読み直す
 */
export const PollingActiveContext = createContext(true);

// cacheKey ごとの、最後に取れた値
const lastValues = new Map<string, unknown>();

/**
 * 一定間隔で読み直し、操作の直後などには手で読み直せる取得フック（ウィジェットの usePolling もこれを使う）。
 * - 画面が隠れている間（別のタブ・スマホの画面が消えている）と、ウィジェットのあるホームが隠れている間は読まず、見えたらすぐ読み直す
 * - 前の返事を待ってから次を数える（相手が遅いときに、返事を待つ取得が積み上がらない）
 * - cacheKey を渡すと、最後に取れた値を覚えておき、画面を開き直したときはそれを先に出す（「読み込み中」を挟まない）。
 *   覚えるのはページを開いている間だけ。キーは拡張機能の id で始める（例: "weather:screen"）
 */
export function usePolledResource<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
  options: { cacheKey?: string } = {},
) {
  const { cacheKey } = options;
  const active = useContext(PollingActiveContext);
  const [data, setData] = useState<T | null>(() => (cacheKey ? ((lastValues.get(cacheKey) as T | undefined) ?? null) : null));
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestRef = useRef(0);
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const result = await fetcherRef.current();
      // 後から出した読み直しの結果を、先に出した遅い結果で上書きしない
      if (request !== requestRef.current) return;
      if (cacheKeyRef.current) lastValues.set(cacheKeyRef.current, result);
      setData(result);
      setError(null);
    } catch (err) {
      if (request === requestRef.current) setError(err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

    // 読んでいる最中に画面が見えても、2本目の読み直しの流れを作らない
    let running = false;
    const loop = async () => {
      clearTimeout(timer);
      if (stopped || running || hidden()) return;
      running = true;
      try {
        await refresh();
      } finally {
        running = false;
      }
      if (!stopped && !hidden()) timer = setTimeout(loop, intervalMs);
    };
    const onVisibility = () => {
      if (!hidden()) void loop();
    };

    void loop();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, active, intervalMs, refresh]);

  return { data, error, loading: data === null && error === null, refresh };
}
