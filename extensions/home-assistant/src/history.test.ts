import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { getSensorHistory, haSettings } from "./homeassistant";

// 偽の Home Assistant。記録（/api/history）と今の状態（/api/states）を返す
let lastHistoryUrl = "";
const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url?.startsWith("/api/history/period/")) {
    lastHistoryUrl = req.url;
    const many = Array.from({ length: 1000 }, (_, i) => ({
      state: String(20 + (i % 10) / 10),
      last_changed: iso(1000 - i),
    }));
    return res.end(
      JSON.stringify([
        [
          { entity_id: "sensor.a", state: "22.0", last_changed: iso(120) },
          { state: "unavailable", last_changed: iso(60) },
          { state: "23.5", last_changed: iso(10) },
        ],
        [{ entity_id: "sensor.b", state: "20", last_changed: iso(1001) }, ...many],
      ]),
    );
  }
  if (req.url === "/api/states") {
    return res.end(
      JSON.stringify([
        { entity_id: "sensor.a", state: "23.5", attributes: { friendly_name: "温度計A", unit_of_measurement: "°C" } },
        { entity_id: "sensor.b", state: "20.9", attributes: { friendly_name: "温度計B", unit_of_measurement: "°C" } },
      ]),
    );
  }
  res.end("[]");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
haSettings.current = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: "t" };
after(() => server.close());

test("センサーの記録を、数値の点の並びにして名前と単位を添える", async () => {
  const series = await getSensorHistory(["sensor.a", "sensor.b"], 24);
  const a = series.find((s) => s.entityId === "sensor.a")!;
  assert.equal(a.name, "温度計A");
  assert.equal(a.unit, "°C");
  // unavailable は抜く
  assert.deepEqual(
    a.points.map(([, v]) => v),
    [22, 23.5],
  );
  assert.match(lastHistoryUrl, /filter_entity_id=sensor\.a%2Csensor\.b/);
  assert.match(lastHistoryUrl, /minimal_response&no_attributes$/);
});

test("点が多いときは、時間で区切った平均にまとめる", async () => {
  const series = await getSensorHistory(["sensor.b"], 24);
  const b = series.find((s) => s.entityId === "sensor.b")!;
  assert.ok(b.points.length <= 240 && b.points.length > 100, String(b.points.length));
  assert.ok(b.points.every(([, v]) => v >= 20 && v <= 21));
});

test("センサー以外・多すぎる数・決まっていない期間は読まない", async () => {
  await assert.rejects(getSensorHistory(["lock.front_door"], 24), /invalid entity id/);
  await assert.rejects(getSensorHistory(["sensor.a/../../config"], 24), /invalid entity id/);
  await assert.rejects(getSensorHistory([], 24), /required/);
  await assert.rejects(
    getSensorHistory(
      Array.from({ length: 13 }, (_, i) => `sensor.s${i}`),
      24,
    ),
    /required/,
  );
  await assert.rejects(getSensorHistory(["sensor.a"], 9999), /invalid hours/);
});
