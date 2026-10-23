import { createHash, timingSafeEqual } from "node:crypto";
import { defineServerExtension } from "@home-dashboard/extension-sdk";
import { getClaudeUsage, setProjectsDir } from "./usage";
import { getClaudeLimits, recordStatusLine, setLimitsDataDir } from "./limits";

/** 合言葉どうしを、長さや中身で返事の速さが変わらないように比べる */
function sameToken(given: string | null, expected: string): boolean {
  if (!given || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** Claude の拡張機能のサーバー側。Claude Code の使用量（セッションログ）と、5時間・週の利用制限（statusLine） */
export default defineServerExtension({
  register(api) {
    setLimitsDataDir(api.dataDir);
    const syncDir = () => setProjectsDir(String(api.settings.projectsDir));
    syncDir();
    api.onSettingsChange(syncDir);

    api.route("GET", "/usage", (ctx) => getClaudeUsage(ctx.locale));
    api.route("GET", "/limits", () => getClaudeLimits());
    // statusLine から送る（ログインの無いホストのプログラムから）。届く人が誰でも書き込めないよう、
    // スクリプトに持たせた合言葉（CLAUDE_LIMITS_TOKEN）を Bearer で添えたときだけ受け付ける。読むのはログインが要る
    api.route(
      "POST",
      "/limits",
      ({ body, bearer }) => {
        if (!sameToken(bearer, String(api.settings.reportToken ?? ""))) throw api.error(401, "合言葉が違います");
        return recordStatusLine(body);
      },
      { public: true },
    );
  },
});
