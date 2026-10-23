import { useCallback, useEffect, useState } from "react";
import type { WidgetRuntimeContext } from "@home-dashboard/widget-sdk";
import type { VoiceTurnRecord } from "./useVoiceAssistant";

/**
 * 画面のチャットの会話（Claude Code の会話）。チャットは会話を1つ選んで表示し、話しかけるとその会話で答えてもらう。
 * ウェイクワードで話しかけたやり取りも、そのときの会話の記録として一覧に並ぶ。
 */

export interface ConversationSummary {
  id: string;
  /** 最初に話しかけた言葉 */
  title: string;
  startedAt: string;
  updatedAt: string;
  turns: number;
  personas: { id: string; name: string }[];
}

/** 新しい会話のID。チャットで決めて送ると、エージェントがこのIDで Claude Code の会話を始める */
export function newConversationId(): string {
  // crypto.randomUUID は HTTPS か localhost でしか使えない（LAN の http で開いた端末でも作れるようにする）
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const CONVERSATION_STORAGE_KEY = "home-dashboard:voice-chat-conversation";
const PERSONA_STORAGE_KEY = "home-dashboard:voice-chat-persona";

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても、開いている間は選んだものを使う
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface VoiceChatSession {
  conversations: ConversationSummary[];
  /** 表示している会話。まだ一度も話していない新しい会話のこともある */
  conversationId: string;
  /** 表示している会話のやり取り（古い順） */
  records: VoiceTurnRecord[];
  /** ほかの会話で新しくあったやり取り（ウェイクワードで話しかけた、など）。開くと消える */
  elsewhere: VoiceTurnRecord | null;
  select(conversationId: string): void;
  startNew(): void;
  /** 話しかける相手（端末ごとに覚える）。null なら既定のキャラクター */
  personaId: string | null;
  setPersonaId(personaId: string): void;
}

/** 会話の一覧と、選んでいる会話のやり取り。enabled（チャットを開いている）の間だけ取得する */
export function useVoiceChatSession(ctx: WidgetRuntimeContext, enabled: boolean): VoiceChatSession {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // 端末ごとに前に開いていた会話から続ける（無ければ最近の会話、それも無ければ新しい会話）
  const [conversationId, setConversationId] = useState<string | null>(() => readStored(CONVERSATION_STORAGE_KEY));
  const [records, setRecords] = useState<VoiceTurnRecord[]>([]);
  const [elsewhere, setElsewhere] = useState<VoiceTurnRecord | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [personaId, setPersonaIdState] = useState<string | null>(() => readStored(PERSONA_STORAGE_KEY));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchJson<{ conversations: ConversationSummary[] }>(`${ctx.apiBaseUrl}/api/voice/conversations`).then((data) => {
      if (cancelled || !data) return;
      setConversations(data.conversations);
      setConversationId((current) => current ?? data.conversations[0]?.id ?? newConversationId());
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket, enabled, listVersion]);

  useEffect(() => {
    if (conversationId) writeStored(CONVERSATION_STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!enabled || !conversationId) return;
    let cancelled = false;
    setRecords([]);
    const params = new URLSearchParams({ conversationId });
    fetchJson<{ records: VoiceTurnRecord[] }>(`${ctx.apiBaseUrl}/api/voice/history?${params}`).then((data) => {
      if (!cancelled && data) setRecords(data.records);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx.apiBaseUrl, ctx.socket, enabled, conversationId]);

  useEffect(() => {
    if (!enabled || !ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "voice-history") return;
        const record = message.record as VoiceTurnRecord;
        if (record.conversationId && record.conversationId === conversationId) {
          setRecords((prev) => (prev.some((r) => r.id && r.id === record.id) ? prev : [...prev, record]));
        } else if (record.conversationId) {
          setElsewhere(record);
        }
        // 一覧の並び・件数も変わるので取り直す
        setListVersion((v) => v + 1);
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, enabled, conversationId]);

  const select = useCallback((id: string) => {
    setConversationId(id);
    setElsewhere((current) => (current?.conversationId === id ? null : current));
  }, []);

  const startNew = useCallback(() => {
    setConversationId(newConversationId());
  }, []);

  const setPersonaId = useCallback((id: string) => {
    setPersonaIdState(id);
    writeStored(PERSONA_STORAGE_KEY, id);
  }, []);

  return {
    conversations,
    conversationId: conversationId ?? "",
    records,
    elsewhere,
    select,
    startNew,
    personaId,
    setPersonaId,
  };
}
