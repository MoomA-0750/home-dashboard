/**
 * スクロールバーは、ふだんは隠し、スクロールしている間とその少し後だけ出す（theme.css の .is-scrolling）。
 * Windows の Chrome などは、細いスクロールバーを開いた直後から出しっぱなしにし、一度スクロールするまで消さないので、
 * 見せるかどうかをこちらで決める。スクロールの知らせは入れ物ごとに来るので、ページ全体で1つだけ受ける
 */
const SHOW_MS = 900;

export function installScrollbarVisibility(): void {
  const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
  document.addEventListener(
    "scroll",
    (event) => {
      const target = event.target instanceof Element ? event.target : document.scrollingElement;
      if (!target) return;
      target.classList.add("is-scrolling");
      clearTimeout(timers.get(target));
      timers.set(target, setTimeout(() => target.classList.remove("is-scrolling"), SHOW_MS));
    },
    { capture: true, passive: true },
  );
}
