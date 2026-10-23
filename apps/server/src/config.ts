import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// .env の読み込みはこのモジュールの先頭で行う。
// ESモジュールのimportは呼び出し側の本体より先に評価されるため、index.ts側で読み込むと
// この config が先に process.env を参照してしまい .env が反映されない
// （Docker運用では env_file で実環境変数として渡るため露呈しなかった）。
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const configDir = process.env.CONFIG_DIR ?? new URL("../../../config", import.meta.url).pathname;

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? new URL("../../../data", import.meta.url).pathname,
  configDir,
  /** 本体に入っている拡張機能（リポジトリの extensions/。それぞれの dist/ を読む） */
  extensionsDir: process.env.EXTENSIONS_DIR ?? new URL("../../../extensions", import.meta.url).pathname,
  webDistDir: process.env.WEB_DIST_DIR ?? new URL("../../web/dist", import.meta.url).pathname,
  /**
   * 最初に登録しておく拡張機能のリポジトリ（本体のリポジトリなど）。まだ1つも登録していないときだけ登録する。
   * 非公開のリポジトリなら、読むためのトークン（GitHub なら Contents を読むだけの fine-grained token）も渡すか、画面で入れる
   */
  extensionSource: {
    url: process.env.EXTENSION_SOURCE_URL ?? "",
    branch: process.env.EXTENSION_SOURCE_BRANCH ?? "dist-extensions",
    token: process.env.EXTENSION_SOURCE_TOKEN ?? "",
    name: process.env.EXTENSION_SOURCE_NAME ?? "",
  },

  // Spotify・Home Assistant・メール・天気などの連携の設定は、それぞれの拡張機能の manifest.json（extensions/*）にある
  voice: {
    /**
     * 音声エージェント（apps/voice-agent）向けの /ws/voice-agent と /mcp の共有トークン。
     * 未設定なら、どちらも使えない（音声エージェントがつながれない）
     */
    agentToken: process.env.VOICE_AGENT_TOKEN ?? "",
    /**
     * キャラクターの設定ファイルが無いときに、応答パネルに出すVRMアバター。無ければ状態を表す円だけになる。
     * 第三者のモデルを置く想定なのでリポジトリには含めない（config/*.vrm は .gitignore 済み）。
     * config/ は Docker 運用でもホスト側をマウントしているので、イメージを作り直さずに差し替えられる
     */
    avatarPath: process.env.VOICE_AVATAR_PATH ?? join(configDir, "avatar.vrm"),
    /**
     * ウェイクワードごとに呼び分けるキャラクターを1人1ディレクトリで置く場所（形式は config/voice-personas.example/）。
     * 設定画面からのインポート・削除でここに書き込むので、Docker 運用でも書き込めるようにマウントしておく
     */
    personasDir: process.env.VOICE_PERSONAS_DIR ?? join(configDir, "voice-personas"),
  },
};
