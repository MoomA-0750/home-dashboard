import type { ReactNode } from "react";
import { cx } from "./cx";
import { textFor, useLocale, type LocalizedText } from "./i18n";

/**
 * サイドバーから開く画面（拡張機能の Media・Home Control など）の共通の枠。ホームの時計とウィジェットの列の代わりに出る。
 * 画面ごとの背景（暗くする・ぼかす）は敷かない（その範囲だけ色が変わり、サイドバーとのあいだに境界が出る）。
 * 中の文字は壁紙にじかに置くので影（halo）を付ける（ガラスの部品の中では部品が消す）。開いたときは区画を少しずつずらして出す
 */
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
    <main
      className={cx(
        // 横長で背の低い画面では、画面の高さに収めたい中身（Media など）が引く見出しと余白の分を伝える
        "layer-base col-start-3 h-svh min-w-0 wall:[--screen-header-space:110px] phone:col-start-1 phone:h-screen-phone",
        fill ? "overflow-hidden" : "overflow-y-auto",
      )}
    >
      <div
        className={cx(
          "halo enter-stagger mx-auto max-w-350 px-12 pt-10 pb-20 tablet:px-8 phone:px-4 phone:pt-6",
          // 横長で背の低い画面では、中身の幅の上限を外して横に広く使い、見出しと余白を詰める
          "wall:max-w-none wall:px-10 wall:pt-5 wall:pb-6",
          fill && "flex h-full flex-col pb-6 wall:pb-6 *:shrink-0",
        )}
      >
        {/* 見出しの右の操作（ButtonRow など）は、狭い画面で次の行に回っても右に寄せる */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 wall:mb-4 [&>:not(h1):last-child]:ml-auto">
          <h1 className="text-screen font-semibold wall:text-card">{textFor(title, locale)}</h1>
          {actions}
        </header>
        {children}
      </div>
    </main>
  );
}
