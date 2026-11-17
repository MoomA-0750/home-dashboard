# AGENTS.md

このリポジトリで画面（`apps/web`・`packages/ui`・`extensions/*`）を作る・直すときの決まり。

- 見た目と動きの決まりは `docs/design-system.md`、拡張機能の作り方は `docs/extensions.md`
- 色・面・字・余白・動きの名前と値は kasane の `dashboard` テーマ。`packages/ui/src/kasane/` は kasane から写したもの（`kasane-native.json`）で、手で直さない。
  名前の意味と決まり（kasane の DESIGN.md）は kasane のリポジトリにある。足りない名前は kasane の側に足してから写し直す
- この画面だけの値は `--home-dashboard-*`（`packages/ui/src/styles/tokens.css`）。前の名前（`--text-primary`・`text-text`・`font-semibold` など）は
  外で組まれた拡張機能のための互換の層なので、消さない・新しく使わない
- 確かめる: `pnpm lint:style`、`pnpm typecheck`、kasane の検査（kasane の `scripts/lint.mjs packages/ui/src apps/web --app home-dashboard`。許すものは `kasane-allow.txt` に理由と書く）、
  kasane から写したものが古くないか（kasane の `scripts/kasane-sync.mjs . --check`）
