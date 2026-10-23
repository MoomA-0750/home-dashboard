# 文字の明暗比を測る道具

ガラスの入れ物や壁紙の上の文字は、後ろの色が場所ごとに違うので、CSS の色だけでは読みやすさが分からない。
`check.mjs` は、試験用のサーバーの画面をブラウザで開き、文字だけを消した画面を撮って、文字の並ぶ所の後ろの色
（明るい方の9割の値。文字の影は含む）と文字の色から明暗比を出す。目安は 4.5（大きな文字は 3）。

```sh
# 本番のデータに触らないよう、別の DATA_DIR で試験用のサーバーを動かす（画面は pnpm build:web で組み立てておく）
PORT=8819 DATA_DIR=/tmp/devdata VOICE_AGENT_TOKEN=test pnpm --filter @home-dashboard/server dev

node tools/contrast-check/check.mjs                  # 目安に届かない所だけ
node tools/contrast-check/check.mjs --all            # 全部
node tools/contrast-check/check.mjs --json out.json  # 結果を JSON にも書く
node tools/contrast-check/check.mjs --css a.css      # CSS を足した見た目で測る（直す前・直した後を比べる）
```

壁紙（`apps/web/public/background.jpg`）で結果が大きく変わる。壁紙を替えたら測り直す。
押せないボタン（薄く出している）と、歌詞の歌い終えた行は、わざと薄くしているので届かなくてよい。
