import { defineWidget, usePolling, type WidgetProps } from "@home-dashboard/widget-sdk";

interface SpotifyMediaConfig {
  pollIntervalMs: number;
}

type RepeatState = "off" | "track" | "context";

interface NowPlayingResponse {
  configured: boolean;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatState;
  track: { name: string; artist: string; albumArtUrl: string | null } | null;
}

type ControlAction = "play" | "pause" | "next" | "previous" | "shuffle" | "repeat";

async function fetchNowPlaying(apiBaseUrl: string): Promise<NowPlayingResponse> {
  const res = await fetch(`${apiBaseUrl}/api/spotify/now-playing`);
  if (!res.ok) throw new Error(`spotify API error: ${res.status}`);
  return res.json();
}

async function control(apiBaseUrl: string, action: ControlAction, state?: boolean | RepeatState) {
  await fetch(`${apiBaseUrl}/api/spotify/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, state }),
  });
}

/**
 * Fluent アイコンを CSS マスクで描画する。
 * apps/web の Icon コンポーネントと同じ仕組みだが、ウィジェットパッケージから
 * apps/web に依存させたくないのでここでは最小限の実装を持つ。
 */
function ControlIcon({ file }: { file: string }) {
  return (
    <span
      className="fluent-icon"
      style={{ ["--fluent-icon" as string]: `url("/icons/${file}.svg")` }}
      aria-hidden="true"
    />
  );
}

function SpotifyMediaView({ ctx, config }: WidgetProps<SpotifyMediaConfig>) {
  const { data } = usePolling(() => fetchNowPlaying(ctx.apiBaseUrl), config.pollIntervalMs);

  if (!data || !data.configured) {
    return (
      <div className="widget-card widget-spotify widget-spotify--unconfigured">
        <div className="widget-spotify__meta">
          <p className="widget-spotify__title">Spotify未接続</p>
          <span className="widget-spotify__hint">サーバーの SPOTIFY_REFRESH_TOKEN を設定してください</span>
        </div>
      </div>
    );
  }

  if (!data.track) {
    return (
      <div className="widget-card widget-spotify widget-spotify--idle">
        <div className="widget-spotify__meta">
          <p className="widget-spotify__title">再生していません</p>
        </div>
      </div>
    );
  }

  const nextRepeat: RepeatState = data.repeat === "off" ? "context" : data.repeat === "context" ? "track" : "off";

  return (
    <div className="widget-card widget-spotify">
      <div className="widget-spotify__meta">
        <p className="widget-spotify__title">{data.track.name}</p>
        <p className="widget-spotify__artist muted">{data.track.artist}</p>
        <div className="widget-spotify__controls" aria-label="音楽プレーヤー">
          <button
            type="button"
            className={`widget-spotify__toggle${data.shuffle ? " widget-spotify__toggle--on" : ""}`}
            aria-label="シャッフル"
            aria-pressed={data.shuffle}
            onClick={() => control(ctx.apiBaseUrl, "shuffle", !data.shuffle)}
          >
            <ControlIcon file="arrow_shuffle_24_regular" />
          </button>
          <button type="button" aria-label="前の曲" onClick={() => control(ctx.apiBaseUrl, "previous")}>
            <ControlIcon file="previous_24_regular" />
          </button>
          <button
            type="button"
            className="widget-spotify__play"
            aria-label={data.isPlaying ? "一時停止" : "再生"}
            onClick={() => control(ctx.apiBaseUrl, data.isPlaying ? "pause" : "play")}
          >
            <ControlIcon file={data.isPlaying ? "pause_24_filled" : "play_24_regular"} />
          </button>
          <button type="button" aria-label="次の曲" onClick={() => control(ctx.apiBaseUrl, "next")}>
            <ControlIcon file="next_24_regular" />
          </button>
          <button
            type="button"
            className={`widget-spotify__toggle${data.repeat !== "off" ? " widget-spotify__toggle--on" : ""}`}
            aria-label="リピート"
            aria-pressed={data.repeat !== "off"}
            onClick={() => control(ctx.apiBaseUrl, "repeat", nextRepeat)}
          >
            <ControlIcon file="arrow_repeat_all_24_regular" />
          </button>
        </div>
      </div>
      {data.track.albumArtUrl ? (
        <img className="widget-spotify__art" src={data.track.albumArtUrl} alt="" />
      ) : (
        <div className="widget-spotify__art widget-spotify__art--placeholder" aria-hidden="true">
          {data.track.name.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

export default defineWidget<SpotifyMediaConfig>({
  id: "spotify-media",
  name: "Spotifyメディア",
  description: "現在再生中の曲を表示し、再生操作ができます",
  defaultSize: { w: 4, h: 1 },
  minSize: { w: 3, h: 1 },
  defaultConfig: { pollIntervalMs: 5000 },
  Component: SpotifyMediaView,
});
