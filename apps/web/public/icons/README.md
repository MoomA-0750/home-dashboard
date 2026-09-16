# Icons

Microsoft Fluent UI System Icons を SVG のまま置いてある。
`.fluent-icon`（`apps/web/src/styles/theme.css`）が CSS マスクとして読み込むため、
SVG 内の色は使われず、親要素の `color` がそのままアイコンの色になる。

追加するときはこのディレクトリに SVG を置き、`apps/web/src/components/Icon.tsx` の
`ICON_FILES` に 1 行足す。

## 対応表

| ダッシュボードでの用途 | Fluent icon |
| --- | --- |
| Home | Home 24 Regular |
| Media | Play 24 Regular |
| Home Control | Lightbulb 24 Regular |
| Toolbox | Toolbox 24 Regular |
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

Source: https://github.com/microsoft/fluentui-system-icons

ライセンスは `LICENSE.txt` を参照。
