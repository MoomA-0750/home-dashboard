import { useEffect, useRef, useState } from "react";

export interface PollingResult<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

/**
 * サーバーAPIを一定間隔でポーリングするための共通フック。
 * 各ウィジェットはこれを使うことでポーリング/クリーンアップの実装を重複させずに済む。
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { data, error, loading };
}
