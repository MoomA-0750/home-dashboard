# home-dashboard

サーバーが配信するホームダッシュボードUI。壁掛け・据え置き端末（LD290EJS等の非力な端末を想定）は
Webブラウザでこのダッシュボードを表示するだけの「シンクライアント」とし、状態やロジックはサーバー側に持たせる構成。

複数端末から同じサーバーにアクセスして使うことを想定しており、レイアウト変更はWebSocket経由で
他の接続中クライアントにもリアルタイムに反映される。

## 構成

pnpm workspaceによるモノレポ。

```
apps/
  web/      React + Vite製のフロントエンド（トップ画面・ウィジェットレール）
  server/   Fastify製のAPIサーバー（レイアウト永続化・外部サービス連携・静的配信）
  voice-agent/  Python製の音声アシスタント（ウェイクワード → Claude Code → 読み上げ）。ホスト上で常駐させる
packages/
  widget-sdk/       ウィジェットを実装するための型定義・共通フック
  widgets/
    clock/            時計
    weather/           天気（Open-Meteo、APIキー不要）
    spotify-media/     Spotify再生中トラック表示・操作
    homelab-status/    ホームラボのホスト死活監視
    ha-controls/       Home Assistantの家電操作（照明・スイッチ・鍵・エアコン）
    ha-climate/        Home Assistantの室温・湿度
    claude-usage/      Claude Codeのトークン使用量（ccusage相当）
    tailscale-status/  tailnet内のノード状況
    git-repos/         ローカルgitリポジトリの状況
    mail-inbox/        メール（IMAP）の未読
config/     homelab-hosts.json などランタイム設定（Gitには含まれない値を置く）
data/       レイアウト等の永続化データ（Gitには含まれない）
docker/     Dockerfile
```

`apps/web/public/` にはフロントエンドが参照する静的アセットを置いている。

- `fonts/` — Murecho（OFL）。壁掛けパネルがオフラインでも設計どおりの見た目になるよう同梱している
- `icons/` — Fluent UI System Icons（MIT）。CSSマスクとして読み込むので色は親から継承される
- `background.jpg` — **Gitには含まれない。** 好きな画像をこのパスに置くと背景になり、
  置かなければ `--dash-background-fallback` のグラデーションが使われる

## 画面デザイン

トップ画面は Figma のデザインに沿って実装している。

- Figma: <https://www.figma.com/design/zvNSZcCg8lGyWT4bAwup76/Home-Dashboard?node-id=46-2>
- 寸法の設計図（素のHTML/CSSによる検証用プロトタイプ）: `~/Documents/dash-css`

画面は「余白・時計・余白・ウィジェットレール・余白」の5カラムで、3つの余白が均等に伸縮する。
時刻・天気・日付は画面そのものの構成要素として左側に固定表示され、ウィジェットレールには出さない
（`apps/web/src/components/MainInfo.tsx`）。

ウィジェットは幅650px・高さ200px・角丸45px・内側余白30pxを基本サイズとし、30px間隔で縦に積む。
react-grid-layout を1カラム（`rowHeight=200` / `margin=[0,30]`）で使っているので、
編集モードではドラッグでの並べ替えと高さのリサイズができる。

サイドバーはアイコン5項目で、間のハンドルをドラッグすると80〜240pxの範囲で広がり、
広げるとアイコンの横にラベルが出る（幅は localStorage に保存される）。
Home以外の画面は未実装のため、いまは Settings（ウィジェット追加・編集モード切り替え）だけが開く。

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

## ホスト側の資源を見るウィジェット（Claude Code使用量 / Tailscale / gitリポジトリ）

この3つはホスト上のファイルやソケットを読む。Docker運用時は `docker-compose.yml` が
以下をマウントし、対応する環境変数でコンテナ内のパスを渡す（設定作業は不要）。

| ウィジェット | ホスト側 | コンテナ内 | 環境変数 |
|---|---|---|---|
| Claude Code使用量 | `~/.claude/projects` (ro) | `/host/claude-projects` | `CLAUDE_PROJECTS_DIR` |
| gitリポジトリ | `~/Documents/git-cloned` (ro) | `/host/git-repos` | `GIT_REPOS_DIR` |
| Tailscale | `/var/run/tailscale/tailscaled.sock` | `/host/tailscaled.sock` | `TAILSCALE_SOCKET` |

別の場所を見たい場合は環境変数を変える。ホスト上で直接起動する開発時は、これらの既定値
（上表の「ホスト側」）がそのまま使われるので設定は要らない。

- **Claude Code使用量**: `~/.claude/projects/**/*.jsonl` の `message.usage` を集計する。jsonlは追記のみ
  なのでファイルごとに読み込み位置を覚えて差分だけ読む（全体で200MB近くあるため）。
  **料金は出さない** — モデル単価をこちら側に持つと実際の請求と乖離した数字を表示することになるので、
  トークン数と、サブスクのレート制限に効く「5時間ブロック」の消費状況を見せる方針にしている
- **Tailscale**: `tailscale` コマンドではなく tailscaled の LocalAPI（unixソケット上のHTTP）を直接叩くので、
  コンテナにtailscaleバイナリを入れる必要はない。**読み取り専用**で、exit nodeの切り替えなど
  経路を変更する操作は実装していない（LAN上に認証なしで公開されるダッシュボードから
  ホスト自身の経路を書き換えられるのは危ないため）
- **gitリポジトリ**: read-onlyマウントでも動くよう `--no-optional-locks` を、コンテナのrootと
  ホスト側のファイル所有者が違っても動くよう `-c safe.directory=*` を付けて `git` を呼んでいる。
  表示のみで、commitやpushなどの操作は行わない

## メール（IMAP）連携のセットアップ

`apps/server/.env` に設定する。未設定なら「メール未接続」と表示されるだけで、他には影響しない。

```
MAIL_HOST=imap.gmail.com
MAIL_PORT=993
MAIL_USER=you@gmail.com
MAIL_PASSWORD=<アプリパスワード>
MAIL_MAILBOX=INBOX
```

Gmailの場合は2段階認証を有効にした上で [アプリパスワード](https://myaccount.google.com/apppasswords)
を発行する（通常のアカウントのパスワードではIMAPログインできない）。

未読件数と直近の差出人・件名を**表示するだけ**で、既読化・削除・返信は実装していない
（LAN上の誰でも触れる画面から、誤操作でメールを失う操作ができないようにするため）。
IMAPは接続コストが高いので、結果はサーバー側で60秒キャッシュして全クライアントで共有する。

> iMessageは今回見送った。tailnet上にMacはあるので原理的には可能だが、`~/Library/Messages/chat.db` を
> 読むエージェントをMac側に常駐させ、フルディスクアクセスを与える必要があり、このダッシュボード単体では完結しない。

## push前のチェック（public-safe）

このリポジトリは現在privateだが、**いつpublicに切り替えても問題ない状態を保つ**方針にしている。
そのため、認証情報そのものだけでなく、自宅ネットワークの実アドレスやtailnet名のような
「漏れても致命的ではないが、わざわざ公開する必要のない識別子」もコミットしない。

クローン直後に一度だけ、pre-pushフックを有効化する:

```bash
git config core.hooksPath .githooks
```

以降、`git push` のたびに `scripts/check-public-safe.sh` が走り、以下が見つかると push が中止される。

- 各種トークン・APIキー・秘密鍵の形式（JWT / `ghp_` / `tskey-` / `xox*-` / `sk-` / `AIza` / PEM）
- tailnet名（`*.ts.net`）とTailscaleのIP（`100.64.0.0/10`）
- プライベートIP（`192.168.*` / `10.*` / `172.16-31.*`）

検査対象は**「今回リモートに新しく送られるオブジェクト」**であって、最新のツリーではない。
`git rev-list --objects <送るcommit> --not --remotes=origin` で求めたblobを全部見る。
最新の中身だけを見る作りにすると、**中身は綺麗だが履歴に残っているブランチを見逃す**
（新規ブランチのpushでは履歴ごと送られるため、これは実際に起きる）。

ドキュメント用のダミー値など、意図的に許可したい文字列は `scripts/public-safe-allow.txt` に
1行1リテラルで追記する。単発で通したい場合は `git push --no-verify`。

手動で確認したいときは:

```bash
./scripts/check-public-safe.sh                       # HEAD のツリー
./scripts/check-public-safe.sh <commit-ish>          # 指定コミットのツリー
./scripts/check-public-safe.sh --objects main --not --remotes=origin   # 送られる内容
```

## 音声アシスタント（ウェイクワード → Claude Code）

「ねえクロード」と話しかけると画面にパネルが出て、続けて話した内容を Claude Code に渡し、
返答を VOICEVOX で読み上げる。スマートスピーカー的に使うための部分。

```
マイク ─→ apps/voice-agent（ホスト上で常駐）
            Vosk: ウェイクワード検出 ─→ Silero VAD: 話し終わりの判定 ─→ faster-whisper: 書き起こし
            ─→ 常駐させた claude（stream-json）─→ 文ごとに VOICEVOX Engine で合成 ─→ スピーカー
                │ 状態のスナップショット          │ ツール呼び出し（天気・家電・音楽）
                ▼                                ▼
          apps/server  /ws/voice-agent ─→ /ws で全画面に配信 ─→ VoiceOverlay
                       /api/voice/ask・cancel ←─ 画面からのテキスト入力・中止
                       /mcp ─→ 天気（Open-Meteo）・Home Assistant・Spotify
```

音声の入出力・認識・Claude Code の呼び出しはすべてエージェント側で行い、サーバーは状態の中継だけをする。
エージェントをサーバーのコンテナに入れていないのは、マイク・スピーカーと、ログイン済みの `claude` コマンドが
ホスト側にあるため。画面側は状態を表示するだけなので、LD290EJS のような非力な端末でも負荷は増えない。

### セットアップ

```bash
# 1. 読み上げエンジン（docker-compose.yml に voicevox サービスとして定義済み）
docker compose up -d voicevox

# 2. Voskの日本語モデル（約50MB）
mkdir -p ~/.cache/home-dashboard-voice && cd ~/.cache/home-dashboard-voice
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip
python3 -c "import zipfile; zipfile.ZipFile('vosk-model-small-ja-0.22.zip').extractall('.')"

# 3. エージェント本体（whisperのモデルは初回起動時に自動でダウンロードされる）
cd apps/voice-agent
python3 -m venv .venv && .venv/bin/pip install -e .
cp .env.example .env    # マイクのデバイス・話者などを設定
.venv/bin/python -m voice_agent

# 常駐させる場合（ユーザーサービス。ファイル先頭のコメント参照）
cp home-dashboard-voice-agent.service ~/.config/systemd/user/
systemctl --user enable --now home-dashboard-voice-agent
```

エージェントが接続すると、Settings パネルの「音声アシスタント」が「待機中」になり、
そこからテキストで話しかけることもできる（マイクの無い端末や、声を出せない場面向け）。

### 使い方

- **「ねえクロード」→ チャイム → 命令**: ウェイクワードだけ言うとチャイムが鳴り、6秒以内に話し始めた命令を聞く
- **「ねえクロード、電気消して」**: 続けて言ってもよい（ウェイクワードの後ろをそのまま命令として扱う）
- **続けて話す**: 声で話しかけた返答の後5秒（`VOICE_FOLLOW_UP_S`）は、ウェイクワード無しで次を話せる
  （画面に「続けてどうぞ」と出る。何も聞こえなければ黙って待機に戻る）
- **マイクボタン**: 待機中は画面左下に既定のキャラクターのウェイクワード（「ねえプラム」など）のボタンが出る。
  タップするとウェイクワード無しで聞き始め、読み上げ中に押すと止めて聞き直す
- **キャラクターの呼び分け**: 「ねえプラム」「ねえカリン」のように、ウェイクワードごとに別のキャラクター（口調・声・VRM）が応える。
  マイクボタンと文字入力で応えるのは、Settings で選んだ既定のキャラクター（下の「キャラクター」参照）
- 「明日は傘いる？」「リビングの電気消して」「エアコンを27度にして」「今流れてる曲は？」のように、
  ダッシュボードが連携している天気・家電・音楽はツールで直接扱う（Web検索より速い）
- 最後のやり取りから5分以内なら同じ会話の続きになる（「明日は？」が通じる）
- 読み上げ中はマイクの音を捨てている（自分の声でウェイクワードを誤検出しないため）。
  中止は画面のパネルの ✕ か、マイクボタンから

### Claude Code に渡す権限

部屋にいる人やテレビの音なら誰の声でも動くので、Claude Code は権限を絞って起動している
（`apps/voice-agent/voice_agent/claude.py`）。

- `--restricted`: ユーザー/プロジェクトの設定ファイル（許可ルール・hooks）を読まず、コマンド実行系のツールを外す
- `--strict-mcp-config` + `--mcp-config`: **ダッシュボードのMCPサーバー（`/mcp`）だけ**を読み込む
  （Gmail・カレンダー等のコネクタやユーザー設定のMCPサーバーは読み込まない）
- `--tools` / `--allowedTools`: 組み込みツールは既定で **WebSearch と WebFetch だけ**
- 作業ディレクトリは専用の空ディレクトリ（`~/.local/share/home-dashboard-voice/workspace`）

家電操作は Bash を開放するのではなく、サーバーの `/mcp`（`apps/server/src/routes/mcp.ts`）が
用意した次のツールだけで行う。中身はウィジェット用の `/api/*` と同じ関数なので、HAのサービスの
ホワイトリストと解錠の禁止がそのまま効き、`/api/*` でできる以上のことはできない。

| ツール | 内容 |
|---|---|
| `get_weather` | 現在の天気、今後12時間の降水確率、今日〜明後日の予報 |
| `list_home_devices` | 家電（照明・スイッチ・鍵・エアコン）と室温・湿度センサーの状態 |
| `control_home_device` | 家電の操作（`ALLOWED_SERVICES` の範囲。解錠は `HOMEASSISTANT_ALLOW_UNLOCK=true` のときだけ） |
| `get_now_playing` / `control_music` | Spotify の再生中の曲・再生/一時停止/次/前 |

`control_home_device` の説明には、Claude の起動時点の家電の一覧（entity_id と名前）を埋め込んでいる。
先に一覧を取らせると「電気つけて」1回にツールが2往復し、最初の1文字まで7.4秒かかっていたのが、
直接操作できるようにして約4秒になった。

`VOICE_AGENT_TOKEN` を設定すると `/mcp` と `/ws/voice-agent` はトークン無しでは使えなくなる
（未設定なら、既存の `/api/*` と同じくLAN内から誰でも使える）。

### Claude Code の常駐

質問のたびに `claude -p` を起動すると、起動とMCPサーバーへの接続で最初の1文字までに1.6〜2.7秒かかる。
`--input-format stream-json` で1プロセスを常駐させ、質問を標準入力に流し込むようにして約0.7秒にした。

- 最後のやり取りから `VOICE_SESSION_IDLE_S`（既定5分）経つとプロセスを作り直し、新しい会話にする
  （次の質問に備えて先に起動しておく。待機中のメモリは約220MB）
- 中止したときは読みかけの応答が次に混ざらないようプロセスを捨て、`--resume` で会話を引き継いだものを起動し直す
- モデルは Sonnet。Haiku も試したが、この程度の質問では速くならず、読み上げに向かない `**` を混ぜたり、
  ツールを呼ばずに家電の状態を答えたりした

### キャラクター（ウェイクワードごとの呼び分け）

キャラクターは `config/voice-personas/` に1人1ディレクトリで置く（形式は `config/voice-personas.example/`）。
1人もいなければ今までどおり「ねえクロード」で呼ぶ素のアシスタント1人だけになる。

```
config/voice-personas/
  common.json          呼びかけの前置き（wakePrefix、既定「ねえ」）・全員に共通のおとり（commonDecoys）・並び順（order）
  world.md             キャラクターたちの共通の設定（関係性など）
  plum/persona.json    名前・ウェイクワード・おとり・声・表情
  plum/prompt.md       振る舞い・口調（無ければキャラクターの無い素のアシスタント）
  plum/avatar.vrm      VRMアバター（0.x / 1.0）
```

| `persona.json` の項目 | 内容 |
|---|---|
| `id` | ディレクトリ名と同じ。英小文字・数字・`-`・`_` で32文字まで |
| `name` / `wakeLabel` | 表示名と、画面に出す呼び名（省略時は表示名。ウェイクワードと読みが違うときに書く） |
| `wakeWords` | Vosk の語彙にある表記で書く（「あまなつ」は「甘夏」）。前に `wakePrefix` が付く |
| `decoys` | 名前と音の似た語。後述の実測を見て足し引きする |
| `voice` | VOICEVOX の話者IDと話速（`http://127.0.0.1:50021/speakers` で一覧できる） |
| `expressions` | 返答の（表情名）で切り替える表情。`avatar` はVRMの表情名と重み、`voice` は声のスタイル（例: ささやき・ツンツンの話者ID）、`keywords` は表情名以外の描写を書かれたときの手がかり |

プロンプトとVRMは個人のもの（第三者のキャラクター・モデルを含む）なので、`config/voice-personas/` は
リポジトリにもDockerイメージにも含めない（実行時にホストの `config/` をマウントして読む）。

#### 追加・書き出し・削除

Settings の「キャラクター」から、1人分のディレクトリをZIPにしたパッケージ（`persona.json`・`prompt.md`・`avatar.vrm`。
直下でも1階層のフォルダの中でもよい）を追加・書き出し・削除できる。書き出したZIPはそのまま取り込み直せる。

- **確かめること**: 取り込むときにサーバーが `persona.json` の形と、表情の割り当てがVRMに実在する表情名かを確かめる。
  エージェントは読み直したときに、ウェイクワード・おとりが音声認識（Vosk）の語彙にあるか、話者IDが VOICEVOX にあるかを確かめる
  （Vosk は語彙に無い語を黙って無視するので、それに気づかないと呼んでも反応しない）。見つかった問題はキャラクターの一覧に出す
- **同じIDがあるとき**: 上書きするか確かめてから差し替える（前のVRM・プロンプトは残さない）
- **安全のため**: ZIPの中のパスは書き込み先に使わず、決まった3つのファイル名だけを取り出す（`../` で `config/` の外へ書かれないように）。
  展開する前に大きさを確かめ、一時ディレクトリに書いてから差し替えるので、書きかけのキャラクターをエージェントが読むこともない。
  LAN上の誰でも追加できるが、キャラクターのプロンプトで Claude Code のツールや権限は変わらないので、`/api/*` でできる以上のことはできない
- **反映**: 画面から追加・削除するとエージェントに読み直させる。ファイルを直接直した場合も、エージェントが5秒ごとに変更を見て読み直す。
  応答や聞き取りの途中なら、待機に戻ってから差し替える。Claude の会話は全員の設定を入れ直した新しい会話になる
  （直近のやり取りは記録から引き継ぐ）

- **記憶は全員で共有する**: Claude Code の会話は1本のままにして、全員の設定をシステムプロンプトに入れておき、
  質問ごとに `[話しかけられた相手: プラム]` を添えてそのキャラクターとして答えさせる。
  プラムが答えた天気の話を、次に呼ばれたカリンが「プラムちゃんは…って言ってたわよ」と踏まえて答える
- **誰が何に答えたかを残す**: やり取りのたびに `data/voice-history.jsonl` へ1行1件のJSONで記録し、
  Settings の「最近のやり取り」に出す。新しい会話を始めるとき（エージェントの再起動後や、5分以上間が空いた後）は
  直近の記録を最初の質問に添えるので、前のやり取りも覚えている（`VOICE_HISTORY_TURNS` 件・`VOICE_HISTORY_HOURS` 時間まで）。
  Claude にも文章にせず、「話しかけた人 / 話しかけられた相手 / ユーザーの発言 / 返答した相手 / 返答」の項目に分けたJSONで渡す
  （文章で「プラムに「…」 → プラム「…」」と渡したら、キャラクターが質問したと読み違えた）

  ```json
  {"id": "7fe3cdbd", "at": "2026-09-17T15:39:33+09:00", "conversationId": "de57386a-…",
   "persona": {"id": "plum", "name": "プラム"},
   "input": {"source": "text", "text": "ドヤ顔で自慢してから照れてみて"},
   "output": {"text": "えへへ〜、実はプラム、…",
              "segments": [{"expression": "ドヤ顔", "text": "えへへ〜、実はプラム、"}, {"expression": "てれてれ", "text": "…"}]},
   "status": "answered"}
  ```

  `input.source` は `wake`（ウェイクワードで呼んで声で）/ `follow-up`（返答の後に続けて）/ `button`（マイクボタン）/ `text`（文字入力）、
  `status` は `answered` / `cancelled`（途中で中止）/ `error`。`conversationId` が同じものは同じ会話の中で続けて話したもの
- **既定のキャラクター**: Settings の「ボタン・文字入力で応答するキャラクター」で選ぶ。サーバーの
  `data/voice-settings.json` に保存し、全端末のマイクボタンと文字入力に効く
- **（表情名）で表情と声のトーンを変える**: 「（ドヤ顔）プラムにおまかせだよっ！（てれてれ）…」のように、Claude は文の頭に
  キャラクターの「使える表情」を書く。その文からアバターの表情（とあれば声のスタイル）が変わり、次の指定まで続く。
  （ ）は画面にも読み上げにも出さない。全員に共通の表情（にっこり・びっくり・しょんぼり・ぷんぷん・ほっこり・ふつう）に、
  キャラクターごとの表情を `expressions` で足す（プラムならモデルに入っている `doya_1`・`shy`・`heart` など）
  - 表情名以外の描写（「（嬉しそうに耳を動かす）」）を書いてしまった場合も隠し、`keywords` から近い表情を選ぶ
  - 「（333メートル）」のように数字を含むものや30文字を超えるものは、本文の補足として残す
  - 括弧の途中では読み上げの区切りを入れない（閉じ括弧の無い断片になって取り除けなくなるため）。
    ストリーミングで届く途中の書きかけの（ ）も、閉じる前から画面では隠す
  - キャラクター設定の無い素のアシスタントでは、括弧を指定として扱わない
- **権限は全員同じ**: キャラクターのプロンプトで Claude Code のツールや権限は変わらない

**呼び分けの精度**（VOICEVOXの8人の声での実測。`tests/test_listening.py::test_wake_word_accuracy`）:
「ねえプラム / ねえカリン / ねえあまなつ / ねえクロード」の正例96件で取りこぼし4件、日常会話の負例208件で誤検出8件、
キャラクターの取り違えは0件。

- 「ねえ、……プラム」と間を空けて呼ぶと、Voskが「ねえ」と名前を別々の発話に区切ることがあるので、1.6秒以内ならつなげて判定する
- 名前と近すぎるおとりは正しい呼びかけを吸う。「パラム」「クローン」はそれぞれプラム・クロードを取りこぼさせたので外した。
  「プラン」も同様で、外した代わりに「ねえ、プランは〜」を誤検出する（8件中5件）
- Voskの名前の単語の信頼度は、正しく呼んでも0.5前後のことが多く、しきい値では振り分けられなかった
- whisper で名前を確かめる2段構えも試したが、whisper base が名前を崩す（プラム→クラム、あまなつ→マナツ）ため、
  正しい呼びかけを96件中34件弾いてしまい採用しなかった
- 実際の人の声では精度が変わるはずなので、マイクをつないだら実際の声で確かめて `decoys` を調整する

### VRMアバター

キャラクターの `avatar`（キャラクター設定が無い場合は `config/avatar.vrm`・`VOICE_AVATAR_PATH`）を置くと、
応答パネルの円の代わりにVRMアバターが出て、読み上げに合わせて口を動かす。置いていなければ円だけになる。

- **口パク**: 画面では音が鳴らない（ホストのスピーカーで鳴る）ので、音声を解析するのではなく、
  エージェントが VOICEVOX の `audio_query` の音素の長さから計算した「読み上げ開始からの秒数と母音」の時系列を
  文ごとに送り、画面はそれを受け取った時刻を再生開始とみなして口の形（あいうえお）を切り替える。
  計算した長さと合成した音声の長さの差は実測で20ms程度
- **動き**: まばたき・呼吸・頭の揺れ、聞いている間は首をかしげ、考えている間は上の方を見る
- **表情**: 読み上げる文ごとに、エージェントが（表情名）から決めた表情（VRMの表情名と重み）を口パクの時系列と一緒に送り、
  その文を読み始めるときに切り替える。表情名は大文字・小文字の違いを吸収する（VRM 0.x のカスタム表情は「Surprised」など）
- **読み込み**: モデルは数十MBあるので、既定のキャラクターの分だけ画面を開いて3秒後に先読みし、一度読んだものは
  キャラクターごとに使い回す（ほかのキャラクターは呼ばれたときに読む）。
  サーバーは ETag を返すので、2回目以降はブラウザのキャッシュが使われる。three.js（約770KB）は
  アバターを出すときだけ読み込む別チャンクにしてある
- **書き出しツールの不具合への対処**: JSON に `NaN` を含むVRM（揺れもののコライダー半径など）は GLTFLoader が読めないので、
  読み込むときに0へ置き換える。VRM 0.x と 1.0 とで腕を下ろす回転の向きが逆なので、バージョンで切り替える
- **端末ごとに切れる**: Settings の「この端末でアバターを表示」。描画が重い端末（LD290EJS 等）では切る。
  この開発環境（GPU無し・ソフトウェア描画）では3〜8fpsだった

モデルはリポジトリにもDockerイメージにも含めない（`.gitignore` / `.dockerignore` 済み）。
第三者のモデルは再配布禁止のものが多く、`config/` は実行時にホストからマウントされるので、イメージに焼き込む必要もない。
使うモデルの利用条件（VRMのメタ情報の「アバターに人格を与えることの許諾範囲」「再配布」など）は置く前に確認する。

### ウェイクワードの誤検出対策

Voskを「ウェイクワード＋音の似た語（おとり）」だけの文法で常時回している。おとりが無いと
「〜ですね、クローゼット」「あのね、クロードモネ」「ねえ、クローバー」を「ねえ クロード」と取り違えたが、
`クローゼット クローバー クロール …` を文法に入れると、そちらに振り分けられて誤検出しなくなった
（VOICEVOXで作った正例6件・負例7件で確認）。誤検出する語を見つけたら `VOICE_WAKE_DECOYS` に足す。

もう一つ、ウェイクワードの直前がおとり単語のときは無視している。「あのね、クロードモネの〜」が、
前に流れる無音の長さ次第で「あのね **ねえ クロード** モネ」と認識されることがあったため
（語尾の「ね」を取り直しただけで、呼びかけではない）。

Voskの信頼度（`conf`）は誤検出でも1.0になるので判定には使えなかった。発話途中の暫定結果も
「クロード」→「クローバー」のように後から変わるので使わず、発話の区切りで確定した結果だけを見ている。

### 速度について（このホストのCPU）

gco の仮想CPUは **AVX/AVX2 を公開していない**（`/proc/cpuinfo` に `sse4_2` までしか出ない）。
whisper と VOICEVOX はどちらも AVX の有無で大きく速度が変わるので、現状は次のように遅い。

| 処理 | 実測 |
|---|---|
| whisper base（2.5秒の発話） | 約2.5秒 |
| whisper small（同） | 約5秒 |
| VOICEVOX（5.3秒の音声、4スレッド） | 約4.3秒（既定のスレッド数では6.9秒） |
| VOICEVOX（「はい。」0.6秒の音声） | 約0.85秒 |

テキストで質問したときの内訳（Claude常駐・ダッシュボードのツールあり）はおおよそ次のとおりで、
いま一番大きいのは読み上げの合成待ちになっている（画面には返答の文字が先に流れる）。

| 質問 | 最初の1文字まで | 声が出るまで |
|---|---|---|
| 「私の好きな果物は何だっけ？」（ツールなし） | 0.7秒 | 2.8秒 |
| 「サーキュレーターを止めて」（ツール1回） | 3.9秒 | 5.7秒 |
| 「明日は傘いる？」（天気ツール） | 3〜4.5秒 | 6〜9秒 |

このため whisper は `base` を既定にし、読み上げは長い文を読点でも区切って先に合成に回している。
ハイパーバイザ側で VM の CPU タイプを `host` にすれば（AVX2 が見えるようになれば）数倍速くなる見込みなので、
そのときは `VOICE_WHISPER_MODEL=small` に上げると聞き間違いが減る（base は「記温」のような誤変換がある）。

### テスト

```bash
cd apps/voice-agent
.venv/bin/pip install -e '.[test]'
.venv/bin/pytest            # 約20秒（初回は発話の合成で1〜2分）
.venv/bin/pytest -m "not audio"   # 音声を使わないものだけ
```

| ファイル | 内容 |
|---|---|
| `tests/test_text.py` | 読み上げの文の区切り、（表情名）の読み取り（表情が続くこと・描写を隠すこと・数字入りの括弧は残すこと・声のスタイルの切り替え）、書き起こしからウェイクワード（キャラクター名）を落とす処理 |
| `tests/test_listening.py` | キャラクターの呼び分けの精度（8人の声×正例12・負例26）、前後の無音・名前の前の間への強さ、命令の切り出し（一息で・間を空けて・言いよどみ）、呼ばれたキャラクターへの振り分け、タイムアウト、続けて話す、マイクボタン |
| `tests/test_claude.py` | 偽の `claude` で、権限を絞るフラグ・渡すMCPの設定・常駐プロセスの使い回し・中止後の `--resume`・会話の作り直し・全キャラクターの設定と応答する相手の渡し方・新しい会話への記録の引き継ぎ |
| `tests/test_voicevox.py` | 口パクの時系列の長さが、実際に合成した音声の長さと揃っているか |
| `tests/test_personas.py` | キャラクターのディレクトリの読み込み（並び順・壊れた設定を飛ばす・一時ディレクトリを読まない）、変更の検知、語彙に無いウェイクワード・無い話者IDの警告 |

サーバー側のキャラクターのパッケージ処理（検証・VRMの表情名・インポート/書き出し/削除・危険なパスのZIP）は
`cd apps/server && pnpm test`（Node のテストランナー）。

`test_listening.py` は VOICEVOX Engine で発話を作り、実物の Vosk・Silero VAD・whisper に通す。
マイクの代わりに実時間を待たずに流し込むので速い（判定はすべて認識器が受け取った音声の時刻で行っている）。
作った音声は `~/.cache/home-dashboard-voice/test-audio` に置き、リポジトリには入れない
（VOICEVOX の音声の配布にはキャラクターごとの規約がかかるため）。VOICEVOX Engine や Vosk のモデルが無ければスキップする。

### マイク無しでの動作確認

`voice_agent.fake_mic` は音声ファイルを実時間のペースでマイク代わりに流す。
VOICEVOX でテスト用の発話を作って流せば、ウェイクワード検出から読み上げまでを一通り試せる。

```bash
# 8787でDocker版が動いている場合は、開発サーバーを別ポートで立ててそちらにつなぐ
PORT=8788 pnpm dev:server
API_PROXY_TARGET=http://localhost:8788 pnpm dev:web

cd apps/voice-agent
VOICE_SERVER_URL=http://127.0.0.1:8788 \
VOICE_INPUT_CMD=".venv/bin/python -m voice_agent.fake_mic --gap 40 wake.wav command.wav" \
VOICE_OUTPUT_CMD="ffmpeg -loglevel error -re -i - -f null -" \
.venv/bin/python -m voice_agent
```

> VOICEVOX の音声を公開・配布する場合はキャラクターごとの利用規約に従ってクレジット表記が必要。
> 家庭内で鳴らすだけなら表記の場は無いが、録画をSNSに載せる等の場合は注意。

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
     // レールでは 1行 = 200px（`w` は使わない）
     defaultSize: { w: 3, h: 1 },
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

これでサイドバーの Settings パネルの「ウィジェットを追加」に表示され、レールに追加できるようになる。

## ロードマップ

実装済み: 基盤（ウィジェットプラグイン機構・トップ画面・Docker配布）＋ウィジェット10種
（時計・天気・Spotify・ホームラボ死活監視・HA家電操作・HA室温湿度・Claude Code使用量・
Tailscale・gitリポジトリ・メール）。当初構想していた連携ウィジェットはメールを除きすべて実データで動作確認済み
（メールのみ認証情報が未設定のため未接続表示のまま）。
音声アシスタントは、ウェイクワード検出から Claude Code の返答の読み上げまでを、マイク無しで
（疑似マイクとVOICEVOXで作った発話で）動作確認済み。実機のマイク・スピーカーでは未検証。
家電操作のツールは Home Assistant のスタブで確認しており、実機の HA ではまだ試していない。

未着手:

- Home以外の画面（Media / Home Control / Toolbox）
- 設計図がまだ無いウィジェット（ホームラボ・Tailscale・git・メール等）のカードデザイン
  （現状は650x200のカードに旧レイアウトの中身がそのまま入っているだけ）
- 時間帯・再生状況等に応じたウィジェットの自動出現/レイアウト変更
- 音声アシスタントの続き: 読み上げ中の声での割り込み（エコーキャンセル）、実機のマイク・スピーカーでの調整、
  VRMアバターの身振り（現状は表情・口・視線・首の動きのみ）
- iMessage連携（Mac側に常駐エージェントが要るため保留）
- キャンバス上でのウィジェット設定編集UI（現状は`defaultConfig`とサーバー側の設定ファイルのみ）
