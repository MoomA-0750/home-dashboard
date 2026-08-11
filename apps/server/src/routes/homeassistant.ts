import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

/** config/homeassistant.json で表示対象を明示できる。無ければドメインから自動検出する */
interface HomeAssistantConfig {
  controls?: string[];
  climate?: string[];
}

/**
 * 呼び出しを許可するサービスのホワイトリスト。
 * このサーバーはHAのトークンを持つため、無制限に中継すると事実上HAの全機能を
 * 認証なしでLANに公開することになる。操作系ウィジェットが必要とするものだけに絞る。
 */
const ALLOWED_SERVICES: Record<string, string[]> = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off", "toggle"],
  lock: ["lock", "unlock"],
  climate: ["turn_on", "turn_off", "set_temperature"],
};

const CONTROL_DOMAINS = ["light", "switch", "lock", "climate"];

const haConfigPath = join(config.configDir, "homeassistant.json");

function isConfigured(): boolean {
  return Boolean(config.homeAssistant.baseUrl && config.homeAssistant.token);
}

async function readHaConfig(): Promise<HomeAssistantConfig> {
  try {
    const raw = await readFile(haConfigPath, "utf-8");
    return JSON.parse(raw) as HomeAssistantConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function haFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${config.homeAssistant.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.homeAssistant.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function fetchStates(): Promise<HaState[]> {
  const res = await haFetch("/api/states");
  if (!res.ok) throw new Error(`home assistant states error: ${res.status}`);
  return res.json() as Promise<HaState[]>;
}

function toEntity(s: HaState) {
  return {
    entityId: s.entity_id,
    domain: s.entity_id.split(".")[0],
    name: (s.attributes.friendly_name as string) ?? s.entity_id,
    state: s.state,
    unit: (s.attributes.unit_of_measurement as string) ?? null,
    deviceClass: (s.attributes.device_class as string) ?? null,
  };
}

/** 明示設定があればその順序で、無ければドメイン/device_classで自動検出する */
function selectEntities(states: HaState[], explicit: string[] | undefined, fallback: (s: HaState) => boolean) {
  if (explicit && explicit.length > 0) {
    const byId = new Map(states.map((s) => [s.entity_id, s]));
    return explicit.flatMap((id) => {
      const s = byId.get(id);
      return s ? [toEntity(s)] : [];
    });
  }
  return states.filter(fallback).map(toEntity);
}

export async function registerHomeAssistantRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/homeassistant/controls", async () => {
    if (!isConfigured()) return { configured: false, entities: [], allowUnlock: false };
    const [states, haConfig] = await Promise.all([fetchStates(), readHaConfig()]);
    const entities = selectEntities(states, haConfig.controls, (s) =>
      CONTROL_DOMAINS.includes(s.entity_id.split(".")[0]),
    );
    return { configured: true, entities, allowUnlock: config.homeAssistant.allowUnlock };
  });

  app.get("/api/homeassistant/climate", async () => {
    if (!isConfigured()) return { configured: false, sensors: [], thermostats: [] };
    const [states, haConfig] = await Promise.all([fetchStates(), readHaConfig()]);

    const sensors = selectEntities(
      states,
      haConfig.climate,
      (s) =>
        s.entity_id.startsWith("sensor.") &&
        ["temperature", "humidity"].includes(s.attributes.device_class as string),
    );
    const thermostats = states.filter((s) => s.entity_id.startsWith("climate.")).map((s) => ({
      ...toEntity(s),
      currentTemperature: (s.attributes.current_temperature as number) ?? null,
      targetTemperature: (s.attributes.temperature as number) ?? null,
    }));

    return { configured: true, sensors, thermostats };
  });

  app.post<{ Body: { entityId: string; service: string; data?: Record<string, unknown> } }>(
    "/api/homeassistant/call",
    async (request, reply) => {
      if (!isConfigured()) return reply.code(409).send({ error: "home assistant not configured" });

      const { entityId, service, data } = request.body;
      const domain = entityId?.split(".")[0];

      if (!domain || !ALLOWED_SERVICES[domain]?.includes(service)) {
        return reply.code(403).send({ error: `service not allowed: ${domain}.${service}` });
      }
      // 解錠は既定で拒否する（LAN上に認証なしで公開されるため。config.tsのallowUnlock参照）
      if (domain === "lock" && service === "unlock" && !config.homeAssistant.allowUnlock) {
        return reply.code(403).send({ error: "unlock is disabled (set HOMEASSISTANT_ALLOW_UNLOCK=true to enable)" });
      }

      const res = await haFetch(`/api/services/${domain}/${service}`, {
        method: "POST",
        body: JSON.stringify({ entity_id: entityId, ...data }),
      });
      if (!res.ok) {
        return reply.code(502).send({ error: `home assistant service error: ${res.status}` });
      }
      return { ok: true };
    },
  );
}
