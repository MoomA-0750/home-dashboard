import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { getClimate, getControls, getOverview, haSettings, listSensors, setSensorEnabled } from "./homeassistant";

// 偽の Home Assistant。温度計2つ・湿度計1つ・照明1つと、部屋（/api/template）を返す
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  if (req.url === "/api/states") {
    const sensor = (id: string, state: string, deviceClass: string, unit: string) => ({
      entity_id: id,
      state,
      attributes: { friendly_name: id, device_class: deviceClass, unit_of_measurement: unit },
    });
    return res.end(
      JSON.stringify([
        sensor("sensor.temp_a", "22.0", "temperature", "°C"),
        sensor("sensor.temp_b", "24.0", "temperature", "°C"),
        sensor("sensor.temp_broken", "unavailable", "temperature", "°C"),
        sensor("sensor.hum_a", "40", "humidity", "%"),
        { entity_id: "light.living", state: "on", attributes: { friendly_name: "リビング" } },
      ]),
    );
  }
  if (req.url === "/api/template") return res.end(JSON.stringify([]));
  res.end("[]");
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const dataDir = await mkdtemp(join(tmpdir(), "ha-sensors-"));
haSettings.current = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: "t" };
haSettings.configDir = dataDir;
haSettings.dataDir = dataDir;
after(async () => {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
});

test("種類ごとの平均を、読めるセンサーだけで出す", async () => {
  const { readings } = await getControls();
  assert.deepEqual(
    readings.map((r) => [r.deviceClass, r.value, r.count]),
    [
      ["temperature", 23, 2],
      ["humidity", 40, 1],
    ],
  );
});

test("切ったセンサーは、平均・Home Control・室温湿度に入れず、一覧では切ってあると出す", async () => {
  await setSensorEnabled("sensor.temp_b", false);
  assert.deepEqual(JSON.parse(await readFile(join(dataDir, "sensors.json"), "utf-8")), { disabled: ["sensor.temp_b"] });

  const { readings } = await getControls();
  assert.equal(readings.find((r) => r.deviceClass === "temperature")?.value, 22);
  const overview = await getOverview(true);
  assert.ok(!overview.sensors.some((s) => s.entityId === "sensor.temp_b"));
  const climate = await getClimate();
  assert.ok(!climate.sensors.some((s) => s.entityId === "sensor.temp_b"));
  const { sensors } = await listSensors();
  assert.equal(sensors.find((s) => s.entityId === "sensor.temp_b")?.enabled, false);
  assert.equal(sensors.find((s) => s.entityId === "sensor.temp_a")?.enabled, true);
  assert.ok(!sensors.some((s) => s.entityId === "light.living"));

  await setSensorEnabled("sensor.temp_b", true);
  assert.equal((await getControls()).readings.find((r) => r.deviceClass === "temperature")?.value, 23);
});

test("センサー以外は入／切できない", async () => {
  await assert.rejects(setSensorEnabled("light.living", false), /invalid entity id/);
  await assert.rejects(setSensorEnabled("sensor.a/../x", false), /invalid entity id/);
});
