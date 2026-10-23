import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 画面側で覚えておく入れ物（ページを開いている間だけ）。開き直したとき・フォルダーや月を戻したときは覚えたものをすぐ出し、
 * 裏で読み直して新しくする。同じキーの読みは1本にまとめ、先読み（prefetch）した結果もそのまま使う。
 * キーは「mail:」「calendar:」で始める
 */

const values = new Map<string, { value: unknown; at: number }>();
const loading = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 300;

export function peekCached<T>(key: string): T | undefined {
  return values.get(key)?.value as T | undefined;
}

/** 読んで覚える。maxAgeMs より新しく覚えていれば、読まずにそれを返す */
export function fetchCached<T>(key: string, load: () => Promise<T>, maxAgeMs = 0): Promise<T> {
  const hit = values.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return Promise.resolve(hit.value as T);
  const running = loading.get(key);
  if (running) return running as Promise<T>;
  const task = load().then(
    (value) => {
      values.delete(key);
      values.set(key, { value, at: Date.now() });
      while (values.size > MAX_ENTRIES) values.delete(values.keys().next().value!);
      return value;
    },
  );
  loading.set(key, task);
  void task.finally(() => loading.delete(key)).catch(() => undefined);
  return task;
}

/** prefix で始まるものを捨てる（書いたあと、古い一覧を出さない） */
export function forgetCached(prefix: string): void {
  for (const key of [...values.keys()]) if (key.startsWith(prefix)) values.delete(key);
}

/** 先読み。失敗しても何もしない */
export function prefetch<T>(key: string, load: () => Promise<T>, maxAgeMs = 60_000): void {
  void fetchCached(key, load, maxAgeMs).catch(() => undefined);
}

/**
 * key のものを読む。覚えていればすぐ出し、裏で読み直す。key が null なら読まない。
 * refreshMs ごとに読み直す（画面が隠れている間は読まない）
 */
export function useCached<T>(key: string | null, load: () => Promise<T>, refreshMs?: number) {
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: string | null }>(() => ({
    key,
    data: key ? peekCached<T>(key) : undefined,
    error: null,
  }));
  const loadRef = useRef(load);
  loadRef.current = load;

  // キーが変わったら、そのキーで覚えているものにすぐ切り替える（無ければ「読み込み中」）
  let current = state;
  if (state.key !== key) {
    current = { key, data: key ? peekCached<T>(key) : undefined, error: null };
    setState(current);
  }

  const reload = useCallback(async () => {
    if (!key) return;
    try {
      const data = await fetchCached(key, () => loadRef.current());
      setState((s) => (s.key === key ? { key, data, error: null } : s));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setState((s) => (s.key === key ? { ...s, error } : s));
    }
  }, [key]);

  useEffect(() => {
    void reload();
    if (!refreshMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [reload, refreshMs]);

  return { data: current.data, error: current.error, reload };
}
