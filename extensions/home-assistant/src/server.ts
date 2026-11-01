import { defineServerExtension, HttpError } from "@home-dashboard/extension-sdk";
import {
  callHomeAssistantService,
  canUnlock,
  getClimate,
  getControls,
  getOverview,
  getSensorHistory,
  haSettings,
  listSensors,
  localizeErrors,
  setSensorEnabled,
  testConnection,
} from "./homeassistant";
import { registerNightWatch } from "./nightWatch";

/**
 * Home Assistant の拡張機能のサーバー側。
 * - /controls … 家電操作のウィジェット（家電と、室温・湿度などの平均）
 * - /overview … Home Control 画面（センサー・鍵・空調・照明とスイッチ）
 * - /call … 家電の操作（サービスはホワイトリスト。解錠はログインした画面からだけ）
 * - /night … 夜の表示の条件（nightWatch.ts）
 * - 音声アシスタントの list_home_devices・control_home_device
 */

const HA_ACTIONS = ["turn_on", "turn_off", "toggle", "lock", "unlock", "set_temperature"] as const;
type HaAction = (typeof HA_ACTIONS)[number];

// 確かめの画面と聞き返しに出す、操作の言い方
const ACTION_LABELS: Record<HaAction, string> = {
  turn_on: "つける",
  turn_off: "消す",
  toggle: "切り替える",
  lock: "施錠する",
  unlock: "解錠する",
  set_temperature: "の温度を変える",
};

/** 家電の名前（HAの friendly_name）。引けなければ entity_id のまま */
async function deviceName(entityId: string): Promise<string> {
  try {
    return (await getControls()).entities.find((e) => e.entityId === entityId)?.name ?? entityId;
  } catch {
    return entityId;
  }
}

/**
 * 操作できる家電の一覧を、control_home_device の説明に埋め込むための文字列。
 * 先に list_home_devices を呼ばせると「電気つけて」1回にツールが2往復して2秒ほど余計にかかったので、
 * entity_id を最初から教えておき、1往復で操作できるようにする（状態は古くなるので載せない）。
 * HAにつながらないときは載せない（そのときは list_home_devices で調べさせる）。
 */
async function describeKnownDevices(): Promise<string> {
  try {
    const { configured, entities } = await getControls();
    if (!configured || entities.length === 0) return "";
    const lines = entities.map((e) => `${e.entityId}（${e.name}）`).join("、");
    return `この家の家電: ${lines}。`;
  } catch {
    return "";
  }
}

/** 解錠は、ログインしている人が画面で本人確認して許可したときだけ通る（本体の確かめ。risk: approve） */
function describeLockActions(): string {
  return "lock は lock・unlock（施錠・解錠。解錠は、家の人が画面で本人確認して許可したときだけ実行される）";
}

export default defineServerExtension({
  register(api) {
    haSettings.current = api.settings;
    haSettings.configDir = api.configDir;
    haSettings.dataDir = api.dataDir;
    // 夜の表示の条件（照度・照明・時間帯）を見張り、満たしたら本体へ知らせる
    registerNightWatch(api);

    // allowUnlock は「この画面から解錠できるか」。ログインしていれば true になる
    api.route("GET", "/controls", ({ account, locale }) =>
      localizeErrors(locale, async () => {
        const controls = await getControls();
        return { ...controls, allowUnlock: controls.configured && canUnlock(account !== null) };
      }),
    );
    api.route("GET", "/overview", ({ account, locale }) => localizeErrors(locale, () => getOverview(account !== null)));
    api.route("POST", "/call", ({ body, account, locale }) =>
      localizeErrors(locale, async () => {
        const { entityId, service, data } = (body ?? {}) as {
          entityId: string;
          service: string;
          data?: Record<string, unknown>;
        };
        await callHomeAssistantService(entityId, service, data, { loggedIn: account !== null });
        return { ok: true };
      }),
    );
    // 詳細画面のグラフ。?entityIds=sensor.a,sensor.b&hours=24（または 168）
    api.route("GET", "/history", ({ query, locale }) =>
      localizeErrors(locale, () =>
        getSensorHistory(
          String(query.entityIds ?? "")
            .split(",")
            .filter(Boolean),
          Number(query.hours ?? 24),
        ).then((series) => ({ series })),
      ),
    );
    api.route("POST", "/test", ({ locale }) => testConnection(locale), { adminOnly: true });
    // 設定画面の「計測に使うセンサー」。入／切は管理者だけ
    api.route("GET", "/sensors", ({ locale }) => localizeErrors(locale, () => listSensors()));
    api.route(
      "PUT",
      "/sensors",
      ({ body, locale }) =>
        localizeErrors(locale, async () => {
          const { entityId, enabled } = (body ?? {}) as { entityId: string; enabled: boolean };
          await setSensorEnabled(entityId, enabled);
          return { ok: true };
        }),
      { adminOnly: true },
    );

    api.tool({
      name: "list_home_devices",
      description:
        "Home Assistant の操作できる家電（照明・スイッチ・鍵・エアコン）と、室温・湿度センサーの現在の状態を返す。" +
        "家電を操作する前に entity_id を調べるのに使う。",
      readOnly: true,
      handler: async () => {
        const [controls, climate] = await Promise.all([getControls(), getClimate()]);
        return {
          configured: controls.configured,
          devices: controls.entities,
          sensors: climate.sensors,
          thermostats: climate.thermostats,
        };
      },
    });

    api.tool({
      name: "control_home_device",
      description: async () =>
        "Home Assistant の家電を操作する。" +
        ((await describeKnownDevices()) || "entity_id は list_home_devices で調べる。") +
        `light/switch は turn_on・turn_off・toggle、${describeLockActions()}、` +
        "climate は turn_on・turn_off・set_temperature（temperature を指定）が使える。",
      inputSchema: (z) => ({
        entity_id: z.string().describe("操作する家電の entity_id（例: light.living）"),
        action: z.enum(HA_ACTIONS),
        temperature: z.number().optional().describe("set_temperature のときの設定温度（℃）"),
      }),
      // 照明・スイッチ・空調はすぐ戻せるのでそのまま、施錠は了承を、解錠は画面での本人確認を求める
      // （Google のスマートホームの決まりでも、施錠は確認、解錠は暗証番号が要る）
      risk: ({ action }) => (action === "unlock" ? "approve" : action === "lock" ? "confirm" : "low"),
      describe: async ({ entity_id, action, temperature }) => {
        const name = await deviceName(entity_id);
        return action === "set_temperature"
          ? `${name}の温度を${temperature}度にする`
          : `${name}を${ACTION_LABELS[action]}`;
      },
      handler: async ({ entity_id, action, temperature }, { approvedBy }) => {
        if (action === "set_temperature" && temperature === undefined) {
          throw new HttpError(400, "set_temperature requires temperature");
        }
        // 解錠は、画面で本人確認して許可した人がいるときだけ通る（ログインした画面から押したのと同じ）
        await callHomeAssistantService(entity_id, action, action === "set_temperature" ? { temperature } : undefined, {
          loggedIn: approvedBy !== null,
        });
        return { ok: true };
      },
    });
  },
});
