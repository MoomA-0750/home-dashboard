import { usePolledResource } from "./usePolledResource";

export interface PollingResult<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

/**
 * サーバーAPIを一定間隔でポーリングするための共通フック。
 * 各ウィジェットはこれを使うことでポーリング/クリーンアップの実装を重複させずに済む
 * （画面が隠れている間は止まる。手で読み直したいときは usePolledResource）。
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, enabled = true): PollingResult<T> {
  const { data, error, loading } = usePolledResource(fetcher, intervalMs, enabled);
  return { data, error, loading };
}
