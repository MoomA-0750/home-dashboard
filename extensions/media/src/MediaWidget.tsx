import { useCallback } from "react";
import { defineWidget, Icon, usePolledResource, type WidgetProps , WidgetCard } from "@home-dashboard/widget-sdk";
import { messages } from "./i18n";
import { useMusicProviders, useSelectedMusicProvider } from "./providers";
import "./media.css";

/**
 * ホームのメディアのウィジェット。Media 画面と同じ音楽アプリ（右上で選んだもの。wave・Spotify）の再生中の曲を出し、操作する。
 * 画面と同じ /api/ext/media/providers/<id>/* を読むので、画面で選び直すとウィジェットも切り替わる。
 * 操作したらすぐ読み直し、ほかの端末での操作は数秒ごとの読み直しで追いつく。
 */

interface MediaWidgetConfig {
  pollIntervalMs: number;
}

interface Playback {
  configured: boolean;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: "off" | "track" | "context";
  track: { title: string; artist: string; artUrl: string | null } | null;
  capabilities?: { shuffle: boolean; repeat: boolean };
}

function MediaWidgetView({ ctx, config }: WidgetProps<MediaWidgetConfig>) {
  const providers = useMusicProviders();
  const [provider] = useSelectedMusicProvider(providers);
  const t = messages.useT();
  const base = provider ? `${ctx.apiBaseUrl}/api/ext/media/providers/${provider.extensionId}` : null;

  const { data, error, refresh } = usePolledResource(async (): Promise<Playback | null> => {
    if (!base) return null;
    const res = await fetch(`${base}/playback`);
    if (!res.ok) throw new Error(`media API error: ${res.status}`);
    return res.json();
  }, config.pollIntervalMs);

  const control = useCallback(
    async (action: string, state?: unknown) => {
      if (!base) return;
      await fetch(`${base}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, state }),
      }).catch(() => undefined);
      // 操作の結果をすぐ見せる。鳴らしている端末が反映するまで少しかかるので、少し後にももう一度
      await refresh();
      setTimeout(refresh, 800);
    },
    [base, refresh],
  );

  if (!provider) {
    return (
      <WidgetCard className="widget-media widget-media--idle">
        <div className="widget-media__meta">
          <p className="widget-media__title">{t("noApps")}</p>
          <span className="widget-hint">{t("noAppsHint")}</span>
        </div>
      </WidgetCard>
    );
  }

  // 読み込み中に前の音楽アプリの表示が残らないよう、いまの音楽アプリの名前を添える
  const providerLabel = <span className="widget-media__provider">{provider.name}</span>;

  if (error && !data) {
    return (
      <WidgetCard className="widget-media widget-media--idle">
        <div className="widget-media__meta">
          {providerLabel}
          <p className="widget-media__title">{t("unreachable", { name: provider.name })}</p>
        </div>
      </WidgetCard>
    );
  }
  if (data && !data.configured) {
    return (
      <WidgetCard className="widget-media widget-media--idle">
        <div className="widget-media__meta">
          {providerLabel}
          <p className="widget-media__title">{t("notConnectedShort", { name: provider.name })}</p>
          <span className="widget-hint">{t("notConnectedHint", { name: provider.name })}</span>
        </div>
      </WidgetCard>
    );
  }
  if (!data?.track) {
    return (
      <WidgetCard className="widget-media widget-media--idle">
        <div className="widget-media__meta">
          {providerLabel}
          <p className="widget-media__title">{data ? t("notPlaying") : t("loading")}</p>
        </div>
      </WidgetCard>
    );
  }

  const canShuffle = data.capabilities?.shuffle ?? true;
  const canRepeat = data.capabilities?.repeat ?? true;
  const nextRepeat = data.repeat === "off" ? "context" : data.repeat === "context" ? "track" : "off";

  return (
    <WidgetCard className="widget-media">
      <div className="widget-media__meta">
        {providerLabel}
        <p className="widget-media__title">{data.track.title}</p>
        <p className="widget-media__artist muted">{data.track.artist}</p>
        <div className="widget-media__controls" aria-label={t("player")}>
          {canShuffle && (
            <button
              type="button"
              className={`widget-media__toggle${data.shuffle ? " widget-media__toggle--on" : ""}`}
              aria-label={t("shuffle")}
              aria-pressed={data.shuffle}
              onClick={() => void control("shuffle", !data.shuffle)}
            >
              <Icon name="shuffle" />
            </button>
          )}
          <button type="button" aria-label={t("previous")} onClick={() => void control("previous")}>
            <Icon name="previous" />
          </button>
          <button
            type="button"
            className="widget-media__play"
            aria-label={data.isPlaying ? t("pause") : t("play")}
            onClick={() => void control(data.isPlaying ? "pause" : "play")}
          >
            <Icon name={data.isPlaying ? "pause" : "play"} />
          </button>
          <button type="button" aria-label={t("next")} onClick={() => void control("next")}>
            <Icon name="next" />
          </button>
          {canRepeat && (
            <button
              type="button"
              className={`widget-media__toggle${data.repeat !== "off" ? " widget-media__toggle--on" : ""}`}
              aria-label={t("repeat")}
              aria-pressed={data.repeat !== "off"}
              onClick={() => void control("repeat", nextRepeat)}
            >
              <Icon name="repeat" />
            </button>
          )}
        </div>
      </div>
      {data.track.artUrl ? (
        <img className="widget-media__art" src={data.track.artUrl} alt="" />
      ) : (
        <div className="widget-media__art widget-media__art--placeholder" aria-hidden="true">
          {data.track.title.slice(0, 1)}
        </div>
      )}
    </WidgetCard>
  );
}

/** 音楽アプリを替えたら、取得のしなおし（前の音楽アプリの表示を引きずらない）のため作り直す */
function MediaWidget(props: WidgetProps<MediaWidgetConfig>) {
  const providers = useMusicProviders();
  const [provider] = useSelectedMusicProvider(providers);
  return <MediaWidgetView key={provider?.extensionId ?? "none"} {...props} />;
}

export const mediaWidget = defineWidget<MediaWidgetConfig>({
  id: "media",
  name: { ja: "メディア", en: "Media" },
  description: {
    ja: "Media 画面で選んだ音楽アプリ（wave・Spotify）の再生中の曲を表示し、再生操作ができます",
    en: "Shows the song playing in the music app chosen on the Media screen (wave or Spotify) and lets you control playback",
  },
  defaultSize: { w: 4, h: 1 },
  minSize: { w: 3, h: 1 },
  defaultConfig: { pollIntervalMs: 3000 },
  Component: MediaWidget,
});
