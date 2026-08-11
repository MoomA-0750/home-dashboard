import { defineWidget, usePolling, type WidgetProps } from "@home-dashboard/widget-sdk";

interface SpotifyMediaConfig {
  pollIntervalMs: number;
}

interface NowPlayingResponse {
  configured: boolean;
  isPlaying: boolean;
  track: { name: string; artist: string; albumArtUrl: string | null } | null;
}

async function fetchNowPlaying(apiBaseUrl: string): Promise<NowPlayingResponse> {
  const res = await fetch(`${apiBaseUrl}/api/spotify/now-playing`);
  if (!res.ok) throw new Error(`spotify API error: ${res.status}`);
  return res.json();
}

async function control(apiBaseUrl: string, action: "play" | "pause" | "next" | "previous") {
  await fetch(`${apiBaseUrl}/api/spotify/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

function SpotifyMediaView({ ctx, config }: WidgetProps<SpotifyMediaConfig>) {
  const { data } = usePolling(() => fetchNowPlaying(ctx.apiBaseUrl), config.pollIntervalMs);

  if (!data || !data.configured) {
    return (
      <div className="widget-card widget-spotify widget-spotify--unconfigured">
        Spotify未接続
        <span className="widget-spotify__hint">サーバーの SPOTIFY_REFRESH_TOKEN を設定してください</span>
      </div>
    );
  }

  if (!data.track) {
    return <div className="widget-card widget-spotify widget-spotify--idle">再生していません</div>;
  }

  return (
    <div className="widget-card widget-spotify">
      {data.track.albumArtUrl && (
        <img className="widget-spotify__art" src={data.track.albumArtUrl} alt="" />
      )}
      <div className="widget-spotify__meta">
        <div className="widget-spotify__title">{data.track.name}</div>
        <div className="widget-spotify__artist">{data.track.artist}</div>
        <div className="widget-spotify__controls">
          <button type="button" onClick={() => control(ctx.apiBaseUrl, "previous")}>⏮</button>
          <button type="button" onClick={() => control(ctx.apiBaseUrl, data.isPlaying ? "pause" : "play")}>
            {data.isPlaying ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={() => control(ctx.apiBaseUrl, "next")}>⏭</button>
        </div>
      </div>
    </div>
  );
}

export default defineWidget<SpotifyMediaConfig>({
  id: "spotify-media",
  name: "Spotifyメディア",
  description: "現在再生中の曲を表示し、再生操作ができます",
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  defaultConfig: { pollIntervalMs: 5000 },
  Component: SpotifyMediaView,
});
