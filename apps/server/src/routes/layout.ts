import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { broadcast } from "../ws.js";

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

async function writeLayout(layout: DashboardLayout): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(layoutPath, JSON.stringify(layout, null, 2), "utf-8");
}

export async function registerLayoutRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/layout", async () => readLayout());

  app.put<{ Body: DashboardLayout }>("/api/layout", async (request) => {
    const layout = request.body;
    await writeLayout(layout);
    broadcast({ type: "layout-updated" });
    return layout;
  });
}
