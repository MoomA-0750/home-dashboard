import {
  Badge,
  DetailFrame,
  Icon,
  List,
  ListItem,
  Message,
  Note,
  WidgetCard,
  WidgetHint,
  defineWidget,
  type WidgetDetailProps,
  type WidgetProps,
} from "@home-dashboard/widget-sdk";
import { PlaceActions, deviceIcon, formatAge, messages, placeDetail, usePlaceActions, usePlaces, whereText } from "./shared";

/**
 * 位置のウィジェット。いちばん上に「見る端末」の最初（本人の持ち歩く端末）の、家にいるか・家からの距離を出す。
 * 詳しい画面では端末ごとに、測位を頼む・地図で開く・ここを家にするができる。地図はサイドバーの「位置」の画面に出す
 */

interface Config {
  pollIntervalMs: number;
}

function LocationView({ ctx, config, size, openDetail }: WidgetProps<Config>) {
  const t = messages.useT();
  const { data, error } = usePlaces(ctx, config.pollIntervalMs);
  const [first, ...rest] = data?.places ?? [];
  const others = size.h >= 2 ? rest.slice(0, size.h * 2 - 2) : [];

  return (
    <WidgetCard className="location-widget" onClick={openDetail} label={t("title")}>
      <span className="location-widget__title">
        <Icon name="location" />
        {first?.label ?? t("title")}
      </span>
      {error && !data ? (
        <WidgetHint tone="error">{t("loadFailed")}</WidgetHint>
      ) : data && !data.configured ? (
        <WidgetHint>{data.message}</WidgetHint>
      ) : first ? (
        <>
          <span className={first.atHome ? "location-widget__where location-widget__where--home" : "location-widget__where"}>
            {whereText(first, t)}
          </span>
          <WidgetHint>{formatAge(first.ageSeconds, t)}</WidgetHint>
          {others.length > 0 && (
            <ul className="location-widget__others">
              {others.map((place) => (
                <li key={place.name}>
                  <span>{place.label}</span>
                  <span>{whereText(place, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        data && <WidgetHint>{t("empty")}</WidgetHint>
      )}
    </WidgetCard>
  );
}

function LocationDetail({ ctx, config }: WidgetDetailProps<Config>) {
  const t = messages.useT();
  const { data, error, refresh } = usePlaces(ctx, config.pollIntervalMs);
  const actions = usePlaceActions(ctx, refresh);
  const { result } = actions;
  const places = data?.places ?? [];

  return (
    <DetailFrame title={t("title")} className="location-detail">
      {Boolean(error) && !data && <Message tone="error">{(error as Error).message || t("loadFailed")}</Message>}
      {data && !data.configured && <Note>{data.message}</Note>}
      {data?.configured && !data.home && <Note>{t("noHomeNote")}</Note>}
      {result && <Message tone={result.tone}>{result.text}</Message>}
      {data?.configured && places.length === 0 && <Note>{t("empty")}</Note>}
      {places.length > 0 && (
        <List boxed>
          {places.map((place) => (
            <ListItem
              key={place.name}
              leading={<Icon name={deviceIcon(place)} />}
              title={place.label}
              badge={place.atHome ? <Badge tone="on">{t("atHome")}</Badge> : place.available && !place.fresh ? <Badge tone="dim">{t("old")}</Badge> : undefined}
              detail={placeDetail(place, t)}
              trailing={<PlaceActions place={place} actions={actions} />}
            />
          ))}
        </List>
      )}
      <Note>{t("privacy")}</Note>
    </DetailFrame>
  );
}

export const locationWidget = defineWidget<Config>({
  id: "location",
  name: { ja: "位置", en: "Location" },
  description: {
    ja: "自分の Apple 端末が家にいるか・家からどれくらいかを出します（iCloud の「探す」から）",
    en: "Shows whether your Apple devices are home and how far away they are (from iCloud Find My)",
  },
  defaultSize: { w: 2, h: 1 },
  minSize: { w: 2, h: 1 },
  defaultConfig: { pollIntervalMs: 2 * 60 * 1000 },
  Component: LocationView,
  DetailComponent: LocationDetail,
});
