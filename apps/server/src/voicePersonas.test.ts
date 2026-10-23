import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// config は読み込んだ時点の環境変数で決まるので、先に置き場を決めてから読み込む
const root = await mkdtemp(join(tmpdir(), "voice-personas-"));
process.env.DATA_DIR = join(root, "data");
process.env.VOICE_PERSONAS_DIR = join(root, "personas");
for (const [id, name] of [
  ["plum", "プラム"],
  ["karin", "カリン"],
]) {
  await mkdir(join(root, "personas", id), { recursive: true });
  await writeFile(join(root, "personas", id, "persona.json"), JSON.stringify({ id, name, wakeWords: [name] }));
}

const personas = await import("./voicePersonas.js");

test("切ったキャラクターは common.json の disabled に入り、既定の話し相手から外れる", async () => {
  await personas.writeDefaultPersonaId("plum");
  await personas.setPersonaEnabled("plum", false);
  const common = JSON.parse(await readFile(join(root, "personas", "common.json"), "utf-8"));
  assert.deepEqual(common.disabled, ["plum"]);

  const list = await personas.readPersonas();
  assert.deepEqual(
    list.map((p) => [p.id, p.enabled]),
    [
      ["karin", true],
      ["plum", false],
    ],
  );
  assert.equal(await personas.readDefaultPersonaId(list), "karin");
});

test("最後の1人は切れない。入れ直すと disabled から外れる", async () => {
  await assert.rejects(personas.setPersonaEnabled("karin", false), /最後の1人/);
  await personas.setPersonaEnabled("plum", true);
  const common = JSON.parse(await readFile(join(root, "personas", "common.json"), "utf-8"));
  assert.deepEqual(common.disabled, []);
  await assert.rejects(personas.setPersonaEnabled("nobody", false), /見つかりません/);
});
