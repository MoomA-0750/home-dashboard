import { Component, type ReactNode } from "react";
import { Button, defineMessages, LocaleContext } from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: { failed: "{name}を表示できませんでした", retry: "もう一度表示する" },
  en: { failed: "Couldn't show {name}", retry: "Try again" },
});

interface ErrorBoundaryProps {
  /** 知らせに出す名前（ウィジェット・画面の名前） */
  name: string;
  children: ReactNode;
}

/**
 * 拡張機能のウィジェット・画面・チャットアプリ・設定のページを包む。中で例外が出ても、ダッシュボード全体を消さず、
 * その部分にだけ知らせを出す（拡張機能はリポジトリや ZIP から入れたものもあるので、どれか1つの不具合で全部を止めない）
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  static contextType = LocaleContext;
  declare context: React.ContextType<typeof LocaleContext>;
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name}]`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const locale = this.context;
    return (
      <div className="flex flex-col items-start gap-2.5 p-4 text-label text-muted" role="alert">
        <p>{messages.t("failed", { name: this.props.name }, locale)}</p>
        <Button onClick={() => this.setState({ error: null })}>{messages.t("retry", undefined, locale)}</Button>
      </div>
    );
  }
}
