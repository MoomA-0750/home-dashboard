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
    ha-controls/       Home Assistantの家電操作（照明・スイッチ・鍵・エアコン）
    ha-climate/        Home Assistantの室温・湿度
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

Spotifyは2023年の仕様変更でRedirect URIに `https://` か、リテラルの `127.0.0.1`（`localhost` は不可）
以外を許可しなくなった。サーバーをgco等のリモートホストで動かす場合、初回の認可操作のときだけ
SSHポートフォワードでローカルの `127.0.0.1` 経由にするのが手軽（refresh tokenさえ取れれば以降は不要）。

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) でアプリを作成し、
   Redirect URIに `http://127.0.0.1:8787/auth/spotify/callback` を登録
   （`apps/server/.env` の `SPOTIFY_REDIRECT_URI` と同じ値にする）
2. `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` を設定してサーバーを起動
3. 手元のマシンから `ssh -L 8787:localhost:8787 gco` 等でポートフォワードしてトンネルを開く
4. 手元のブラウザで `http://127.0.0.1:8787/auth/spotify/login` を開いて認可
5. コールバック画面に表示されたrefresh tokenを `SPOTIFY_REFRESH_TOKEN` に設定し、サーバーを再起動

未設定の間、Spotifyウィジェットは「Spotify未接続」と表示される。

常時HTTPS経由でアクセスしたい場合はTailscaleのHTTPS機能（`tailscale cert` + `tailscale serve`）で
`https://general-console.<tailnet>.ts.net` のようなURLを払い出し、それをRedirect URIにする方法もある
（ダッシュボード自体を他デバイスから常用アクセスする際にも流用できるが、別途Tailscale管理画面での
HTTPS有効化が必要）。

## Home Assistant連携のセットアップ

1. HAの「プロフィール → セキュリティ → 長期アクセストークン」でトークンを発行
2. `apps/server/.env` に設定

   ```
   HOMEASSISTANT_URL=http://<HAのIP>:8123
   HOMEASSISTANT_TOKEN=<発行したトークン>
   ```

3. サーバーを再起動すると、`light` / `switch` / `lock` / `climate` のエンティティと、
   `device_class` が `temperature` / `humidity` のセンサーが**自動検出**されてウィジェットに並ぶ

表示するエンティティや順序を明示したい場合は、`config/homeassistant.example.json` を
`config/homeassistant.json` にコピーして編集する（省略時は自動検出）。

### セキュリティ上の設計

このダッシュボードは**LAN上に認証なしで公開される**前提なので、HA連携には2つの制限を入れている。

- **サービス呼び出しはホワイトリスト制**: サーバーはHAのトークンを持つため無制限に中継すると
  事実上HAの全機能を認証なしで公開することになる。`light`/`switch`/`lock`/`climate` の
  必要なサービスだけを許可している（`apps/server/src/routes/homeassistant.ts` の `ALLOWED_SERVICES`）
- **解錠は既定で無効**: 玄関の物理錠を想定し、`lock.unlock` は既定で拒否する（状態表示と施錠のみ）。
  有効にするには `HOMEASSISTANT_ALLOW_UNLOCK=true` を設定する。**LANに入れる誰でも解錠できるようになる**点に注意

トークンはサーバー内に留まり、フロントエンドには一切渡らない（ブラウザは自サーバーのAPIだけを叩く）。

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

実装済み: 基盤（ウィジェットプラグイン機構・キャンバス・Docker配布）＋ウィジェット6種
（時計・天気・Spotify・ホームラボ死活監視・HA家電操作・HA室温湿度）。

未着手:

- **1920x540の横長パネル向けレイアウト最適化**（現状はウィジェットが縦に並び、LD290EJSの画面に収まらない）
- 時間帯・再生状況等に応じたウィジェットの自動出現/レイアウト変更
- ウェイクワード検知＋Claude Codeセッション起動によるスマートディスプレイ的な対話
- ccusage / tailscale / gitリポジトリ状況 / iMessage・メール等の追加ウィジェット
- キャンバス上でのウィジェット設定編集UI（現状は`defaultConfig`とサーバー側の設定ファイルのみ）
