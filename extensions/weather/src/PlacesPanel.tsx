import { useState, type FormEvent } from "react";
import {
  Button,
  ButtonRow,
  Dialog,
  extensionApiUrl,
  Field,
  Group,
  List,
  ListItem,
  Message,
  Note,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import { messages } from "./i18n";

/**
 * 場所を足す・外す小窓（Weather 画面の右上の「場所を追加・管理」から開く）。地名で探すか、この端末の現在地から足す。
 * 足した場所は家で共有（どの端末の Weather 画面にも出る）
 */

export interface WeatherPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  home: boolean;
}

interface Candidate {
  name: string;
  lat: number;
  lon: number;
  detail: string;
}

type Ctx = Pick<WidgetRuntimeContext, "apiBaseUrl">;

async function request<T>(ctx: Ctx, path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(extensionApiUrl(ctx, "weather", path), {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? messages.t("requestFailed", { status: res.status }));
  return body as T;
}

export const fetchPlaces = async (ctx: Ctx) => (await request<{ places: WeatherPlace[] }>(ctx, "/places")).places;

/** この端末の現在地（位置情報の許可を求める） */
function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(messages.t("noGeolocation")));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      reject(
        new Error(
          error.code === error.PERMISSION_DENIED
            ? messages.t("geoDenied")
            : messages.t("geoFailed"),
        ),
      );
    }, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60 * 1000 });
  });
}

export function PlacesPanel({
  ctx,
  places,
  onAdded,
  onRemoved,
  onClose,
}: {
  ctx: Ctx;
  places: WeatherPlace[];
  onAdded: (place: WeatherPlace) => void;
  onRemoved: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<"search" | "here" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = messages.useT();

  const run = async (kind: "search" | "here" | "add", task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const add = (candidate: { name: string; lat: number; lon: number }) =>
    run("add", async () => {
      const { place } = await request<{ place: Omit<WeatherPlace, "home"> }>(ctx, "/places", { method: "POST", json: candidate });
      onAdded({ ...place, home: false });
    });

  const search = (event: FormEvent) => {
    event.preventDefault();
    void run("search", async () => {
      const { places: found } = await request<{ places: Candidate[] }>(ctx, `/places/search?q=${encodeURIComponent(query)}`);
      setResults(found);
    });
  };

  const addHere = () =>
    run("here", async () => {
      const position = await currentPosition();
      const { latitude: lat, longitude: lon } = position.coords;
      const { name } = await request<{ name: string | null }>(ctx, `/places/name?lat=${lat}&lon=${lon}`);
      const { place } = await request<{ place: Omit<WeatherPlace, "home"> }>(ctx, "/places", {
        method: "POST",
        json: { name: name ?? t("currentLocation"), lat, lon },
      });
      onAdded({ ...place, home: false });
    });

  const remove = (id: string) =>
    run("add", async () => {
      await request(ctx, `/places/${encodeURIComponent(id)}`, { method: "DELETE" });
      onRemoved(id);
    });

  return (
    <Dialog title={t("manageTitle")} onClose={onClose}>
      <Group>
        <form onSubmit={search}>
          <Field label={t("searchByName")}>
            <input value={query} placeholder={t("searchPlaceholder")} maxLength={60} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <ButtonRow>
            <Button variant="primary" type="submit" icon="globe" disabled={!query.trim() || busy !== null}>
              {busy === "search" ? t("searching") : t("search")}
            </Button>
            <Button icon="location" onClick={() => void addHere()} disabled={busy !== null}>
              {busy === "here" ? t("locating") : t("addHere")}
            </Button>
          </ButtonRow>
        </form>
        {error && <Message tone="error">{error}</Message>}
      </Group>
      {results !== null &&
        (results.length === 0 ? (
          <Note>{t("notFoundHint")}</Note>
        ) : (
          <List label={t("foundPlaces")}>
            {results.map((r) => (
              <ListItem
                key={`${r.lat},${r.lon}`}
                title={r.name}
                detail={r.detail || `${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}`}
                trailing={<span className="weather-places__add">{t("add")}</span>}
                onClick={busy === null ? () => void add(r) : undefined}
              />
            ))}
          </List>
        ))}
      <List label={t("choosablePlaces")}>
        {places.map((p) => (
          <ListItem
            key={p.id}
            title={p.name}
            detail={p.home ? t("homeDetail") : `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`}
            trailing={
              p.home ? undefined : (
                <Button variant="danger" onClick={() => void remove(p.id)} disabled={busy !== null}>
                  {t("remove")}
                </Button>
              )
            }
          />
        ))}
      </List>
      <Note>{t("osmNote")}</Note>
    </Dialog>
  );
}
