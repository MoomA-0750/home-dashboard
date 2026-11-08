/**
 * サーバー側と画面側が受け渡す形。中身は機械の側の仲介スクリプト（assets/hd-claude-bridge.py）が返すもの
 */

export type MachineType = "self" | "ssh";

export interface MachineConfig {
  id: string;
  name: string;
  type: MachineType;
  /** ssh: 宛先・口・ユーザー・ホスト鍵の指紋（SHA256:…） */
  host?: string;
  port?: number;
  username?: string;
  fingerprint?: string;
}

/** Herdr が見分けたエージェントの状態。idle・done は指示を待っている、blocked は確認・質問の画面を出している */
export type AgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export interface HerdrAgent {
  pane: string;
  name: string | null;
  kind: string;
  status: AgentStatus;
  sessionId: string | null;
  cwd: string | null;
  workspace: string;
  tab: string;
  title: string;
  focused: boolean;
}

export interface HerdrWorkspace {
  id: string;
  label: string;
  number: number;
  status: AgentStatus;
}

export interface HerdrState {
  running: boolean;
  error?: string;
  agents: HerdrAgent[];
  workspaces: HerdrWorkspace[];
}

export interface SessionSummary {
  id: string;
  project: string;
  /** 最後に書かれた時刻（UNIX 秒） */
  mtime: number;
  size: number;
  title: string | null;
  lastPrompt: string | null;
  cwd: string | null;
  branch: string | null;
}

export interface MachineHello {
  version: number;
  hostname: string;
  home: string;
  /** ~/.claude/projects がある */
  claude: boolean;
  /** Herdr の版（無ければ null） */
  herdr: string | null;
}

export interface MachineOverview {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
  sessions: SessionSummary[];
  herdr: HerdrState | null;
}

/** やり取りの1つ（ログの1行から0個以上できる） */
export type LogItem =
  | { k: "user"; id: string; ts?: string; text: string; images: number }
  | { k: "assistant"; id: string; ts?: string; text: string; model?: string }
  | { k: "thinking"; id: string; ts?: string; text: string }
  | { k: "tool"; id: string; ts?: string; name: string; input: Record<string, unknown>; model?: string }
  | { k: "result"; id: string; ts?: string; text: string; images: number; error: boolean }
  | { k: "system"; id: string; ts?: string; subtype: string; text: string };

export interface LogChunk {
  /** 読んだところのバイトの位置。続きは from=end、前は before=start で読む */
  start: number;
  end: number;
  size: number;
  items: LogItem[];
  /** start より前にまだある */
  more: boolean;
}

export type AgentAction =
  | { action: "prompt"; pane: string; text: string }
  | { action: "keys"; pane: string; keys: string[] }
  | { action: "focus"; pane: string }
  | { action: "start"; cwd: string; workspace?: string; resume?: string };
