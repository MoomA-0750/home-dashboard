import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Home, Place } from "./places";
import type { MapTiles } from "./shared";

/**
 * 端末の位置を描く地図（Leaflet）。端末ごとに名前の札と精度の円、家の半径を破線の円で描く。
 * 最初に読めたときだけ全体が入るように寄せ、そのあと読み直しても、動かした地図はそのままにする。
 * selected が変わったらその端末へ寄せる。fitKey を変えると全体を見直す
 */

export interface PlacesMapProps {
  places: Place[];
  home: Home | null;
  tiles: MapTiles;
  homeLabel: string;
  selected: string | null;
  onSelect: (name: string) => void;
  /** 変えるたびに全体が入るように寄せ直す */
  fitKey: number;
}

const FIT_PADDING: L.PointExpression = [48, 48];
const FOCUS_ZOOM = 16;

export function PlacesMap({ places, home, tiles, homeLabel, selected, onSelect, fitKey }: PlacesMapProps) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 地図そのものは1回だけ作る
  useEffect(() => {
    if (!element.current) return;
    const m = L.map(element.current, { zoomControl: true, attributionControl: true, worldCopyJump: true });
    m.setView([35.68, 139.76], 5);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // 画面の幅が変わる（サイドバーの開閉・回転）と、Leaflet は大きさを測り直さないと絵が欠ける
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const tileLayer = L.tileLayer(tiles.tiles, { maxZoom: 19, attribution: tiles.attribution }).addTo(m);
    return () => {
      tileLayer.remove();
    };
  }, [tiles.tiles, tiles.attribution]);

  const points = (): L.LatLng[] => {
    const list = places.filter((p) => p.available && p.lat !== null && p.lon !== null).map((p) => L.latLng(p.lat!, p.lon!));
    if (home) list.push(L.latLng(home.lat, home.lon));
    return list;
  };

  const fitAll = () => {
    const m = map.current;
    const list = points();
    if (!m || list.length === 0) return false;
    if (list.length === 1) m.setView(list[0], FOCUS_ZOOM);
    else m.fitBounds(L.latLngBounds(list), { padding: FIT_PADDING, maxZoom: FOCUS_ZOOM });
    return true;
  };

  // 端末と家を描き直す
  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    if (home) {
      L.circle([home.lat, home.lon], { radius: home.radiusM, className: "location-map__home-area", interactive: false }).addTo(group);
      L.marker([home.lat, home.lon], {
        icon: L.divIcon({ className: "location-map__home", html: homeIconHtml(homeLabel), iconSize: undefined }),
        interactive: false,
        keyboard: false,
      }).addTo(group);
    }
    for (const place of places) {
      if (!place.available || place.lat === null || place.lon === null) continue;
      const at: L.LatLngExpression = [place.lat, place.lon];
      if (place.accuracyM !== null && place.accuracyM > 0) {
        L.circle(at, { radius: place.accuracyM, className: "location-map__accuracy", interactive: false }).addTo(group);
      }
      const classes = ["location-map__pin"];
      if (place.name === selected) classes.push("location-map__pin--selected");
      if (!place.fresh) classes.push("location-map__pin--old");
      L.marker(at, {
        icon: L.divIcon({ className: classes.join(" "), html: pinHtml(place.label), iconSize: undefined }),
        title: place.label,
        alt: place.label,
        riseOnHover: true,
        zIndexOffset: place.name === selected ? 1000 : 0,
      })
        .on("click", () => onSelectRef.current(place.name))
        .addTo(group);
    }
    if (!fitted.current) fitted.current = fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, home, selected, homeLabel]);

  useEffect(() => {
    if (fitKey > 0) fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // 一覧で選んだ端末へ寄せる
  useEffect(() => {
    const m = map.current;
    const place = places.find((p) => p.name === selected);
    if (!m || !place?.available || place.lat === null || place.lon === null) return;
    m.flyTo([place.lat, place.lon], Math.max(m.getZoom(), 15), { duration: 0.6 });
    // 選び直したときだけ動かす（読み直しのたびに引き戻さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return <div ref={element} className={tiles.standard ? "location-map location-map--standard" : "location-map"} />;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function pinHtml(label: string): string {
  return `<span class="location-map__dot"></span><span class="location-map__label">${escapeHtml(label)}</span>`;
}

function homeIconHtml(label: string): string {
  return `<span class="location-map__label location-map__label--home">${escapeHtml(label)}</span>`;
}
