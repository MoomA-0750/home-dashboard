import type { LocalizedText } from "@home-dashboard/ui";
import type { ComponentType } from "react";

/** ウィジェットのグリッド上でのサイズ（単位はキャンバス側のグリッドセル数） */
export interface WidgetSize {
  w: number;
  h: number;
}

/** 全ウィジェットに共通で渡されるランタイム情報 */
export interface WidgetRuntimeContext {
  /** サーバーAPIのベースURL（例: "" 同一オリジン、または "http://gco:8787"） */
  apiBaseUrl: string;
  /** サーバーからのリアルタイム更新を受け取るWebSocket（未接続ならnull） */
  socket: WebSocket | null;
  /** 現在時刻。1分毎などキャンバス側で更新され、time系ウィジェットの再描画トリガーになる */
  now: Date;
}

export interface WidgetProps<TConfig = Record<string, unknown>> {
  /** キャンバス上に配置された個々のウィジェットのインスタンスID（同じ種類を複数配置できる） */
  instanceId: string;
  /** このインスタンスの保存済み設定 */
  config: TConfig;
  /** 現在の表示サイズ（グリッド単位） */
  size: WidgetSize;
  ctx: WidgetRuntimeContext;
  /** 詳細ビューを開く（Component側から呼ぶ） */
  openDetail: () => void;
}

export interface WidgetDetailProps<TConfig = Record<string, unknown>> extends WidgetProps<TConfig> {
  /** 詳細ビューを閉じる */
  closeDetail: () => void;
}

/** ウィジェットの設定（編集中に歯車から開く）に渡すもの */
export interface WidgetSettingsProps<TConfig = Record<string, unknown>> {
  /** 今の設定（defaultConfig に保存済みの値を重ねたもの） */
  config: TConfig;
  ctx: WidgetRuntimeContext;
  /** 設定を変える。すぐ保存され、ほかの端末にも伝わる */
  onChange: (config: TConfig) => void;
}

/**
 * 1つのウィジェット「アプリ」の定義。
 * packages/widgets/* 配下に1ウィジェット1パッケージで実装し、ここに定義したオブジェクトを
 * apps/web の registry.ts に登録することでキャンバスに追加できるようになる。
 */
export interface WidgetDefinition<TConfig = Record<string, unknown>> {
  /** ウィジェット種別を一意に識別するID（例: "clock", "weather"） */
  id: string;
  /** キャンバスの追加メニュー等に出す表示名 */
  name: LocalizedText;
  description?: LocalizedText;
  /** キャンバスに新規追加したときの初期サイズ */
  defaultSize: WidgetSize;
  minSize?: WidgetSize;
  /** 新規追加時のデフォルト設定値 */
  defaultConfig: TConfig;
  /** キャンバス上に常時表示されるコンパクトなビュー */
  Component: ComponentType<WidgetProps<TConfig>>;
  /** クリック等で開く詳細ビュー（省略時はComponentのみで完結するウィジェットとして扱う） */
  DetailComponent?: ComponentType<WidgetDetailProps<TConfig>>;
  /** ウィジェットごとの設定（編集中に歯車から開く。省略時は設定なし） */
  SettingsComponent?: ComponentType<WidgetSettingsProps<TConfig>>;
  /**
   * ホームの見出しの所（時刻・今の天気）に本体が出しているものと同じウィジェット。ウィジェットの列には置かず、追加の一覧にも出さない
   * （前の版で列に置いたものは、読み込むときに外す）
   */
  inHeader?: boolean;
}

/** キャンバス上の1配置（レイアウト情報＋インスタンス設定）。サーバー側の永続化データと対応する */
export interface WidgetInstance<TConfig = Record<string, unknown>> {
  instanceId: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: TConfig;
}

export interface DashboardLayout {
  instances: WidgetInstance[];
  updatedAt: string;
  /** レイアウトデータのスキーマ版。未設定は v1（旧キャンバス形式）扱い */
  version?: number;
}
