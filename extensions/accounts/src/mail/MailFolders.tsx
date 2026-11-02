import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cx, defineMessages, Icon, IconButton, List, ListItem, motionMs, reducedMotion, SectionTitle, type IconName } from "@home-dashboard/widget-sdk";
import { MAIL_FOLDERS, type FolderKey, type MailboxFolder, type MailFolder } from "./types";

/**
 * Mail 画面の左の欄。上に決まったフォルダー（受信箱・送信済みなど）、下に自分で作ったメールボックスをツリーで並べる
 * （「etc/Amazon」は「etc」の下に「Amazon」）。子のあるものは右の矢印で開け閉めし、開いているものは端末に覚える。
 * 開くと子が親の行の下から、いちばん下の子を先頭に引き出され、閉じると上の子から順に親の行の下へ戻る（packages/ui/src/theme/media-accounts.css の mail-tree-entering・closing）
 */

// 子を1つずつずらす間（開く・閉じる）と、その合計の上限（子が多くても待たせない）
const STAGGER_IN_MS = 35;
const STAGGER_OUT_MS = 22;
const STAGGER_TOTAL_MS = 240;

/** フォルダーの行の頭のアイコン（淡い色の角丸の四角） */
function FolderIcon({ icon }: { icon: IconName }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-nav bg-accent-soft/18 text-title">
      <Icon name={icon} />
    </span>
  );
}

function staggers(count: number) {
  if (reducedMotion()) return { inMs: 0, outMs: 0 };
  const steps = Math.max(count - 1, 1);
  return { inMs: Math.min(STAGGER_IN_MS, STAGGER_TOTAL_MS / steps), outMs: Math.min(STAGGER_OUT_MS, STAGGER_TOTAL_MS / steps) };
}

const messages = defineMessages({
  ja: {
    folders: "フォルダー",
    mailboxFolders: "メールボックス",
    folder_inbox: "受信箱",
    folder_sent: "送信済み",
    folder_drafts: "下書き",
    folder_junk: "迷惑メール",
    folder_trash: "ゴミ箱",
    expand: "{name}を開く",
    collapse: "{name}を閉じる",
  },
  en: {
    folders: "Folders",
    mailboxFolders: "Mailboxes",
    folder_inbox: "Inbox",
    folder_sent: "Sent",
    folder_drafts: "Drafts",
    folder_junk: "Junk",
    folder_trash: "Trash",
    expand: "Expand {name}",
    collapse: "Collapse {name}",
  },
});

export const folderMessages = messages;

export const FOLDER_ICONS: Record<MailFolder, IconName> = {
  inbox: "inbox",
  sent: "send",
  drafts: "drafts",
  junk: "junk",
  trash: "delete",
};

/** 読んでいるフォルダー。自分で作ったメールボックスなら、そのアカウント */
export interface FolderChoice {
  key: FolderKey;
  mailboxId: string | null;
}

interface TreeNode {
  name: string;
  /** そのものがメールボックスか（途中の段だけのこともある） */
  folder: MailboxFolder | null;
  children: TreeNode[];
  /** 開け閉めを覚えるキー */
  id: string;
}

export function buildTree(folders: MailboxFolder[]): TreeNode[] {
  const root: TreeNode = { name: "", folder: null, children: [], id: "" };
  for (const folder of folders) {
    let node = root;
    folder.path.forEach((name, depth) => {
      let child = node.children.find((c) => c.name === name);
      if (!child) {
        child = { name, folder: null, children: [], id: `${folder.mailboxId}/${folder.path.slice(0, depth + 1).join("/")}` };
        node.children.push(child);
      }
      node = child;
    });
    node.folder = folder;
  }
  return root.children;
}

const STORAGE_KEY = "home-dashboard:mail-open-folders";

function readOpen(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function MailFolders({
  folders,
  groupName,
  current,
  unreadInbox,
  onChoose,
}: {
  folders: MailboxFolder[];
  /** アカウントごとにまとめるときの見出し（1つのアカウントだけなら null） */
  groupName: ((mailboxId: string) => string) | null;
  current: FolderChoice;
  unreadInbox: number;
  onChoose: (choice: FolderChoice) => void;
}) {
  const t = messages.useT();
  const [open, setOpen] = useState(readOpen);
  // 閉じている途中（吸い込まれる動きが終わるまで、子を出したままにする）
  const [closing, setClosing] = useState<Set<string>>(new Set());
  // 開いて、出てくる途中のもの（開き直した画面で、覚えていて開いているものまで動かさない）
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 開け閉めした段より下の行（とアカウントの見出し）も、子と一緒に滑らかに上下させる。高さは動かさず、行ごとの transform で動かす
  const rootRef = useRef<HTMLDivElement>(null);
  // 開く: 子を出す前の、下の行の位置（出したあとに、そこから今の位置へ動かす）
  const beforeOpen = useRef<{ rows: Map<HTMLElement, number>; durationMs: number } | null>(null);
  // 閉じる: 上げておいた下の行（子を外したあとに、動かさずに transform を外す）
  const lifted = useRef(new Map<string, HTMLElement[]>());
  const settle = useRef<HTMLElement[] | null>(null);

  const followingRows = (id: string): HTMLElement[] => {
    const root = rootRef.current;
    const node = root?.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    if (!root || !node) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("[data-tree-row]")).filter(
      (el) => !node.contains(el) && Boolean(node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
  };

  useLayoutEffect(() => {
    const opening = beforeOpen.current;
    if (opening) {
      beforeOpen.current = null;
      for (const [el, top] of opening.rows) {
        const delta = top - el.getBoundingClientRect().top;
        if (!delta || opening.durationMs === 0) continue;
        // 前の位置に置いてから、いちばん下の子と同じ速さで今の位置へ
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;
        void el.getBoundingClientRect();
        el.style.transition = `transform ${opening.durationMs}ms var(--ease-out)`;
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), opening.durationMs);
      }
    }
    const rows = settle.current;
    if (rows) {
      // 子が外れて、行が上げておいた位置へ詰まった。動かさずに transform を外す
      settle.current = null;
      for (const el of rows) {
        el.style.transition = "none";
        el.style.transform = "";
        void el.getBoundingClientRect();
        el.style.transition = "";
      }
    }
  });

  const persist = (next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // 覚えられなくても、開け閉めはできる
    }
  };
  const toggle = (id: string, childCount: number) => {
    const timer = timers.current.get(id);
    if (closing.has(id)) {
      // 閉じている途中にもう一度押したら、開いたままに戻す（上げていた下の行も戻す）
      clearTimeout(timer);
      timers.current.delete(id);
      for (const el of lifted.current.get(id) ?? []) {
        el.style.transition = `transform ${motionMs("base")}ms var(--ease-out)`;
        el.style.transform = "";
      }
      lifted.current.delete(id);
      setClosing((c) => new Set([...c].filter((x) => x !== id)));
      return;
    }
    if (!open.has(id)) {
      // いちばん下の子は遅れずに出て、motion-slow で止まる。下の行もそれに合わせる
      beforeOpen.current = {
        rows: new Map(followingRows(id).map((el) => [el, el.getBoundingClientRect().top])),
        durationMs: motionMs("slow"),
      };
      setOpened((o) => new Set(o).add(id));
      // 出終わったら「動いている間」の印を外す（子の欄の上端で切るのをやめる）
      const { inMs } = staggers(childCount);
      clearTimeout(timer);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setOpened((o) => new Set([...o].filter((x) => x !== id)));
        }, motionMs("slow") + inMs * Math.max(childCount - 1, 0)),
      );
      const next = new Set(open).add(id);
      setOpen(next);
      persist(next);
      return;
    }
    setClosing((c) => new Set(c).add(id));
    const { outMs } = staggers(childCount);
    const total = motionMs("base") + outMs * Math.max(childCount - 1, 0);
    // 下の行を、子の欄の高さだけ上げる。いちばん下の子（最後に戻る）と同じ遅れ・時間・動き方で、そのすぐ下に付いていく
    const node = rootRef.current?.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    const children = node?.querySelector<HTMLElement>(":scope > [data-tree-children]");
    if (children) {
      const height = children.getBoundingClientRect().height + parseFloat(getComputedStyle(children).marginTop);
      const rows = followingRows(id);
      for (const el of rows) {
        el.style.transition = `transform ${motionMs("base")}ms var(--ease-in) ${outMs * Math.max(childCount - 1, 0)}ms`;
        el.style.transform = `translateY(${-height}px)`;
      }
      lifted.current.set(id, rows);
    }
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        settle.current = [...(settle.current ?? []), ...(lifted.current.get(id) ?? [])];
        lifted.current.delete(id);
        setClosing((c) => new Set([...c].filter((x) => x !== id)));
        setOpened((o) => new Set([...o].filter((x) => x !== id)));
        setOpen((current) => {
          const next = new Set(current);
          next.delete(id);
          persist(next);
          return next;
        });
      }, total),
    );
  };

  const groups = new Map<string, MailboxFolder[]>();
  for (const f of folders) groups.set(f.mailboxId, [...(groups.get(f.mailboxId) ?? []), f]);

  const renderNodes = (nodes: TreeNode[]) => (
    <List>
      {nodes.map((node, index) => {
        const isOpen = open.has(node.id) && !closing.has(node.id);
        const shown = open.has(node.id);
        const count = node.children.length;
        const { inMs, outMs } = staggers(count);
        const folder = node.folder;
        const selected = folder !== null && current.key === folder.id && current.mailboxId === folder.mailboxId;
        return (
          <li key={node.id} data-node-id={node.id} style={{ "--i": index } as CSSProperties}>
            <ul data-tree-row>
              <ListItem
                leading={<FolderIcon icon="mail" />}
                title={node.name}
                selected={selected}
                chevron={false}
                onClick={() => (folder ? onChoose({ key: folder.id as FolderKey, mailboxId: folder.mailboxId }) : toggle(node.id, count))}
                trailing={
                  node.children.length > 0 ? (
                    // 開け閉めの矢印は、開くと下を向く。行の高さを変えないよう小さくし、外の余白を詰める
                    <IconButton
                      icon="chevron-right"
                      label={t(isOpen ? "collapse" : "expand", { name: node.name })}
                      aria-expanded={isOpen}
                      className={cx(
                        "-my-1.5 -mr-1.5 size-8 text-muted hover:bg-tint/8",
                        "[&_.fluent-icon]:transition-transform [&_.fluent-icon]:duration-(--motion-fast) [&_.fluent-icon]:ease-standard",
                        isOpen && "[&_.fluent-icon]:rotate-90",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(node.id, count);
                      }}
                    />
                  ) : undefined
                }
              />
            </ul>
            {shown && count > 0 && (
              <div
                data-tree-children
                className={cx(
                  "mt-1.5 pl-5 [&>ul]:mb-0",
                  opened.has(node.id) && "mail-tree-entering",
                  closing.has(node.id) && "mail-tree-closing",
                )}
                style={{ "--n": count, "--stagger-in": `${inMs}ms`, "--stagger-out": `${outMs}ms` } as CSSProperties}
              >
                {renderNodes(node.children)}
              </div>
            )}
          </li>
        );
      })}
    </List>
  );

  return (
    <div ref={rootRef}>
      <List label={t("folders")}>
        {MAIL_FOLDERS.map((f) => (
          <ListItem
            key={f}
            leading={<FolderIcon icon={FOLDER_ICONS[f]} />}
            title={t(`folder_${f}`)}
            badge={f === "inbox" && unreadInbox > 0 ? String(unreadInbox) : undefined}
            selected={current.key === f}
            chevron={false}
            onClick={() => onChoose({ key: f, mailboxId: null })}
          />
        ))}
      </List>
      {[...groups].map(([mailboxId, list]) => (
        <section key={mailboxId} className="[&>ul]:mb-0">
          {/* アカウントの見出しも、開け閉めした段より下なら行と一緒に動かす */}
          <div data-tree-row>
            <SectionTitle>{groupName ? groupName(mailboxId) : t("mailboxFolders")}</SectionTitle>
          </div>
          {renderNodes(buildTree(list))}
        </section>
      ))}
    </div>
  );
}
