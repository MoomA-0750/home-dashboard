import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SettingField } from "@home-dashboard/extension-sdk";

// config は読み込んだ時点の環境変数で決まるので、先に置き場と .env 相当の値を決めてから読み込む
const dataDir = await mkdtemp(join(tmpdir(), "connection-settings-"));
process.env.DATA_DIR = dataDir;
process.env.TEST_HA_URL = "http://env-ha:8123/";
process.env.TEST_HA_TOKEN = "env-token";
process.env.TEST_MAIL_SECURE = "false";

const settings = await import("./connectionSettings.js");

const HA_FIELDS: SettingField[] = [
  { key: "baseUrl", label: "URL", kind: "url", env: "TEST_HA_URL" },
  { key: "token", label: "トークン", kind: "secret", env: "TEST_HA_TOKEN" },
  { key: "allowUnlock", label: "解錠", kind: "boolean", env: "TEST_HA_UNLOCK", hidden: true },
];
const MAIL_FIELDS: SettingField[] = [
  { key: "port", label: "ポート", kind: "number", default: 993, min: 1, max: 65535, integer: true },
  { key: "secure", label: "TLS", kind: "boolean", env: "TEST_MAIL_SECURE", default: true },
];
const WEATHER_FIELDS: SettingField[] = [
  { key: "name", label: "地名", kind: "text", default: "Tokyo" },
  { key: "lat", label: "緯度", kind: "number", default: 35.6, min: -90, max: 90 },
  { key: "dir", label: "置き場", kind: "text", default: "~/somewhere" },
];

let ha: Record<string, unknown>;
let mail: Record<string, unknown>;
let weather: Record<string, unknown>;

before(async () => {
  // 拡張機能にする前の名前（homeAssistant）で保存してあった値も読む
  await writeFile(join(dataDir, "connections.json"), JSON.stringify({ homeAssistant: { token: "saved-token" } }));
  await settings.loadConnectionSettings();
  ha = settings.registerSettingsSection("home-assistant", "Home Assistant", HA_FIELDS, { test: "/test" });
  mail = settings.registerSettingsSection("mail", "メール", MAIL_FIELDS);
  weather = settings.registerSettingsSection("weather", "天気", WEATHER_FIELDS);
});

function field(sectionId: string, key: string) {
  return settings
    .describeConnectionSettings()
    .find((section) => section.id === sectionId)!
    .fields.find((f) => f.key === key);
}

test(".env の値と既定値を、項目の種類に合わせて読む（古い名前で保存した値も効く）", () => {
  assert.equal(ha.baseUrl, "http://env-ha:8123");
  assert.equal(ha.token, "saved-token");
  assert.equal(ha.allowUnlock, false);
  assert.equal(mail.port, 993);
  assert.equal(mail.secure, false);
  assert.match(String(weather.dir), /\/somewhere$/);
  assert.ok(!String(weather.dir).startsWith("~"));
});

test("画面で変えた値をすぐ入れ物に入れ、秘密の値と hidden の項目は返さない", async () => {
  settings.resetConnectionSettingsForTest();
  await settings.updateConnectionSettings("home-assistant", { baseUrl: "http://ha.lan:8123/", token: "new-token" });
  assert.equal(ha.baseUrl, "http://ha.lan:8123");
  assert.equal(ha.token, "new-token");

  const token = field("home-assistant", "token")!;
  assert.equal(token.value, null);
  assert.equal(token.isSet, true);
  assert.equal(token.source, "settings");
  assert.equal(field("home-assistant", "allowUnlock"), undefined);
  assert.equal(settings.describeConnectionSettings(["home-assistant"])[0].test, "/test");

  const saved = JSON.parse(await readFile(join(dataDir, "connections.json"), "utf-8"));
  assert.equal(saved["home-assistant"].token, "new-token");
  assert.equal((await stat(join(dataDir, "connections.json"))).mode & 0o777, 0o600);
});

test("送ってこなかった項目は変えず、空にした項目は .env の値に戻す", async () => {
  settings.resetConnectionSettingsForTest();
  await settings.updateConnectionSettings("home-assistant", { baseUrl: "http://ha.lan:8123", token: "new-token" });
  await settings.updateConnectionSettings("home-assistant", { baseUrl: "" });
  assert.equal(ha.baseUrl, "http://env-ha:8123");
  assert.equal(ha.token, "new-token");
  assert.equal(field("home-assistant", "baseUrl")!.source, "env");
});

test("変わった節の知らせを受け取れる", async () => {
  let called = 0;
  settings.onConnectionChange("mail", () => called++);
  await settings.updateConnectionSettings("mail", { port: "143", secure: true });
  assert.equal(called, 1);
  assert.equal(mail.port, 143);
  assert.equal(mail.secure, true);
});

test("形の合わない値・知らない項目・画面に出さない項目は受け付けない", async () => {
  await assert.rejects(settings.updateConnectionSettings("home-assistant", { baseUrl: "ftp://ha" }), /http か https/);
  await assert.rejects(settings.updateConnectionSettings("mail", { port: 70000 }), /1〜65535/);
  await assert.rejects(settings.updateConnectionSettings("weather", { lat: "north" }), /数値/);
  await assert.rejects(settings.updateConnectionSettings("home-assistant", { allowUnlock: true }), /unknown field/);
  await assert.rejects(settings.updateConnectionSettings("voice", {}), /unknown section/);
});

test("保存したファイルを起動時に読み直す", async () => {
  await settings.updateConnectionSettings("weather", { name: "大阪", lat: 34.69 });
  settings.resetConnectionSettingsForTest();
  assert.equal(weather.name, "Tokyo");
  await settings.loadConnectionSettings();
  assert.equal(weather.name, "大阪");
  assert.equal(weather.lat, 34.69);
});

test("区画は、知らない項目と危ないリンクを捨てて画面に返す", () => {
  settings.registerSettingsSection("grouped", "区画", WEATHER_FIELDS, {
    groups: [
      {
        id: "place",
        title: "場所",
        fields: ["name", "lat", "missing"],
        steps: ["{name} を入れる"],
        links: [
          { label: "地図", href: "https://example.com/map" },
          { label: "中の道", href: "/api/ext/grouped/help" },
          { label: "危ない", href: "javascript:alert(1)" },
          { label: "外の頭", href: "//example.com" },
        ],
      },
    ],
  });
  const section = settings.describeConnectionSettings().find((s) => s.id === "grouped")!;
  assert.deepEqual(section.groups, [
    {
      id: "place",
      title: "場所",
      note: null,
      fields: ["name", "lat"],
      steps: ["{name} を入れる"],
      links: [
        { label: "地図", href: "https://example.com/map" },
        { label: "中の道", href: "/api/ext/grouped/help" },
      ],
    },
  ]);
  settings.unregisterSettingsSection("grouped");
});
