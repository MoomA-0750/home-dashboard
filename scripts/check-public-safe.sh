#!/usr/bin/env bash
# push しようとしている内容に「public にしたら困るもの」が含まれていないか検査する。
#
# このリポジトリは現在 private だが、いつ public に切り替えても問題ない状態を保つ方針。
# 認証情報そのものだけでなく、自宅ネットワークの実アドレスや tailnet 名のような
# 「漏れても致命的ではないが、わざわざ公開する必要のない識別子」も対象にする。
#
# 使い方:
#   scripts/check-public-safe.sh                       # HEAD のツリーを検査（手元での確認用）
#   scripts/check-public-safe.sh <commit-ish>          # そのコミットのツリーを検査
#   scripts/check-public-safe.sh --objects <rev-list引数...>
#                                                      # 実際に送られるオブジェクトを検査
#
# --objects モードが本命。ツリーだけを見ると「最新の中身は綺麗だが履歴に残っている」ブランチを
# 見逃すため、pre-push フックからはこちらを使う（新規ブランチの push では履歴ごと送られる）。
#
# 例外を認めたい文字列（ドキュメント用のダミーIP等）は scripts/public-safe-allow.txt に
# 1行1リテラルで書く。その文字列を含む行は検出対象から外れる。

set -uo pipefail

repo_root="$(git rev-parse --show-toplevel)"
allow_file="$repo_root/scripts/public-safe-allow.txt"

# 検出パターン: "説明<TAB>正規表現(ERE)"
patterns=$(
  cat <<'PATTERNS'
JWT形式のトークン(HAの長期アクセストークン等)	eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}
GitHubトークン	gh[pousr]_[A-Za-z0-9]{30,}
Tailscale認証キー	tskey-[a-z]+-[A-Za-z0-9-]{10,}
Slackトークン	xox[baprs]-[A-Za-z0-9-]{10,}
OpenAI形式のAPIキー	sk-[A-Za-z0-9]{32,}
Google APIキー	AIza[0-9A-Za-z_-]{35}
秘密鍵	-----BEGIN [A-Z ]*PRIVATE KEY-----
tailnet名(*.ts.net)	\b[a-z0-9][a-z0-9-]*\.ts\.net\b
TailscaleのIP(100.64.0.0/10)	\b100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}\b
プライベートIP(192.168.x.x)	\b192\.168\.[0-9]{1,3}\.[0-9]{1,3}\b
プライベートIP(10.x.x.x)	\b10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b
プライベートIP(172.16-31.x.x)	\b172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3}\b
PATTERNS
)

# 検査対象を "<blob sha><TAB><表示用パス>" の一覧として組み立てる
targets=$(mktemp)
tmp=$(mktemp)
trap 'rm -f "$targets" "$tmp" "$tmp.filtered"' EXIT

if [ "${1:-}" = "--objects" ]; then
  shift
  [ $# -eq 0 ] && { echo "--objects には rev-list の引数が必要です" >&2; exit 2; }
  # rev-list --objects は "<sha> <path>" を出す（コミット・ツリーはパスが空）。blobだけ拾う。
  git rev-list --objects "$@" \
    | while read -r sha path; do
        [ -z "$path" ] && continue
        [ "$(git cat-file -t "$sha" 2>/dev/null)" = blob ] && printf '%s\t%s\n' "$sha" "$path"
      done | sort -u > "$targets"
  scope="push対象のオブジェクト"
else
  rev="${1:-HEAD}"
  git ls-tree -r "$rev" \
    | while read -r _mode type sha path; do
        [ "$type" = blob ] && printf '%s\t%s\n' "$sha" "$path"
      done > "$targets"
  scope="$rev のツリー"
fi

if [ ! -s "$targets" ]; then
  echo "✓ public-safe チェック: 検査対象なし（$scope）"
  exit 0
fi

findings=0

while IFS=$'\t' read -r label regex; do
  [ -z "${label:-}" ] && continue
  : > "$tmp"

  while IFS=$'\t' read -r sha path; do
    case "$path" in
      # ロックファイルはハッシュ列が誤検出を生むうえ、人が書く場所ではないので除外する
      pnpm-lock.yaml|package-lock.json|yarn.lock) continue ;;
      # 検出器自身と許可リストは、検出パターンを本文に含むので対象外にする（自己検出の回避）
      scripts/check-public-safe.sh|scripts/public-safe-allow.txt) continue ;;
    esac
    git cat-file -p "$sha" 2>/dev/null \
      | grep -nEI "$regex" 2>/dev/null \
      | sed "s|^|$path:|" >> "$tmp"
  done < "$targets"

  # 許可リストに載っている文字列を含む行は除外する
  if [ -s "$allow_file" ]; then
    grep -vFf <(grep -vE '^\s*(#|$)' "$allow_file") "$tmp" > "$tmp.filtered" 2>/dev/null || : > "$tmp.filtered"
    mv "$tmp.filtered" "$tmp"
  fi

  if [ -s "$tmp" ]; then
    findings=$((findings + 1))
    echo "✗ $label"
    sort -u "$tmp" | sed 's/^/    /'
  fi
done <<< "$patterns"

if [ "$findings" -gt 0 ]; then
  cat >&2 <<'MSG'

public にすると困る可能性のある内容が見つかりました。push を中止します。
（過去のコミットに含まれている場合、最新の中身が綺麗でも push すると履歴ごと送られます）

対処のどれかを選んでください:
  - 該当箇所を例示用の値に置き換える（履歴に入っている場合は履歴の書き換えが要る）
  - ドキュメント用のダミー値など問題ない場合は scripts/public-safe-allow.txt に追記する
  - 今回だけ意図的に通す場合は  git push --no-verify
MSG
  exit 1
fi

echo "✓ public-safe チェック通過（$scope）"
