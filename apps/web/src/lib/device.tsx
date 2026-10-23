import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setDeviceSettings, type DeviceSettings } from "./auth";
import { useLiteMode, type LiteReason } from "./lite";

/**
 * この端末の設定（apps/server/src/accounts.ts の DeviceSettings）。ログインしている端末ごとにサーバーが持つ。
 * - dashboard: 家に置きっぱなしのダッシュボード端末。画面を眠らせず、ログアウトを出さない
 * - lite: ガラスのぼかしを切った軽い表示（lib/lite.ts）
 */
export interface DeviceControl {
  sessionId: string;
  device: DeviceSettings;
  /** 軽い表示が入っているか・なぜか（自動のときは端末を測った結果） */
  lite: { active: boolean; reason: LiteReason };
  update(change: Partial<DeviceSettings>): Promise<void>;
  /** サーバーの値を読み直す（ほかの端末から変えられたとき） */
  reload(): void;
}

const DeviceContext = createContext<DeviceControl | null>(null);

export function DeviceProvider({
  apiBaseUrl,
  sessionId,
  device,
  reload,
  children,
}: {
  apiBaseUrl: string;
  sessionId: string;
  device: DeviceSettings;
  reload: () => void;
  children: ReactNode;
}) {
  // 「自動」を選び直したら測り直す
  const [liteGeneration, setLiteGeneration] = useState(0);
  const lite = useLiteMode(device.lite, liteGeneration);
  const update = async (change: Partial<DeviceSettings>) => {
    await setDeviceSettings(apiBaseUrl, sessionId, change);
    if (change.lite === "auto") setLiteGeneration((n) => n + 1);
    reload();
  };
  return (
    <DeviceContext.Provider value={{ sessionId, device, lite, update, reload }}>{children}</DeviceContext.Provider>
  );
}

export function useDevice(): DeviceControl {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDevice must be used inside DeviceProvider");
  return value;
}

/** ほかの端末からこの端末の設定が変えられたら読み直す */
export function useDeviceSettingsSync(socket: WebSocket | null, reload: () => void): void {
  useEffect(() => {
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data).type === "device-settings") reload();
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket, reload]);
}

/**
 * 画面を眠らせない（Screen Wake Lock）。タブを隠すとブラウザが外すので、見えるようになったら取り直す。
 * 使えないブラウザ・http で開いた端末では何もしない（端末の側の「画面を消さない」設定に任せる）
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
      } catch {
        // 省電力モードなどで断られたら、次に見えたときにもう一度
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [enabled]);
}
