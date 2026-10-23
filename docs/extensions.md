# 拡張機能の作り方

ダッシュボードの連携（Home Assistant・天気など）と、画面の機能（Media・チャット）は、すべて「拡張機能」でできている。
1つの拡張機能は1つのフォルダで、サーバー側（API・音声アシスタントのツール）・画面側（ウィジェット・サイドバーの画面・設定の欄）・
接続設定の項目をまとめて持つ。設定画面の「拡張機能」で、管理者が入／切・持ち込み・削除をする。

## 3つの形

| 形 | 例 | 何をするか |
|---|---|---|
| 機能を持つ | Media・チャット・Home Assistant・homelab | 自分でウィジェットや画面を持つ。ほかの拡張機能が入るための**機能の口**を持つこともある |
| 機能に入る | wave・Spotify（Media の「音楽アプリ」に入る） | 口を持つ拡張機能が決めた形を満たして渡すだけ。画面・ウィジェット・音声アシスタントのツールは口を持つ側が持つ |
| どちらでもない | 天気・メール | 自分のウィジェットだけを持つ（「機能を持つ」の小さいもの） |

設定画面の一覧は、この形で分かれて並ぶ（入るものは「Media の音楽アプリ」のように、口ごとにまとまる）。

## はじめる

```bash
pnpm new:extension my-thing --name 私のもの --widget --screen --server   # extensions/my-thing ができる
pnpm install                                                              # 型（SDK）を読めるようにする
pnpm build:extension extensions/my-thing                                  # dist/ ができる
pnpm build:extension extensions/my-thing --zip                            # 持ち込み用の my-thing-0.1.0.zip もできる
pnpm dev:extensions                                                       # extensions/* を見張って組み立て直す
```

- `--widget`（ウィジェット）・`--screen`（サイドバーの画面）・`--server`（サーバー側）を選ぶ。何も付けなければウィジェットとサーバー側
- `--provides music` で、Media の音楽アプリのような「機能に入る」ものを作る
- `--dir ../somewhere/my-thing` で、リポジトリの外に作る
- 本体の拡張機能（`extensions/*`）は、サーバーを起動し直すと読む。ZIP は設定画面の「拡張機能を持ち込む」で入れる（同じ id は入れ替わる）
- 見本: `examples/extensions/memo`（伝言メモ。ウィジェット・詳しい画面・API・WebSocket の知らせ・音声アシスタントのツール・設定）

## フォルダの形

```
my-thing/
  manifest.json     id・名前・版・説明・接続設定の項目・機能の口（下の「manifest.json」）
  src/server.ts     サーバー側（無くてもよい）。npm の依存も server.js に1つにまとまる
  src/web.tsx       画面側（無くてもよい）。import した .css は web.css にまとまる
  assets/           画面に配るファイル（アイコンなど。/api/extensions/<id>/files/assets/... で読める）
```

組み立てると `dist/{manifest.json,server.js,web.js,web.css,assets/}` ができる。サーバー側も画面側も無い、manifest だけの拡張機能も作れる
（チャットがそう。画面は本体の音声アシスタントと一緒に動くので本体にあり、拡張機能は入／切だけを受け持つ）。

## manifest.json

```json
{
  "id": "my-thing",
  "name": "私のもの",
  "version": "0.1.0",
  "description": "設定画面の一覧に出す説明",
  "apiVersion": 1,
  "settings": [
    { "key": "url", "label": "URL", "kind": "url", "env": "MY_THING_URL", "placeholder": "http://..." },
    { "key": "token", "label": "トークン", "kind": "secret", "env": "MY_THING_TOKEN" }
  ],
  "settingsNote": "接続設定の上に出す説明",
  "settingsTest": "/test",
  "features": [{ "id": "notice", "name": "お知らせの出どころ", "description": "..." }],
  "provides": ["music"]
}
```

- `id` は小文字の英数字と `-`（40文字まで）。API の道（`/api/ext/<id>/`）や置き場の名前になる
- `settings` の `kind` は `text`・`url`・`secret`・`number`・`boolean`。`env` の環境変数を既定にし、画面で変えた値を優先する。
  `secret` は画面に返さない
- `settingsTest` を書くと、接続設定に「接続を確かめる」が出る（`POST /api/ext/<id><path>` を呼び、`{ ok, message }` を見せる）
- `settingsGroups` で、接続設定を出どころごとの区画に分ける（カレンダー・メールの Google・Microsoft など）。
  `{ "id", "title", "note"?, "fields": [項目の key], "steps"?: [手順の文], "links"?: [{ "label", "href" }] }` の並び。
  区画ごとに「設定済み」と保存のボタンが付き、`steps` は「手順」を開くと番号付きで出る。手順の `{key}` はその項目の今の値
  （秘密の項目を除く。まだ無ければ項目の名前）に置き換わるので、戻り先の URL などを写して使える。
  `links` は `https://` の外のページ（サービスの管理画面など）か、`/` から始まる本体の中の道。どの区画にも入れない項目は、いちばん上の区画に出る
- `features` はこの拡張機能が持つ**機能の口**、`provides` は**入る口**（下の「機能の口」）

## サーバー側（src/server.ts）

```ts
import { defineServerExtension, HttpError } from "@home-dashboard/extension-sdk";

export default defineServerExtension({
  register(api) {
    api.route("GET", "/items/:id", ({ params, query, account }) => ({ id: params.id }));
    api.tool({ name: "my_thing_status", description: "…を返す。", risk: "read", handler: async () => ({}) });
  },
});
```

`api` でできること（型は `packages/extension-sdk/src/index.ts`）:

- `api.route(method, path, handler, { public?, adminOnly? })` … `/api/ext/<id><path>` で受ける。既定でログインが要る。
  `/auth/...` の道は `/auth/<id>/...` でも受ける（外のサービスの認可の戻り先）。返したオブジェクトは JSON になる。
  `api.redirect(url)`・`api.text(body)`・`api.file(bytes, contentType, { cacheSeconds? })`（画像・音声などをそのまま。
  image/・audio/・video/ 以外の形はダウンロードさせる）で別の形に、`throw new HttpError(409, "理由")` で状態コードと画面に出してよい理由を返す
- `api.tool({ name, description, inputSchema: (z) => ({...}), risk?, personal?, untrusted?, describe?, handler })` … 音声アシスタント（Claude）に渡すツール。
  `description` を関数にすると、一覧を読むときだけ作る（家電の一覧を埋め込むなど）。
  部屋にいる誰の声でも動くので、本体が実行の前に確かめをする（README の「音声アシスタントの道具の確かめ」）。そのために次を宣言する:
  - `risk` … 危なさ。`"read"`（読むだけ）・`"low"`（すぐ戻せる操作。照明・音楽など）・`"confirm"`（話している人の了承が要る。送信・削除など）・
    `"approve"`（画面で本人確認して許可したときだけ。解錠など）。引数で変わるもの（鍵の施錠と解錠など）は `(args) => …` の関数にする。
    省くと `readOnly: true` なら read、そうでなければ confirm
  - `personal` … 家の人の情報（メール・予定など）を返す（声では出さない設定にできる）
  - `untrusted` … 外の人が書いた文（メールの本文・予定の招待の名前など）を返す（読んだ後の会話では、low の操作にも了承を求める）
  - `describe(args)` … 確かめの小窓と聞き返しに出す「何をするか」の一文（例: 「玄関を解錠する」）。省くと道具の名前と引数を出す
  - `handler(args, { approvedBy })` … approve の道具は、許可したアカウントが `approvedBy` に入る。了承は本体がするので、
    `confirmed` のような引数を自分で持たなくてよい
- `api.settings`（接続設定の今の値）・`api.onSettingsChange(fn)`・`api.updateSettings({...})`（認可で受け取ったトークンを保存するなど）
- `api.dataDir`（この拡張機能だけの書ける置き場）・`api.configDir`（本体の config/）
- `api.broadcast(type, payload)` … つないでいる画面へ知らせる（画面には `ext:<id>:<type>` で届く）
- `api.provide(feature, implementation)`・`api.providers(feature)` … 機能の口（下）
- `api.onDispose(fn)` … 切ったとき・入れ替えたときの後片付け（タイマーを止めるなど）
- `api.log.info/warn/error`
- 道の `handler` に渡る `bearer` … ログインの要らない道（`public: true`）に `Authorization: Bearer <値>` で添えられた値。
  外のプログラムに合言葉を持たせて確かめるときに使う（Claude の拡張機能の `POST /limits` など）。ほかの道では常に null

### 別のプロセスで動くとき

持ち込まれた拡張機能（ZIP・リポジトリから入れたもの）は、管理者が信頼するにしない限り、別のプロセスで権限を絞って動く。
本体の拡張機能（`extensions/*`）と同じ書き方で動くが、次が違う:

- 読めるのは自分のファイルと `api.dataDir`、書けるのは `api.dataDir` だけ。`api.configDir` やホストのファイルは読めない。
  子プロセス（`child_process`）・ワーカー・ネイティブのアドオンも使えない。`process.env` に本体の環境変数は無い（接続設定は `api.settings` で読む）
- 道・道具・機能の口は本体に写しを作って、呼ばれるたびにプロセスをまたいで呼ぶ。渡す値と返す値は写せるもの（JSON・`Uint8Array`・`Date` など）にする
- `api.provide` で渡したものは、本体の側から見ると関数がすべて Promise を返す。`api.providers` は使えない（いつも空）
- `risk` の関数・`describe`・関数にした `description` は本体から尋ねられる（答えは Promise になる）
- プロセスが落ちると、理由を残して切れた扱いになる（入れ直すと起動し直す）

ホストのファイルを読む・コマンドを使うなど、これでは動かないものは、管理者が拡張機能の詳細の「本体と同じ権限で動かす」で信頼する。

## 画面側（src/web.tsx）

```tsx
import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { myWidget } from "./widget";
import { MyScreen } from "./screen";
import { MySettings } from "./MySettings";
import "./web.css";

export default defineWebExtension({
  widgets: [myWidget],
  screens: [{ id: "main", label: "私のもの", icon: "grid", order: 50, Component: MyScreen }],
  SettingsPanel: MySettings, // 設定画面の拡張機能の詳細で、接続設定の下に出す欄（manifest の settings で表せない設定）
  provides: { music: { name: "私のもの", order: 30 } }, // 機能に入るとき
});
```

- React と `@home-dashboard/widget-sdk` は本体のものを使う（ビルドの道具が同梱しないようにつなぐ。React が2つあると hooks が動かない）
- ウィジェットは `defineWidget({ id, name, defaultSize, defaultConfig, Component, DetailComponent?, SettingsComponent? })`。
  `Component` は `{ ctx, config, size, openDetail }`、`SettingsComponent`（ホームの編集中に歯車から開く）は `{ config, ctx, onChange }` を受け取る
- サイドバーの画面の `Component` は `{ ctx, account }` を受け取る
- API は `extensionApiUrl(ctx, "<id>", "/items")` で呼ぶ。読み直しは `usePolling`・`usePolledResource`、
  サーバーの知らせは `ctx.socket` の `message` で `ext:<id>:<type>` を見る

## 本体の部品（デザイン）

見た目は本体の部品を組み合わせて作り、拡張機能の CSS では色・角丸・余白・影を決めない。本体の見た目が変わっても、拡張機能はそのままそろう。
部品は `@home-dashboard/widget-sdk` から import する（実体は `packages/widget-sdk/src/ui.tsx`、見た目は本体の `theme.css` の `ui-*`）。
どの部品・値をどこでどう使うか（色・字の段・余白・重なり・動き）の決まりは [design-system.md](design-system.md) にある。

| 部品 | 使うところ |
|---|---|
| `WidgetCard` | ウィジェットのカード。押して詳しく開くものは `onClick` を渡す（button になる） |
| `WidgetHint` | ウィジェットの中の補足の一行。`tone="error"` で注意の色 |
| `DetailFrame` | ウィジェットを押して開く詳しい画面の中身と見出し |
| `ScreenFrame`・`ScreenSection`・`ScreenNotice` | サイドバーの画面の枠・区切りと見出し・知らせ |
| `StatTile`・`StatGrid` | 値のタイル（アイコン付きの名前と大きな値。Home Control のセンサー・Weather と同じ形）と、その並べ方 |
| `Dialog` | 画面の上に重ねて出す小窓（場所の追加など。背景・Esc・× で閉じる） |
| `PillMenu` | 画面の右上で選ぶもの（Media の音楽アプリ・Home Control の部屋など） |
| `Button`（`variant`: `primary`・`danger`、`icon`）・`ButtonLink`・`ButtonRow` | ボタン。どれも丸い端の同じ高さ。`primary` はその場でいちばん押すもの（保存など）、`danger` は消すのを確かめるもの |
| `Group` | 入れ物（区画）。中に入力欄やボタンを並べる |
| `List`（`boxed`）・`ListItem`（`title`・`detail`・`badge`・`leading`・`trailing`・`onClick`・`off`・`selected`・`chevron`・`error`） | 一覧。ふだんは角の丸い行が並ぶ形（選んで開く・切り替えるもの）。`boxed` を付けると1つのガラスの入れ物に入れて線で区切る（天気の日ごと・予定のように、並べて読み比べるもの）。押せる行は右に矢印が出る。入／切は `trailing` に `ToggleSwitch` |
| `ToggleSwitch` | 入／切 |
| `Slider`（`value`・`min`・`max`・`step`・`onInput`・`onCommit`） | 量を変えるバー（再生位置・明るさ・強さ）。動かしている間は `onInput`、離したときに `onCommit` を一度だけ呼ぶ |
| `Field`（`label`・`hint`）・`Check` | 入力欄・選ぶ欄に名前を付ける（中に `<input>`・`<select>`・`<textarea>` を置く）・チェックボックス |
| `SectionTitle`・`Note`・`Notice`・`Message`（`tone`）・`Badge` | 区画の見出し・説明の文・目立たせる知らせ・操作の結果・小さな印 |
| `BackButton`・`CodeBlock` | 一覧から開いた詳しい画面の戻る・そのまま写して使う文字（コマンド・鍵） |
| `Icon` | 本体のアイコン（`name`）か、自分の SVG（`src`） |

```tsx
<SectionTitle>ホスト</SectionTitle>
<Note>ウィジェットに出す機械です。</Note>
<List>
  <ListItem title="mooma-lpve" detail="SSH · 192.168.1.10" onClick={open} />
  <ListItem title="センサー" trailing={<ToggleSwitch checked={on} label="センサーを切る" onChange={setOn} />} />
</List>
<Group>
  <Field label="名前"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
  <ButtonRow>
    <Button variant="primary" type="submit">保存</Button>
    <Button onClick={test}>接続を確かめる</Button>
  </ButtonRow>
</Group>
```

寸法の決まり（本体の `theme.css` の `:root`）:

- ウィジェットのカードは角丸 45px・内側の余白 30px。中の部品の角丸は `--inner-radius`（外の角丸 − 内側の余白）
- 入れ物（`Group`・`List`）は内側の余白 `--group-padding`、角丸 `--group-radius`（中の角丸 ＋ 内側の余白。中の入力欄・ボタンと縁が平行になる）
- 一覧の1行（名前と説明だけ）は上下 `--group-row-padding`、文章を何行も載せるものは上下も `--group-padding`
- 入れ物と入れ物のあいだは `--group-gap`

- 字の大きさは `--font-*`、余白は `--space-*`、動きは `--motion-*`・`--ease-*` から選ぶ。JS で動かすスクロールは `scrollBehavior()` を使う（「動きを減らす」設定に合わせる）

自分の CSS（`src/web.css`）には、中身の並べ方（並ぶ向き・間・大きさ）だけを書く。クラス名は拡張機能の id で始めて、ほかとぶつからないようにする。
色が要るときは本体の変数（`--text-primary`・`--text-secondary`・`--accent-warn`・`--glass-border` など）を使う。

## 言語（日本語・英語）

画面の言語は、設定の「一般 → 言語」でアカウントごとに選ぶ（日本語・英語。どの端末でログインしても同じ言語）。拡張機能も、画面に出す文をどちらの言語でも出せるようにする。

- **画面側**: `defineMessages({ ja: {...}, en: {...} })` で辞書を作り、部品の中で `const t = messages.useT()`、`t("key", { n: 3 })`。
  英語の辞書は日本語と同じ鍵をすべて持つ（型で確かめる）。数で言い方が変わる英語は関数で書ける（`(p) => (p.n === 1 ? "1 item" : `${p.n} items`)`）。
  React の外（fetch のエラーの文など）では `messages.t("key")`（今の言語）。日付・時刻は `formatClock`・`formatPastDay`・`intlLocale()`（`Intl` に渡す名前）。
- **本体に渡す名前**（画面の `label`・`ariaLabel`、ウィジェットの `name`・`description`、設定のページの `label`、機能の口の `name`）は、
  `{ ja: "天気", en: "Weather" }` のように言語ごとに書ける（`LocalizedText`）。
- **日付・時刻・温度**: 設定の「一般」で、暦（西暦・和暦）・日付の形・時刻（24・12時間）・週の始まり・温度の単位も選ぶ（アカウントごと）。
  自分で `toLocaleDateString` せず、`useDateFormat()`（`date(d, "monthDayWeekday")` など。形は `monthDay`・`monthDayWeekday`・`weekday`・`full`・`fullWeekday`・`monthYear`）、
  `useTimeFormat()`・`formatClock`、`useTemperature()`（摂氏を渡すと設定の単位で出す）、`convertReading(value, unit)`（センサーの読み値の温度を直す）、
  `startOfWeek(date)` を使う。画面の見出し（`ScreenFrame` の `title`）と画面の名前（`label`）は `{ ja, en }` で渡す。
- **サーバー側**: 画面に返す文（`api.error` の理由など）は `defineServerMessages({ ja, en })` の辞書から、道の `ctx.locale` で引く
  （`messages.t(ctx.locale, "notFound")`）。音声アシスタントのツールの説明・答えは日本語のままでよい。
- **manifest.json**: `locales.en` に英語の名前・説明・設定の項目を書く（書いていないものは日本語のまま出る）。

```json
"locales": {
  "en": {
    "name": "Weather",
    "description": "Weather from Open-Meteo …",
    "settingsNote": "Look up the latitude and longitude in a map app.",
    "settings": { "lat": { "label": "Latitude" }, "name": { "label": "Place name", "placeholder": "Tokyo" } },
    "features": { "music": { "name": "Music apps" } },
    "settingsLinks": ["Connect to Spotify"],
    "settingsGroups": { "google": { "title": "Google", "note": "…", "steps": ["…"], "links": ["Open Google Cloud"] } }
  }
}
```

## 機能の口（拡張機能どうしのつながり）

ある拡張機能が口を持ち、ほかの拡張機能がそこへ入る。Media の「音楽アプリ」（`music`）がその例で、wave・Spotify が入っている。

**口を持つ側**（Media）:

1. manifest.json の `features` に口を書く（`{ "id": "music", "name": "音楽アプリ" }`）
2. 入るものが満たす形を型で決めて、ほかの拡張機能から import できるようにする
   （`extensions/media/package.json` の `exports` の `./types` → `MusicProvider`）
3. サーバー側で `api.providers<MusicProvider>("music")` から入っているものを集めて使う（読むたびに今のものが返る。
   切った拡張機能のものは消える）。Media はこれで、画面の道（`/api/ext/media/providers/<id>/...`）と、
   音声アシスタントの `get_now_playing`・`control_music` を1組だけ持つ
4. 画面側で `useFeatureProviders("music")` から、入っているもの（`extensionId`・`name`・`order`）を読む（Media の右上の選択）

**入る側**（wave・Spotify）:

1. manifest.json の `provides` に口の id を書く（`["music"]`）
2. サーバー側で `api.provide("music", provider)`。`provider` は口を持つ側の形（`import type { MusicProvider } from "@home-dashboard/ext-media/types"`）
3. 画面側で `provides: { music: { name: "wave", order: 10 } }`（右上に出す名前と、選んでいない端末で先に使う順）

入る先の口を持つ拡張機能が切ってあると、入る側は設定画面に「…が切ってあるので使われていません」と出る。

**画面ごと入る口**: 拡張機能「チャット」の「チャットアプリ」（`chat`）は、入る側が画面を持ってくる。
画面側で `provides: { chat: { name: "iMessage", order: 20, Component } }` と書くと、本体の Chat 画面の右上の切り替えに並び、
選ぶと音声アシスタントのチャットの代わりに `Component` が出る。`Component` は `ChatAppProps`（`ctx`・`account`・`switcher`）を受け取り、
`switcher`（本体が作る切り替え）を見出しの右に置く。サーバー側の `api.provide` は要らない（iMessage が例）。

## 公開する・リポジトリから入れる

組み立てたものを Git のリポジトリの**公開用の枝**（既定は `dist-extensions`）に置くと、ダッシュボードはそのリポジトリを登録して、
そこから入れたり更新したりできる。ダッシュボードの側では組み立てないので、どの環境でも、置いたものと同じものが動く。

```bash
pnpm publish:extensions          # 組み立てて、置くもの（足す・更新・そのまま）を見せる。枝は変えない
pnpm publish:extensions --push   # 公開用の枝に置いて push する
```

- 枝には `catalog.json`（拡張機能の一覧と版）と、拡張機能ごとの組み立て済みのフォルダが入る
- **中身を変えたら manifest.json の version を上げる**。上げ忘れたものがあると置かずに止まる（ダッシュボードは版が上がったときだけ更新を知らせるため）
- このリポジトリでは、main に push すると GitHub Actions（`.github/workflows/publish-extensions.yml`）が同じことをする

ダッシュボードの側（設定画面の「拡張機能 → リポジトリ」。管理者だけ）:

- URL（`https://…`）と枝を登録する。非公開のリポジトリなら、読むためのトークン（GitHub なら、そのリポジトリの Contents を読むだけの
  fine-grained token）も入れる。トークンは `data/extension-sources.json`（持ち主だけが読める）に置き、画面には返さない
- 6時間ごとに確かめ、新しい版があれば「更新あり」と出る。押すと入れ替わる。拡張機能ごとに「自動で更新する」を選べる
  （本体と同じ権限で動かすと信頼したものは、自動では更新しない。リポジトリが乗っ取られても、悪い版が本体の中で動かないように）
- 本体に入っている拡張機能も、リポジトリにそれより新しい版があれば更新できる（本体の版の代わりに動く。「本体の版に戻す」で戻せる。
  ダッシュボード本体を更新して本体の版のほうが新しくなったら、本体の版に戻る）
- ZIP で持ち込んだものには、リポジトリの更新は来ない（同じ id でも別物かもしれないため）
- 起動時に登録しておくリポジトリは `.env` の `EXTENSION_SOURCE_URL`・`EXTENSION_SOURCE_BRANCH`・`EXTENSION_SOURCE_TOKEN` で決められる

## 気をつけること

- 本体の拡張機能と、管理者が信頼した拡張機能のサーバー側はダッシュボードのサーバーの中で動き、接続設定のトークンにも触れられる。
  信頼するのは、作った人を信頼できるものだけにする。持ち込んだものは別のプロセスで動く（上の「別のプロセスで動くとき」）
- 持ち込んだもの・リポジトリから入れたものは `data/extensions/<id>/` に置かれる。消しても、書いたデータ（`data/extension-data/<id>/`）と接続設定は残る
- 本体の拡張機能（`extensions/*`）は切れるが消せない。持ち込んだものと同じ id は使えない
- 置いてあったウィジェットは、拡張機能を切っても場所を残し、入れ直すと戻る
