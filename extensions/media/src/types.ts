/**
 * Media 画面が扱う「音楽アプリ」の共通の形。音楽アプリの拡張機能（Spotify・wave）は /media/* の道をこの形で返す
 * （画面は提供元を知らずにこの形だけを見る）。
 */

export interface MusicTrack {
  /** 提供元での識別子（Spotify なら spotify:track:... の URI、wave なら YouTube の videoId）。再生・キューへの追加に使う */
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  artUrl: string | null;
  durationMs: number | null;
}

export interface MusicPlayback {
  configured: boolean;
  provider: string;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: "off" | "track" | "context";
  track: MusicTrack | null;
  progressMs: number | null;
  /** progressMs を読んだサーバーの時刻（画面はここから再生位置を進めて歌詞の行を決める） */
  observedAt: string;
  deviceName: string | null;
  volumePercent: number | null;
  /** 提供元ができる操作。無ければすべてできる扱い（wave はシャッフル・繰り返しができない） */
  capabilities?: { shuffle: boolean; repeat: boolean };
}

export interface MusicPlaylist {
  id: string;
  uri: string;
  name: string;
  owner: string | null;
  artUrl: string | null;
  trackCount: number | null;
  /** 中の曲を一覧できるか（Spotify の開発モードでは、自分のか共同編集のプレイリストだけ） */
  browsable: boolean;
}

export interface MusicSuggestionGroup {
  id: string;
  title: string;
  /** どういう理由で並んでいるか（「よく聴く曲」など）。おすすめの出どころを正直に見せる */
  note: string | null;
  tracks: MusicTrack[];
}

/** 再生する端末（スマホ・PC・スピーカーなど） */
export interface MusicDevice {
  id: string;
  name: string;
  /** 端末の種類（smartphone・computer など。分からなければ null） */
  kind: string | null;
  /** いま鳴らしている端末か */
  active: boolean;
  /** 中継・アプリにつながっていて、移せるか */
  online: boolean;
}

/** 画面の言語（設定の「一般」で選んだもの） */
export type MusicLocale = "ja" | "en";

/**
 * 提供元が投げるエラーに付けてよい、言語ごとの理由。Media の道（./routes）が、呼んだ画面の言語の文に替えて返す
 * （HttpError に { localized: { ja, en } } を足して投げる。音声アシスタントには message＝日本語のまま渡る）
 */
export interface LocalizedReason {
  ja: string;
  en: string;
}

export type MusicAction = "play" | "pause" | "next" | "previous" | "shuffle" | "repeat";

export interface MusicProvider {
  id: string;
  name: string;
  getPlayback(): Promise<MusicPlayback>;
  getQueue(): Promise<MusicTrack[]>;
  /** プレイリスト。提供元が名付けるもの（「高く評価した曲」など）は locale（省くと日本語）の言語で返す */
  getPlaylists(locale?: MusicLocale): Promise<MusicPlaylist[]>;
  getPlaylistTracks(id: string): Promise<MusicTrack[]>;
  /** おすすめ。title・note は locale（省くと日本語）の言語で返す */
  getSuggestions(seed: MusicTrack | null, locale?: MusicLocale): Promise<MusicSuggestionGroup[]>;
  control(action: MusicAction, state?: boolean | "off" | "track" | "context"): Promise<void>;
  /** プレイリストを頭から、または曲を1曲だけ、今すぐ鳴らす */
  play(target: { contextUri?: string; trackUri?: string; offsetUri?: string }): Promise<void>;
  addToQueue(trackUri: string): Promise<void>;
  /** 今の曲の再生位置を positionMs（ミリ秒）へ動かす（シークバーのドラッグ） */
  seek(positionMs: number): Promise<void>;
  /**
   * 「次に再生」の index 番目（0 から）の曲へ飛ぶ。提供元に飛ぶための口があれば使う。
   * 無ければ（Spotify）、道の側で「次の曲」を index+1 回送って飛ばす（./routes）。wave は /v1/queue/jump で1回で飛ぶ
   */
  skipTo?(index: number, trackUri: string): Promise<void>;
  /** 再生する端末の一覧 */
  getDevices(): Promise<MusicDevice[]>;
  /** その端末に再生を移す */
  transfer(deviceId: string): Promise<void>;
}
