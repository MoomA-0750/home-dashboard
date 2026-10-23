import type { ReactNode } from "react";
import { textFor, useLocale, type LocalizedText } from "./i18n";

/** サイドバーから開く画面（拡張機能の Media・Home Control など）の共通の枠。ホームの時計とウィジェットの列の代わりに出る */
export function ScreenFrame({
  title,
  actions,
  fill,
  children,
}: {
  /** 画面の見出し。{ ja, en } で渡すと、言語に合わせて出す */
  title: LocalizedText;
  actions?: ReactNode;
  /** 画面の高さいっぱいに中身を置き、画面そのものは送らない（中身が自分で送る。チャットなど） */
  fill?: boolean;
  children: ReactNode;
}) {
  const locale = useLocale();
  return (
    <main className={fill ? "screen screen--fill" : "screen"}>
      <div className="screen__inner">
        <header className="screen__header">
          <h1>{textFor(title, locale)}</h1>
          {actions}
        </header>
        {children}
      </div>
    </main>
  );
}
