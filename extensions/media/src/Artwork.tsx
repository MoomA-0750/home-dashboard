import { cx, Icon } from "@home-dashboard/widget-sdk";

/**
 * ジャケット・プレイリストの絵（正方形）。絵が無ければ音符を薄く出す。
 * 角丸と大きさは使う側が className で決める（小さな一覧の行の頭は rounded-art、大きなものは rounded-inner）
 */
export function Artwork({ url, className }: { url: string | null; className?: string }) {
  return (
    <span
      className={cx(
        "grid aspect-square place-items-center overflow-hidden bg-white/8 [&_.fluent-icon]:size-1/3 [&_.fluent-icon]:opacity-50",
        className,
      )}
    >
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <Icon name="music-note" />}
    </span>
  );
}
