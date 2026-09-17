import { existsSync } from "node:fs";
import { homedir } from "node:os";
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
  webDistDir: process.env.WEB_DIST_DIR ?? new URL("../../web/dist", import.meta.url).pathname,

  weather: {
    lat: Number(process.env.WEATHER_LAT ?? 35.6895),
    lon: Number(process.env.WEATHER_LON ?? 139.6917),
    name: process.env.WEATHER_LOCATION_NAME ?? "Tokyo",
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
    redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? "http://localhost:8787/auth/spotify/callback",
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN ?? "",
  },

  homeAssistant: {
    baseUrl: (process.env.HOMEASSISTANT_URL ?? "").replace(/\/$/, ""),
    token: process.env.HOMEASSISTANT_TOKEN ?? "",
    /**
     * 玄関の物理錠の「解錠」を許可するか。
     * このダッシュボードはLAN上に認証なしで公開される前提なので、既定では解錠できない
     * （状態表示と施錠のみ）。有効にするとLANに入れる誰でも解錠できてしまう点に注意。
     */
    allowUnlock: process.env.HOMEASSISTANT_ALLOW_UNLOCK === "true",
  },

  claudeUsage: {
    /** Claude Codeのセッションログ置き場。Docker運用ではホスト側を read-only でマウントして渡す */
    projectsDir: process.env.CLAUDE_PROJECTS_DIR ?? join(homedir(), ".claude", "projects"),
  },

  tailscale: {
    /** tailscaled の LocalAPI ソケット。Docker運用ではこれをマウントする */
    socketPath: process.env.TAILSCALE_SOCKET ?? "/var/run/tailscale/tailscaled.sock",
  },

  git: {
    /** この直下のディレクトリを走査してgitリポジトリを探す */
    reposDir: process.env.GIT_REPOS_DIR ?? join(homedir(), "Documents", "git-cloned"),
  },

  mail: {
    host: process.env.MAIL_HOST ?? "",
    port: Number(process.env.MAIL_PORT ?? 993),
    secure: process.env.MAIL_SECURE !== "false",
    user: process.env.MAIL_USER ?? "",
    /** Gmailの場合はアカウントのパスワードではなく「アプリパスワード」 */
    password: process.env.MAIL_PASSWORD ?? "",
    mailbox: process.env.MAIL_MAILBOX ?? "INBOX",
  },

  voice: {
    /**
     * 音声エージェント（apps/voice-agent）向けの /ws/voice-agent と /mcp の共有トークン。
     * 未設定なら誰でも使える（/mcp でできることは既存の /api/* と同じ範囲なので既定は空）
     */
    agentToken: process.env.VOICE_AGENT_TOKEN ?? "",
    /**
     * キャラクターの設定ファイルが無いときに、応答パネルに出すVRMアバター。無ければ状態を表す円だけになる。
     * 第三者のモデルを置く想定なのでリポジトリには含めない（config/*.vrm は .gitignore 済み）。
     * config/ は Docker 運用でもホスト側をマウントしているので、イメージを作り直さずに差し替えられる
     */
    avatarPath: process.env.VOICE_AVATAR_PATH ?? join(configDir, "avatar.vrm"),
    /** ウェイクワードごとに呼び分けるキャラクターの設定（形式は config/voice-personas.example.json） */
    personasPath: process.env.VOICE_PERSONAS_PATH ?? join(configDir, "voice-personas.json"),
  },
};
