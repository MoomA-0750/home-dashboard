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

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/config ./config

RUN mkdir -p /app/data

EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]
