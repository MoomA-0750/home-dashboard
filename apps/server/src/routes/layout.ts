import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { broadcast, isClientId } from "../ws.js";

interface WidgetInstance {
  instanceId: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

interface DashboardLayout {
  instances: WidgetInstance[];
  updatedAt: string;
  version?: number;
}

const layoutPath = join(config.dataDir, "layout.json");

const emptyLayout = (): DashboardLayout => ({ instances: [], updatedAt: new Date(0).toISOString() });

async function readLayout(): Promise<DashboardLayout> {
  try {
    const raw = await readFile(layoutPath, "utf-8");
    return JSON.parse(raw) as DashboardLayout;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyLayout();
    throw err;
  }
}

const MAX_INSTANCES = 200;
const MAX_LAYOUT_BYTES = 256 * 1024;

const isNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

/** 画面から届いたレイアウトの形を確かめる（どの端末でも読めない形で上書きされないように） */
function parseLayout(body: unknown): DashboardLayout | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { instances?: unknown; updatedAt?: unknown; version?: unknown };
  if (!Array.isArray(raw.instances) || raw.instances.length > MAX_INSTANCES) return null;
  const instances: WidgetInstance[] = [];
  for (const item of raw.instances) {
    const i = item as Partial<WidgetInstance> | null;
    if (
      !i ||
      typeof i.instanceId !== "string" ||
      typeof i.widgetId !== "string" ||
      ![i.x, i.y, i.w, i.h].every(isNumber) ||
      (i.config !== undefined && (typeof i.config !== "object" || i.config === null || Array.isArray(i.config)))
    )
      return null;
    instances.push({ ...i, config: i.config ?? {} } as WidgetInstance);
  }
  const layout: DashboardLayout = {
    instances,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    ...(isNumber(raw.version) ? { version: raw.version as number } : {}),
  };
  return JSON.stringify(layout).length > MAX_LAYOUT_BYTES ? null : layout;
}

async function writeLayout(layout: DashboardLayout): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  // 書きかけで止まって壊れた layout.json が残らないよう、別名に書いてから置き換える
  const tmp = `${layoutPath}.tmp`;
  await writeFile(tmp, JSON.stringify(layout, null, 2), "utf-8");
  await rename(tmp, layoutPath);
}

function sameInstances(a: WidgetInstance[], b: WidgetInstance[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function registerLayoutRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/layout", async () => readLayout());

  app.put<{ Body: unknown }>("/api/layout", async (request, reply) => {
    const layout = parseLayout(request.body);
    if (!layout) return reply.code(400).send({ error: "invalid layout" });
    const previous = await readLayout();
    // 中身が変わらない保存は知らせない（知らせると各端末が読み直して保存し直し、端末の間で保存が往復し続ける）
    if (sameInstances(previous.instances, layout.instances)) return layout;
    await writeLayout(layout);
    // 保存した端末は自分の変更を読み直さなくてよいので、誰の保存かを添える
    const source = request.headers["x-client-id"];
    broadcast({ type: "layout-updated", source: isClientId(source) ? source : null });
    return layout;
  });
}
