import { useState, type ReactNode } from "react";
import { ChatBubble, ChatMeta, ChatRow, cx, formatClock, Icon, useLocale } from "@home-dashboard/widget-sdk";
import { strings } from "./i18n";
import { CodePre, Markdown } from "./Markdown";
import type { LogItem } from "./types";

/**
 * セッションのやり取りを、Claude Code（端末とウェブ）と同じ並びで出す。
 * - あなたの指示は右の吹き出し、Claude の返事は左に Markdown のまま（吹き出しにしない）
 * - ツールの呼び出しは1行（● 名前 中身の要約）。押すと入力と結果が開く。結果は呼び出しの id で組にする
 * - 考えたことは畳んだ1行、会話の要約などの区切りは線
 */

type ToolItem = Extract<LogItem, { k: "tool" }>;
type ResultItem = Extract<LogItem, { k: "result" }>;

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** 作業フォルダの下なら、相手のフォルダからの道にする */
function shortPath(path: string, cwd: string | null): string {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  return path;
}

/** ツールの1行に出す要約（Claude Code の「Bash(git status)」の括弧の中にあたるもの） */
export function toolSummary(item: ToolItem, cwd: string | null): string {
  const input = item.input ?? {};
  switch (item.name) {
    case "Bash":
      return str(input.command).split("\n")[0];
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return shortPath(str(input.file_path) || str(input.notebook_path), cwd);
    case "Grep":
    case "Glob":
      return [str(input.pattern), str(input.path) && shortPath(str(input.path), cwd)].filter(Boolean).join(" · ");
    case "WebFetch":
      return str(input.url);
    case "WebSearch":
      return str(input.query);
    case "Task":
    case "Agent":
      return str(input.description) || str(input.subagent_type);
    case "TodoWrite":
      return Array.isArray(input.todos) ? strings.t("todoCount", { n: input.todos.length }) : "";
    case "Skill":
      return str(input.skill);
    default: {
      const first = Object.values(input).find((v) => typeof v === "string" && v.trim());
      return typeof first === "string" ? first.split("\n")[0] : "";
    }
  }
}

/** mcp__server__tool は「server · tool」にする */
export function toolName(name: string): string {
  const mcp = name.match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/);
  return mcp ? `${mcp[1]} · ${mcp[2]}` : name;
}

/** 指示に入るスラッシュコマンドの印（<command-name> など）を、打った形（/name 引数）に戻す */
export function promptText(text: string): { text: string; output: string | null } {
  const name = text.match(/<command-name>([^<]*)<\/command-name>/)?.[1];
  const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1];
  const output = text.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/)?.[1];
  if (name) return { text: `${name.startsWith("/") ? name : `/${name}`}${args ? ` ${args}` : ""}`, output: null };
  if (output !== undefined) return { text: "", output: output.trim() };
  return { text: text.replace(/<command-message>[\s\S]*?<\/command-message>\s*/g, "").trim(), output: null };
}

function Time({ ts }: { ts?: string }) {
  const locale = useLocale();
  if (!ts) return null;
  const date = new Date(ts);
  return <ChatMeta title={date.toLocaleString()}>{formatClock(date, locale)}</ChatMeta>;
}

function Diff({ before, after }: { before: string; after: string }) {
  const lines = [
    ...before.split("\n").map((line) => ({ sign: "-", line })),
    ...after.split("\n").map((line) => ({ sign: "+", line })),
  ];
  return (
    <CodePre>
      {lines.map(({ sign, line }, index) => (
        <span key={index} className={cx("block", sign === "-" ? "bg-danger/14" : "bg-ok/14")}>
          {sign} {line}
        </span>
      ))}
    </CodePre>
  );
}

function ToolInput({ item }: { item: ToolItem }) {
  const t = strings.useT();
  const input = item.input ?? {};
  if (item.name === "Edit") return <Diff before={str(input.old_string)} after={str(input.new_string)} />;
  if (item.name === "MultiEdit" && Array.isArray(input.edits)) {
    return (
      <div className="flex flex-col gap-2">
        {(input.edits as Record<string, unknown>[]).map((edit, index) => (
          <Diff key={index} before={str(edit.old_string)} after={str(edit.new_string)} />
        ))}
      </div>
    );
  }
  if (item.name === "Write") return <CodePre>{str(input.content)}</CodePre>;
  if (item.name === "Bash") return <CodePre>{str(input.command)}</CodePre>;
  if (item.name === "TodoWrite" && Array.isArray(input.todos)) {
    return (
      <ul className="flex flex-col gap-1 text-label">
        {(input.todos as Record<string, unknown>[]).map((todo, index) => (
          <li key={index} className={cx("flex items-start gap-2", todo.status === "completed" && "text-muted line-through")}>
            <Icon
              name={todo.status === "completed" ? "checkmark" : todo.status === "in_progress" ? "arrow-sync" : "chevron-right"}
              className="mt-0.5 size-rem-4 shrink-0"
            />
            <span>{str(todo.content) || str(todo.activeForm)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-medium text-muted">{t("input")}</span>
      <CodePre>{JSON.stringify(input, null, 2)}</CodePre>
    </div>
  );
}

function ToolRow({ item, result, running, cwd }: { item: ToolItem; result?: ResultItem; running: boolean; cwd: string | null }) {
  const t = strings.useT();
  const [open, setOpen] = useState(false);
  const summary = toolSummary(item, cwd);
  const failed = result?.error === true;
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        className="press-wide flex min-w-0 cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1 text-left text-label hover:bg-white/6"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cx(
            "size-2 shrink-0 rounded-full",
            failed ? "bg-danger" : result ? "bg-ok" : running ? "bg-warn" : "bg-muted opacity-60",
          )}
          aria-label={failed ? t("toolFailed") : result ? undefined : running ? t("running") : undefined}
        />
        <span className="shrink-0 font-semibold">{toolName(item.name)}</span>
        {summary && <span className="ellipsis min-w-0 flex-1 font-mono text-note text-muted">{summary}</span>}
        <Icon name={open ? "chevron-up" : "chevron-down"} className="ml-auto size-rem-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="ml-4.5 flex min-w-0 flex-col gap-2 border-l border-line pl-3">
          <ToolInput item={item} />
          {result && (
            <div className="flex min-w-0 flex-col gap-1">
              <span className={cx("text-caption font-medium", failed ? "text-danger" : "text-muted")}>
                {failed ? t("toolFailed") : t("output")}
                {result.images > 0 && ` · ${t("images", { n: result.images })}`}
              </span>
              <CodePre>{result.text || t("noOutput")}</CodePre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Thinking({ text }: { text: string }) {
  const t = strings.useT();
  const [open, setOpen] = useState(false);
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        className="press-wide flex cursor-pointer items-center gap-2.5 rounded-inner px-2 py-1 text-left text-label text-muted italic hover:bg-white/6"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="sparkle" className="size-rem-4 shrink-0" />
        {t("thinking")}
        <Icon name={open ? "chevron-up" : "chevron-down"} className="ml-auto size-rem-4 shrink-0 opacity-50" />
      </button>
      {open && <p className="ml-4.5 border-l border-line pl-3 text-label leading-normal whitespace-pre-wrap text-muted untrim">{text}</p>}
    </li>
  );
}

/** ツールの呼び出しと考えたことの続き（返事の文の間）を、1つのまとまりにする */
function Steps({ children }: { children: ReactNode }) {
  return (
    <li className="w-full min-w-0">
      <ol className="flex min-w-0 list-none flex-col gap-0.5">{children}</ol>
    </li>
  );
}

export function Transcript({ items, cwd, working }: { items: LogItem[]; cwd: string | null; working: boolean }) {
  const t = strings.useT();
  const results = new Map<string, ResultItem>();
  for (const item of items) if (item.k === "result") results.set(item.id, item);
  const lastToolIndex = items.reduce((last, item, index) => (item.k === "tool" ? index : last), -1);

  const out: ReactNode[] = [];
  let steps: ReactNode[] = [];
  const flush = () => {
    if (steps.length > 0) out.push(<Steps key={`steps-${out.length}`}>{steps}</Steps>);
    steps = [];
  };

  items.forEach((item, index) => {
    switch (item.k) {
      case "user": {
        flush();
        const prompt = promptText(item.text);
        if (prompt.output !== null) {
          out.push(
            <li key={item.id} className="w-full min-w-0">
              <CodePre>{prompt.output || t("noOutput")}</CodePre>
            </li>,
          );
          break;
        }
        out.push(
          <ChatRow key={item.id} mine gap>
            <ChatBubble mine>
              {prompt.text}
              {item.images > 0 && <span className="mt-1 block text-note text-muted">{t("images", { n: item.images })}</span>}
            </ChatBubble>
            <Time ts={item.ts} />
          </ChatRow>,
        );
        break;
      }
      case "assistant":
        flush();
        out.push(
          <li key={item.id} className="mb-2 w-full min-w-0 px-2">
            <Markdown text={item.text} />
          </li>,
        );
        break;
      case "thinking":
        steps.push(<Thinking key={item.id} text={item.text} />);
        break;
      case "tool":
        steps.push(
          <ToolRow
            key={item.id}
            item={item}
            result={results.get(item.id)}
            running={working && index === lastToolIndex}
            cwd={cwd}
          />,
        );
        break;
      case "result":
        break;
      case "system":
        flush();
        out.push(
          <li key={item.id} className="my-2 flex items-center gap-3 text-caption text-muted" role="separator">
            <span className="h-px flex-1 bg-line" />
            {item.subtype === "compact_boundary" ? t("compacted") : item.text || t("systemError")}
            <span className="h-px flex-1 bg-line" />
          </li>,
        );
        break;
    }
  });
  flush();
  return <>{out}</>;
}
