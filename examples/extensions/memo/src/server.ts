import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineServerExtension, HttpError } from "@home-dashboard/extension-sdk";

/**
 * 伝言メモの拡張機能のサーバー側（拡張機能の作り方の見本）。
 * - api.dataDir にメモを置く（この拡張機能だけが使う置き場。消しても残る）
 * - api.route で /api/ext/memo/memo を受ける（ログインが要る）
 * - api.broadcast で、メモが変わったことをつないでいるすべての画面に知らせる
 * - api.tool で、音声アシスタント（Claude）にメモを読む・書く道具を渡す
 */

const MAX_LENGTH = 500;

interface Memo {
  text: string;
  author: string | null;
  updatedAt: string | null;
}

export default defineServerExtension({
  register(api) {
    const path = join(api.dataDir, "memo.json");

    const read = async (): Promise<Memo> => {
      try {
        return JSON.parse(await readFile(path, "utf-8")) as Memo;
      } catch {
        return { text: "", author: null, updatedAt: null };
      }
    };

    const write = async (text: unknown, author: string | null): Promise<Memo> => {
      if (typeof text !== "string") throw new HttpError(400, "text は文字で送ってください");
      if (text.length > MAX_LENGTH) throw new HttpError(400, `メモは${MAX_LENGTH}文字までです`);
      const memo: Memo = { text: text.trim(), author, updatedAt: new Date().toISOString() };
      await mkdir(api.dataDir, { recursive: true });
      await writeFile(`${path}.tmp`, JSON.stringify(memo), "utf-8");
      await rename(`${path}.tmp`, path);
      api.broadcast("changed", memo);
      return memo;
    };

    api.route("GET", "/memo", async () => ({ title: String(api.settings.title), memo: await read() }));
    api.route("PUT", "/memo", async ({ body, account }) =>
      write((body as { text?: unknown } | null)?.text, account?.username ?? null),
    );

    api.tool({
      name: "read_memo",
      description: "家族への伝言メモ（ダッシュボードに出ているもの）を読む。",
      readOnly: true,
      handler: () => read(),
    });
    api.tool({
      name: "write_memo",
      description: "家族への伝言メモを書き換える（前のメモは消える）。空にすると消す。",
      inputSchema: (z) => ({ text: z.string().max(MAX_LENGTH).describe("メモの本文") }),
      handler: ({ text }) => write(text, "音声アシスタント"),
    });
  },
});
