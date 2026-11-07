import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { IconButton } from "./ui";
import { defineMessages } from "./i18n";
import { useClosing } from "./motion";

const messages = defineMessages({
  ja: { close: "閉じる" },
  en: { close: "Close" },
});

/**
 * 画面の上に重ねて出す小窓（「ウィジェットを追加」・Home Control のセンサーの詳細と同じ見た目）。
 * 背景を押す・Esc・右上の × で閉じる（薄くなってから onClose を呼ぶ）。
 * - title を省くと見出しの行を出さず、閉じるボタンだけ右上に置く（中身が自分で見出しを持つとき。読み上げの名前は label で渡す）
 * - dismissible={false} は答えるまで閉じない確かめ（背景・Esc・× で閉じない。閉じるのは中身のボタン）
 * - layer は重なりの段（既定 modal。音声アシスタントの了承・許可は guard で、音声のパネルより上）
 * - size は幅。md は 36rem まで、wide は中身が広いもの（グラフ・表。44rem まで）、fit は中身に合わせる（ウィジェットの詳細。画面の幅まで）
 * - className は面に足すクラス（中身の並べ方など）
 */
export function Dialog({
  title,
  label,
  onClose,
  dismissible = true,
  layer = "modal",
  role = "dialog",
  size = "md",
  className,
  children,
}: {
  title?: string;
  label?: string;
  onClose: () => void;
  dismissible?: boolean;
  layer?: "modal" | "guard";
  role?: "dialog" | "alertdialog";
  size?: "md" | "wide" | "fit";
  className?: string;
  children: ReactNode;
}) {
  const t = messages.useT();
  const { closing, close } = useClosing(onClose);
  useEffect(() => {
    if (!dismissible) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, dismissible]);

  return createPortal(
    <div
      className={cx(
        "scrim fixed inset-0 flex items-center justify-center p-4",
        layer === "guard" ? "layer-guard" : "layer-modal",
        // 下敷きは薄く現れ、面は 97% から広がる。閉じるときは逆にたどる（消える間は押せない）
        "animate-fade closing:pointer-events-none closing:animate-fade-out",
        closing && "is-closing",
      )}
      onClick={dismissible ? close : undefined}
    >
      <div
        className={cx(
          "raised relative max-h-dialog w-full animate-pop overflow-y-auto rounded-card p-(--card-padding) in-[.is-closing]:animate-pop-out",
          { md: "max-w-dialog", wide: "max-w-dialog-wide", fit: "w-fit min-w-80 max-w-full" }[size],
          className,
        )}
        role={role}
        aria-modal="true"
        aria-label={title ?? label}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined ? (
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-heading font-semibold">{title}</h2>
            {dismissible && <IconButton icon="dismiss" label={t("close")} onClick={close} />}
          </div>
        ) : (
          // 見出しを中身が持つときも、閉じるボタンは右上に出す（壁掛けのタッチでは、背景を押す・Esc に気づきにくい）
          dismissible && <IconButton icon="dismiss" label={t("close")} onClick={close} className="absolute top-4 right-4" />
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
