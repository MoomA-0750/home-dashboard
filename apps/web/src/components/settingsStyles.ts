/**
 * 設定のページで何度も使う形（クラスの並び）。部品（@home-dashboard/ui）にするまでの置き場で、ここ1か所に書く。
 * 部品になったら、使っている所を部品に替えて、ここから消す
 */

/** 一覧の行の右に出す、選んでいる印（選んでいない行も場所を空けて、行の高さをそろえる） */
export const choiceMark = (selected: boolean) => (selected ? undefined : "invisible");

/** 小窓・ページの中身を縦に並べる（入れ物のあいだは gap-3） */
export const STACK = "flex flex-col gap-3";

/** つまみの横に名前と今の値を置く行（壁紙の暗さの強さ・夜の暗さ）。Slider には className="flex-1" を渡す */
export const SLIDER_ROW = "flex items-center gap-3.5 text-small";
export const SLIDER_ROW_LABEL = "min-w-26 shrink-0";
