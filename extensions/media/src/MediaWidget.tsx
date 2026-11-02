import { useCallback } from "react";
import { cx, defineWidget, IconButton, usePolledResource, WidgetCard, WidgetHint, type WidgetProps } from "@home-dashboard/widget-sdk";
import { Artwork } from "./Artwork";
import { messages } from "./i18n";
import { useMusicProviders, useSelectedMusicProvider } from "./providers";

/**
 * ホームのメディアのウィジェット。Media 画面と同じ音楽アプリ（右上で選んだもの。wave・Spotify）の再生中の曲を出し、操作する。
 * 画面と同じ /api/ext/media/providers/<id>/* を読むので、画面で選び直すとウィジェットも切り替わる。
 * 操作したらすぐ読み直し、ほかの端末での操作は数秒ごとの読み直しで追いつく。
 */

/** 曲名などの大きな1行（カードの見出しの大きさ） */
const TITLE = "ellipsis text-card font-semibold leading-tight";

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
      <WidgetCard>
        <p className={TITLE}>{t("noApps")}</p>
        <WidgetHint>{t("noAppsHint")}</WidgetHint>
      </WidgetCard>
    );
  }

  // 読み込み中に前の音楽アプリの表示が残らないよう、いまの音楽アプリの名前を添える
  const providerLabel = <span className="text-micro text-muted">{provider.name}</span>;

  if (error && !data) {
    return (
      <WidgetCard>
        {providerLabel}
        <p className={TITLE}>{t("unreachable", { name: provider.name })}</p>
      </WidgetCard>
    );
  }
  if (data && !data.configured) {
    return (
      <WidgetCard>
        {providerLabel}
        <p className={TITLE}>{t("notConnectedShort", { name: provider.name })}</p>
        <WidgetHint>{t("notConnectedHint", { name: provider.name })}</WidgetHint>
      </WidgetCard>
    );
  }
  if (!data?.track) {
    return (
      <WidgetCard>
        {providerLabel}
        <p className={TITLE}>{data ? t("notPlaying") : t("loading")}</p>
      </WidgetCard>
    );
  }

  const canShuffle = data.capabilities?.shuffle ?? true;
  const canRepeat = data.capabilities?.repeat ?? true;
  const nextRepeat = data.repeat === "off" ? "context" : data.repeat === "context" ? "track" : "off";

  return (
    <WidgetCard className="flex-row items-center justify-between gap-5">
      <div className="flex min-w-0 flex-col gap-1">
        {providerLabel}
        <p className={TITLE}>{data.track.title}</p>
        <p className="ellipsis text-small text-muted">{data.track.artist}</p>
        <div className="mt-1 flex items-center gap-1" aria-label={t("player")}>
          {/* シャッフル・リピートはオン/オフのトグルなので、オンのときだけ明るく塗る（オフは控えめな色） */}
          {canShuffle && (
            <IconButton
              icon="shuffle"
              label={t("shuffle")}
              selected={data.shuffle}
              className={cx(!data.shuffle && "text-muted")}
              onClick={() => void control("shuffle", !data.shuffle)}
            />
          )}
          <IconButton icon="previous" label={t("previous")} onClick={() => void control("previous")} />
          <IconButton
            icon={data.isPlaying ? "pause" : "play"}
            selected
            aria-pressed={undefined}
            label={data.isPlaying ? t("pause") : t("play")}
            onClick={() => void control(data.isPlaying ? "pause" : "play")}
          />
          <IconButton icon="next" label={t("next")} onClick={() => void control("next")} />
          {canRepeat && (
            <IconButton
              icon="repeat"
              label={t("repeat")}
              selected={data.repeat !== "off"}
              className={cx(data.repeat === "off" && "text-muted")}
              onClick={() => void control("repeat", nextRepeat)}
            />
          )}
        </div>
      </div>
      <Artwork url={data.track.artUrl} className="size-35 shrink-0 rounded-inner phone:size-23" />
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
