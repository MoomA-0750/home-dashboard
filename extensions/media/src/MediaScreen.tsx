import { useEffect, useRef, useState } from "react";
import { type ReactNode } from "react";
import { Icon, PillMenu, ScreenFrame, scrollBehavior, Slider, usePolledResource, type ScreenProps } from "@home-dashboard/widget-sdk";
import { messages } from "./i18n";
import { useMusicProviders, useSelectedMusicProvider, type MediaProviderOption } from "./providers";
import "./media.css";

/**
 * Media 画面（再生中・操作・次に再生・歌詞・プレイリスト・おすすめ）。右上のピルで
 * 音楽アプリ（機能の口「music」に入っている拡張機能。wave・Spotify）と、鳴らす端末を選ぶ。
 * 画面はこの拡張機能の /providers/<id>/* の道（MusicProvider の形。./types と ./routes）だけを見るので、提供元を知らない。
 */

interface MusicTrack {
  uri: string;
  title: string;
  artist: string;
  album: string | null;
  artUrl: string | null;
  durationMs: number | null;
}

interface MusicPlayback {
  configured: boolean;
  provider: string;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: "off" | "track" | "context";
  track: MusicTrack | null;
  progressMs: number | null;
  deviceName: string | null;
  /** 提供元ができる操作。無ければすべてできる扱い（wave はシャッフル・繰り返しができない） */
  capabilities?: { shuffle: boolean; repeat: boolean };
}

interface MusicPlaylist {
  id: string;
  uri: string;
  name: string;
  owner: string | null;
  artUrl: string | null;
  trackCount: number | null;
  browsable: boolean;
}

interface SuggestionGroup {
  id: string;
  title: string;
  note: string | null;
  tracks: MusicTrack[];
}

interface LyricLine {
  timeMs: number | null;
  text: string;
}

interface Lyrics {
  found: boolean;
  synced: boolean;
  instrumental: boolean;
  lines: LyricLine[];
}

type Tab = "lyrics" | "playlists" | "suggestions";

interface MusicDevice {
  id: string;
  name: string;
  kind: string | null;
  active: boolean;
  online: boolean;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("loadFailed", { status: res.status }));
  return body as T;
}

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? messages.t("actionFailed", { status: res.status }));
  }
}

function formatTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "--:--";
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 読んだ時点の再生位置から、今の位置を進めて求める（歌詞の行と進み具合のバーに使う） */
function usePlaybackPosition(playback: MusicPlayback | null, receivedAt: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!playback?.isPlaying) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [playback?.isPlaying]);
  if (!playback || playback.progressMs === null) return null;
  const elapsed = playback.isPlaying ? Math.max(0, now - receivedAt) : 0;
  const position = playback.progressMs + elapsed;
  return playback.track?.durationMs ? Math.min(position, playback.track.durationMs) : position;
}

export type { MediaProviderOption };

export function MediaScreen({ ctx, account }: ScreenProps) {
  const providers = useMusicProviders();
  const [provider, choose] = useSelectedMusicProvider(providers);
  const t = messages.useT();

  if (!provider) {
    return (
      <ScreenFrame title={{ ja: "メディア", en: "Media" }}>
        <p className="screen__notice">{t("noProviders")}</p>
      </ScreenFrame>
    );
  }
  // 提供元を替えたら、再生中・タブの中身は読み直す（key で作り直す）
  return (
    <MediaScreenBody
      key={provider.extensionId}
      ctx={ctx}
      account={account}
      provider={provider}
      providers={providers}
      onChooseProvider={choose}
    />
  );
}

interface MediaScreenBodyProps extends ScreenProps {
  provider: MediaProviderOption;
  providers: MediaProviderOption[];
  onChooseProvider: (id: string) => void;
}

function MediaScreenBody({ ctx, provider, providers, onChooseProvider }: MediaScreenBodyProps) {
  const apiBaseUrl = `${ctx.apiBaseUrl}/api/ext/media/providers/${provider.extensionId}`;
  const t = messages.useT();
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const playbackResource = usePolledResource(async () => {
    const playback = await getJson<MusicPlayback>(`${apiBaseUrl}/playback`);
    setReceivedAt(Date.now());
    return playback;
  }, 3000);
  const playback = playbackResource.data;
  const position = usePlaybackPosition(playback, receivedAt);
  const [tab, setTab] = useState<Tab>("lyrics");
  const [failure, setFailure] = useState<string | null>(null);

  const act = async (work: () => Promise<void>) => {
    setFailure(null);
    try {
      await work();
      await playbackResource.refresh();
      setTimeout(playbackResource.refresh, 800);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  };
  const control = (action: string, state?: unknown) =>
    act(() => postJson(`${apiBaseUrl}/control`, { action, state }));
  const play = (target: { contextUri?: string; trackUri?: string; offsetUri?: string }) =>
    act(() => postJson(`${apiBaseUrl}/play`, target));
  const enqueue = (trackUri: string) => act(() => postJson(`${apiBaseUrl}/queue`, { trackUri }));

  // 右上: 音楽アプリと鳴らす端末を選ぶピル。読み込み中・未接続でも出す（ほかのアプリへ替えられるように）
  const actions: ReactNode = (
    <div className="media__pickers">
      <PillMenu
        label={provider.name}
        icon="music-note"
        ariaLabel={t("providerAria", { name: provider.name })}
        items={providers.map((p) => ({
          id: p.extensionId,
          label: p.name,
          selected: p.extensionId === provider.extensionId,
        }))}
        onSelect={onChooseProvider}
      />
      {playback?.configured && (
        <DevicePill
          apiBaseUrl={apiBaseUrl}
          currentName={playback.deviceName}
          onTransfer={(deviceId) => act(() => postJson(`${apiBaseUrl}/transfer`, { deviceId }))}
        />
      )}
    </div>
  );

  if (playbackResource.loading)
    return (
      <ScreenFrame title={{ ja: "メディア", en: "Media" }} actions={actions}>
        {t("loading")}
      </ScreenFrame>
    );
  if (playbackResource.error && !playback) {
    return (
      <ScreenFrame title={{ ja: "メディア", en: "Media" }} actions={actions}>
        <p className="screen__notice">{String((playbackResource.error as Error).message ?? playbackResource.error)}</p>
      </ScreenFrame>
    );
  }
  if (playback && !playback.configured) {
    return (
      <ScreenFrame title={{ ja: "メディア", en: "Media" }} actions={actions}>
        <p className="screen__notice">{t("notConnected", { name: provider.name })}</p>
      </ScreenFrame>
    );
  }

  const track = playback?.track ?? null;
  const duration = track?.durationMs ?? null;
  const canShuffle = playback?.capabilities?.shuffle ?? true;
  const canRepeat = playback?.capabilities?.repeat ?? true;

  return (
    <ScreenFrame title={{ ja: "メディア", en: "Media" }} actions={actions}>
      {failure && (
        <p className="screen__error" role="alert">
          {failure}
        </p>
      )}
      <div className="media">
        <section className="media__now" aria-label={t("nowPlaying")}>
          <div className="media__art">
            {track?.artUrl ? <img src={track.artUrl} alt="" /> : <Icon name="music-note" />}
          </div>
          <div className="media__meta">
            <span className="media__title">{track?.title ?? t("notPlaying")}</span>
            <span className="media__artist">
              {track ? [track.artist, track.album].filter(Boolean).join(" — ") : ""}
            </span>
          </div>
          <SeekBar
            key={track?.uri ?? "none"}
            position={position}
            duration={duration}
            onSeek={(positionMs) => act(() => postJson(`${apiBaseUrl}/seek`, { positionMs }))}
          />
          <div className={`media__controls${canShuffle && canRepeat ? "" : " media__controls--basic"}`}>
            {canShuffle && (
              <button
                type="button"
                className={`home-icon-button${playback?.shuffle ? " home-icon-button--on" : ""}`}
                aria-label={t("shuffle")}
                aria-pressed={playback?.shuffle ?? false}
                onClick={() => control("shuffle", !playback?.shuffle)}
              >
                <Icon name="shuffle" />
              </button>
            )}
            <button type="button" className="home-icon-button" aria-label={t("previous")} onClick={() => control("previous")}>
              <Icon name="previous" />
            </button>
            <button
              type="button"
              className="media__play"
              aria-label={playback?.isPlaying ? t("pause") : t("play")}
              onClick={() => control(playback?.isPlaying ? "pause" : "play")}
            >
              <Icon name={playback?.isPlaying ? "pause" : "play"} />
            </button>
            <button type="button" className="home-icon-button" aria-label={t("next")} onClick={() => control("next")}>
              <Icon name="next" />
            </button>
            {canRepeat && (
              <button
                type="button"
                className={`home-icon-button${playback?.repeat !== "off" ? " home-icon-button--on" : ""}`}
                aria-label={t("repeatState", {
                  state: t(playback?.repeat === "track" ? "repeatOne" : playback?.repeat === "context" ? "repeatAll" : "repeatOff"),
                })}
                onClick={() =>
                  control(
                    "repeat",
                    playback?.repeat === "off" ? "context" : playback?.repeat === "context" ? "track" : "off",
                  )
                }
              >
                <Icon name="repeat" />
                {playback?.repeat === "track" && <span className="media__repeat-one">1</span>}
              </button>
            )}
          </div>
          <UpNext
            apiBaseUrl={apiBaseUrl}
            trackUri={track?.uri ?? null}
            onSkip={(index, trackUri) => act(() => postJson(`${apiBaseUrl}/queue/skip`, { index, trackUri }))}
          />
        </section>

        <section className="ui-glass media__panel">
          <div className="media__tabs" role="tablist" aria-label={t("tabsAria")}>
            {(
              [
                ["lyrics", t("lyrics"), "lyrics"],
                ["playlists", t("playlists"), "music-note"],
                ["suggestions", t("suggestions"), "sparkle"],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`media__tab${tab === id ? " media__tab--active" : ""}`}
                onClick={() => setTab(id)}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
          <div className="media__tab-body">
            {tab === "lyrics" && <LyricsView apiBaseUrl={apiBaseUrl} track={track} positionMs={position} />}
            {tab === "playlists" && <PlaylistsView apiBaseUrl={apiBaseUrl} onPlay={play} />}
            {tab === "suggestions" && (
              <SuggestionsView
                apiBaseUrl={apiBaseUrl}
                trackUri={track?.uri ?? null}
                onPlay={play}
                onEnqueue={enqueue}
              />
            )}
          </div>
        </section>
      </div>
    </ScreenFrame>
  );
}

function UpNext({
  apiBaseUrl,
  trackUri,
  onSkip,
}: {
  apiBaseUrl: string;
  trackUri: string | null;
  onSkip: (index: number, trackUri: string) => Promise<void>;
}) {
  const t = messages.useT();
  // 飛んでいる途中の曲（「次の曲」を何回か送るので少しかかる）
  const [skipping, setSkipping] = useState<number | null>(null);
  const { data, refresh } = usePolledResource(
    () => getJson<{ tracks: MusicTrack[] }>(`${apiBaseUrl}/queue`),
    15000,
  );
  // 曲が変わったら次の曲の一覧も変わるので読み直す
  useEffect(() => {
    refresh();
  }, [trackUri, refresh]);
  const tracks = data?.tracks.slice(0, 5) ?? [];
  if (tracks.length === 0) return null;
  return (
    <div className="media__up-next">
      <h2 className="screen__section-title">{t("upNext")}</h2>
      <ol className="media__track-list">
        {tracks.map((track, index) => (
          <li key={`${track.uri}-${index}`}>
            {/* 押すとその曲へ飛ぶ */}
            <button
              type="button"
              className={`media__track${skipping === index ? " media__track--pending" : ""}`}
              disabled={skipping !== null}
              aria-label={t("skipTo", { title: track.title })}
              onClick={async () => {
                setSkipping(index);
                try {
                  await onSkip(index, track.uri);
                  await refresh();
                } finally {
                  setSkipping(null);
                }
              }}
            >
              <TrackArt track={track} />
              <span className="media__track-text">
                <span className="media__track-title">{track.title}</span>
                <span className="media__track-artist">{skipping === index ? t("skipping") : track.artist}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TrackArt({ track }: { track: { artUrl: string | null } }) {
  return (
    <span className="media__track-art">
      {track.artUrl ? <img src={track.artUrl} alt="" loading="lazy" /> : <Icon name="music-note" />}
    </span>
  );
}

function activeLineIndex(lines: LyricLine[], positionMs: number | null): number {
  if (positionMs === null) return -1;
  let active = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if ((lines[i].timeMs ?? Infinity) <= positionMs) active = i;
    else break;
  }
  return active;
}

function LyricsView({
  apiBaseUrl,
  track,
  positionMs,
}: {
  apiBaseUrl: string;
  track: MusicTrack | null;
  positionMs: number | null;
}) {
  const t = messages.useT();
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const trackKey = track ? `${track.uri}` : null;

  useEffect(() => {
    setLyrics(null);
    setError(null);
    if (!track) return;
    let cancelled = false;
    const params = new URLSearchParams({ title: track.title, artist: track.artist });
    if (track.album) params.set("album", track.album);
    if (track.durationMs) params.set("durationMs", String(track.durationMs));
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) =>
      getJson<Lyrics>(`${apiBaseUrl}/lyrics?${params}`)
        .then((result) => !cancelled && setLyrics(result))
        .catch((err) => {
          if (cancelled) return;
          // LRCLIB が一時的に混んでいることがあるので、少し待って何度か引き直す
          if (attempt < 3) retryTimer = setTimeout(() => load(attempt + 1), 10_000 * (attempt + 1));
          else setError(err instanceof Error ? err.message : String(err));
        });
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
    // 曲が変わったときだけ引き直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, trackKey]);

  const active = lyrics?.synced ? activeLineIndex(lyrics.lines, positionMs) : -1;

  // 歌っている行を真ん中に送る
  useEffect(() => {
    if (active < 0) return;
    // scrollIntoView だと画面全体まで動いてしまうので、歌詞の枠の中だけを動かす
    const list = listRef.current;
    const container = list?.parentElement;
    const element = list?.children[active] as HTMLElement | undefined;
    if (!container || !element) return;
    container.scrollTo({
      // 歌詞の枠（position: relative）が offsetParent なので、offsetTop は枠の中での位置
      top: element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2,
      behavior: scrollBehavior(),
    });
  }, [active]);

  if (!track) return <p className="screen__notice">{t("lyricsIdle")}</p>;
  if (error) return <p className="screen__notice">{t("lyricsFailed", { error })}</p>;
  if (!lyrics) return <p className="screen__notice">{t("lyricsSearching")}</p>;
  if (lyrics.instrumental) return <p className="screen__notice">{t("instrumental")}</p>;
  if (!lyrics.found) return <p className="screen__notice">{t("lyricsNotFound")}</p>;

  return (
    <div className="media__lyrics">
      <ol ref={listRef} className={`media__lyrics-lines${lyrics.synced ? " media__lyrics-lines--synced" : ""}`}>
        {lyrics.lines.map((line, index) => (
          <li
            key={index}
            className={
              index === active
                ? "media__lyric media__lyric--active"
                : index < active
                  ? "media__lyric media__lyric--past"
                  : "media__lyric"
            }
          >
            {line.text || "♪"}
          </li>
        ))}
      </ol>
      <p className="media__credit">{t("lyricsCredit")}</p>
    </div>
  );
}

function PlaylistsView({
  apiBaseUrl,
  onPlay,
}: {
  apiBaseUrl: string;
  onPlay: (target: { contextUri?: string; offsetUri?: string }) => void;
}) {
  const t = messages.useT();
  const { data, error } = usePolledResource(
    () => getJson<{ playlists: MusicPlaylist[] }>(`${apiBaseUrl}/playlists`),
    5 * 60 * 1000,
  );
  const [open, setOpen] = useState<MusicPlaylist | null>(null);

  if (error) return <p className="screen__notice">{(error as Error).message}</p>;
  if (!data) return <p className="screen__notice">{t("loading")}</p>;
  if (open)
    return <PlaylistTracks apiBaseUrl={apiBaseUrl} playlist={open} onBack={() => setOpen(null)} onPlay={onPlay} />;
  if (data.playlists.length === 0) return <p className="screen__notice">{t("noPlaylists")}</p>;

  return (
    <ul className="media__playlists">
      {data.playlists.map((playlist) => (
        <li key={playlist.id} className="media__playlist">
          <button
            type="button"
            className="media__playlist-open"
            onClick={() => (playlist.browsable ? setOpen(playlist) : onPlay({ contextUri: playlist.uri }))}
            aria-label={playlist.browsable ? t("viewPlaylist", { name: playlist.name }) : t("playPlaylist", { name: playlist.name })}
          >
            <span className="media__playlist-art">
              {playlist.artUrl ? <img src={playlist.artUrl} alt="" loading="lazy" /> : <Icon name="music-note" />}
            </span>
            <span className="media__playlist-name">{playlist.name}</span>
            <span className="media__playlist-meta">
              {[playlist.owner, playlist.trackCount !== null ? t("trackCount", { n: playlist.trackCount }) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
          <button
            type="button"
            className="media__playlist-play"
            aria-label={t("playPlaylist", { name: playlist.name })}
            onClick={() => onPlay({ contextUri: playlist.uri })}
          >
            <Icon name="play" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PlaylistTracks({
  apiBaseUrl,
  playlist,
  onBack,
  onPlay,
}: {
  apiBaseUrl: string;
  playlist: MusicPlaylist;
  onBack: () => void;
  onPlay: (target: { contextUri?: string; offsetUri?: string }) => void;
}) {
  const t = messages.useT();
  const { data, error } = usePolledResource(
    () => getJson<{ tracks: MusicTrack[] }>(`${apiBaseUrl}/playlists/${encodeURIComponent(playlist.id)}/tracks`),
    5 * 60 * 1000,
  );

  return (
    <div className="media__playlist-detail">
      <div className="media__playlist-head">
        <button type="button" className="home-button home-button--ghost" onClick={onBack}>
          {t("backToPlaylists")}
        </button>
        <span className="media__playlist-title">{playlist.name}</span>
        <button
          type="button"
          className="home-button home-button--primary"
          onClick={() => onPlay({ contextUri: playlist.uri })}
        >
          {t("playFromStart")}
        </button>
      </div>
      {error !== null && <p className="screen__notice">{(error as Error).message}</p>}
      {!data && !error && <p className="screen__notice">{t("loading")}</p>}
      <ol className="media__track-list">
        {data?.tracks.map((track, index) => (
          <li key={`${track.uri}-${index}`}>
            <button
              type="button"
              className="media__track"
              onClick={() => onPlay({ contextUri: playlist.uri, offsetUri: track.uri })}
            >
              <TrackArt track={track} />
              <span className="media__track-text">
                <span className="media__track-title">{track.title}</span>
                <span className="media__track-artist">{track.artist}</span>
              </span>
              <span className="media__track-time">{formatTime(track.durationMs)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SuggestionsView({
  apiBaseUrl,
  trackUri,
  onPlay,
  onEnqueue,
}: {
  apiBaseUrl: string;
  trackUri: string | null;
  onPlay: (target: { trackUri: string }) => void;
  onEnqueue: (trackUri: string) => void;
}) {
  const t = messages.useT();
  const { data, error, refresh } = usePolledResource(
    () => getJson<{ groups: SuggestionGroup[] }>(`${apiBaseUrl}/suggestions`),
    10 * 60 * 1000,
  );
  // 「今の曲に似た曲」は今の曲で変わるので、曲が変わったら引き直す
  useEffect(() => {
    refresh();
  }, [trackUri, refresh]);

  if (error) return <p className="screen__notice">{(error as Error).message}</p>;
  if (!data) return <p className="screen__notice">{t("loading")}</p>;
  if (data.groups.length === 0) return <p className="screen__notice">{t("noSuggestions")}</p>;

  return (
    <div className="media__suggestions">
      {data.groups.map((group) => (
        <section key={group.id} className="media__suggestion-group">
          <h2 className="screen__section-title">
            {group.title}
            {group.note && <small> · {group.note}</small>}
          </h2>
          <ol className="media__track-list">
            {group.tracks.map((track) => (
              <li key={track.uri} className="media__track-row">
                <button type="button" className="media__track" onClick={() => onPlay({ trackUri: track.uri })}>
                  <TrackArt track={track} />
                  <span className="media__track-text">
                    <span className="media__track-title">{track.title}</span>
                    <span className="media__track-artist">{track.artist}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="home-icon-button media__enqueue"
                  aria-label={t("enqueue", { title: track.title })}
                  onClick={() => onEnqueue(track.uri)}
                >
                  <Icon name="add" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** 鳴らす端末のピル。開いたときに一覧を読み直す */
function DevicePill({
  apiBaseUrl,
  currentName,
  onTransfer,
}: {
  apiBaseUrl: string;
  currentName: string | null;
  onTransfer: (deviceId: string) => void;
}) {
  const t = messages.useT();
  const [devices, setDevices] = useState<MusicDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setDevices((await getJson<{ devices: MusicDevice[] }>(`${apiBaseUrl}/devices`)).devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // つながっている端末を上に。つながっていない端末は選べない（移せないため）
  const items = (devices ?? [])
    .slice()
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.active) - Number(a.active))
    .map((device) => ({
      id: device.id,
      label: device.name,
      detail: device.active ? t("nowPlaying") : device.online ? undefined : t("deviceOffline"),
      selected: device.active,
      disabled: !device.online,
    }));

  return (
    <PillMenu
      label={currentName ?? t("chooseDevice")}
      icon="speaker"
      ariaLabel={t("deviceAria", { name: currentName ?? t("noDeviceSelected") })}
      items={items}
      onSelect={onTransfer}
      onOpen={() => void load()}
      empty={error ?? (devices === null ? t("loading") : t("noDevices"))}
    />
  );
}

const SEEK_KEY_STEP_MS = 5000;

/**
 * 再生位置のバー（widget-sdk の Slider）。つまみをドラッグ（またはバーを押す・矢印キーで5秒）して、離したところへ再生位置を動かす。
 * 動かしたあとは、新しい再生位置が届くまで動かした先を出したままにする（跳ね戻らないように）
 */
function SeekBar({
  position,
  duration,
  onSeek,
}: {
  position: number | null;
  duration: number | null;
  onSeek: (positionMs: number) => Promise<void>;
}) {
  const t = messages.useT();
  // ドラッグ中の位置、または動かしたあと届くまでの位置
  const [preview, setPreview] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const canSeek = duration !== null && duration > 0;
  const shown = preview ?? position;

  const commit = async (positionMs: number) => {
    clearTimeout(timer.current);
    setPreview(positionMs);
    try {
      await onSeek(positionMs);
    } finally {
      // 新しい再生位置が届くまで少し待ってから、届いた位置に任せる
      timer.current = setTimeout(() => setPreview(null), 1500);
    }
  };

  return (
    <div className="media__progress">
      <Slider
        value={shown ?? 0}
        max={duration ?? 0}
        keyStep={SEEK_KEY_STEP_MS}
        disabled={!canSeek}
        label={t("seekPosition")}
        valueText={`${formatTime(shown)} / ${formatTime(duration)}`}
        onInput={(value) => {
          clearTimeout(timer.current);
          setPreview(value);
        }}
        onCommit={(value) => void commit(value)}
      />
      <div className="media__times">
        <span>{formatTime(shown)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
