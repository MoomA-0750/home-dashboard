import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AuthGate } from "./components/AuthGate";
import { LocaleProvider } from "./lib/locale";
import { installScrollbarVisibility } from "@home-dashboard/ui/wallpaper";
import "react-grid-layout/css/styles.css";
import "@home-dashboard/ui/theme.css";

installScrollbarVisibility();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      {/* 同一オリジン配信なので API の宛先は空（useRuntimeContext と同じ） */}
      <AuthGate apiBaseUrl="">
        {(account, sessionId, onSignedOut) => (
          <App key={sessionId} account={account} sessionId={sessionId} onSignedOut={onSignedOut} />
        )}
      </AuthGate>
    </LocaleProvider>
  </React.StrictMode>,
);

// PWA としてインストールできるようにする（public/sw.js）。開発中は登録しない（Vite の読み直しと混ざるため）
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // http の LAN で開いた端末など、登録できなくてもダッシュボードはそのまま使える
    });
  });
}
