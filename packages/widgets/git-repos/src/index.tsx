import { defineWidget, usePolling, type WidgetDetailProps, type WidgetProps } from "@home-dashboard/widget-sdk";

interface GitReposConfig {
  pollIntervalMs: number;
  /** キャンバス上のコンパクト表示に出すリポジトリ数の上限 */
  compactLimit: number;
}

interface RepoStatus {
  name: string;
  path: string;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  dirty: boolean;
  lastCommit: { hash: string; subject: string; date: string } | null;
  error: string | null;
}

interface GitReposResponse {
  configured: boolean;
  reason?: string;
  root: string;
  dirtyCount: number;
  unpushedCount: number;
  repos: RepoStatus[];
}

async function fetchRepos(apiBaseUrl: string): Promise<GitReposResponse> {
  const res = await fetch(`${apiBaseUrl}/api/git/repos`);
  if (!res.ok) throw new Error(`git repos API error: ${res.status}`);
  return res.json();
}

function changeCount(repo: RepoStatus): number {
  return repo.staged + repo.unstaged + repo.untracked;
}

/** 手を入れる必要がありそうなリポジトリを上に持ってくる（未コミット → 未push → 最終コミットが新しい順） */
function sortByAttention(repos: RepoStatus[]): RepoStatus[] {
  return [...repos].sort((a, b) => {
    if (a.dirty !== b.dirty) return a.dirty ? -1 : 1;
    if ((a.ahead > 0) !== (b.ahead > 0)) return a.ahead > 0 ? -1 : 1;
    const aDate = a.lastCommit?.date ?? "";
    const bDate = b.lastCommit?.date ?? "";
    return aDate < bDate ? 1 : -1;
  });
}

function relativeDate(iso: string | undefined): string {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "たった今";
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}

function RepoRow({ repo }: { repo: RepoStatus }) {
  const changes = changeCount(repo);
  return (
    <li className="widget-git__item">
      <span className={`widget-git__mark ${repo.dirty ? "widget-git__mark--dirty" : "widget-git__mark--clean"}`}>
        {repo.dirty ? "●" : "○"}
      </span>
      <span className="widget-git__name">{repo.name}</span>
      <span className="widget-git__branch">{repo.branch}</span>
      <span className="widget-git__counts">
        {changes > 0 && <span className="widget-git__badge widget-git__badge--dirty">{changes}</span>}
        {repo.ahead > 0 && <span className="widget-git__badge">↑{repo.ahead}</span>}
        {repo.behind > 0 && <span className="widget-git__badge">↓{repo.behind}</span>}
      </span>
    </li>
  );
}

function GitReposView({ ctx, config, openDetail }: WidgetProps<GitReposConfig>) {
  const { data, loading } = usePolling(() => fetchRepos(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) return <div className="widget-card widget-git">確認中…</div>;
  if (data && !data.configured) {
    return (
      <div className="widget-card widget-git widget-git--unconfigured">
        リポジトリ未検出
        <span className="widget-spotify__hint">{data.reason}</span>
      </div>
    );
  }

  const sorted = sortByAttention(data?.repos ?? []);
  const visible = sorted.slice(0, config.compactLimit);
  const hidden = sorted.length - visible.length;

  return (
    <button type="button" className="widget-card widget-git" onClick={openDetail}>
      <span className="widget-git__header">
        <span className="widget-git__title">git</span>
        <span className="widget-git__summary">
          未コミット{data?.dirtyCount ?? 0} / 未push{data?.unpushedCount ?? 0}
        </span>
      </span>
      <ul className="widget-git__list">
        {visible.map((repo) => (
          <RepoRow key={repo.path} repo={repo} />
        ))}
      </ul>
      {hidden > 0 && <span className="widget-git__more">ほか{hidden}件</span>}
    </button>
  );
}

function GitReposDetail({ ctx, config }: WidgetDetailProps<GitReposConfig>) {
  const { data } = usePolling(() => fetchRepos(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <div className="widget-detail">読み込み中…</div>;

  return (
    <div className="widget-detail widget-git-detail">
      <h2>gitリポジトリ</h2>
      <p className="widget-usage-detail__note">{data.root}</p>

      <ul className="widget-git-detail__list">
        {sortByAttention(data.repos).map((repo) => (
          <li key={repo.path} className="widget-git-detail__item">
            <div className="widget-git-detail__head">
              <span className={`widget-git__mark ${repo.dirty ? "widget-git__mark--dirty" : "widget-git__mark--clean"}`}>
                {repo.dirty ? "●" : "○"}
              </span>
              <span className="widget-git-detail__name">{repo.name}</span>
              <span className="widget-git__branch">{repo.branch}</span>
              {repo.upstream ? (
                <span className="widget-git__counts">
                  {repo.ahead > 0 && <span className="widget-git__badge">↑{repo.ahead}</span>}
                  {repo.behind > 0 && <span className="widget-git__badge">↓{repo.behind}</span>}
                </span>
              ) : (
                <span className="widget-git__badge widget-git__badge--dim">upstreamなし</span>
              )}
            </div>
            {repo.error ? (
              <div className="widget-git-detail__error">{repo.error}</div>
            ) : (
              <div className="widget-git-detail__body">
                {repo.dirty && (
                  <span className="widget-git-detail__changes">
                    staged {repo.staged} / 変更 {repo.unstaged} / 未追跡 {repo.untracked}
                  </span>
                )}
                {repo.lastCommit && (
                  <span className="widget-git-detail__commit">
                    <code>{repo.lastCommit.hash}</code> {repo.lastCommit.subject}
                    <span className="widget-git-detail__date">{relativeDate(repo.lastCommit.date)}</span>
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default defineWidget<GitReposConfig>({
  id: "git-repos",
  name: "gitリポジトリ",
  description: "ローカルのリポジトリのブランチ・未コミット変更・未pushコミットを表示します",
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  defaultConfig: { pollIntervalMs: 60 * 1000, compactLimit: 4 },
  Component: GitReposView,
  DetailComponent: GitReposDetail,
});
