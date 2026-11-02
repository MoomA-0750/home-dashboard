import { useEffect, useRef, useState } from "react";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  BackButton,
  Button,
  Chip,
  cx,
  IconButton,
  PillMenu,
  ScreenFrame,
  ScreenNotice,
  ScreenSection,
  scrollBehavior,
  Slider,
  usePolledResource,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import { Artwork } from "./Artwork";
import { messages } from "./i18n";
import { useMusicProviders, useSelectedMusicProvider, type MediaProviderOption } from "./providers";

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
        <ScreenNotice>{t("noProviders")}</ScreenNotice>
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
    <div className="flex flex-wrap items-center gap-2.5">
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
        <ScreenNotice>{String((playbackResource.error as Error).message ?? playbackResource.error)}</ScreenNotice>
      </ScreenFrame>
    );
  }
  if (playback && !playback.configured) {
    return (
      <ScreenFrame title={{ ja: "メディア", en: "Media" }} actions={actions}>
        <ScreenNotice>{t("notConnected", { name: provider.name })}</ScreenNotice>
      </ScreenFrame>
    );
  }

  const track = playback?.track ?? null;
  const duration = track?.durationMs ?? null;
  const canShuffle = playback?.capabilities?.shuffle ?? true;
  const canRepeat = playback?.capabilities?.repeat ?? true;

  return (
    <ScreenFrame title={{ ja: "メディア", en: "Media" }} actions={actions}>
      {failure && <ScreenNotice tone="error">{failure}</ScreenNotice>}
      {/*
        左に再生中（ジャケット・曲名・操作・次に再生）、右にタブ（歌詞・プレイリスト・おすすめ）。狭い画面では縦に積む。
        壁掛けの横長で背の低い画面では、画面の高さに収め、ジャケットを左の高さいっぱいにして、それぞれの列の中だけを送る
      */}
      <div className="flex items-start gap-10 tablet:flex-col tablet:items-stretch tablet:gap-6 wall:media-wall-height wall:items-stretch">
        <section
          className="sticky top-0 flex min-w-75 shrink basis-105 flex-col gap-4.5 tablet:static tablet:basis-auto wall:static wall:min-h-0 wall:grow-5 wall:basis-0 wall:flex-row wall:gap-8"
          aria-label={t("nowPlaying")}
        >
          <Artwork
            url={track?.artUrl ?? null}
            className="w-full rounded-inner shadow-widget tablet:mx-auto tablet:max-w-90 wall:h-full wall:w-auto wall:shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-4.5 wall:min-h-0 wall:flex-1">
            <div className="flex min-w-0 flex-col gap-2.5">
              <span className="ellipsis text-card font-semibold">{track?.title ?? t("notPlaying")}</span>
              <span className="ellipsis text-muted">
                {track ? [track.artist, track.album].filter(Boolean).join(" — ") : ""}
              </span>
            </div>
            <SeekBar
              key={track?.uri ?? "none"}
              position={position}
              duration={duration}
              onSeek={(positionMs) => act(() => postJson(`${apiBaseUrl}/seek`, { positionMs }))}
            />
            {/* シャッフル・繰り返しのできない提供元（wave）では、残りの3つを真ん中に寄せる */}
            <div className={cx("flex items-center", canShuffle && canRepeat ? "justify-between" : "justify-center gap-8")}>
              {canShuffle && (
                <IconButton
                  icon="shuffle"
                  size="lg"
                  label={t("shuffle")}
                  selected={playback?.shuffle ?? false}
                  onClick={() => control("shuffle", !playback?.shuffle)}
                />
              )}
              <IconButton icon="previous" size="lg" label={t("previous")} onClick={() => control("previous")} />
              <IconButton
                icon={playback?.isPlaying ? "pause" : "play"}
                size="lg"
                selected
                aria-pressed={undefined}
                label={playback?.isPlaying ? t("pause") : t("play")}
                className="size-19 [&_.fluent-icon]:size-8.5"
                onClick={() => control(playback?.isPlaying ? "pause" : "play")}
              />
              <IconButton icon="next" size="lg" label={t("next")} onClick={() => control("next")} />
              {canRepeat && (
                <span className="relative">
                  <IconButton
                    icon="repeat"
                    size="lg"
                    selected={playback?.repeat !== "off"}
                    label={t("repeatState", {
                      state: t(
                        playback?.repeat === "track" ? "repeatOne" : playback?.repeat === "context" ? "repeatAll" : "repeatOff",
                      ),
                    })}
                    onClick={() =>
                      control(
                        "repeat",
                        playback?.repeat === "off" ? "context" : playback?.repeat === "context" ? "track" : "off",
                      )
                    }
                  />
                  {/* 1曲の繰り返しの印（ボタンの右下に重ねる） */}
                  {playback?.repeat === "track" && (
                    <span className="pointer-events-none absolute right-1.5 bottom-1.5 text-micro font-bold text-on-fill">1</span>
                  )}
                </span>
              )}
            </div>
            <UpNext
              apiBaseUrl={apiBaseUrl}
              trackUri={track?.uri ?? null}
              onSkip={(index, trackUri) => act(() => postJson(`${apiBaseUrl}/queue/skip`, { index, trackUri }))}
            />
          </div>
        </section>

        <section className="glass flex min-w-0 flex-1 flex-col rounded-card media-panel-height tablet:min-h-0 wall:h-full wall:min-h-0 wall:grow-4 wall:basis-0">
          <div
            className="flex gap-1.5 border-b border-glass-border p-5 phone:overflow-x-auto"
            role="tablist"
            aria-label={t("tabsAria")}
          >
            {(
              [
                ["lyrics", t("lyrics"), "lyrics"],
                ["playlists", t("playlists"), "music-note"],
                ["suggestions", t("suggestions"), "sparkle"],
              ] as const
            ).map(([id, label, icon]) => (
              <Chip
                key={id}
                role="tab"
                icon={icon}
                selected={tab === id}
                aria-pressed={undefined}
                aria-selected={tab === id}
                className="shrink-0 whitespace-nowrap phone:[&_.fluent-icon]:hidden"
                onClick={() => setTab(id)}
              >
                {label}
              </Chip>
            ))}
          </div>
          <div className="min-h-0 flex-1 p-6 *:animate-enter wall:overflow-y-auto">
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
    <ScreenSection title={t("upNext")} className="mt-2 mb-0 wall:min-h-0 wall:overflow-y-auto">
      <TrackList>
        {tracks.map((track, index) => (
          <li key={`${track.uri}-${index}`}>
            {/* 押すとその曲へ飛ぶ */}
            <TrackButton
              track={track}
              detail={skipping === index ? t("skipping") : undefined}
              pending={skipping === index}
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
            />
          </li>
        ))}
      </TrackList>
    </ScreenSection>
  );
}

/** 曲の一覧（次に再生・プレイリストの曲・おすすめ） */
function TrackList({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col gap-1">{children}</ol>;
}

/** 曲の1行（ジャケット・曲名・アーティスト。右に長さを出せる）。押すとその曲を鳴らす */
function TrackButton({
  track,
  detail,
  time,
  pending,
  className,
  ...rest
}: {
  track: MusicTrack;
  /** アーティストの代わりに出す文（「移動中…」など） */
  detail?: string;
  time?: string;
  /** 押して待っている行（薄く色を付ける） */
  pending?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        "press-wide flex min-h-15 w-full cursor-pointer items-center gap-3.5 rounded-inner px-2.5 py-1.5 text-left text-text",
        "hover:bg-white/8 disabled:cursor-progress",
        pending && "bg-tint/10",
        className,
      )}
      {...rest}
    >
      <Artwork url={track.artUrl} className="size-12 shrink-0 rounded-art" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="ellipsis">{track.title}</span>
        <span className="ellipsis text-note font-medium text-muted">{detail ?? track.artist}</span>
      </span>
      {time && <span className="text-note font-medium text-muted tabular-nums">{time}</span>}
    </button>
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

  if (!track) return <ScreenNotice>{t("lyricsIdle")}</ScreenNotice>;
  if (error) return <ScreenNotice>{t("lyricsFailed", { error })}</ScreenNotice>;
  if (!lyrics) return <ScreenNotice>{t("lyricsSearching")}</ScreenNotice>;
  if (lyrics.instrumental) return <ScreenNotice>{t("instrumental")}</ScreenNotice>;
  if (!lyrics.found) return <ScreenNotice>{t("lyricsNotFound")}</ScreenNotice>;

  return (
    <div className="relative lyrics-scroll wall:h-full wall:max-h-none">
      <ol ref={listRef} className="flex flex-col gap-4.5 lyrics-pad">
        {lyrics.lines.map((line, index) => (
          <li
            key={index}
            className={cx(
              "text-card leading-normal font-semibold untrim",
              // 時刻付きの歌詞では、歌っている行だけを明るくし、ほかは控えめにする
              lyrics.synced &&
                "origin-left transition duration-(--motion-slow) ease-standard",
              lyrics.synced && (index === active ? "scale-104" : index < active ? "text-text/55" : "text-text/40"),
            )}
          >
            {line.text || "♪"}
          </li>
        ))}
      </ol>
      <p className="text-right text-micro text-muted">{t("lyricsCredit")}</p>
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

  if (error) return <ScreenNotice>{(error as Error).message}</ScreenNotice>;
  if (!data) return <ScreenNotice>{t("loading")}</ScreenNotice>;
  if (open)
    return <PlaylistTracks apiBaseUrl={apiBaseUrl} playlist={open} onBack={() => setOpen(null)} onPlay={onPlay} />;
  if (data.playlists.length === 0) return <ScreenNotice>{t("noPlaylists")}</ScreenNotice>;

  return (
    <ul className="grid media-tiles gap-4.5">
      {data.playlists.map((playlist) => (
        <li key={playlist.id} className="relative">
          <button
            type="button"
            className="press flex w-full cursor-pointer flex-col gap-2 text-left text-text"
            onClick={() => (playlist.browsable ? setOpen(playlist) : onPlay({ contextUri: playlist.uri }))}
            aria-label={playlist.browsable ? t("viewPlaylist", { name: playlist.name }) : t("playPlaylist", { name: playlist.name })}
          >
            <Artwork url={playlist.artUrl} className="w-full rounded-inner" />
            <span className="ellipsis font-semibold">{playlist.name}</span>
            <span className="text-caption font-medium text-muted untrim">
              {[playlist.owner, playlist.trackCount !== null ? t("trackCount", { n: playlist.trackCount }) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
          {/* ジャケットの右下に重ねる再生ボタン（ジャケットと同じ正方形の枠の右下に置く） */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-end justify-end p-2.5">
            <IconButton
              icon="play"
              size="lg"
              selected
              aria-pressed={undefined}
              label={t("playPlaylist", { name: playlist.name })}
              className="pointer-events-auto"
              onClick={() => onPlay({ contextUri: playlist.uri })}
            />
          </div>
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
    <div>
      <BackButton label={t("backToPlaylists")} onClick={onBack} />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="min-w-0 flex-1 text-heading font-semibold">{playlist.name}</span>
        <Button variant="primary" icon="play" onClick={() => onPlay({ contextUri: playlist.uri })}>
          {t("playFromStart")}
        </Button>
      </div>
      {error !== null && <ScreenNotice>{(error as Error).message}</ScreenNotice>}
      {!data && !error && <ScreenNotice>{t("loading")}</ScreenNotice>}
      <TrackList>
        {data?.tracks.map((track, index) => (
          <li key={`${track.uri}-${index}`}>
            <TrackButton
              track={track}
              time={formatTime(track.durationMs)}
              onClick={() => onPlay({ contextUri: playlist.uri, offsetUri: track.uri })}
            />
          </li>
        ))}
      </TrackList>
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

  if (error) return <ScreenNotice>{(error as Error).message}</ScreenNotice>;
  if (!data) return <ScreenNotice>{t("loading")}</ScreenNotice>;
  if (data.groups.length === 0) return <ScreenNotice>{t("noSuggestions")}</ScreenNotice>;

  return (
    <div>
      {data.groups.map((group) => (
        <ScreenSection key={group.id} title={group.note ? `${group.title} · ${group.note}` : group.title} className="mb-8 last:mb-0">
          <TrackList>
            {group.tracks.map((track) => (
              <li key={track.uri} className="flex items-center gap-2">
                <TrackButton track={track} onClick={() => onPlay({ trackUri: track.uri })} />
                <IconButton icon="add" label={t("enqueue", { title: track.title })} onClick={() => onEnqueue(track.uri)} />
              </li>
            ))}
          </TrackList>
        </ScreenSection>
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
    <div>
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
      <div className="mt-0.5 flex justify-between text-caption font-medium text-muted tabular-nums">
        <span>{formatTime(shown)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
