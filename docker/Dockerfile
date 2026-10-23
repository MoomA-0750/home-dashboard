# syntax=docker/dockerfile:1

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ランタイムイメージ。pnpm workspaceのシンボリックリンク構造を保つため、
# ビルド成果物と依存関係一式（node_modules）をディレクトリ構成ごとコピーする。
# （サーバー単体の依存だけを絞り込む最適化はまだ行っていない。イメージサイズが問題になったら見直す）
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

# gitリポジトリ状況ウィジェットが `git status` / `git log` を実行するため
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/dist ./apps/web/dist
# 本体に入っている拡張機能（Spotify・Home Assistant など）。サーバーはそれぞれの dist/ を読む
COPY --from=build /app/extensions ./extensions

# config/ は実行時にマウントする（イメージには入れない。.dockerignore）
RUN mkdir -p /app/data /app/config

EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]
