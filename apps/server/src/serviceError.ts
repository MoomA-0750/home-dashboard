/**
 * HTTPのルートとMCPのツール（routes/mcp.ts）の両方から呼ぶ処理が投げるエラー。
 * ルート側はこのステータスコードでそのまま返し、ツール側は message をClaudeに見せる。
 * en を渡すと、英語の画面（Cookie の hd_locale=en）には英語の理由を返す（messageFor）
 */
export class ServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly en?: string,
  ) {
    super(message);
  }

  /** 画面の言語での理由 */
  messageFor(locale: "ja" | "en"): string {
    return locale === "en" && this.en ? this.en : this.message;
  }
}
