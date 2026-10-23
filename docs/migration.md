# 別の機械へ移す

ダッシュボードの持ち物（アカウント・設定・会話の記録・拡張機能のデータ・キャラクター）を、別の機械へ移す手順。
道具は `scripts/migrate.mjs`（`pnpm migrate`）。

## 何がどこにあるか

| 場所 | 中身 | 道具で移すか |
|---|---|---|
| `data/` | ログインのアカウント・端末・パスキー、ウィジェットの並び、接続設定（トークン）、壁紙、音声アシスタントの会話の記録・添付・設定、拡張機能の入／切と持ち込んだ拡張機能、拡張機能ごとのデータ（`extension-data/<id>/`。インターネットアカウントのトークン・天気の場所・ホームラボの SSH の鍵など） | 移す（`extension-cache/` は作り直せるので入れない） |
| `config/` | キャラクター（`voice-personas/`）・VRM | 移す |
| `apps/server/.env`・`apps/voice-agent/.env` | 秘密の設定（トークン・パスワード） | 移す |
| `~/.local/share/home-dashboard-voice/workspace` | 音声アシスタントが Claude Code を動かす作業場所 | 移す（`--no-voice-workspace` で外せる） |
| `~/.cache/home-dashboard-voice` | 音声認識のモデル | 移さない（入れ直す） |
| Docker のボリューム `https-data`・`https-config` | https の証明書 | 移さない（起動すると取り直す） |
| Docker のボリューム `aivisspeech-data` | AivisSpeech のモデル | 移さない（自分で足したモデルは入れ直す） |
| ブラウザ | 画面ごとの設定（サイドバーの幅・開いたフォルダーなど） | 移さない（同じアドレスで開けば残る） |

データベースは使っていない。どれもファイル（JSON）なので、上の4つを持っていけば元どおりに動く。

## 気を付けること

- **トークンやパスワードは `data/` に平文で入っている**。道具は合言葉で暗号化（AES-256-GCM）したファイルを作る。`--no-encrypt` で作ったものは、そのまま秘密として扱う
- **パスキーはホスト名に結び付く**。移した先を別のホスト名で開くと、パスキーではログインできない。パスワードで入って登録し直す
- **https の待ち受けの IP**は既定で `192.168.1.10`。違う IP なら、リポジトリ直下の `.env` に `DASHBOARD_HTTPS_BIND` と `DASHBOARD_ACME_DIRECTORY` を書く
- **wave のネットワーク**（`relay-deploy-v2_default`）が無いと `docker compose up` が起動しない。先に wave を起動するか、`docker-compose.yml` の `networks` から wave を外す
- **ホストから読み込むもの**（`~/.claude/projects`・`~/Documents/git-cloned`・tailscaled のソケット・`~/.step/certs/root_ca.crt`）が移した先にも要る。無ければその機能だけ動かない
- `data/` にはコンテナ（root）が書いたファイルがあり、今のユーザーからは読めないことがある。道具は Docker の中で読むので持ち出せ、戻すときは今のユーザーの持ち物にそろえる（権限はそのまま）

## 手順

### 1. 元の機械で書き出す

```bash
pnpm migrate export --stop
```

- 合言葉を2回聞かれる（8文字以上）。`HD_MIGRATE_PASSPHRASE` に入れておけば聞かれない
- `--stop` はダッシュボードと音声エージェントを止めてから書き出し、終わったら動かし直す（書き込み途中のファイルを持ち出さないため）。止めたくなければ `--live`
- できたファイル（`home-dashboard-<日時>.hdmigrate`）を、移す先の機械へ運ぶ。`--out <ファイル>` で場所を変えられる
- 中身を確かめるときは `pnpm migrate list <ファイル>`

### 2. 移す先で準備する

```bash
git clone <このリポジトリ> ~/Documents/git-cloned/home-dashboard
cd ~/Documents/git-cloned/home-dashboard
pnpm install
pnpm build:extensions
```

wave を使うなら、先に wave（`~/Documents/git-cloned/wave/dev/relay-deploy-v2`）を起動しておく。

### 3. 戻す

```bash
pnpm migrate import home-dashboard-<日時>.hdmigrate
```

- ダッシュボードが動いていたら止めてから戻す
- すでに `data/` などがあるときは止まる。`--force` で置き換える（今のものは `<名前>.before-import-<日時>` に残す）
- 合言葉が違う・ファイルが壊れているときは、何も書き換えずに止まる

### 4. 足りないものを確かめる

```bash
pnpm migrate check
```

`NG` は起動できないもの、`!!` はその機能だけ動かないもの。次のことも確かめる。

- 前の機械の家のフォルダーを指す値が `data/` に残っていないか（ユーザー名が違うとき。残っていればファイルの名前を出すので、設定画面で直す）
- パスキーのホスト名
- 2つの `.env` の `VOICE_AGENT_TOKEN` がそろっているか

### 5. 起動する

```bash
docker compose up -d --build
```

音声アシスタントを使うなら、README の「音声アシスタント」の手順で venv とサービスを入れ直す（`apps/voice-agent/.venv` は移さない）。

### 6. 動いたら片付ける

- 運んだ `.hdmigrate` ファイルを消す（秘密が入っている）
- `--force` で残した `*.before-import-*` が要らなければ消す
- 元の機械のダッシュボードを止める（同じアカウントで2台が外のサービスへつなぐと、トークンの更新がぶつかることがある）
