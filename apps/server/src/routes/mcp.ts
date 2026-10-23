import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { agentBearerMatches } from "../agentToken.js";
import { errorStatus } from "../extensions/host.js";
import { dashboardTools, takeGrant } from "../voiceGuard.js";

/**
 * 音声アシスタント（apps/voice-agent が起動する Claude Code）に、ダッシュボードの機能をツールとして渡すMCPサーバー。
 *
 * Claude に Bash や任意のHTTPアクセスを許す代わりに、拡張機能が api.tool で足した操作だけを使わせる
 * （天気・家電・音楽など。切った拡張機能のツールは出さない）。
 * 中身はウィジェット用のAPIと同じ関数なので、Home Assistant のサービスのホワイトリストもそのまま効く。
 *
 * 道具は、実行の前に本体の確かめ（voiceGuard の checkToolUse。音声エージェントが Claude Code の権限の問い合わせを回してくる）を
 * 通ったものだけを動かす。了承・許可が要る操作は、エージェントのトークンだけでは動かせない。
 */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function run(fn: () => unknown): Promise<ToolResult> {
  try {
    const result = await fn();
    return { content: [{ type: "text", text: JSON.stringify(result ?? { ok: true }) }] };
  } catch (err) {
    const message =
      errorStatus(err) !== null
        ? (err as Error).message
        : `failed: ${err instanceof Error ? err.message : String(err)}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

/**
 * ツールの説明が関数のもの（家電の一覧を埋め込むなど）は、ツール一覧を返すときだけ作る（Claudeの起動時に1回だけ）。
 * ツールを呼ぶたびにHAへ問い合わせると、HAが落ちているときに天気などまで遅くなる
 */
async function createServer(listing: boolean): Promise<McpServer> {
  const server = new McpServer({ name: "home-dashboard", version: "0.1.0" });
  for (const { extensionId, definition } of dashboardTools()) {
    let description = "";
    if (typeof definition.description === "string") description = definition.description;
    else if (listing) {
      description = await definition.description().catch((err) => {
        console.error(`[${extensionId ? `ext:${extensionId}` : "core"}] ツール ${definition.name} の説明を作れませんでした:`, err);
        return "";
      });
    }
    server.registerTool(
      definition.name,
      {
        description,
        inputSchema: definition.inputSchema?.(z),
        annotations: definition.readOnly ? { readOnlyHint: true } : undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        const granted = takeGrant(definition.name, args ?? {});
        if (!granted) {
          return {
            content: [{ type: "text" as const, text: "この操作は本体の確かめを通っていないので、実行していません。" }],
            isError: true,
          };
        }
        return run(() => definition.handler(args ?? {}, granted));
      },
    );
  }
  return server;
}

export async function registerMcpRoutes(app: FastifyInstance): Promise<void> {
  // ステートレスで動かす（リクエストごとにサーバーとトランスポートを作る）。
  // 状態はすべて拡張機能の先（HAやSpotify）にあり、こちらでセッションを持つ理由がない
  app.post("/mcp", async (request, reply) => {
    if (!agentBearerMatches(request.headers.authorization)) {
      return reply.code(401).send({ error: "invalid token" });
    }
    const body = request.body as { method?: string } | undefined;
    const server = await createServer(body?.method === "tools/list");
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // ステートレスなのでサーバーからのSSEストリームやセッション終了は受け付けない
  const methodNotAllowed = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.code(405).send({ error: "method not allowed" });
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);
}
