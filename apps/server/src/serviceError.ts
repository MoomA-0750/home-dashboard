/**
 * HTTPのルートとMCPのツール（routes/mcp.ts）の両方から呼ぶ処理が投げるエラー。
 * ルート側はこのステータスコードでそのまま返し、ツール側は message をClaudeに見せる。
 */
export class ServiceError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
