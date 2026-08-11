# home-dashboard

サーバーが配信するホームダッシュボードUI。壁掛け・据え置き端末（LD290EJS等の非力な端末を想定）は
Webブラウザでこのダッシュボードを表示するだけの「シンクライアント」とし、状態やロジックはサーバー側に持たせる構成。

複数端末から同じサーバーにアクセスして使うことを想定しており、レイアウト変更はWebSocket経由で
他の接続中クライアントにもリアルタイムに反映される。

## 構成

pnpm workspaceによるモノレポ。

```
apps/
  web/      React + Vite製のキャンバス（フロントエンド）
  server/   Fastify製のAPIサーバー（レイアウト永続化・外部サービス連携・静的配信）
packages/
  widget-sdk/       ウィジェットを実装するための型定義・共通フック
  widgets/
    clock/            時計
    weather/           天気（Open-Meteo、APIキー不要）
    spotify-media/     Spotify再生中トラック表示・操作
    homelab-status/    ホームラボのホスト死活監視
config/     homelab-hosts.json などランタイム設定（Gitには含まれない値を置く）
data/       レイアウト等の永続化データ（Gitには含まれない）
docker/     Dockerfile
```

## セットアップ（開発）

```bash
pnpm install
cp apps/server/.env.example apps/server/.env   # 天気の地点・Spotify連携などを設定
cp config/homelab-hosts.example.json config/homelab-hosts.json  # 監視したいホストを追記

pnpm dev:server   # http://localhost:8787
pnpm dev:web      # http://localhost:5173 (APIは8787にプロキシ)
```

## ビルド

```bash
pnpm build   # apps/web と apps/server の両方をビルド
```

## Docker

```bash
cp apps/server/.env.example apps/server/.env
cp config/homelab-hosts.example.json config/homelab-hosts.json
docker compose up -d --build
```

単一コンテナがビルド済みのフロントエンド静的ファイルとAPIサーバーの両方を配信する
（`http://<host>:8787` を開けばダッシュボードが表示される）。

`data/`・`config/` はホスト側にボリュームマウントされるので、レイアウトやホスト一覧はコンテナを
再作成しても保持される。

> 注: この開発環境にはDockerデーモンがなく、実際の `docker build`/`docker compose up` の
> 動作確認はできていない。初回はデプロイ先（`gco`）で `docker compose up -d --build` を実行し、
> 問題があれば都度修正する想定。

## Spotify連携のセットアップ

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) でアプリを作成
2. Redirect URI に `apps/server/.env` の `SPOTIFY_REDIRECT_URI` と同じ値を登録
3. `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` を設定してサーバーを起動
4. ブラウザで `http://<server>:8787/auth/spotify/login` を開いて認可
5. コールバック画面に表示されたrefresh tokenを `SPOTIFY_REFRESH_TOKEN` に設定し、サーバーを再起動

未設定の間、Spotifyウィジェットは「Spotify未接続」と表示される。

## ウィジェットの追加方法

各ウィジェットは `packages/widgets/<name>` に1つの独立したパッケージとして実装する。

1. `packages/widgets/<name>/` を作成し、既存のウィジェット（例: `clock`）の `package.json` / `tsconfig.json` を
   コピーしてパッケージ名を変更する
2. `src/index.tsx` で `@home-dashboard/widget-sdk` の `defineWidget()` を使ってウィジェットを定義する

   ```tsx
   import { defineWidget, type WidgetProps } from "@home-dashboard/widget-sdk";

   interface MyConfig { /* ウィジェット固有の設定 */ }

   function MyWidgetView({ config, ctx, openDetail }: WidgetProps<MyConfig>) {
     return <div className="widget-card">...</div>;
   }

   export default defineWidget<MyConfig>({
     id: "my-widget",
     name: "マイウィジェット",
     defaultSize: { w: 3, h: 2 },
     defaultConfig: {},
     Component: MyWidgetView,
     // 詳細ビューが必要な場合は DetailComponent も渡す
   });
   ```

   - サーバーAPIを呼ぶ場合は `usePolling(fetcher, intervalMs)`（widget-sdk提供）でポーリングする
   - 見た目は `widget-card` クラス（`apps/web/src/styles/theme.css` で定義されたガラス調カード）に
     揃えると他のウィジェットとトーンが統一される
   - 詳細ビューを持たせたい場合は `DetailComponent` を実装する。`widget-detail` クラスがベーススタイル

3. `apps/web/package.json` の `dependencies` に新パッケージを追加し、
   `apps/web/src/widgets.ts` で `widgetRegistry.register(...)` する

これでキャンバスの「ウィジェットを追加」パネルに表示され、配置できるようになる。

## ロードマップ

現在の実装は基盤（ウィジェットプラグイン機構・キャンバス・Docker配布）＋基本ウィジェット4種まで。
Inboxのメモにあった以下は未着手:

- 時間帯・再生状況等に応じたウィジェットの自動出現/レイアウト変更
- Home Assistant連携（家電操作・室温湿度）
- ウェイクワード検知＋Claude Codeセッション起動によるスマートディスプレイ的な対話
- ccusage / tailscale / gitリポジトリ状況 / iMessage・メール等の追加ウィジェット
