import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import * as widgetSdk from "@home-dashboard/widget-sdk";
import {
  WidgetRegistry,
  type ExtensionSettingsPanelProps,
  type FeatureProviderInfo,
  type ScreenDefinition,
  type SettingsPageDefinition,
  type WebExtension,
  type WidgetDefinition,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import clock from "@home-dashboard/widget-clock";
import type { ManifestLocales } from "./manifestText";

/**
 * 拡張機能の画面側を読み込む。
 * サーバーの一覧（/api/extensions）にある拡張機能の web.js を import し、ウィジェットとサイドバーの画面を集める。
 * 拡張機能は React・widget-sdk を同梱せず、ここで globalThis.__homeDashboard に置いた本体のものを使う
 * （scripts/build-extension.mjs が import をここへつなぐ）。設定画面で入／切・持ち込み・削除すると、
 * サーバーが "extensions-changed" を知らせるので、読み直す（再読み込みは要らない）。
 */

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  description: string | null;
  builtin: boolean;
  enabled: boolean;
  active: boolean;
  error: string | null;
  hasWeb: boolean;
  hasStyle: boolean;
  revision: string;
  /** どこから来たか（本体・ZIP・登録したリポジトリ） */
  origin: { kind: "builtin" } | { kind: "zip" } | { kind: "source"; sourceId: string; commit: string };
  /** 別のプロセスで権限を絞って動かしているか（本体の拡張機能と、管理者が信頼するにしたものは false） */
  sandboxed: boolean;
  /** 本体に入っている版（本体の拡張機能をリポジトリの版で置き換えているときは、元の版）。本体に無いものは null */
  builtinVersion: string | null;
  /** 登録したリポジトリにある新しい版 */
  update: { version: string; sourceId: string; sourceName: string } | null;
  /** 新しい版があれば自動で入れ替えるか */
  autoUpdate: boolean;
  /** この拡張機能が持つ機能の口（ほかの拡張機能がここへ入る） */
  features: { id: string; name: string; description: string | null }[];
  /** 入る機能の口の id */
  provides: string[];
  /** 英語にしたときの文言（manifest の locales。lib/manifestText の localizeExtension で使う） */
  locales?: ManifestLocales;
}

/** 設定画面に足すページ。key は「拡張機能の id:ページの id」 */
export interface ExtensionSettingsPage extends SettingsPageDefinition {
  key: string;
  extensionId: string;
}

/** サイドバーに出す画面。key は「拡張機能の id:画面の id」 */
export interface ExtensionScreen extends ScreenDefinition {
  key: string;
  extensionId: string;
}

export interface LoadedExtensions {
  /** 一覧と画面側を読み終えたか（読み終えるまではウィジェットの列を出さない。知らないウィジェットに見えてしまうため） */
  ready: boolean;
  extensions: ExtensionInfo[];
  registry: WidgetRegistry;
  screens: ExtensionScreen[];
  /** 機能の口の id → 入っている拡張機能（order の順）。FeatureProvidersContext で拡張機能へ渡す */
  featureProviders: Record<string, FeatureProviderInfo[]>;
  /** 設定画面の左の一覧に足すページ（order の順） */
  settingsPages: ExtensionSettingsPage[];
  /** 拡張機能の id → 設定画面の詳細に出す欄 */
  settingsPanels: Record<string, ComponentType<ExtensionSettingsPanelProps>>;
  /** 画面側を読めなかった拡張機能と理由 */
  failures: Record<string, string>;
  reload: () => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __homeDashboard: { modules: Record<string, unknown> } | undefined;
}

globalThis.__homeDashboard = {
  modules: {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "react-dom": ReactDOM,
    "@home-dashboard/widget-sdk": widgetSdk,
  },
};

/** 本体に入っているウィジェット（ホームの時刻の表示。ウィジェットの列には出さない） */
const CORE_WIDGETS: WidgetDefinition<any>[] = [clock];

function fileUrl(apiBaseUrl: string, ext: ExtensionInfo, name: string): string {
  return `${apiBaseUrl}/api/extensions/${ext.id}/files/${name}?v=${ext.revision}`;
}

/** 拡張機能の web.css を <link> で入れる。切った・消した拡張機能のものは外す */
function syncStyles(apiBaseUrl: string, extensions: ExtensionInfo[]): void {
  const wanted = new Map(
    extensions.filter((ext) => ext.active && ext.hasStyle).map((ext) => [ext.id, fileUrl(apiBaseUrl, ext, "web.css")]),
  );
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-extension]"))) {
    const id = link.dataset.extension!;
    if (wanted.get(id) === link.getAttribute("href")) wanted.delete(id);
    else link.remove();
  }
  for (const [id, href] of wanted) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.extension = id;
    document.head.appendChild(link);
  }
}

const emptyRegistry = () => {
  const registry = new WidgetRegistry();
  for (const widget of CORE_WIDGETS) registry.register(widget);
  return registry;
};

export function useExtensions(ctx: WidgetRuntimeContext): LoadedExtensions {
  const [state, setState] = useState<Omit<LoadedExtensions, "reload">>(() => ({
    ready: false,
    extensions: [],
    registry: emptyRegistry(),
    screens: [],
    featureProviders: {},
    settingsPages: [],
    settingsPanels: {},
    failures: {},
  }));
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    let extensions: ExtensionInfo[];
    try {
      const res = await fetch(`${ctx.apiBaseUrl}/api/extensions`);
      if (!res.ok) throw new Error(`extensions API error: ${res.status}`);
      extensions = ((await res.json()) as { extensions: ExtensionInfo[] }).extensions;
    } catch {
      // サーバーが落ちているあいだは、読み込んである分のまま待つ（つながり直したら読み直す）
      setTimeout(() => request === requestRef.current && void load(), 10_000);
      return;
    }
    syncStyles(ctx.apiBaseUrl, extensions);

    const registry = emptyRegistry();
    const screens: ExtensionScreen[] = [];
    const featureProviders: Record<string, FeatureProviderInfo[]> = {};
    const settingsPages: ExtensionSettingsPage[] = [];
    const settingsPanels: Record<string, ComponentType<ExtensionSettingsPanelProps>> = {};
    const failures: Record<string, string> = {};
    const loaded = await Promise.all(
      extensions
        .filter((ext) => ext.active && ext.hasWeb)
        .map(async (ext) => {
          try {
            const module = (await import(/* @vite-ignore */ fileUrl(ctx.apiBaseUrl, ext, "web.js"))) as {
              default?: WebExtension;
            };
            return { ext, web: module.default ?? {} };
          } catch (err) {
            failures[ext.id] = err instanceof Error ? err.message : String(err);
            return null;
          }
        }),
    );
    for (const item of loaded) {
      if (!item) continue;
      for (const widget of item.web.widgets ?? []) {
        try {
          registry.register(widget);
        } catch (err) {
          failures[item.ext.id] = err instanceof Error ? err.message : String(err);
        }
      }
      for (const [feature, provision] of Object.entries(item.web.provides ?? {})) {
        (featureProviders[feature] ??= []).push({
          extensionId: item.ext.id,
          name: provision.name ?? item.ext.name,
          order: provision.order ?? 100,
          Component: provision.Component,
        });
      }
      if (item.web.SettingsPanel) settingsPanels[item.ext.id] = item.web.SettingsPanel;
      for (const page of item.web.settingsPages ?? []) {
        settingsPages.push({ ...page, key: `${item.ext.id}:${page.id}`, extensionId: item.ext.id });
      }
      for (const screen of item.web.screens ?? []) {
        screens.push({ ...screen, key: `${item.ext.id}:${screen.id}`, extensionId: item.ext.id });
      }
    }
    screens.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    for (const list of Object.values(featureProviders)) list.sort((a, b) => a.order - b.order);
    settingsPages.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    if (request !== requestRef.current) return;
    setState({ ready: true, extensions, registry, screens, featureProviders, settingsPages, settingsPanels, failures });
  }, [ctx.apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  // 設定画面での入／切・持ち込み・削除（ほかの端末でしたものも）と、サーバーの再起動のあとに読み直す
  useEffect(() => {
    const socket = ctx.socket;
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data as string).type === "extensions-changed") void load();
      } catch {
        // JSON でない知らせは関係ない
      }
    };
    socket.addEventListener("message", onMessage);
    void load();
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, load]);

  return { ...state, reload: load };
}
