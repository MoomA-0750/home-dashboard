/**
 * 外のサービス（Google・Microsoft・IMAP・CalDAV）から読んだものを覚えておく入れ物。
 * - fresh の間は覚えたものをそのまま返す
 * - stale の間は、覚えたものを先に返して、裏で読み直す（画面を待たせない）
 * - それより古いか、まだ無ければ、読んで返す
 * 同じキーの読みは1本にまとめる（何台もの端末のウィジェットが同時に読んでも、外へは1回）。
 * 書いたら、そのアカウントのものを forget で捨てる
 */

interface Entry {
  value?: unknown;
  at: number;
  loading?: Promise<unknown>;
}

const MAX_ENTRIES = 600;

export class SwrCache {
  private entries = new Map<string, Entry>();

  async get<T>(key: string, ttl: { fresh: number; stale: number }, load: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    const age = entry && "value" in entry ? Date.now() - entry.at : Infinity;
    if (entry && age < ttl.fresh) return entry.value as T;
    if (entry && age < ttl.stale) {
      // 裏で読み直す。失敗したら、次にまた試す（古いものはそのまま）
      if (!entry.loading) void this.refresh(key, entry, load).catch(() => undefined);
      return entry.value as T;
    }
    const current = entry ?? { at: 0 };
    return (current.loading as Promise<T> | undefined) ?? this.refresh(key, current, load);
  }

  private refresh<T>(key: string, entry: Entry, load: () => Promise<T>): Promise<T> {
    const loading = load().then(
      (value) => {
        // 読んでいる間に捨てられた（書いた）なら、古い読みの結果は覚えない
        if (this.entries.get(key) === entry) {
          entry.value = value;
          entry.at = Date.now();
          entry.loading = undefined;
          // 新しく使ったものを後ろへ（多すぎたら、長く使っていないものから捨てる）
          this.entries.delete(key);
          this.entries.set(key, entry);
        }
        return value;
      },
      (err) => {
        if (this.entries.get(key) === entry) {
          entry.loading = undefined;
          if (!("value" in entry)) this.entries.delete(key);
        }
        throw err;
      },
    );
    entry.loading = loading;
    this.entries.set(key, entry);
    while (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
    return loading;
  }

  /** prefix で始まるものを捨てる（そのアカウントに書いたとき） */
  forget(prefix: string): void {
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.entries.delete(key);
  }
}

const MINUTE = 60_000;

/** 覚えておく長さ。stale を長めにして、開き直したときはすぐ出し、裏で新しくする */
export const TTL = {
  unread: { fresh: 30_000, stale: 30 * MINUTE },
  messages: { fresh: 30_000, stale: 30 * MINUTE },
  message: { fresh: 10 * MINUTE, stale: 60 * MINUTE },
  folders: { fresh: 10 * MINUTE, stale: 24 * 60 * MINUTE },
  calendars: { fresh: 5 * MINUTE, stale: 24 * 60 * MINUTE },
  events: { fresh: MINUTE, stale: 30 * MINUTE },
};
