# アバターの動き・ポーズを撮って確かめる道具

VRMアバターの身振り（`apps/web/src/avatar/`）を作るとき、数値を書いて画面を開き直す、を繰り返すと時間がかかる。
ここの2つは、開発サーバーの「動きを確認」画面を自動で操作してコマ送りで撮る。

設計の背景は [docs/avatar-motion.md](../../docs/avatar-motion.md) と [docs/avatar-pose.md](../../docs/avatar-pose.md)。

## 使う前に

1. キャラクター（VRM・プロンプト）を `config/voice-personas/<id>/` に置く（リポジトリには含まれない。`config/voice-personas.example/` を参照）
2. サーバーと画面を開発モードで動かす

```sh
# サーバー（本番のデータに触らないよう、別の DATA_DIR を指す）
PORT=8788 DATA_DIR=/tmp/devdata HOMEASSISTANT_URL= pnpm --filter @home-dashboard/server dev

# 画面
API_PROXY_TARGET=http://localhost:8788 pnpm --filter @home-dashboard/web dev
```

3. 依存を入れる（`playwright-core` はこのリポジトリの devDependencies に入っている）

ブラウザは、インストール済みの Google Chrome を使う。別のものを使うなら `CHROME_PATH` で指定する。

```sh
export DASHBOARD_URL=http://localhost:5173/   # 既定値

# ブラウザを指定する場合の例
export CHROME_PATH=/usr/bin/chromium                                                        # Linux
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"           # macOS
export CHROME_PATH="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
```

描画の速さで作業効率が大きく変わる。GPUの無いサーバー（ソフトウェア描画）では実測4fps、
M1 の MacBook Air では60fpsだった。ポーズを詰めるときはGPUのある機械で作業し、仕上げに実際の表示端末で確かめるとよい。

## コマ送りで撮る

```sh
node tools/avatar-shots/capture.mjs /tmp/shots プラム \
  motion:proud:10:100 wait::2:1000 view:横:1:400
```

手順は `区分:名前:枚数:1枚あたりのミリ秒`。区分は次のとおり。

| 区分 | 意味 | 例 |
|---|---|---|
| `state` | 状態 | `state:聞いている:1:500` |
| `view` | 見る向き | `view:斜め:1:400` |
| `expression` | 表情（返答の（表情名）） | `expression:ドヤ顔:1:800` |
| `motion` | 身振りだけ | `motion:love:8:150` |
| `button` | 名前でボタンを押す | `button:口パク・強調:10:120` |
| `wait` | 押さずに時間だけ進める | `wait::3:1000` |

**ブラウザの時計を止めて進めている**ので、描画が数fpsしか出ない環境でも、身振りの途中（ストローク・保持・戻す）が撮れる。
止めないと、スクリーンショットにかかる実時間のぶん先へ進んでしまい、同じ絵しか撮れない。

## 候補を描き比べる

角度をいくつも試すときは、候補をJSONにして一度に撮る。`motions.ts` は書き換わらない。

```sh
cat > /tmp/cand.json <<'EOF'
[
  {"label":"ねじり60","target":"proud","bones":{"leftUpperArm":[60,5,-50],"leftLowerArm":[0,-110,0]}},
  {"label":"ねじり90","target":"proud","bones":{"leftUpperArm":[90,5,-50],"leftLowerArm":[0,-110,0]}}
]
EOF
node tools/avatar-shots/candidates.mjs /tmp/shots プラム /tmp/cand.json 正面,斜め
```

## 並べて見る

撮った画像は、並べると違いが分かりやすい。

```sh
cd /tmp/shots && ffmpeg -framerate 1 -pattern_type glob -i "f*.png" -vf "scale=240:-2,tile=7x2" sheet.png
```

## 気をつけること

- **手が体に触れる身振り（腰に手・胸の前で手を合わせる）は、正面だけでは判断できない**。`view:斜め` と `view:横` で必ず確かめる
- 撮れた画像にはキャラクターが写る。第三者のモデルなので、**リポジトリにも外部サービスにも安易に置かない**
- 速い環境だけで詰めると、1コマが長い環境でしか出ない不具合（腕が届く前に保持が終わる等）を見落とす。
  仕上げは実際に表示する端末でも確認する
