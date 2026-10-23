import {
  defineMessages,
  defineWidget,
  usePolling,
  type WidgetDetailProps,
  type WidgetProps,
  Badge,
  DetailFrame,
  WidgetCard,
} from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    apiError: "git repos API error: {status}",
    justNow: "たった今",
    hoursAgo: "{n}時間前",
    daysAgo: "{n}日前",
    monthsAgo: "{n}ヶ月前",
    checking: "確認中…",
    noRepos: "リポジトリ未検出",
    summary: "未コミット{dirty} / 未push{unpushed}",
    more: "ほか{n}件",
    loading: "読み込み中…",
    title: "gitリポジトリ",
    noUpstream: "upstreamなし",
    changes: "staged {staged} / 変更 {unstaged} / 未追跡 {untracked}",
  },
  en: {
    apiError: "git repos API error: {status}",
    justNow: "Just now",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    monthsAgo: (p) => (p.n === 1 ? "1 month ago" : `${p.n} months ago`),
    checking: "Checking…",
    noRepos: "No repositories found",
    summary: "Uncommitted {dirty} / Unpushed {unpushed}",
    more: "+{n} more",
    loading: "Loading…",
    title: "Git repositories",
    noUpstream: "No upstream",
    changes: "staged {staged} / modified {unstaged} / untracked {untracked}",
  },
});

type T = ReturnType<typeof messages.useT>;

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
  const res = await fetch(`${apiBaseUrl}/api/ext/git-repos/repos`);
  if (!res.ok) throw new Error(messages.t("apiError", { status: res.status }));
  return res.json();
}

function changeCount(repo: RepoStatus): number {
  return repo.staged + repo.unstaged + repo.untracked;
}

/** 手を入れる必要がありそうなリポジトリを上に持ってくる（未コミット → 未push → 最終コミットが新しい順） */
function sortByAttention(repos: RepoStatus[]): RepoStatus[] {
  return [...repos].sort((a, b) => {
    if (a.dirty !== b.dirty) return a.dirty ? -1 : 1;
    if (a.ahead > 0 !== b.ahead > 0) return a.ahead > 0 ? -1 : 1;
    const aDate = a.lastCommit?.date ?? "";
    const bDate = b.lastCommit?.date ?? "";
    return aDate < bDate ? 1 : -1;
  });
}

function relativeDate(iso: string | undefined, t: T): string {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return t("justNow");
  if (hours < 24) return t("hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("daysAgo", { n: days });
  return t("monthsAgo", { n: Math.floor(days / 30) });
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
        {changes > 0 && <Badge tone="warn">{changes}</Badge>}
        {repo.ahead > 0 && <Badge>↑{repo.ahead}</Badge>}
        {repo.behind > 0 && <Badge>↓{repo.behind}</Badge>}
      </span>
    </li>
  );
}

function GitReposView({ ctx, config, openDetail }: WidgetProps<GitReposConfig>) {
  const t = messages.useT();
  const { data, loading } = usePolling(() => fetchRepos(ctx.apiBaseUrl), config.pollIntervalMs);

  if (loading && !data) return <WidgetCard className="widget-git">{t("checking")}</WidgetCard>;
  if (data && !data.configured) {
    return (
      <WidgetCard className="widget-git widget-git--unconfigured">
        {t("noRepos")}
        <span className="widget-hint">{data.reason}</span>
      </WidgetCard>
    );
  }

  const sorted = sortByAttention(data?.repos ?? []);
  const visible = sorted.slice(0, config.compactLimit);
  const hidden = sorted.length - visible.length;

  return (
    <WidgetCard className="widget-git" onClick={openDetail}>
      <span className="widget-git__header">
        <span className="widget-git__title">git</span>
        <span className="widget-git__summary">
          {t("summary", { dirty: data?.dirtyCount ?? 0, unpushed: data?.unpushedCount ?? 0 })}
        </span>
      </span>
      <ul className="widget-git__list">
        {visible.map((repo) => (
          <RepoRow key={repo.path} repo={repo} />
        ))}
      </ul>
      {hidden > 0 && <span className="widget-git__more">{t("more", { n: hidden })}</span>}
    </WidgetCard>
  );
}

function GitReposDetail({ ctx, config }: WidgetDetailProps<GitReposConfig>) {
  const t = messages.useT();
  const { data } = usePolling(() => fetchRepos(ctx.apiBaseUrl), config.pollIntervalMs);
  if (!data?.configured) return <DetailFrame>{t("loading")}</DetailFrame>;

  return (
    <DetailFrame title={t("title")} className="widget-git-detail">
      <p className="widget-note">{data.root}</p>

      <ul className="widget-git-detail__list">
        {sortByAttention(data.repos).map((repo) => (
          <li key={repo.path} className="widget-git-detail__item">
            <div className="widget-git-detail__head">
              <span
                className={`widget-git__mark ${repo.dirty ? "widget-git__mark--dirty" : "widget-git__mark--clean"}`}
              >
                {repo.dirty ? "●" : "○"}
              </span>
              <span className="widget-git-detail__name">{repo.name}</span>
              <span className="widget-git__branch">{repo.branch}</span>
              {repo.upstream ? (
                <span className="widget-git__counts">
                  {repo.ahead > 0 && <Badge>↑{repo.ahead}</Badge>}
                  {repo.behind > 0 && <Badge>↓{repo.behind}</Badge>}
                </span>
              ) : (
                <Badge tone="dim">{t("noUpstream")}</Badge>
              )}
            </div>
            {repo.error ? (
              <div className="widget-git-detail__error">{repo.error}</div>
            ) : (
              <div className="widget-git-detail__body">
                {repo.dirty && (
                  <span className="widget-git-detail__changes">
                    {t("changes", { staged: repo.staged, unstaged: repo.unstaged, untracked: repo.untracked })}
                  </span>
                )}
                {repo.lastCommit && (
                  <span className="widget-git-detail__commit">
                    <code>{repo.lastCommit.hash}</code> {repo.lastCommit.subject}
                    <span className="widget-git-detail__date">{relativeDate(repo.lastCommit.date, t)}</span>
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </DetailFrame>
  );
}

export default defineWidget<GitReposConfig>({
  id: "git-repos",
  name: { ja: "gitリポジトリ", en: "Git repositories" },
  description: {
    ja: "ローカルのリポジトリのブランチ・未コミット変更・未pushコミットを表示します",
    en: "Shows branches, uncommitted changes and unpushed commits of local repositories",
  },
  defaultSize: { w: 3, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 60 * 1000, compactLimit: 4 },
  Component: GitReposView,
  DetailComponent: GitReposDetail,
});
