import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { ScreenProps } from "./extension";
import type { LocalizedText } from "@home-dashboard/ui";

/**
 * 機能の口（画面側）。口を持つ拡張機能（Media など）が、そこへ入っている拡張機能（wave・Spotify など）を知るのに使う。
 * 入る側は web.tsx の provides と manifest.json の provides に口の id を書き、サーバー側で api.provide する。
 * 本体が動いている拡張機能から一覧を作って FeatureProvidersContext で渡すので、口を持つ側は useFeatureProviders で読む。
 */

/** 機能の口に入っている拡張機能（画面側） */
export interface FeatureProviderInfo {
  extensionId: string;
  /** 画面に出す名前（provides の name。無ければ manifest の name）。textFor で今の言語の文にする */
  name: LocalizedText;
  /** 選んでいない端末で先に使う順（小さいほど先。省略時は 100） */
  order: number;
  /** 口が画面を求めるとき（チャットアプリなど）の、入る側の画面 */
  Component?: ComponentType<any>;
}

/** web.tsx の provides に書くもの */
export interface FeatureProvision {
  /** 画面に出す名前（省略時は manifest の name。{ ja, en } で言語ごとにも書ける） */
  name?: LocalizedText;
  /** 選んでいない端末で先に使う順（小さいほど先。省略時は 100） */
  order?: number;
  /** 口が画面を求めるとき（チャットアプリなど）の、入る側の画面。形は口ごとに決まる（チャットなら ChatAppProps） */
  Component?: ComponentType<any>;
}

/**
 * 機能の口「chat」（チャットアプリ）に入る画面が受け取るもの。本体の Chat 画面の中に、音声アシスタントの代わりに出る。
 * switcher は本体が作るチャットアプリの切り替え（PillMenu）で、画面の見出しの右に置く
 */
export interface ChatAppProps extends ScreenProps {
  switcher: ReactNode;
}

/**
 * 本体の口「header-weather」（ホームの時刻の横の今の天気）に入る画面が受け取るもの。アイコンと気温だけを並べる
 * （字の大きさ・色は本体が決める）。本体は入っているもののうち order の小さい1つを出す。画面側だけの口なので、
 * manifest.json の provides と api.provide は要らない
 */
export interface HeaderWeatherProps {
  ctx: ScreenProps["ctx"];
}

/** 口の id → 入っている拡張機能（order の順）。本体が渡す */
export const FeatureProvidersContext = createContext<Record<string, FeatureProviderInfo[]>>({});

/** その口に入っている拡張機能（動いているものだけ。order の順） */
export function useFeatureProviders(feature: string): FeatureProviderInfo[] {
  return useContext(FeatureProvidersContext)[feature] ?? EMPTY;
}

const EMPTY: FeatureProviderInfo[] = [];
