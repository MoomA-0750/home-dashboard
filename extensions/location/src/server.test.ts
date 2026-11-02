import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { RouteContext, RouteHandler, ServerExtensionApi, StateSource, ToolDefinition } from "@home-dashboard/extension-sdk";
import extension from "./server";
import { distanceM, parseWatched, selectPlaces, updatePresence, type PresenceState, type RawDevice } from "./places";

const HOME = { lat: 35.681236, lon: 139.767125 };

function device(name: string, lat: number | null, lon: number | null, extra: Partial<RawDevice> = {}): RawDevice {
  return {
    name,
    model: "iPhone",
    battery: 0.5,
    location_available: lat !== null,
    latitude: lat,
    longitude: lon,
    horizontal_accuracy_m: 10,
    position_type: "Wifi",
    is_old: false,
    timestamp: "2026-10-29T12:00:00+09:00",
    age_seconds: 60,
    fresh: true,
    ...extra,
  };
}

/** 作り物の icloud-locate。devices を書き換えると次の応答が変わる */
async function fakeLocate(token = "secret") {
  const state = { devices: [] as RawDevice[], status: 200, requests: [] as string[] };
  const server: Server = createServer((req, res) => {
    state.requests.push(req.url ?? "");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== `Bearer ${token}`) return send(401, { error: "unauthorized", message: "x" });
    if (state.status !== 200) return send(state.status, { error: "auth_required", message: "x" });
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/health") return send(200, { status: "ok" });
    if (url.pathname === "/devices") return send(200, state.devices);
    if (url.pathname === "/location") {
      const needle = url.searchParams.get("device") ?? "";
      return send(200, state.devices.filter((d) => d.name.includes(needle)));
    }
    send(404, { error: "not_found", message: "x" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { state, url, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

/** 作り物の本体 */
async function host(settings: Record<string, unknown>) {
  const routes = new Map<string, RouteHandler>();
  const tools = new Map<string, ToolDefinition>();
  const broadcasts: { type: string; payload: unknown }[] = [];
  const disposers: (() => void)[] = [];
  let states: StateSource | null = null;
  const api = {
    dataDir: "/nonexistent",
    settings: { homeRadius: 150, watchMinutes: 0, ...settings },
    onSettingsChange() {},
    onDispose: (fn: () => void) => disposers.push(fn),
    async updateSettings(values: Record<string, unknown>) {
      Object.assign(api.settings, values);
    },
    route: (method: string, path: string, handler: RouteHandler) => routes.set(`${method} ${path}`, handler),
    tool: (definition: ToolDefinition) => tools.set(definition.name, definition),
    broadcast: (type: string, payload: unknown) => broadcasts.push({ type, payload }),
    provideStates: (source: StateSource) => {
      states = source;
    },
    log: { info() {}, warn() {}, error() {} },
  } as unknown as ServerExtensionApi;
  await extension.register(api);
  const call = async (key: string, ctx: Partial<RouteContext> = {}) =>
    routes.get(key)!({ params: {}, query: {}, body: null, account: null, fromAgent: false, bearer: null, locale: "ja", ...ctx });
  return { api, call, tools, broadcasts, states: () => states, dispose: () => disposers.forEach((fn) => fn()) };
}

test("見る端末は 登録名=呼び名 を読み、’ や空白の入った名前を切らない", () => {
  assert.deepEqual(parseWatched("Alice’s iPhone=自分, iPad\n Alice’s iPhone=重複"), [
    { name: "Alice’s iPhone", label: "自分" },
    { name: "iPad", label: "iPad" },
  ]);
});

test("距離は球の上で測る（東京駅から皇居の辺りまで約1km）", () => {
  const d = distanceM(HOME.lat, HOME.lon, 35.685175, 139.7528);
  assert.ok(d > 1200 && d < 1400, String(d));
});

test("見る端末が空なら位置のある端末だけ、決めてあれば書いた順に、無い名前は位置なしで出す", () => {
  const raw = [device("iPad", 35.0, 139.0), device("古い iPhone", null, null), device("iPhone", HOME.lat, HOME.lon)];
  const home = { ...HOME, radiusM: 150 };
  assert.deepEqual(selectPlaces(raw, [], home).map((p) => p.name), ["iPad", "iPhone"]);
  const picked = selectPlaces(raw, parseWatched("iPhone=自分, 書き間違い"), home);
  assert.deepEqual(picked.map((p) => [p.label, p.atHome, p.available]), [
    ["自分", true, true],
    ["書き間違い", null, false],
  ]);
});

test("在宅の変わり目: 最初の1回と、古い・粗い測位では知らせない", () => {
  const home = { ...HOME, radiusM: 150 };
  const state = new Map<string, PresenceState>();
  const at = (lat: number, extra: Partial<RawDevice> = {}) =>
    selectPlaces([device("iPhone", lat, HOME.lon, extra)], [], home);
  assert.deepEqual(updatePresence(state, at(HOME.lat), new Date()), []);
  // 2km 離れたが測位が古い・粗い → 変えない
  assert.deepEqual(updatePresence(state, at(HOME.lat + 0.02, { age_seconds: 3 * 3600 }), new Date()), []);
  assert.deepEqual(updatePresence(state, at(HOME.lat + 0.02, { horizontal_accuracy_m: 1500 }), new Date()), []);
  const left = updatePresence(state, at(HOME.lat + 0.02), new Date());
  assert.deepEqual(left.map((e) => e.type), ["left"]);
  assert.deepEqual(updatePresence(state, at(HOME.lat + 0.02), new Date()), []);
  assert.deepEqual(updatePresence(state, at(HOME.lat), new Date()).map((e) => e.type), ["arrived"]);
});

test("道: 位置を読み、測位は登録名の同じ端末を選び、ここを家にできる", async () => {
  const fake = await fakeLocate();
  fake.state.devices = [device("iPhone", HOME.lat + 0.01, HOME.lon), device("iPhone 2", 0, 0)];
  const { call, api } = await host({ url: `${fake.url}/`, token: "secret", devices: "iPhone=自分" });
  try {
    const first = (await call("GET /places")) as { home: boolean; places: { label: string; distanceM: number | null }[] };
    assert.equal(first.home, false);
    assert.deepEqual(first.places.map((p) => [p.label, p.distanceM]), [["自分", null]]);

    const located = (await call("POST /places/:name/locate", { params: { name: "iPhone" } })) as { place: { name: string } };
    assert.equal(located.place.name, "iPhone");
    assert.ok(fake.state.requests.some((r) => r.startsWith("/location?device=iPhone&refresh=auto")));

    await call("POST /home", { body: { device: "iPhone" } });
    assert.equal(api.settings.homeLat, Number((HOME.lat + 0.01).toFixed(6)));
    const after = (await call("GET /places")) as {
      places: { atHome: boolean }[];
      homeArea: { radiusM: number };
      map: { tiles: string; standard: boolean };
    };
    assert.equal(after.places[0].atHome, true);
    assert.equal(after.homeArea.radiusM, 150);
    assert.deepEqual([after.map.standard, after.map.tiles.includes("openstreetmap")], [true, true]);
    api.settings.mapTiles = "https://tiles.example/{z}/{x}/{y}.png";
    const custom = (await call("GET /places")) as { map: { tiles: string; standard: boolean } };
    assert.deepEqual(custom.map, { tiles: "https://tiles.example/{z}/{x}/{y}.png", attribution: "", standard: false });
  } finally {
    await fake.close();
  }
});

test("道: 再認証が要るときは 503 と理由、トークン違いは 502", async () => {
  const fake = await fakeLocate();
  try {
    fake.state.status = 503;
    const { call } = await host({ url: fake.url, token: "secret" });
    await assert.rejects(call("GET /places"), (err: { statusCode: number; message: string }) => {
      assert.equal(err.statusCode, 503);
      assert.match(err.message, /2FA/);
      return true;
    });
    const wrong = await host({ url: fake.url, token: "nope" });
    await assert.rejects(wrong.call("GET /places"), { statusCode: 502 });
    const test = (await wrong.call("POST /test")) as { ok: boolean };
    assert.equal(test.ok, false);
  } finally {
    await fake.close();
  }
});

test("在宅の様子の口は合言葉が要り、座標を返さない", async () => {
  const { call } = await host({ presenceToken: "pass" });
  await assert.rejects(call("GET /presence"), { statusCode: 401 });
  await assert.rejects(call("GET /presence", { bearer: "wrong" }), { statusCode: 401 });
  const view = (await call("GET /presence", { bearer: "pass" })) as Record<string, unknown>;
  assert.deepEqual(Object.keys(view).sort(), ["anyoneHome", "checkedAt", "devices"]);
  const closed = await host({});
  await assert.rejects(closed.call("GET /presence", { bearer: "pass" }), { statusCode: 404 });
});

test("見張り: 家を出たら画面へ知らせ、Webhook に座標なしで POST する", async () => {
  const fake = await fakeLocate();
  const hooks: unknown[] = [];
  const hookServer = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hooks.push(JSON.parse(body));
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => hookServer.listen(0, "127.0.0.1", resolve));
  const hookUrl = `http://127.0.0.1:${(hookServer.address() as AddressInfo).port}/hook/abc`;
  fake.state.devices = [device("iPhone", HOME.lat, HOME.lon)];
  const settings = {
    url: fake.url,
    token: "secret",
    homeLat: HOME.lat,
    homeLon: HOME.lon,
    watchMinutes: 1,
    webhookUrl: hookUrl,
    devices: "iPhone=自分",
  };
  mock.timers.enable({ apis: ["setInterval"] });
  const h = await host(settings);
  try {
    await waitFor(() => fake.state.requests.includes("/devices"));
    fake.state.devices = [device("iPhone", HOME.lat + 0.02, HOME.lon)];
    mock.timers.tick(60_000);
    await waitFor(() => hooks.length > 0);
    const event = hooks[0] as Record<string, unknown>;
    assert.equal(event.type, "left");
    assert.equal(event.label, "自分");
    assert.equal(event.latitude, undefined);
    assert.deepEqual(h.broadcasts.map((b) => b.type), ["presence"]);
    // 本体が読める家の状態の値（夜の表示の条件など）にも出る。座標は渡さない
    const readings = await h.states()!.read(["anyone-home", "home:iPhone"]);
    assert.deepEqual(
      readings.map((r) => [r.id, r.name, r.value]),
      [
        ["anyone-home", "だれかの端末が家にある", false],
        ["home:iPhone", "自分が家にいる", false],
      ],
    );
  } finally {
    mock.timers.reset();
    h.dispose();
    await fake.close();
    await new Promise<void>((resolve) => hookServer.close(() => resolve()));
  }
});

async function waitFor(fn: () => boolean, ms = 3000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error("待ちきれませんでした");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
