import { useEffect, useRef, useState } from "react";
import type { WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import { applyShading, getAnalysis, startWallpaper } from "@home-dashboard/ui/wallpaper";

/**
 * 壁紙（背景の写真）。設定画面で選んだ画像をサーバーから読み、画面全体の枠（AppShell の .k-wallpaper）の背景にする。
 * 選んでいなければ既定の写真（/background.jpg。無ければテーマの下地のグラデーション）。ほかの端末で変えたら、知らせを受けてすぐ替える。
 */

export interface WallpaperInfo {
  custom: boolean;
  version: string | null;
  /** 壁紙の明るい所に足す暗さの強さ（0〜1.5。設定の「壁紙」で変える） */
  dimStrength?: number;
}

const DEFAULT_DIM_STRENGTH = 1;

export function wallpaperImageUrl(apiBaseUrl: string, info: WallpaperInfo): string {
  return info.custom && info.version ? `${apiBaseUrl}/api/wallpaper/image?v=${info.version}` : "/background.jpg";
}

export function useWallpaper(ctx: WidgetRuntimeContext) {
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(null);

  useEffect(() => {
    fetch(`${ctx.apiBaseUrl}/api/wallpaper`)
      .then((res) => (res.ok ? (res.json() as Promise<WallpaperInfo>) : null))
      .then((info) => info && setWallpaper(info))
      .catch(() => undefined);
  }, [ctx.apiBaseUrl]);

  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "wallpaper-updated")
          setWallpaper({ custom: message.custom, version: message.version, dimStrength: message.dimStrength });
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket]);

  // 壁紙の明るい所に重なる文字が読めるよう、壁紙の明るさを測って暗さを足し（文字の影の濃さもそれに合わせる）、
  // テーマの色を壁紙の色合いに合わせる（@home-dashboard/ui/wallpaper。中身は kasane の dashboard の壁紙の仕組み）。
  // 画面の縦横比で見える範囲が変わるので、暗さは大きさが変わったら測り直す
  // 設定を読む前も既定の写真を出す（読み終えて同じ写真なら測り直さない）
  const imageUrl = wallpaper ? wallpaperImageUrl(ctx.apiBaseUrl, wallpaper) : "/background.jpg";
  const strength = wallpaper?.dimStrength ?? DEFAULT_DIM_STRENGTH;
  const strengthRef = useRef(strength);
  strengthRef.current = strength;

  // 強さだけが変わったときは、測り直さずに当て直す
  useEffect(() => {
    const zones = getAnalysis();
    if (zones) applyShading(zones, strength);
  }, [strength]);

  useEffect(() => startWallpaper(imageUrl, () => strengthRef.current), [imageUrl]);

  return [wallpaper, setWallpaper] as const;
}
