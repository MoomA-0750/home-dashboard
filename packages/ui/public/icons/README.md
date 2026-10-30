# Icons

Microsoft Fluent UI System Icons を SVG のまま置いてある。
`.fluent-icon`（`packages/ui/src/theme.css`）が CSS マスクとして読み込むため、
SVG 内の色は使われず、親要素の `color` がそのままアイコンの色になる。

追加するときはこのディレクトリに SVG を置き、`packages/widget-sdk/src/Icon.tsx` の
`ICON_FILES` に 1 行足す。

## 対応表

| ダッシュボードでの用途 | Fluent icon |
| --- | --- |
| Home | Home 24 Regular |
| 設定が足りない（押すと設定へ。インターネットアカウントの Google・Microsoft など） | Warning 24 Regular |
| Media | Play 24 Regular |
| 鳴らす端末（Media の右上） | Speaker 2 24 Regular |
| 設定画面の一覧の「開く」・「戻る」 | Chevron Right / Chevron Left 24 Regular |
| 設定画面の項目（ウィジェット・アカウント・拡張機能・キャラクター） | Grid / Person / Puzzle Piece / People 24 Regular |
| Home Control | Lightbulb 24 Regular |
| Toolbox（いまはサイドバーに出していない） | Toolbox 24 Regular |
| Settings | Settings 24 Regular |
| シャッフル | Arrow Shuffle 24 Regular |
| 前の曲 | Previous 24 Regular |
| 一時停止 | Pause 24 Filled |
| 再生 | Play 24 Regular |
| 次の曲 | Next 24 Regular |
| リピート | Arrow Repeat All 24 Regular |
| 降水予報 | Drop 24 Regular |
| 閉じる・削除 | Dismiss 24 Regular |
| 追加 | Add 24 Regular |
| 編集モード | Edit 24 Regular |
| 天気（WMO code 別） | Weather Sunny / Moon / Partly Cloudy Day / Partly Cloudy Night / Cloudy / Fog / Rain / Rain Showers Day / Snow / Snowflake / Thunderstorm 24 Regular |
| 天気不明 | Question Circle 24 Regular |
| 音声アシスタント | Mic 24 Regular |
| テキストで話しかける（送信） | Send 24 Regular |
| チャット（画面から話しかける） | Chat 24 Regular |
| 録音を止めて送る | Stop 24 Filled |
| MCP の一覧を更新 | Arrow Sync 24 Regular |
| MCP サーバーを外す | Delete 24 Regular |
| チャットの会話の一覧 | History 24 Regular |
| 新しい会話 | Compose 24 Regular |
| ウィジェットを上へ・下へ | Chevron Up / Chevron Down 24 Regular |
| ウィジェットのつまみ（ドラッグ） | Re Order Dots Vertical 24 Regular |
| 鍵（施錠・解錠） | Lock Closed / Lock Open 24 Regular |
| 室温 | Temperature 24 Regular |
| 二酸化炭素 | Molecule 24 Regular |
| 曲・プレイリスト | Music Note 2 24 Regular |
| 歌詞 | Text Quote 24 Regular |
| おすすめ | Sparkle 24 Regular |
| 電源（エアコンなど） | Power 24 Regular |
| スイッチ | Plug Connected 24 Regular |
| Claude の利用制限 | Gauge 24 Regular |
| この端末を信頼する（鍵の操作の認証） | Shield Keyhole 24 Regular |
| 壁紙 | Image 24 Regular |
| メール | Mail 24 Regular |
| 端末（パソコン・電話） | Desktop / Phone 24 Regular |
| Messages（iMessage） | Chat Multiple 24 Regular |
| ファイルを添える | Attach 24 Regular |
| 選んでいるもの（設定の言語など） | Checkmark 24 Regular |

Source: https://github.com/microsoft/fluentui-system-icons

ライセンスは `LICENSE.txt` を参照。
| カレンダー（Calendar 画面・予定のウィジェット） | Calendar LTR 24 Regular |
| 受信箱（Mail 画面） | Mail Inbox 24 Regular |
| 返信 | Arrow Reply 24 Regular |
| インターネットアカウント（設定画面の項目） | Globe 24 Regular |
| 予定の場所 | Location 24 Regular |
| 予定の時刻 | Clock 24 Regular |
| 風（Weather 画面） | Weather Squalls 24 Regular |
| 視程 | Eye 24 Regular |
| 日の出・日の入り | Weather Sunny Low 24 Regular |
| UV 指数 | Weather Sunny High 24 Regular |
| 大気質 | Leaf One 24 Regular |
| 風向き（矢印） | Arrow Up 24 Regular |
| 霧雨 | Weather Drizzle 24 Regular |
| にわか雨（夜） | Weather Rain Showers Night 24 Regular |
| みぞれ・着氷性の雨 | Weather Rain Snow 24 Regular |
| にわか雪（昼・夜） | Weather Snow Shower Day / Night 24 Regular |
| ひょう（昼・夜） | Weather Hail Day / Night 24 Regular |
| メールの下書き・迷惑メール（Mail の左の欄） | Drafts / Mail Warning 24 Regular |
