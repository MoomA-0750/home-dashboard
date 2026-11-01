import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServerExtensionApi } from "@home-dashboard/extension-sdk";
import { localizeErrors, nightCandidates, readEntityStates } from "./homeassistant";
import { DEFAULT_RULES, evaluateRules, nextNight, normalizeRules, referencedEntities, type NightRules } from "./night";

/**
 * 夜の表示の条件を見張る。決めた間隔で Home Assistant の状態を読み、条件を満たして hold 分続いたら本体へ「夜」を知らせる
 * （api.setNightSignal）。条件は拡張機能のデータ置き場の night.json に置く。
 * - GET /night  … 条件・今の判定・選べる機器（設定画面の「夜の表示の条件」）
 * - PUT /night  … 条件を変える（管理者）
 */

const CHECK_MS = 30_000;

export function registerNightWatch(api: ServerExtensionApi): void {
  const rulesPath = () => join(api.dataDir, "night.json");
  let rules: NightRules = { ...DEFAULT_RULES };
  let metSince: number | null = null;
  let active = false;
  let loaded = false;

  async function loadRules(): Promise<NightRules> {
    if (loaded) return rules;
    try {
      rules = normalizeRules(JSON.parse(await readFile(rulesPath(), "utf-8")));
    } catch {
      rules = { ...DEFAULT_RULES };
    }
    loaded = true;
    return rules;
  }

  async function evaluate(now = new Date()) {
    const current = await loadRules();
    const states = await readEntityStates(referencedEntities(current));
    return evaluateRules(current, states, now);
  }

  async function check() {
    try {
      const evaluation = await evaluate();
      const next = nextNight(evaluation, metSince, rules.holdMinutes, Date.now());
      metSince = next.metSince;
      if (next.active !== active || next.active) api.setNightSignal(next.active, evaluation.reason);
      active = next.active;
    } catch (err) {
      // Home Assistant に届かない間は夜にしない（暗いまま戻れなくなるより、明るいほうがまし）
      if (active) api.setNightSignal(false);
      active = false;
      metSince = null;
      api.log.warn(`夜の表示の条件を読めませんでした: ${(err as Error).message}`);
    }
  }

  const timer = setInterval(() => void check(), CHECK_MS);
  api.onDispose(() => clearInterval(timer));
  api.onSettingsChange(() => void check());
  void check();

  api.route("GET", "/night", ({ locale }) =>
    localizeErrors(locale, async () => {
      const current = await loadRules();
      const [evaluation, candidates] = await Promise.all([evaluate(), nightCandidates()]);
      return {
        configured: candidates.configured,
        rules: current,
        met: evaluation.met,
        active,
        results: evaluation.results,
        entities: candidates.entities,
      };
    }),
  );

  api.route(
    "PUT",
    "/night",
    async ({ body }) => {
      rules = normalizeRules(body);
      loaded = true;
      await mkdir(api.dataDir, { recursive: true });
      await writeFile(rulesPath(), `${JSON.stringify(rules, null, 2)}\n`);
      // 条件を変えたら続いた長さを数え直す
      metSince = null;
      await check();
      return { ok: true, rules };
    },
    { adminOnly: true },
  );
}
