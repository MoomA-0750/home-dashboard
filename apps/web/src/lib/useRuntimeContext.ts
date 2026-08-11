import { useEffect, useRef, useState } from "react";
import type { WidgetRuntimeContext } from "@home-dashboard/widget-sdk";

const API_BASE_URL = ""; // 同一オリジン配信（server が web の build 成果物も配信する）想定

function buildWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

/** 現在時刻(1分毎更新)とWebSocket接続を保持し、全ウィジェットに渡すランタイムコンテキストを構築する */
export function useRuntimeContext(): WidgetRuntimeContext {
  const [now, setNow] = useState(() => new Date());
  const socketRef = useRef<WebSocket | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (cancelled) return;
      socket = new WebSocket(buildWsUrl());
      socketRef.current = socket;
      socket.addEventListener("open", () => forceRender((n) => n + 1));
      socket.addEventListener("close", () => {
        socketRef.current = null;
        retryTimer = setTimeout(connect, 5000);
      });
    };
    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return { apiBaseUrl: API_BASE_URL, socket: socketRef.current, now };
}
