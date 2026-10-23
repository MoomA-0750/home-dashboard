#!/usr/bin/env bash
# Claude Code の statusLine の入力（標準入力の JSON）を、ダッシュボードへ送る。
# 利用制限（5時間・週）は statusLine にしか出てこないので、~/.claude/statusline.sh から次のように呼ぶ:
#
#   printf '%s' "$input" | ~/Documents/git-cloned/home-dashboard/scripts/claude-limits-report.sh >/dev/null 2>&1 &
#
# 送り先は HOME_DASHBOARD_URL（既定 http://localhost:8787）。
# 合言葉（ダッシュボードの .env の CLAUDE_LIMITS_TOKEN と同じ値）は、環境変数 CLAUDE_LIMITS_TOKEN か
# ~/.config/home-dashboard/claude-limits-token（chmod 600）に置く。合言葉が無いとダッシュボードは受け取らない。
# プロンプトの描画を止めないよう短い時間で諦め、失敗しても何も言わない。
set -u
url="${HOME_DASHBOARD_URL:-http://localhost:8787}"
token="${CLAUDE_LIMITS_TOKEN:-}"
token_file="${XDG_CONFIG_HOME:-$HOME/.config}/home-dashboard/claude-limits-token"
if [ -z "$token" ] && [ -r "$token_file" ]; then
  token="$(tr -d '[:space:]' < "$token_file")"
fi
[ -n "$token" ] || exit 0
# 合言葉はコマンドラインに載せず（ps で見えるため）、ヘッダーをファイルとして渡す
curl -s -m 2 -o /dev/null -X POST -H 'Content-Type: application/json' \
  -H @<(printf 'Authorization: Bearer %s\n' "$token") \
  --data-binary @- "$url/api/ext/claude/limits" || true
