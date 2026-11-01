import { useState } from "react";
import {
  Badge,
  Button,
  Icon,
  List,
  ListItem,
  Message,
  Note,
  ScreenFrame,
  ScreenNotice,
  SideLayout,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import { PlacesMap } from "./PlacesMap";
import { PlaceActions, deviceIcon, messages, placeDetail, usePlaceActions, usePlaces } from "./shared";

/**
 * 位置の画面（サイドバーから開く）。右に地図、左に端末の一覧。一覧か地図の札を押すとその端末へ寄せ、
 * 一覧の下にその端末のボタン（今の位置を測る・マップで開く・ここを家にする）を出す。狭い画面では一覧を地図の下に回す
 */

const POLL_MS = 60 * 1000;

export function LocationScreen({ ctx }: ScreenProps) {
  const t = messages.useT();
  const { data, error, refresh } = usePlaces(ctx, POLL_MS);
  const actions = usePlaceActions(ctx, refresh);
  const [selected, setSelected] = useState<string | null>(null);
  const [fitKey, setFitKey] = useState(0);

  const places = data?.places ?? [];
  const current = places.find((p) => p.name === selected) ?? null;
  const provider = data?.map?.standard ? "OpenStreetMap" : (data?.map?.tiles.match(/^https?:\/\/([^/]+)/)?.[1] ?? "");

  return (
    <ScreenFrame
      title={{ ja: "位置", en: "Location" }}
      actions={
        places.length > 0 && (
          <Button onClick={() => setFitKey((n) => n + 1)}>
            <Icon name="location" />
            {t("showAll")}
          </Button>
        )
      }
    >
      {Boolean(error) && !data && <ScreenNotice tone="error">{(error as Error).message || t("loadFailed")}</ScreenNotice>}
      {data && !data.configured && <ScreenNotice>{data.message}</ScreenNotice>}
      {data?.configured && (
        <SideLayout
          className="location-screen"
          sideLabel={t("devices")}
          side={
            <>
              {!data.home && <Note>{t("noHomeNote")}</Note>}
              {places.length === 0 ? (
                <Note>{t("empty")}</Note>
              ) : (
                <List boxed label={t("devices")}>
                  {places.map((place) => (
                    <ListItem
                      key={place.name}
                      leading={<Icon name={deviceIcon(place)} />}
                      title={place.label}
                      badge={
                        place.atHome ? (
                          <Badge tone="on">{t("atHome")}</Badge>
                        ) : place.available && !place.fresh ? (
                          <Badge tone="dim">{t("old")}</Badge>
                        ) : undefined
                      }
                      detail={placeDetail(place, t)}
                      selected={place.name === selected}
                      chevron={false}
                      onClick={() => setSelected(place.name)}
                    />
                  ))}
                </List>
              )}
              {actions.result && <Message tone={actions.result.tone}>{actions.result.text}</Message>}
              {current && (
                <div className="location-screen__actions">
                  <PlaceActions place={current} actions={actions} mapLabel={t("appleMaps")} />
                </div>
              )}
              <Note>{t("privacy")}</Note>
              {data.map && <Note>{t("mapPrivacy", { provider })}</Note>}
            </>
          }
        >
          {data.map && (
            <PlacesMap
              places={places}
              home={data.homeArea ?? null}
              tiles={data.map}
              homeLabel={t("home")}
              selected={selected}
              onSelect={setSelected}
              fitKey={fitKey}
            />
          )}
        </SideLayout>
      )}
    </ScreenFrame>
  );
}
