import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { unzipSync, zipSync, type Zippable } from "fflate";

// config は読み込み時に環境変数を見るので、モジュールより先に一時ディレクトリを指しておく
const root = await mkdtemp(join(tmpdir(), "voice-personas-"));
process.env.VOICE_PERSONAS_DIR = join(root, "voice-personas");
process.env.DATA_DIR = join(root, "data");
const { importPersonaPackage, exportPersonaPackage, deletePersona, parsePersonaFile, vrmExpressionNames } = await import(
  "./voicePersonaPackages.js"
);
const { readCommon, readPersonas } = await import("./voicePersonas.js");
const { ServiceError } = await import("./serviceError.js");

const encode = (text: string) => new TextEncoder().encode(text);

/** JSON チャンクだけの最小の GLB */
function glb(json: unknown): Uint8Array {
  let body = encode(JSON.stringify(json));
  body = Uint8Array.from([...body, ...new Array((4 - (body.length % 4)) % 4).fill(0x20)]);
  const out = new Uint8Array(20 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  return out;
}

const VRM0 = {
  extensions: {
    VRM: {
      blendShapeMaster: {
        blendShapeGroups: [
          { presetName: "joy", name: "Joy" },
          { presetName: "a", name: "A" },
          { presetName: "unknown", name: "Surprised" },
        ],
      },
    },
  },
};

const persona = (overrides: Record<string, unknown> = {}) => ({
  id: "haru",
  name: "ハル",
  wakeWords: ["ハル"],
  decoys: ["春"],
  voice: { speaker: 8, speed: 1.1 },
  expressions: {
    にっこり: { avatar: { happy: 0.6 } },
    びっくり: { avatar: { surprised: 1 } },
    ドヤ顔: { avatar: { doya_1: 1 } },
  },
  ...overrides,
});

function packageZip(files: Zippable): Uint8Array {
  return zipSync(files);
}

async function rejects(promise: Promise<unknown>, status: number, message: RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ServiceError);
    assert.equal(err.statusCode, status);
    assert.match(err.message, message);
    return true;
  });
}

after(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("persona.json の検証", () => {
  test("正しい設定を受け付けて整える", () => {
    const parsed = parsePersonaFile(JSON.stringify(persona({ name: " ハル " })));
    assert.equal(parsed.name, "ハル");
    assert.deepEqual(parsed.wakeWords, ["ハル"]);
  });

  test("ディレクトリ名に使うIDは英小文字・数字などに限る", () => {
    assert.throws(() => parsePersonaFile(JSON.stringify(persona({ id: "../evil" }))), /id は/);
    assert.throws(() => parsePersonaFile(JSON.stringify(persona({ id: "ハル" }))), /id は/);
  });

  test("表情の身振り（motion）と、耳・尻尾の骨の指定（rig）を受け付ける", () => {
    const parsed = parsePersonaFile(
      JSON.stringify(
        persona({
          expressions: { ドヤ顔: { avatar: { doya_1: 1 }, motion: "proud" } },
          rig: { ears: { left: ["Ear_L"], right: ["Ear_R"] }, tail: ["Tail"] },
        }),
      ),
    );
    assert.equal(parsed.expressions?.["ドヤ顔"].motion, "proud");
    assert.deepEqual(parsed.rig, { ears: { left: ["Ear_L"], right: ["Ear_R"] }, tail: ["Tail"] });
    assert.throws(
      () => parsePersonaFile(JSON.stringify(persona({ expressions: { 笑: { motion: "../x" } } }))),
      /motion は/,
    );
  });

  test("ウェイクワードが無いものや、表情名に括弧を含むものは受け付けない", () => {
    assert.throws(() => parsePersonaFile(JSON.stringify(persona({ wakeWords: [] }))), /wakeWords/);
    assert.throws(
      () => parsePersonaFile(JSON.stringify(persona({ expressions: { "（笑）": { avatar: { happy: 1 } } } }))),
      /括弧/,
    );
    assert.throws(
      () => parsePersonaFile(JSON.stringify(persona({ expressions: { 笑: { avatar: { happy: 2 } } } }))),
      /0〜1/,
    );
  });
});

describe("VRMの表情名", () => {
  test("VRM 0.x のプリセットは three-vrm と同じ名前に読み替え、カスタム表情は名前で持つ", () => {
    assert.deepEqual([...vrmExpressionNames(JSON.stringify(VRM0))!].sort(), ["aa", "happy", "surprised"]);
  });

  test("書き出しツールが書いた NaN があっても読める", () => {
    const json = JSON.stringify(VRM0).replace('"Joy"', '"Joy","radius":NaN');
    assert.ok(vrmExpressionNames(json)?.has("happy"));
  });

  test("VRM 1.0 はプリセットとカスタムの両方", () => {
    const names = vrmExpressionNames(
      JSON.stringify({ extensions: { VRMC_vrm: { expressions: { preset: { happy: {} }, custom: { doya_1: {} } } } } }),
    );
    assert.deepEqual([...names!].sort(), ["doya_1", "happy"]);
  });
});

describe("インポート・書き出し・削除", () => {
  before(async () => {
    await rm(process.env.VOICE_PERSONAS_DIR!, { recursive: true, force: true });
  });

  test("フォルダ入りのZIPを取り込み、VRMに無い表情を警告する", async () => {
    const zip = packageZip({
      haru: {
        "persona.json": encode(JSON.stringify(persona())),
        "prompt.md": encode("一人称はわたし"),
        "avatar.vrm": glb(VRM0),
      },
    });
    const result = await importPersonaPackage(zip);
    assert.deepEqual(result, {
      id: "haru",
      name: "ハル",
      replaced: false,
      warnings: ["表情「ドヤ顔」の doya_1 がVRMにありません（その表情でも顔が変わりません）"],
    });
    const dir = join(process.env.VOICE_PERSONAS_DIR!, "haru");
    assert.deepEqual((await readdir(dir)).sort(), ["avatar.vrm", "persona.json", "prompt.md"]);
    assert.deepEqual((await readCommon()).order, ["haru"]);
    const [listed] = await readPersonas();
    assert.equal(listed.wakePhrase, "ねえハル");
    // 書きかけ用の一時ディレクトリは残らない
    assert.deepEqual(await readdir(process.env.VOICE_PERSONAS_DIR!), ["common.json", "haru"]);
  });

  test("同じIDがあれば、上書きを確認するまで取り込まない", async () => {
    const zip = packageZip({ "persona.json": encode(JSON.stringify(persona({ name: "ハル2" }))) });
    await rejects(importPersonaPackage(zip), 409, /すでにあります/);
    const result = await importPersonaPackage(zip, { replace: true });
    assert.equal(result.replaced, true);
    // 上書きしたパッケージに無いファイル（前のVRM・プロンプト）は残さない
    assert.deepEqual(await readdir(join(process.env.VOICE_PERSONAS_DIR!, "haru")), ["persona.json"]);
  });

  test("ZIPの中のパスは書き込み先に使わない", async () => {
    const zip = packageZip({ "../../evil/persona.json": encode(JSON.stringify(persona({ id: "evil" }))) });
    await rejects(importPersonaPackage(zip), 400, /persona.json がありません/);
    await assert.rejects(stat(join(root, "evil")));
  });

  test("2人分入ったZIPや、VRMではないアバターは受け付けない", async () => {
    await rejects(
      importPersonaPackage(
        packageZip({
          a: { "persona.json": encode(JSON.stringify(persona({ id: "a" }))) },
          b: { "persona.json": encode(JSON.stringify(persona({ id: "b" }))) },
        }),
      ),
      400,
      /2人以上/,
    );
    await rejects(
      importPersonaPackage(
        packageZip({ "persona.json": encode(JSON.stringify(persona({ id: "c" }))), "avatar.vrm": encode("not a glb") }),
      ),
      400,
      /VRM（GLB）ファイルではありません/,
    );
    await rejects(importPersonaPackage(encode("not a zip")), 400, /ZIPファイルとして読めません/);
  });

  test("書き出したZIPをそのまま取り込み直せ、削除すると並び順からも消える", async () => {
    const original = packageZip({
      "persona.json": encode(JSON.stringify(persona({ id: "sora", name: "ソラ" }))),
      "prompt.md": encode("やさしい"),
      "avatar.vrm": glb(VRM0),
    });
    await importPersonaPackage(original);
    const { zip } = await exportPersonaPackage("sora");
    const names = Object.keys(unzipSync(zip)).filter((name) => !name.endsWith("/"));
    assert.deepEqual(names.sort(), ["sora/avatar.vrm", "sora/persona.json", "sora/prompt.md"]);

    await deletePersona("sora");
    await assert.rejects(stat(join(process.env.VOICE_PERSONAS_DIR!, "sora")));
    assert.ok(!(await readCommon()).order?.includes("sora"));

    await importPersonaPackage(zip);
    assert.equal(await readFile(join(process.env.VOICE_PERSONAS_DIR!, "sora", "prompt.md"), "utf-8"), "やさしい");
    await rejects(deletePersona("nobody"), 404, /見つかりません/);
  });
});
