import { Fragment, type ReactNode } from "react";
import { cx } from "@home-dashboard/widget-sdk";

/**
 * Claude の返事（Markdown）を、要素で組んで出す（HTML として流し込まない）。Claude Code の端末とウェブの画面と同じく、
 * 見出し・段落・箇条書き・番号付き・引用・コードの塊・表・区切り線、行の中のコード・太字・斜体・リンク（http(s) だけ）を扱う
 */

type Block =
  | { t: "code"; lang: string; text: string }
  | { t: "heading"; level: number; text: string }
  | { t: "list"; ordered: boolean; start: number; items: string[] }
  | { t: "quote"; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "hr" }
  | { t: "p"; text: string };

const LIST_RE = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+-]*)/);
    if (fence) {
      const close = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(close)) body.push(lines[i++]);
      i++;
      blocks.push({ t: "code", lang: fence[2], text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ t: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ t: "quote", text: body.join("\n") });
      continue;
    }
    const item = line.match(LIST_RE);
    if (item) {
      const ordered = /\d/.test(item[2]);
      const indent = item[1].length;
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i].match(LIST_RE);
        if (current && current[1].length <= indent && /\d/.test(current[2]) === ordered) {
          items.push(current[3]);
          i++;
        } else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length > 0) {
          // 字下げした続き（入れ子の箇条書きも、字下げを残した続きの行として出す）
          items[items.length - 1] += `\n${lines[i].replace(/^\s{0,4}/, "")}`;
          i++;
        } else break;
      }
      blocks.push({
        t: "list",
        ordered,
        start: ordered ? Number.parseInt(item[2], 10) || 1 : 1,
        items,
      });
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*(```|~~~)/.test(lines[i]) &&
      !LIST_RE.test(lines[i]) &&
      !/^\s*>/.test(lines[i])
    )
      body.push(lines[i++]);
    if (body.length === 0) body.push(lines[i++]);
    blocks.push({ t: "p", text: body.join("\n") });
  }
  return blocks;
}

const INLINE_RE =
  /(`+)([^`]+?)\1|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)<>]+)/g;

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

const linkClass = "text-accent-soft underline decoration-accent-soft/40 underline-offset-2 wrap-anywhere";

export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const [whole, , code, bold1, bold2, em, label, href, bare] = match;
    if (code !== undefined) {
      out.push(
        <code key={key++} className="rounded-nav bg-white/8 px-1.5 py-0.5 font-mono wrap-anywhere">
          {code}
        </code>,
      );
    } else if (bold1 !== undefined || bold2 !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold">
          <Inline text={bold1 ?? bold2 ?? ""} />
        </strong>,
      );
    } else if (em !== undefined) {
      out.push(
        <em key={key++}>
          <Inline text={em} />
        </em>,
      );
    } else if (label !== undefined && href !== undefined) {
      const safe = safeHref(href);
      out.push(
        safe ? (
          <a key={key++} className={linkClass} href={safe} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <Fragment key={key++}>{label}</Fragment>
        ),
      );
    } else if (bare !== undefined) {
      const safe = safeHref(bare);
      out.push(
        safe ? (
          <a key={key++} className={linkClass} href={safe} target="_blank" rel="noreferrer">
            {bare}
          </a>
        ) : (
          bare
        ),
      );
    } else out.push(whole);
    last = index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** 改行を残した行の中の文 */
function Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          <Inline text={line} />
        </Fragment>
      ))}
    </>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-title font-bold",
  2: "text-title font-semibold",
  3: "text-body font-semibold",
  4: "text-body font-semibold",
  5: "text-label font-semibold",
  6: "text-label font-semibold text-muted",
};

/** コードの塊（端末の出力・差分にも使う）。横に長い行は送る */
export function CodePre({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cx("untrim max-h-96 min-w-0 overflow-auto rounded-inner border border-glass-border bg-input px-3.5 py-2.5 font-mono text-caption leading-normal whitespace-pre text-text text-shadow-none", className)}
    >
      {children}
    </pre>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="untrim flex min-w-0 flex-col gap-3 text-body leading-normal wrap-anywhere">
      {blocks.map((block, index) => {
        switch (block.t) {
          case "code":
            return <CodePre key={index}>{block.text}</CodePre>;
          case "heading":
            return (
              <p key={index} className={HEADING_CLASS[block.level]} role="heading" aria-level={block.level}>
                <Inline text={block.text} />
              </p>
            );
          case "hr":
            return <hr key={index} className="border-line" />;
          case "quote":
            return (
              <blockquote key={index} className="border-l-2 border-line pl-3 text-muted">
                <Lines text={block.text} />
              </blockquote>
            );
          case "table":
            return (
              <div key={index} className="min-w-0 overflow-x-auto">
                <table className="border-collapse text-label wrap-normal">
                  <thead>
                    <tr>
                      {block.head.map((cell, c) => (
                        <th key={c} className="min-w-24 border-b border-line px-2.5 py-1.5 text-left font-semibold">
                          <Inline text={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} className="min-w-24 border-b border-line/60 px-2.5 py-1.5 align-top">
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag
                key={index}
                start={block.ordered ? block.start : undefined}
                className={
                  (block.ordered ? "list-decimal" : "list-disc") + " flex flex-col gap-1 pl-6 marker:text-muted"
                }
              >
                {block.items.map((item, n) => (
                  <li key={n}>
                    <Lines text={item} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "p":
            return (
              <p key={index}>
                <Lines text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
