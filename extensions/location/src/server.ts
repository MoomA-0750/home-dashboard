import { timingSafeEqual } from "node:crypto";
import {
  defineServerExtension,
  defineServerMessages,
  HttpError,
  type Locale,
  type ServerExtensionApi,
  type StateReading,
} from "@home-dashboard/extension-sdk";
import {
  parseHome,
  parseWatched,
  selectPlaces,
  updatePresence,
  type Place,
  type PresenceEvent,
  type PresenceState,
  type RawDevice,
} from "./places";

/**
 * 位置の拡張機能のサーバー側。icloud-locate（~/Documents/git-cloned/icloud-locate）の常駐 API から、
 * 自分の Apple 端末の位置を読む。端末側には何も入れない（iCloud の「探す」を使う）。
 * - GET  /places            … 見る端末の位置と家からの距離、地図に描く家の円とタイル（端末を起こさない）
 * - POST /places/:name/locate … その端末に測位を頼んで、新しい位置を待つ（電池を使う）
 * - POST /home              … 端末の今の位置を家にする（管理者）
 * - GET  /presence          … 在宅の様子（座標なし）。外のプログラム（knot など）が Bearer の合言葉で読む
 * - 在宅の見張り: 決めた間隔で位置を見て、家に着いた・出たら画面へ知らせ、Webhook を呼ぶ
 * 座標はメモリの中だけで扱い、ファイルやログには書かない
 */

const messages = defineServerMessages({
  ja: {
    notConfigured: "icloud-locate の URL とトークンを、設定画面の「拡張機能 → 位置」で入れてください",
    authRequired:
      "iCloud の再認証が要ります。icloud-locate の機械で locate.sh を対話で動かし、2FA を通してください（済めば1分ほどで戻ります）",
    unauthorized: "icloud-locate のトークンが違います",
    notFound: "その端末は iCloud にありません: {name}",
    upstream: "icloud-locate から読めませんでした: {error}",
    unreachable: "icloud-locate に届きません: {error}",
    noHome: "家の場所がまだ決まっていません",
    noLocation: "{name} の位置がありません（電源が切れている・圏外・「探す」がオフ）",
    tested: "つながりました（iCloud: {status}）",
    noPresenceToken: "在宅の様子を外へ出す合言葉が設定されていません",
  },
  en: {
    notConfigured: "Enter the icloud-locate URL and token under Settings → Extensions → Location",
    authRequired:
      "iCloud needs signing in again. Run locate.sh interactively on the icloud-locate machine and complete 2FA (it recovers about a minute later)",
    unauthorized: "The icloud-locate token is wrong",
    notFound: "No such device in iCloud: {name}",
    upstream: "Couldn't read from icloud-locate: {error}",
    unreachable: "Can't reach icloud-locate: {error}",
    noHome: "The home location isn't set yet",
    noLocation: "No location for {name} (powered off, out of range, or Find My is off)",
    tested: "Connected (iCloud: {status})",
    noPresenceToken: "No passphrase is set for sharing presence with other programs",
  },
});

/** refresh=auto は端末の応答を最大 45 秒待つので、HTTP はそれより長く待つ */
const LOCATE_TIMEOUT_S = 45;
const LOCATE_HTTP_TIMEOUT_MS = 60_000;
const QUICK_HTTP_TIMEOUT_MS = 15_000;

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default defineServerExtension({
  register(api) {
    const t = (locale: Locale, key: Parameters<typeof messages.t>[1], params?: Record<string, string | number>) =>
      messages.t(locale, key, params);

    const baseUrl = () => String(api.settings.url ?? "").replace(/\/+$/, "");
    const configured = () => Boolean(baseUrl() && String(api.settings.token ?? ""));
    const home = () => parseHome(api.settings.homeLat, api.settings.homeLon, api.settings.homeRadius);
    const watched = () => parseWatched(String(api.settings.devices ?? ""));

    /** icloud-locate を GET する。エラーは画面に出せる理由つきの HttpError にする */
    async function upstream<T>(path: string, locale: Locale, timeoutMs = QUICK_HTTP_TIMEOUT_MS): Promise<T> {
      if (!configured()) throw new HttpError(409, t(locale, "notConfigured"));
      let res: Response;
      try {
        res = await fetch(`${baseUrl()}${path}`, {
          headers: { Authorization: `Bearer ${String(api.settings.token)}` },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new HttpError(502, t(locale, "unreachable", { error: (err as Error).message }));
      }
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (res.ok) return body as T;
      if (res.status === 503) throw new HttpError(503, t(locale, "authRequired"));
      if (res.status === 401) throw new HttpError(502, t(locale, "unauthorized"));
      throw new HttpError(502, t(locale, "upstream", { error: body?.message ?? `HTTP ${res.status}` }));
    }

    async function readPlaces(locale: Locale): Promise<Place[]> {
      const raw = await upstream<RawDevice[]>("/devices", locale);
      return selectPlaces(raw, watched(), home());
    }

    /** 1台に測位を頼む。/location は部分一致で複数台返るので、登録名が同じものを選ぶ */
    async function locate(name: string, locale: Locale): Promise<Place> {
      const query = new URLSearchParams({ device: name, refresh: "auto", timeout: String(LOCATE_TIMEOUT_S) });
      const raw = await upstream<RawDevice[]>(`/location?${query}`, locale, LOCATE_HTTP_TIMEOUT_MS);
      const found = raw.find((d) => d.name === name);
      if (!found) throw new HttpError(404, t(locale, "notFound", { name }));
      const label = watched().find((w) => w.name === name)?.label ?? name;
      return selectPlaces([found], [{ name, label }], home())[0];
    }

    // --- 在宅の見張り（状態はメモリだけ。再起動したら、最初の1回は変わり目にしない） ---
    const presence = new Map<string, PresenceState>();
    let lastCheck: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function notify(event: PresenceEvent) {
      api.broadcast("presence", event);
      const hook = String(api.settings.webhookUrl ?? "");
      if (!hook) return;
      try {
        const res = await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "home-dashboard/location", ...event }),
          signal: AbortSignal.timeout(QUICK_HTTP_TIMEOUT_MS),
        });
        if (!res.ok) api.log.warn(`Webhook が ${res.status} を返しました（${event.type}）`);
      } catch (err) {
        api.log.warn(`Webhook を呼べませんでした（${event.type}）: ${(err as Error).message}`);
      }
    }

    async function check() {
      if (!configured() || !home()) return;
      try {
        const places = await readPlaces("ja");
        const now = new Date();
        lastCheck = now.toISOString();
        for (const event of updatePresence(presence, places, now)) {
          api.log.info(`${event.label}: ${event.type === "arrived" ? "家に着いた" : "家を出た"}`);
          await notify(event);
        }
      } catch (err) {
        // 再認証が要る間は毎回同じ理由なので、警告は出しても見張りは止めない
        api.log.warn(`在宅の見張り: ${(err as Error).message}`);
      }
    }

    function schedule() {
      if (timer) clearInterval(timer);
      timer = null;
      const minutes = Number(api.settings.watchMinutes ?? 0);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      timer = setInterval(() => void check(), Math.max(1, minutes) * 60_000);
      void check();
    }

    api.onSettingsChange(() => {
      presence.clear();
      schedule();
    });
    api.onDispose(() => {
      if (timer) clearInterval(timer);
    });
    schedule();

    // 本体が読める家の状態の値（夜の表示の条件など）。在宅の見張りが分かっている間だけ値があり、見張っていない・
    // まだ分からないときは null（条件を満たさない扱い）。座標は渡さない
    const presenceReadings = (): StateReading[] => {
      const known = watched().map((w) => ({ id: `home:${w.name}`, name: `${w.label}が家にいる`, state: presence.get(w.name) }));
      const states = known.map((k) => k.state).filter((state): state is PresenceState => state !== undefined);
      return [
        {
          id: "anyone-home",
          name: "だれかの端末が家にある",
          kind: "onoff",
          value: states.length === 0 ? null : states.some((state) => state.atHome),
        },
        ...known.map(({ id, name, state }): StateReading => ({ id, name, kind: "onoff", value: state ? state.atHome : null })),
      ];
    };
    api.provideStates({
      list: async () => presenceReadings(),
      read: async (ids) => presenceReadings().filter((reading) => ids.includes(reading.id)),
    });

    const presenceView = () => {
      const labels = new Map(watched().map((w) => [w.name, w.label]));
      const devices = [...presence.entries()].map(([name, state]) => ({
        device: name,
        label: labels.get(name) ?? name,
        atHome: state.atHome,
        since: state.since,
      }));
      return { checkedAt: lastCheck, anyoneHome: devices.some((d) => d.atHome), devices };
    };

    // --- 画面の道 ---
    /** 地図の絵（タイル）。既定は OpenStreetMap。家の機械で配るタイルなどに替えられる */
    const mapView = () => {
      const tiles = String(api.settings.mapTiles ?? "").trim();
      return tiles
        ? { tiles, attribution: String(api.settings.mapAttribution ?? ""), standard: false }
        : { tiles: OSM_TILES, attribution: OSM_ATTRIBUTION, standard: true };
    };

    api.route("GET", "/places", async ({ locale }) => {
      if (!configured()) return { configured: false, message: t(locale, "notConfigured"), places: [] };
      const area = home();
      return {
        configured: true,
        home: area !== null,
        // 家の円を地図に描くため（画面の中だけで使い、残さない）
        homeArea: area,
        map: mapView(),
        places: await readPlaces(locale),
        presence: presenceView(),
      };
    });

    api.route("POST", "/places/:name/locate", async ({ params, locale }) => ({ place: await locate(params.name, locale) }));

    api.route(
      "POST",
      "/home",
      async ({ body, locale }) => {
        const name = String((body as { device?: unknown } | null)?.device ?? "");
        const place = (await readPlaces(locale)).find((p) => p.name === name);
        if (!place?.available) throw new HttpError(409, t(locale, "noLocation", { name }));
        await api.updateSettings({ homeLat: Number(place.lat!.toFixed(6)), homeLon: Number(place.lon!.toFixed(6)) });
        return { ok: true };
      },
      { adminOnly: true },
    );

    api.route("POST", "/test", async ({ locale }) => {
      try {
        const health = await upstream<{ status: string }>("/health", locale);
        return { ok: true, message: t(locale, "tested", { status: health.status }) };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    });

    // 外のプログラム（knot の HTTP のアクションなど）が在宅を読む口。座標は返さない
    api.route(
      "GET",
      "/presence",
      ({ bearer, locale }) => {
        const secret = String(api.settings.presenceToken ?? "");
        if (!secret) throw new HttpError(404, t(locale, "noPresenceToken"));
        if (!bearer || !sameSecret(bearer, secret)) throw new HttpError(401, "unauthorized");
        return presenceView();
      },
      { public: true },
    );

    registerTools(api, { readPlaces, locate, watched });
  },
});

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function registerTools(
  api: ServerExtensionApi,
  deps: {
    readPlaces: (locale: Locale) => Promise<Place[]>;
    locate: (name: string, locale: Locale) => Promise<Place>;
    watched: () => { name: string; label: string }[];
  },
) {
  /** 声で答えやすい形にする（座標は地名を考えるために渡す） */
  const describePlace = (p: Place) => ({
    device: p.name,
    label: p.label,
    available: p.available,
    atHome: p.atHome,
    distanceFromHomeKm: p.distanceM === null ? null : Math.round(p.distanceM / 100) / 10,
    latitude: p.lat,
    longitude: p.lon,
    accuracyM: p.accuracyM === null ? null : Math.round(p.accuracyM),
    minutesAgo: p.ageSeconds === null ? null : Math.round(p.ageSeconds / 60),
    battery: p.battery === null ? null : Math.round(p.battery * 100),
  });

  api.tool({
    name: "get_location",
    description: async () => {
      const names = deps.watched().map((w) => (w.label === w.name ? w.name : `${w.label}（${w.name}）`));
      return [
        "家の人の Apple 端末の位置（iCloud の「探す」）を返す。家にいるか・家からの距離・何分前の測位か・電池。",
        "座標は地名や最寄りの場所を答えるのに使い、数字のまま読み上げない。",
        names.length ? `見ている端末: ${names.join("、")}。最初のものが本人の持ち歩く端末。` : "",
        "refresh を true にすると、その端末に測位を頼んで新しい位置を待つ（最大45秒・端末の電池を使う）。古い位置で足りるなら false。",
      ].join("");
    },
    inputSchema: (z) => ({
      device: z.string().optional().describe("端末の呼び名か登録名。省くと見ている端末すべて（refresh のときは最初の端末）"),
      refresh: z.boolean().optional().describe("測位を頼んで新しい位置にする"),
    }),
    risk: "read",
    personal: true,
    handler: async ({ device, refresh }) => {
      const watched = deps.watched();
      const wanted = device
        ? (watched.find((w) => w.label === device || w.name === device)?.name ?? device)
        : null;
      if (refresh) {
        const name = wanted ?? watched[0]?.name;
        if (name) return { places: [describePlace(await deps.locate(name, "ja"))] };
      }
      const places = await deps.readPlaces("ja");
      const picked = wanted ? places.filter((p) => p.name === wanted) : places;
      return { places: (picked.length ? picked : places).map(describePlace) };
    },
  });
}
