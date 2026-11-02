# デザインシステム

ダッシュボードの見た目と動きの決まり。本体（apps/web）も拡張機能（extensions/*）も、ここに沿って作る。

- スタイルは **Tailwind（v4）のクラス**で書く。CSS のファイルは足さない（`pnpm lint:style` が確かめる）
- 値（色・字の大きさ・余白・角丸・影・重なり・動き）は Tailwind のテーマ（`packages/ui/src/tailwind-theme.css`）にあるものだけを使う。
  Tailwind の既定の色（`text-red-500` など）・字の大きさ・角丸・ブレークポイントは消してあり、書いても何も出ない。
  `[#123]`・`[13px]` のような、テーマを通さない値も書かない。合う段が無いときは、まずテーマに足す
- 実行中に変わる値（壁紙に合わせた色・動きの時間）は `packages/ui/src/styles/tokens.css` の `:root` の変数が持ち、テーマはそれを指す
- 部品（ボタン・一覧・入れ物・小窓・バー…）は `packages/ui`（`@home-dashboard/ui`）にある。拡張機能からは `@home-dashboard/widget-sdk` から使う。
  拡張機能は部品を組み合わせ、並べ方（flex・grid・gap・余白）だけを自分のクラスで書く。自分で色・角丸・ガラスを決めない
- 設計図は Figma（tokens.css の冒頭のリンク）。値を変えるときは、設計図にも同じ値を置く

## 0. 書き方（Tailwind）

### 道具

- `pnpm lint:style [フォルダ]` … 決まりに沿っているか（CSS のファイル・効かないクラス・テーマを通さない値・色の直書き・部品で書くもの）
- クラスをつなぐのは `cx()`（`@home-dashboard/ui`・widget-sdk）。ぶつかるクラスは後のものが勝つ（部品の `p-4` に `className="p-2"` を渡すと `p-2`）
- 拡張機能の組み立て（`scripts/build-extension.mjs`）が、拡張機能の中で使ったクラスだけを `dist/web.css` に出す。テーマと全体の決まりは本体が出す
- Tailwind のクラスで書けないもの（`@keyframes`・込み入った選び方）は、`packages/ui/src/theme/*.css` に `@utility` で足す（拡張機能からも使える）
- 部品の中のアイコン（`Icon`）は、目印の `fluent-icon` で選ぶ（`[&_.fluent-icon]:size-5`）。大きさは既定 24px（`size-6`）、`Icon` の `className` でも変えられる

### テーマの名前

| 何 | クラス | 例 |
|---|---|---|
| 文字の色 | `text-text`（本文）・`text-muted`（説明）・`text-accent`・`text-accent-soft`・`text-ok`・`text-warn`・`text-danger`・`text-success`・`text-on-fill`・`text-on-danger` | `text-muted` |
| 地・縁の色 | `bg-*`・`border-*` に同じ名前。ほかに `bg-raised`（浮かせる面）・`bg-input`（入力欄）・`bg-fill`・`bg-backdrop`（小窓の後ろ）・`border-line`・`border-glass-border`・`bg-shade`・`bg-tint`。不透明度は `/40` | `bg-tint/10` |
| 字の大きさ | `text-micro`・`text-caption`・`text-note`・`text-label`・`text-small`・`text-body`・`text-title`・`text-heading`、画面の見出し `text-screen`・大きな数値 `text-stat`・カードの見出し `text-card` | `text-caption` |
| 太さ・行間 | `font-normal`（400）・`font-medium`（500）・`font-semibold`（600）・`font-bold`（700）／`leading-none`（1）・`leading-tight`（1.3）・`leading-normal`（1.5） | |
| 余白 | Tailwind の既定（0.25rem 刻み。`p-4` ＝ 1rem）。入れ物の内側は `p-4`、入れ物のあいだは `gap-3` | `px-4 py-3` |
| 角丸 | `rounded-card`（45px）・`rounded-inner`（15px）・`rounded-group`・`rounded-nav`・`rounded-art`（12px。小さな写真）・`rounded-full`（丸・ピル） | |
| 影 | `shadow-widget`・`text-shadow-halo`（`halo` と同じ） | |
| 動きの曲線 | `ease-out`（出てくる）・`ease-in`（消える）・`ease-standard`（その場で変わる）。時間は `duration-(--motion-fast)` など | |
| 出る・消える動き | `animate-enter`・`animate-enter-slow`・`animate-fade`・`animate-pop`・`animate-drop`・`animate-fade-out`・`animate-exit`・`animate-pop-out`・`animate-drop-out`・`animate-reveal`・`animate-spin` | `closing:animate-fade-out` |
| 画面の区切り | `phone:`（≤620px）・`tablet:`（≤900px）・`narrow:`（≤1100px）・`wide:`（≥1100px）・`triple:`（≥1500px。メールだけ）・`wall:`（壁掛けの横長で背の低い画面） | `phone:flex-col` |
| 状態 | `lite:`（軽い表示）・`night:`（夜の表示）・`closing:`（閉じる動きの間。`.is-closing`）・`motion-reduce:`、選んでいるものは `aria-pressed:`・`aria-selected:`・`data-[…]:` | `aria-pressed:fill-bright` |

### 本体が用意するクラス（`tailwind-theme.css` の `@utility`）

| クラス | 何をするか |
|---|---|
| `glass` | ガラスの面（縁・光沢・暗い地・影・ぼかしの5つ1組）。入れ物・カード・ボタン。components の層にあり、同じ要素の `bg-*`・`border-*`・`fill-bright` がいつも勝つ（`styles/components.css`） |
| `raised` | 浮かせる面（小窓・メニュー。ぼかさない）。`glass` と同じく components の層 |
| `fill-bright` | 明るい塗り（選んでいる項目・いちばん押すボタン） |
| `no-blur` | ガラスの中のガラス・ほぼ不透明な塗りの、後ろのぼかしを切る |
| `halo` | 壁紙にじかに置く文字の影 |
| `press`・`press-wide` | 押せるもの（色を短く変え、押している間 96%・幅の広い行は 98.5% に縮む） |
| `change` | その場で色や形が変わるもの（トグル・タブ・家電の入／切） |
| `layer-base`〜`layer-guard` | 重なりの順（7章） |
| `tap`・`tap-lg`・`tap-xl` | 押せる最小の高さ（40・44・52px） |
| `ellipsis` | 省略（…）で切る1行（字の上下の余白も戻す） |
| `untrim` | 字の上下の余白を戻す（折り返す文章・入力欄） |

## 1. 考え方

1. **壁紙が主役**。画面は壁紙の上に、文字と「ガラス」の入れ物を置くだけにする。画面ごとの背景の色は敷かない
2. **2つの層**。文字は「壁紙にじかに置く」か「ガラスの中に置く」かのどちらか。じかに置く文字には淡い影を付け、ガラスの中では付けない（4章）
3. **読めること**。明るい壁紙でも、文字の明暗比が目安（4.5、大きな文字は 3）に届くようにする。測る道具は `tools/contrast-check`
4. **離れて触る大きさ**。壁掛けの画面（1920x540）とスマホの両方で押せるよう、押せるものは高さ 40px 以上にする
5. **動きは短く、小さく**。出てくるものだけを動かし、消えるものはすぐ消す（8章）

## 2. 色

テーマの色は「r, g, b」の形で持ち、壁紙を読み込んだときに、壁紙の色合いに合わせて差し替える（`packages/ui/src/wallpaperTheme.ts`。`@home-dashboard/ui/wallpaper`）。直書きの色は差し替えに付いてこないので、テーマの色は必ずトークン（Tailwind では `text-accent`・`bg-tint/10` など）で書く。

| トークン | 役割 | 書き方 |
|---|---|---|
| `--accent-rgb` | 選んでいる所・自分の吹き出し・光るもの | `rgb(var(--accent-rgb))` |
| `--accent-soft-rgb` | 文字のリンク・フォーカスの縁 | 同上 |
| `--tint-rgb` | 明るいボタンの地（不透明度 .94）・ガラスの縁 | `rgba(var(--tint-rgb), 0.94)` |
| `--ink-rgb` | 明るいボタンの上の文字 | `rgb(var(--ink-rgb))` |
| `--shade-rgb` | 壁紙を暗くする色・文字の影・下敷き | `rgba(var(--shade-rgb), …)` |
| `--text-primary` | 本文・見出し・数値 | |
| `--text-secondary` | 説明・日時・注記・区画の見出し | |
| `--line` | 区切り線 | |
| `--glass-border` | ガラスの縁 | |
| `--accent-ok` / `--accent-warn` | 正常の印 / 注意の印・注意の文字 | |
| `--danger` / `--danger-strong` | エラーの文字 / 危ない操作・止まっている印 | |
| `--success` | うまくいった知らせの文字 | |
| `--surface-raised` | 小窓・メニューの面（ぼかさず、ほぼ不透明） | |
| `--surface-input` | 入力欄・コードの枠の地 | |

- **明るい塗り**（選んでいる項目・いちばん押すボタン）は、地 `rgba(var(--tint-rgb), 0.94)`・文字 `rgb(var(--ink-rgb))` の組だけにする
- 「点いている」家電の黄色（Home Control）と、グラフの系列の色は、その拡張機能の中だけの色として持つ

## 3. 字

字の大きさは `--font-*` の段から役割で選ぶ。基準の大きさ（1rem）は画面の幅に合わせて 14〜20px で変わる（`:root` の `font-size`）。

| トークン | 大きさ | 役割 | 太さ |
|---|---|---|---|
| `--font-micro` | 0.7rem | 出典・小さなバッジ | 400〜600 |
| `--font-caption` | 0.75rem | 行の2行目・日時・入力欄の下の説明・メニューの説明 | 500 |
| `--font-note` | 0.8rem | 注記（`Note`）・結果の知らせ（`Message`）・カードの上の小さなラベル | 500 |
| `--font-label` | 0.85rem | 区画の見出し（`SectionTitle`）・ボタン | 600 |
| `--font-small` | 0.9rem | 画面の区画の見出し（`ScreenSection`）・入力欄・ピルのボタン | 600 / 400 |
| `--font-body` | 0.95rem | 一覧の行の名前（`ListItem`）・設定の項目 | 400 |
| `--font-title` | 1.1rem | カード・小窓の中の見出し | 600 |
| `--font-heading` | 1.25rem | 設定のページの見出し | 600 |

画面の見出しと大きな数値は、画面の幅で伸び縮みさせる。

| 役割 | 大きさ | 太さ |
|---|---|---|
| 画面の見出し（`ScreenFrame` の h1） | `clamp(28px, 2.6vw, 44px)` | 600 |
| 値のタイルの数値（`StatTile`） | `clamp(32px, 2.6vw, 46px)`、単位は 0.4em | 600 |
| カードの見出し（`.widget-card h2`） | `clamp(21px, 2vw, 31px)` | 700（指定なしの既定） |
| ホームの時計 | `--clock-size` | 700 / 200 |

- 太さは3つ。400 は本文、600 は見出し・名前・数値、700 は時計とカードの見出し（`.widget-card h2`）だけ。小さな薄い文字（caption・note）は 500 にする（細い線は壁紙に溶ける）
- 行間は、文章が複数行になるもの（注記・説明）を 1.5、1行の名前・数値を 1 にする
- 字の上下のフォント由来の余白は削ってある（`text-box-trim`）。省略（…）で切る1行は、`text-box-trim: none` で戻す

## 4. 面（サーフェス）

| 面 | 見た目 | 使う所 | 書き方 |
|---|---|---|---|
| 壁紙の上 | 背景なし。文字に淡い影 | 画面の見出し・区画の見出し・注記・ホームの時計 | `ScreenFrame` の中に置けば影は付く |
| ガラス | 光沢＋暗い地＋縁＋影＋ぼかし（5つ1組） | 入れ物・カード・ボタン・選んでいる項目・吹き出し | 部品（`Group`・`List boxed`・`StatTile`・`Button`・`WidgetCard`）を使う。自前の入れ物は要素に `ui-glass` を付ける |
| 浮かせる面 | `--surface-raised`（ぼかさない） | 小窓（`Dialog`）・メニュー（`PillMenu`）・詳細 | 部品を使う |
| 明るい塗り | `--fill` の地に `--on-fill` の文字 | 選んでいる項目・いちばん押すボタン（`Button variant="primary"`） | `background: var(--fill); color: var(--on-fill);` |

**ガラスの5つ1組**（`tailwind-theme.css` の `glass` の1か所だけに書く。部品も拡張機能も `glass` を付ける）

```css
border: 1px solid var(--glass-border);
background: var(--widget-sheen), var(--widget-bg);
background-clip: padding-box; /* 縁の線の下に光沢を敷かない */
box-shadow: var(--widget-shadow);
backdrop-filter: var(--widget-blur);
```

**軽い表示**（弱い端末向け。`:root[data-lite]`、lib/lite.ts）

- ぼかしを切り（`--widget-blur`・`--modal-backdrop-blur` を none）、ガラスの地（`--widget-bg`）と小窓の後ろの幕（`--modal-backdrop`）を濃くする
- 自分で `backdrop-filter` を書いたもの（拡張機能の CSS も）は、軽い表示ではまとめて切られる。ぼかしが無くても読めるよう、地の色を必ず付ける
- 入れ物のぼかしは、なるべく5つ1組のトークン（`--widget-blur`）で書く（軽い表示で揃って切り替わる）

**壁紙の上の読みやすさ**

- 壁紙の明るさを、画面の横の位置ごと（4か所）に測り、明るい所にだけ暗さを足す（`--wallpaper-dim-1〜4`）。強さは設定の「壁紙」で変える
- 壁紙にじかに置く文字の影（`--text-halo`）の濃さは、暗さを足した後に残る明るさで自動で決まる（`--text-halo-strength`）
- 影は文字の外へ 20px ほど広がる。はみ出しを切る入れ物（スクロールする区画・省略で切る1行）は、`--halo-room` だけ内側に余白を取り、外側を同じだけ詰める
- ガラスの中では影を付けない（`halo` は、壁紙にじかに置く文字にだけ付ける）

## 5. 寸法

**余白**は `--space-1`（0.25rem）〜`--space-10`（2.5rem）の段から選ぶ（1・2・3・4・5・6・8・10 = 0.25rem 刻み）。設定の入れ物は専用のトークンを使う。

| トークン | 値 | 使う所 |
|---|---|---|
| `--group-padding` | 1rem | 入れ物の内側（左右は常に。中に入力欄を並べるときは上下も） |
| `--group-row-padding` | 0.8rem | 線で区切った一覧の1行の上下 |
| `--group-gap` | 0.75rem | 入れ物と入れ物のあいだ |
| `--field-padding-x` | 0.9rem | 入力欄・入れ物の中の知らせの左右 |
| `--card-padding` | 30px | カード・小窓の内側 |

**角丸**は「外の角丸 ＝ 中の角丸 ＋ 内側の余白」で縁を平行にする。

| トークン | 値 | 使う所 |
|---|---|---|
| `--card-radius` | 45px | カード・大きな入れ物・小窓・値のタイル |
| `--inner-radius` | card − padding（15px） | カードの中の要素・入力欄・メニュー |
| `--group-radius` | inner ＋ group-padding | 設定の入れ物（`Group`・`List boxed`） |
| `999px` | ピル | ボタン・バッジ・バー |
| `50%` | 丸 | アイコンのボタン・顔・印 |

**押せるものの高さ**は 40px（`Button`・チップ）、44px（`PillMenu`・`IconButton`・閉じるボタン）、52px（Home Control の大きなボタン・編集の操作帯。壁掛けで押すもの）の3段。

**写真・アートワークの角丸**は、小さいもの（一覧の行の頭）が 12px、大きいもの（ジャケット・添付の写真）が `--inner-radius`。

**ウィジェットのカード**は 650x200px・内側の余白 30px・角丸 45px（設計図どおり）。

## 6. 部品の使い分け

| こうしたい | 使う部品 | 使わない |
|---|---|---|
| 画面を作る | `ScreenFrame`（見出し・右上の操作）、区画は `ScreenSection` | `<h2 className="screen__section-title">` を直に書く |
| 画面の右上で選ぶ（音楽アプリ・部屋・場所） | `PillMenu` | 独自のドロップダウン |
| 押す | `Button`（`variant="primary"` はその場でいちばん押すもの1つだけ、`"danger"` は消す確認。壁掛けで離れて押すものは `size="lg"`） | 独自のピルボタン |
| 選べるものを並べる（運転モード・大きさ・期間） | `Chip`（`selected` で明るい塗り） | 自前のピル |
| ボタンを並べる | `ButtonRow` | |
| 名前と説明の並び | `List` ＋ `ListItem`（左のアイコンは `ListIcon`）。読み比べる中身（予定・メール・天気の日ごと）は1つの入れ物にまとめる `List boxed`、左の欄で選ぶもの（受信箱・会話）は行ごとにガラスにする `List` | 自前の `ul` と線 |
| 左で選んで右に出す（受信箱とメール、カレンダーと予定） | `SideLayout`（狭い画面で左の欄を消すなら `narrow="hide"` ＋ 右上に `NarrowOnly` で `PillMenu`、下に回すなら `"below"`） | 自前の2列の grid |
| 入力欄をまとめる | `Group` ＋ `Field`（`hint` に説明） | |
| 値を大きく見せる | `StatTile`（`StatGrid` で並べる。押して詳しくするなら `onClick`、注意の値は `tone="warm"`・`"hot"`） | 自前のタイル |
| 進み具合・使っている量 | `ProgressBar`（`value` は 0〜1、色は `--progress-color`） | 自前のバー |
| 件数・状態の小さな印 | `Badge`（`tone`: on・warn・dim） | 自前のピル |
| つながりの状態の丸 | `StatusDot`（`ok` で正常の色） | 自前の丸 |
| アイコンだけのボタン（閉じる・その他・家電の電源） | `IconButton`（44px の丸、`label` は必須。壁掛けで押すものは `size="lg"`（52px のガラス）、入っているものは `selected`。ボタンの並びに置く 44px のガラスの丸は `glass`） | 自前の丸いボタン |
| 入／切 | `ToggleSwitch` | チェックボックス（`Check` は、選ぶものが多い一覧だけ） |
| 量を変える（音量・明るさ・再生位置・強さ） | `Slider`（動かしている間は `onInput`、離したら `onCommit` で保存） | `<input type="range">` |
| 画面の上に重ねて出す | `Dialog` | 自前の下敷き |
| 操作の結果・失敗を少しのあいだ知らせる（「1通をゴミ箱へ移しました」） | `showSnackbar(文)`、失敗は `showSnackbar({ text, tone: "error" })`（画面の下に出て消える。続けて出すと入れ替わる） | 出しっぱなしの `ScreenNotice`（残しておく注意・読めなかった理由だけに使う） |
| 答えるまで閉じない確かめ（音声アシスタントの了承・許可） | 本体の `VoiceGuardPrompt`（`Dialog` と同じ見た目で、背景を押しても閉じない。重なりは guard） | 拡張機能で自前の確かめを作る（`api.tool` の `risk` で宣言する） |
| 区画の見出し・注記 | `SectionTitle`・`Note` | |
| 結果を知らせる | `Message`（`tone="error"`）。画面全体の知らせは `ScreenNotice` | `<p className="screen__notice">` を直に書く |
| 気を付けてほしいこと | `Notice` | |
| 会話の画面 | `ChatLayout`・`ChatLog`・`ChatRow`・`ChatBubble`・`ChatComposer` | |
| ウィジェット | `WidgetCard`、詳細は `DetailFrame`、補足の1行は `WidgetHint` | `className="widget-card"` を直に書く |
| 戻る | `BackButton` | |

## 7. 重なりと画面の大きさ

**重なりの順**（`--z-*`）: base 1（画面）＜ handle 2（サイドバーのつまみ・カードの編集の層）＜ tabbar 3（スマホの下のタブバー）＜ launcher 5（音声の起動ボタン）＜ popover 10（メニュー・詳細）＜ bar 15（編集の操作帯）＜ snackbar 20（操作の結果の知らせ）＜ modal 30（小窓）＜ voice 40（音声のパネル。小窓を開いていても上に出す）＜ guard 50（音声アシスタントの了承・許可の小窓。話しかけている最中に出るので、音声のパネルより上）

**画面の大きさの区切り**

| 区切り | 何が変わるか |
|---|---|
| `max-width: 620px` | スマホ。サイドバーが下のタブバーになり、並びが1列になる |
| `max-width: 900px` | タブレット。ホームが2段組みになり、2列の画面が1列になる |
| `max-width: 1100px` / `min-width: 1100px` | チャットの会話一覧を隠す・天気の横並び |
| `min-aspect-ratio: 2/1 and max-height: 820px` | 壁掛けの横長で背の低い画面（本来の想定）。見出しを小さくする |
| `min-width: 1500px` / `max-width: 1499px` | メールだけ。左の欄・一覧・本文の3つを並べられる幅（狭いときは本文を開くと一覧を隠す） |

新しく区切るときは、この4つ（3つを並べる画面は 1500px）のどれかに合わせる。

## 8. 動き

| トークン | 値 | 使う所 |
|---|---|---|
| `--motion-fast` | 120ms | 色が変わる・押して縮む・hover |
| `--motion-base` | 200ms | トグル・メニュー・タブ・中身の入れ替え・下敷き |
| `--motion-slow` | 280ms | 小窓の面・画面の切り替え |
| `--motion-reveal` | 1600ms | 追加したウィジェットを光らせる |
| `--ease-out` | cubic-bezier(.2, .8, .2, 1) | 出てくるもの（減速して止まる） |
| `--ease-in` | cubic-bezier(.4, 0, 1, 1) | 消えるもの（加速して去る） |
| `--ease-standard` | cubic-bezier(.2, 0, 0, 1) | その場で色や形が変わるもの |
| `--motion-rise` | 10px | 出てくるときに上がる距離 |

**動きの型**（`animate-*` のクラス。部品を使えば付いてくる）

| 何が | 動き | 型 |
|---|---|---|
| 画面を開く（サイドバー・ホームに戻る） | 中身の区画が下から上がりながら現れる。区画ごとに 40ms ずつずらす | `motion-enter` slow |
| 設定の項目・タブを切り替える | 中身が下から上がりながら現れる | `motion-enter` base |
| 小窓を開く | 下敷きが薄く現れ、面が 97% から広がる | `motion-fade` base ＋ `motion-pop` slow |
| メニューを開く | 上から落ちてくる。山形の印が回る | `motion-drop` base |
| 知らせ・結果が出る | 現れる | `motion-fade` base |
| スナックバー | 下から上がりながら現れ、下がりながら消える | `motion-enter` base ＋ `motion-exit` base |
| 吹き出しが増える | 最後の1つが下から上がる | `motion-enter` base |
| 押す | 色が変わり、押している間 96%（一覧の行は 98.5%）に縮む | transition fast |
| トグル・タブ・家電の入／切 | 色と印が動く | transition base |
| 追加したウィジェット | そこまでスクロールし、縁が光る | `widget-reveal` reveal |
| 小窓を閉じる | 下敷きが薄くなり、面が 97% へ縮みながら消える | `motion-fade-out` ＋ `motion-pop-out` base |
| メニューを閉じる | 上へ縮みながら薄くなる | `motion-drop-out` fast |
| 編集の操作帯・カードの編集の層を閉じる | 下がりながら薄くなる／薄くなる | `motion-exit` ／ `motion-fade-out` base |
| 音声のパネルを閉じる | 薄くなってから消える | `motion-fade-out` base |

**決まり**

- 動かすのは `transform` と `opacity` だけ。幅・高さ・位置・ぼかしは動かさない（ガラスのぼかしの描き直しが重い。GPU の無いキオスク端末で特に）
- 開け閉めするものは、出てきた動きを逆にたどって消える。時間は出るときより短く（base か fast）、曲線は `--ease-in`。消える間は押せなくする（`pointer-events: none`）
- 消える動きは `@home-dashboard/ui` の2つで付ける。親が開け閉めを持つもの（メニュー・親の状態で出す小窓）は `usePresence(open)` で、閉じた後も動きの間だけ出しておき `.is-closing` を付ける。親が出し消しする小窓が自分の × ・背景・Esc で閉じるときは `useClosing(onClose)` で、動きの後で `onClose` を呼ぶ（`Dialog` はこれで閉じる）
- 画面の切り替えや、一覧から行が無くなるときは、消える動きを付けない（次の中身がすぐ出るので、目で追わなくてよい）
- 繰り返す動き（回る・脈打つ）は、何かを待っている間だけにする。ウィジェットに常に動くものを置かない
- `transition: all` は使わない。動かすプロパティを書く
- ブラウザがタップした所に重ねる青い覆い（`-webkit-tap-highlight-color`）は、`styles/base.css` で全体を消してある。押した手応えは部品自身の縮み・色で出す（自前の部品も、押したときの見た目を付ける）
- 端末の「動きを減らす」設定では、時間を全部 0 にし、出てくるときの動きを消す（`:root` の `--motion-*` を 0 にするだけで全部止まる）
- JS で動かすもの（スクロール・何秒後に外す）は、`@home-dashboard/ui` の `scrollBehavior()`・`motionMs("reveal")` を使って同じ決まりに合わせる

## 9. そのほか

- **スクロールバー**はふだん隠し、スクロールしている間だけ細く出す（`lib/scrollbars.ts` が `.is-scrolling` を付け外しする）。隠す間も幅は取っておくので、出し入れで中身がずれない
- **アイコン**は Fluent UI System Icons（`apps/web/public/icons`）。`Icon` 部品で出し、色は文字の色に付いてくる
- **字体**は Murecho（なければ Hiragino Sans・Noto Sans JP）

## 10. 揃えたこと（2026-10-23）

10-22 の棚卸しで見つかった「同じ役割なのに値や書き方が違う所」は、次のように揃えた（見た目が少し変わった所がある）。

| 何が | 揃えた形 |
|---|---|
| 字の大きさの直書き | 3章の段へ。例外は、入力欄（スマホで拡大されないよう 1rem）・アイコンの字・音声のパネル（px で設計）・グラフの目盛り |
| 小窓・詳細の見出し | heading（`Dialog`・ウィジェットの追加・ウィジェットの設定・`DetailFrame` の `title`） |
| 大きな数値の太さ | 600（700 は時計とカードの見出しだけ） |
| ガラスを自前で書いている所 | `glass` の1か所にまとめた。Home Control のセンサーは `StatTile`（`onClick`・`tone`） |
| ボタン | 高さは 40（`Button`）・44（`PillMenu`・`IconButton`）・52（壁掛けで押す Home Control と編集の操作帯）。閉じるボタンは全部 `IconButton` と同じ 44px の丸。危ないボタンは `--danger-strong` の地に `--on-danger` の文字 |
| 明るい塗り | `--fill`（地）と `--on-fill`（文字） |
| 浮かせる面 | `--surface-raised` |
| 写真・アートワークの角丸 | 小 12px・大 `--inner-radius` |
| 進み具合のバー | `ProgressBar`（高さ 6px・地は `--line`・色は `--progress-color`） |
| バッジ | `Badge`（`tone`: on・warn・dim） |
| ウィジェットの部品 | 全部の拡張機能が `WidgetCard`・`DetailFrame` を使う |
| 画面の区切り | 7章の4つ（メールの 1500px だけ例外） |

`ButtonLink` は今は使われていないが、拡張機能向けの部品なので残す。
