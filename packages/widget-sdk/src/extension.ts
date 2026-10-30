import type { ComponentType } from "react";
import type { FeatureProvision } from "./features";
import type { IconName } from "@home-dashboard/ui";
import type { LocalizedText } from "@home-dashboard/ui";
import type { WidgetDefinition, WidgetRuntimeContext } from "./types";

/**
 * 拡張機能の画面側の形。web.js の default export にする（scripts/build-extension.mjs でビルドする）。
 * React・この SDK は本体のものを共有するので、拡張機能に同梱しない（ビルドの道具が本体のものへつなぐ）。
 */

export interface ExtensionAccountInfo {
  id: string;
  username: string;
  role: "admin" | "member";
}

export interface ScreenProps {
  ctx: WidgetRuntimeContext;
  account: ExtensionAccountInfo;
}

/** サイドバーから開く画面 */
export interface ScreenDefinition {
  /** 拡張機能の中で一意な名前 */
  id: string;
  /** サイドバーの幅を広げたときに出す名前（{ ja, en } で言語ごとにも書ける） */
  label: LocalizedText;
  /** 読み上げ用の名前（省略時は label） */
  ariaLabel?: LocalizedText;
  /** 本体のアイコンの名前か、{ src: SVG の URL } */
  icon: IconName | { src: string };
  /** サイドバーでの並び（小さいほど上。省略時は 100） */
  order?: number;
  Component: ComponentType<ScreenProps>;
}

/**
 * 設定画面の左の一覧に足すページ（ログインした人なら誰でも開ける。インターネットアカウントなど、人ごとの設定に使う）。
 * 管理者だけが変える、拡張機能そのものの設定は SettingsPanel に置く
 */
export interface SettingsPageDefinition {
  /** 拡張機能の中で一意な名前 */
  id: string;
  /** 一覧に出す名前（{ ja, en } で言語ごとにも書ける） */
  label: LocalizedText;
  /** 本体のアイコンの名前 */
  icon: IconName;
  /** 一覧での並び（本体の項目のあと。小さいほど上。省略時は 100） */
  order?: number;
  /**
   * 本体の項目の中に、区画として出す（"account" なら「アカウント」の中。一覧には足さない）。
   * ログインした人に結び付く設定（インターネットアカウントなど）に使う
   */
  parent?: "account";
  Component: ComponentType<ScreenProps>;
}

/** 設定画面の拡張機能の詳細で、接続設定の下に出す欄に渡すもの */
export interface ExtensionSettingsPanelProps {
  ctx: Pick<WidgetRuntimeContext, "apiBaseUrl">;
  /** 管理者か（変えるのは管理者だけにするときに使う） */
  isAdmin: boolean;
}

export interface WebExtension {
  widgets?: WidgetDefinition<any>[];
  screens?: ScreenDefinition[];
  /**
   * 入る機能の口（口の id → 名前・順）。例: Media の音楽アプリなら { music: { name: "Spotify", order: 20 } }。
   * manifest.json の provides にも同じ id を書き、サーバー側で api.provide する
   */
  provides?: Record<string, FeatureProvision>;
  /** 設定画面の拡張機能の詳細で、接続設定の下に出す欄（manifest の settings で表せない設定のため） */
  SettingsPanel?: ComponentType<ExtensionSettingsPanelProps>;
  /** 設定画面の左の一覧に足すページ（人ごとの設定） */
  settingsPages?: SettingsPageDefinition[];
}

/** 型を効かせるためのヘルパー。web.tsx で `export default defineWebExtension({ widgets: [...], screens: [...] })` */
export function defineWebExtension(extension: WebExtension): WebExtension {
  return extension;
}

/** 拡張機能のサーバー側の道（/api/ext/<id><path>）の URL */
export function extensionApiUrl(
  ctx: Pick<WidgetRuntimeContext, "apiBaseUrl">,
  extensionId: string,
  path: string,
): string {
  return `${ctx.apiBaseUrl}/api/ext/${extensionId}${path}`;
}
