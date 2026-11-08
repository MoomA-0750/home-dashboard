import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonRow,
  ChatComposer,
  ChatHeader,
  ChatLayout,
  ChatLog,
  ChatPending,
  Dialog,
  Field,
  Group,
  IconButton,
  List,
  ListItem,
  Message,
  Note,
  openSettings,
  ScreenFrame,
  ScreenNotice,
  SectionTitle,
  formatClock,
  formatPastDay,
  useLocale,
  usePolledResource,
  usePolling,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import { fetchLog, fetchOverview, fetchScreen, runAction } from "./api";
import { strings } from "./i18n";
import { CodePre } from "./Markdown";
import { Transcript } from "./Transcript";
import type { AgentStatus, HerdrAgent, HerdrWorkspace, LogItem, MachineOverview, SessionSummary } from "./types";

/**
 * Claude Code のセッションの画面。左にセッションの一覧（機械ごと。Herdr で動いているものが上）、右にやり取り（Claude Code と同じ並び）。
 * Herdr で動いているセッションは、下の入力欄から指示を送れる。確認の画面が出ているときは、端末の画面とキーのボタンを出す。
 * 一覧は 4 秒ごと、開いているやり取りは動いている間 1.5 秒ごと（止まっていれば 5 秒ごと）に、続きだけを読む
 */

type Ctx = ScreenProps["ctx"];

interface Entry {
  key: string;
  machineId: string;
  machineName: string;
  sessionId: string | null;
  title: string;
  cwd: string | null;
  branch: string | null;
  mtime: number | null;
  agent: HerdrAgent | null;
  workspace: HerdrWorkspace | null;
  /** Herdr が動いている機械（続きを始められる） */
  herdr: boolean;
}

const STATUS_RANK: Record<AgentStatus, number> = { blocked: 0, working: 1, done: 2, idle: 3, unknown: 4 };
const STATUS_TONE: Record<AgentStatus, "on" | "warn" | "dim" | undefined> = {
  blocked: "warn",
  working: "on",
  done: undefined,
  idle: "dim",
  unknown: "dim",
};

const basename = (path: string | null) => (path ? (path.replace(/\/+$/, "").split("/").pop() ?? path) : "");

function entriesOf(machine: MachineOverview): Entry[] {
  const herdr = machine.herdr?.running === true;
  const workspaces = new Map((machine.herdr?.workspaces ?? []).map((w) => [w.id, w]));
  const agents = machine.herdr?.agents.filter((a) => a.kind === "claude") ?? [];
  const bySession = new Map(agents.filter((a) => a.sessionId).map((a) => [a.sessionId as string, a]));
  const sessions = new Map(machine.sessions.map((s) => [s.id, s]));
  const entries: Entry[] = [];
  const make = (session: SessionSummary | null, agent: HerdrAgent | null): Entry => ({
    key: `${machine.id}/${session?.id ?? agent?.pane}`,
    machineId: machine.id,
    machineName: machine.name,
    sessionId: session?.id ?? agent?.sessionId ?? null,
    title:
      session?.title ||
      (agent?.title && agent.title !== "Claude Code" ? agent.title : "") ||
      session?.lastPrompt ||
      basename(session?.cwd ?? agent?.cwd ?? null) ||
      "Claude Code",
    cwd: session?.cwd ?? agent?.cwd ?? null,
    branch: session?.branch ?? null,
    mtime: session?.mtime ?? null,
    agent,
    workspace: agent ? (workspaces.get(agent.workspace) ?? null) : null,
    herdr,
  });
  for (const agent of agents) entries.push(make(agent.sessionId ? (sessions.get(agent.sessionId) ?? null) : null, agent));
  for (const session of machine.sessions) if (!bySession.has(session.id)) entries.push(make(session, null));
  return entries.sort((a, b) => {
    if (a.agent && b.agent) return STATUS_RANK[a.agent.status] - STATUS_RANK[b.agent.status] || (b.mtime ?? 0) - (a.mtime ?? 0);
    if (a.agent || b.agent) return a.agent ? -1 : 1;
    return (b.mtime ?? 0) - (a.mtime ?? 0);
  });
}

function useWhen() {
  const locale = useLocale();
  return (mtime: number | null) => {
    if (!mtime) return "";
    const date = new Date(mtime * 1000);
    return formatPastDay(date, locale) ?? formatClock(date, locale);
  };
}

function StatusBadge({ status }: { status: AgentStatus | "stopped" }) {
  const t = strings.useT();
  return <Badge tone={status === "stopped" ? "dim" : STATUS_TONE[status]}>{t(`status_${status}`)}</Badge>;
}

// --- やり取りを読む

interface LogState {
  sessionKey: string;
  items: LogItem[];
  start: number;
  end: number;
  more: boolean;
}

/** 同じ id のもの（読み直しの重なり）は後のもので置き換え、並びは先に出たところに残す */
function mergeItems(...lists: LogItem[][]): LogItem[] {
  const map = new Map<string, LogItem>();
  for (const list of lists) for (const item of list) map.set(`${item.k}:${item.id}`, item);
  return [...map.values()];
}

function useSessionLog(ctx: Ctx, entry: Entry | null, fast: boolean) {
  const sessionKey = entry && entry.sessionId ? `${entry.machineId}/${entry.sessionId}` : "";
  const [state, setState] = useState<LogState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(null);
    setError(null);
    if (!entry?.sessionId) return;
    let cancelled = false;
    fetchLog(ctx, entry.machineId, entry.sessionId, { limit: 160 })
      .then((chunk) => {
        if (!cancelled) setState({ sessionKey, items: chunk.items, start: chunk.start, end: chunk.end, more: chunk.more });
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // 開くセッションが変わったときだけ、後ろから読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  const pull = useCallback(async () => {
    const current = stateRef.current;
    if (!entry?.sessionId || !current || current.sessionKey !== sessionKey) return;
    const chunk = await fetchLog(ctx, entry.machineId, entry.sessionId, { from: current.end });
    setState((prev) =>
      prev && prev.sessionKey === sessionKey && prev.end === current.end
        ? { ...prev, items: chunk.items.length ? mergeItems(prev.items, chunk.items) : prev.items, end: chunk.end }
        : prev,
    );
  }, [ctx, entry?.machineId, entry?.sessionId, sessionKey]);

  usePolling(pull, fast ? 1_500 : 5_000, Boolean(state && entry?.sessionId));

  const loadOlder = useCallback(async () => {
    const current = stateRef.current;
    if (!entry?.sessionId || !current || !current.more) return;
    setLoadingOlder(true);
    try {
      const chunk = await fetchLog(ctx, entry.machineId, entry.sessionId, { before: current.start, limit: 160 });
      setState((prev) =>
        prev && prev.sessionKey === sessionKey
          ? { ...prev, items: mergeItems(chunk.items, prev.items), start: chunk.start, more: chunk.more }
          : prev,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }, [ctx, entry?.machineId, entry?.sessionId, sessionKey]);

  return { state: state?.sessionKey === sessionKey ? state : null, error, loadOlder, loadingOlder, pull };
}

// --- 確認の画面と端末の画面

const CHOICES = ["1", "2", "3"];

function TerminalPanel({
  ctx,
  entry,
  blocked,
  onKeys,
  busy,
}: {
  ctx: Ctx;
  entry: Entry;
  blocked: boolean;
  onKeys: (keys: string[]) => void;
  busy: boolean;
}) {
  const t = strings.useT();
  const pane = entry.agent?.pane ?? "";
  const screen = usePolledResource(() => fetchScreen(ctx, entry.machineId, pane, 40), 1_500, Boolean(pane));
  // 端末の下の空行は出さない
  const text = (screen.data?.text ?? "").replace(/\s+$/, "");
  return (
    <Group title={blocked ? t("blockedTitle") : t("terminal")}>
      {blocked && <Note>{t("blockedNote")}</Note>}
      {text ? <CodePre className="max-h-80">{text}</CodePre> : <Note>{t("loading")}</Note>}
      <ButtonRow>
        {blocked &&
          CHOICES.map((n) => (
            <Button key={n} disabled={busy} onClick={() => onKeys([n])} aria-label={t("choose", { n })}>
              {n}
            </Button>
          ))}
        <Button disabled={busy} onClick={() => onKeys(["up"])} aria-label={t("key_up")} icon="chevron-up" />
        <Button disabled={busy} onClick={() => onKeys(["down"])} aria-label={t("key_down")} icon="chevron-down" />
        <Button disabled={busy} variant="primary" onClick={() => onKeys(["enter"])}>
          {t("key_enter")}
        </Button>
        <Button disabled={busy} onClick={() => onKeys(["esc"])}>
          {t("key_esc")}
        </Button>
        <Button disabled={busy} onClick={() => onKeys(["shift+tab"])}>
          {t("key_shiftTab")}
        </Button>
      </ButtonRow>
    </Group>
  );
}

// --- 新しいセッション

function NewSessionDialog({
  ctx,
  machine,
  defaultCwd,
  onClose,
  onStarted,
}: {
  ctx: Ctx;
  machine: MachineOverview;
  defaultCwd: string;
  onClose: () => void;
  onStarted: (message: string) => void;
}) {
  const t = strings.useT();
  const [cwd, setCwd] = useState(defaultCwd);
  const [workspace, setWorkspace] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await runAction(ctx, machine.id, { action: "start", cwd, workspace: workspace || undefined });
      onStarted(t("started"));
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <Dialog title={t("newTitle")} onClose={onClose}>
      <form
        className="fields flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <Field label={t("machine")}>
          <input value={machine.name} readOnly />
        </Field>
        <Field label={t("newCwd")} hint={t("newCwdHint")}>
          <input value={cwd} onChange={(event) => setCwd(event.target.value)} required spellCheck={false} autoCapitalize="off" />
        </Field>
        <Field label={t("newWorkspace")}>
          <select value={workspace} onChange={(event) => setWorkspace(event.target.value)}>
            <option value="">{t("newWorkspaceCreate")}</option>
            {(machine.herdr?.workspaces ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.number}. {w.label}
              </option>
            ))}
          </select>
        </Field>
        {error && <Message tone="error">{error}</Message>}
        <ButtonRow>
          <Button variant="primary" type="submit" disabled={busy || !cwd.trim()}>
            {busy ? t("starting") : t("newStart")}
          </Button>
          <Button type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
        </ButtonRow>
      </form>
    </Dialog>
  );
}

// --- 画面

export function CodeScreen({ ctx, account }: ScreenProps) {
  const t = strings.useT();
  const when = useWhen();
  const admin = account.role === "admin";
  const overview = usePolledResource(() => fetchOverview(ctx), 4_000, admin, { cacheKey: "claude-code:overview" });
  const machines = overview.data?.machines ?? [];
  const entries = useMemo(() => machines.flatMap(entriesOf), [machines]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [newFor, setNewFor] = useState<MachineOverview | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // 選んだものが一覧に無くなっても（Herdr のペインが閉じたなど）、同じセッションを探し直す
  const selected = useMemo(() => {
    if (!selectedKey) return null;
    const direct = entries.find((e) => e.key === selectedKey);
    if (direct) return direct;
    const [machineId, id] = selectedKey.split("/");
    return entries.find((e) => e.machineId === machineId && e.sessionId === id) ?? null;
  }, [entries, selectedKey]);

  // 広い画面では、最初は一覧のいちばん上を開いておく
  useEffect(() => {
    if (!selectedKey && entries.length > 0 && window.matchMedia("(min-width: 1101px)").matches) setSelectedKey(entries[0].key);
  }, [selectedKey, entries]);

  useEffect(() => {
    setNotice(null);
    setTerminalOpen(false);
  }, [selectedKey]);

  const status = selected?.agent?.status ?? null;
  const live = Boolean(selected?.agent);
  const log = useSessionLog(ctx, selected, status === "working" || status === "blocked");

  // 送った・キーを押した直後は、すぐ一覧（状態）とやり取りを読み直す
  const refreshSoon = () => {
    void overview.refresh();
    void log.pull().catch(() => undefined);
  };

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice({ tone: "ok", text: done });
      refreshSoon();
      return true;
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!selected?.agent || !text.trim()) return;
    const pane = selected.agent.pane;
    const ok = await act(() => runAction(ctx, selected.machineId, { action: "prompt", pane, text }));
    if (ok) setText("");
  };
  const sendKeys = (keys: string[]) => {
    if (!selected?.agent) return;
    const pane = selected.agent.pane;
    void act(() => runAction(ctx, selected.machineId, { action: "keys", pane, keys }));
  };

  if (!admin) {
    return (
      <ScreenFrame title={{ ja: "Claude Code", en: "Claude Code" }}>
        <ScreenNotice tone="error">{t("adminOnly")}</ScreenNotice>
      </ScreenFrame>
    );
  }
  if (overview.data && machines.length === 0) {
    return (
      <ScreenFrame title={{ ja: "Claude Code", en: "Claude Code" }}>
        <ScreenNotice>
          {t("noMachines")} {t("noMachinesHint")}
        </ScreenNotice>
        <ButtonRow>
          <Button variant="primary" onClick={() => openSettings({ page: "extensions", extension: "claude-code" })}>
            {t("openSettings")}
          </Button>
        </ButtonRow>
      </ScreenFrame>
    );
  }

  const list = machines.map((machine) => {
    const machineEntries = entries.filter((e) => e.machineId === machine.id);
    const herdr = machine.herdr?.running === true;
    return (
      <div key={machine.id} className="mb-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 px-2">
          <SectionTitle>{machine.name}</SectionTitle>
          {!machine.ok ? (
            <Badge tone="warn">{t("unreachable")}</Badge>
          ) : !machine.herdr ? (
            <Badge tone="dim">{t("viewOnly")}</Badge>
          ) : !herdr ? (
            <Badge tone="warn">{t("herdrStopped")}</Badge>
          ) : null}
          {herdr && (
            <IconButton
              icon="add"
              label={t("newSession")}
              title={t("newSession")}
              className="ml-auto"
              onClick={() => setNewFor(machine)}
            />
          )}
        </div>
        {!machine.ok && machine.error && <Note>{machine.error}</Note>}
        {machine.ok && machineEntries.length === 0 && <Note>{t("noSessions")}</Note>}
        <List label={machine.name}>
          {machineEntries.map((entry) => (
            <ListItem
              key={entry.key}
              title={entry.title}
              detail={[basename(entry.cwd), entry.agent ? entry.workspace?.label : when(entry.mtime)].filter(Boolean).join(" · ")}
              badge={entry.agent ? <StatusBadge status={entry.agent.status} /> : undefined}
              selected={selected?.key === entry.key}
              onClick={() => {
                setSelectedKey(entry.key);
                setListOpen(false);
              }}
            />
          ))}
        </List>
      </div>
    );
  });

  const blocked = status === "blocked";
  const working = status === "working";
  const header = selected ? (
    <ChatHeader
      title={selected.title}
      ok={live}
      status={
        <>
          {live && selected.agent ? t(`status_${selected.agent.status}`) : t("status_stopped")}
          {" · "}
          {selected.machineName}
          {selected.cwd && ` · ${selected.cwd}`}
          {selected.branch && ` · ${selected.branch}`}
        </>
      }
      onOpenList={() => setListOpen(true)}
      actions={
        <ButtonRow>
          {live && (
            <IconButton
              icon="desktop"
              label={terminalOpen ? t("hideTerminal") : t("terminal")}
              title={terminalOpen ? t("hideTerminal") : t("terminal")}
              selected={terminalOpen}
              glass
              onClick={() => setTerminalOpen((v) => !v)}
            />
          )}
          {live && selected.agent && (
            <IconButton
              icon="grid"
              label={t("focusInHerdr")}
              title={t("focusInHerdr")}
              glass
              disabled={busy}
              onClick={() =>
                void act(() => runAction(ctx, selected.machineId, { action: "focus", pane: selected.agent!.pane }), t("focused"))
              }
            />
          )}
          {!live && selected.herdr && selected.sessionId && selected.cwd && (
            <Button
              icon="play"
              disabled={busy}
              onClick={() =>
                void act(
                  () =>
                    runAction(ctx, selected.machineId, { action: "start", cwd: selected.cwd!, resume: selected.sessionId! }),
                  t("resumed"),
                )
              }
            >
              {t("resume")}
            </Button>
          )}
        </ButtonRow>
      }
    />
  ) : null;

  const placeholder = !live ? t("promptViewOnly") : blocked ? t("promptBlocked") : t("promptPlaceholder");

  return (
    <ScreenFrame title={{ ja: "Claude Code", en: "Claude Code" }} fill>
      <ChatLayout list={list} listLabel={t("sessions")} listOpen={listOpen} onCloseList={() => setListOpen(false)}>
        {!selected ? (
          <ChatPending>{overview.data ? t("pickSession") : t("loading")}</ChatPending>
        ) : (
          <>
            {header}
            <ChatLog
              scrollKey={`${selected.key}:${log.state?.items.length ?? 0}`}
              empty={
                !selected.sessionId
                  ? undefined
                  : log.error && !log.state
                    ? log.error
                    : !log.state
                      ? t("loading")
                      : log.state.items.length === 0
                        ? t("emptyLog")
                        : undefined
              }
            >
              {log.state?.more && (
                <li className="self-center">
                  <Button disabled={log.loadingOlder} onClick={() => void log.loadOlder()}>
                    {log.loadingOlder ? t("readingOlder") : t("olderMessages")}
                  </Button>
                </li>
              )}
              {log.state && <Transcript items={log.state.items} cwd={selected.cwd} working={working} />}
            </ChatLog>
            {live && (blocked || terminalOpen) && (
              <TerminalPanel ctx={ctx} entry={selected} blocked={blocked} onKeys={sendKeys} busy={busy} />
            )}
            <ChatComposer
              value={text}
              onChange={setText}
              onSubmit={() => void send()}
              placeholder={placeholder}
              label={t("prompt")}
              disabled={!live || blocked}
              canSubmit={live && !blocked && !busy && Boolean(text.trim())}
              above={notice && <Message tone={notice.tone}>{notice.text}</Message>}
              stop={live && working && !text.trim() ? { label: t("interrupt"), onClick: () => sendKeys(["esc"]) } : undefined}
            />
          </>
        )}
      </ChatLayout>
      {newFor && (
        <NewSessionDialog
          ctx={ctx}
          machine={newFor}
          defaultCwd={selected?.machineId === newFor.id && selected.cwd ? selected.cwd : "~"}
          onClose={() => setNewFor(null)}
          onStarted={(message) => {
            setNotice({ tone: "ok", text: message });
            void overview.refresh();
          }}
        />
      )}
    </ScreenFrame>
  );
}
