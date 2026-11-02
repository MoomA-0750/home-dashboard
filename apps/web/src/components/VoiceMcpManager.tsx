import { useState, type FormEvent } from "react";
import type { McpCatalogServer, McpSettingsInput, VoiceMcpControl } from "../lib/voiceMcp";
import {
  Badge,
  Button,
  cx,
  defineMessages,
  formatClock,
  formatDate,
  IconButton,
  inputClass,
  List,
  ListItem,
  type Locale,
  Message,
  Note,
  SectionTitle,
  ToggleSwitch,
  useLocale,
} from "@home-dashboard/widget-sdk";

const messages = defineMessages({
  ja: {
    needsAuth: "要認証",
    failed: "接続できません",
    use: "{name}を使う",
    dontUse: "{name}を使わない",
    projectScoped: "このホストのプロジェクト単位の登録なので使えません",
    sectionLabel: "Claude が使うコネクター・MCP",
    note: "部屋にいる人なら誰でも声で使えます。どの道具も、使う前に下の「道具ごとの確かめ」で決めた確かめをします（決めていない道具は、了承か画面での許可が要ります）。変えると次の返答から使われます（会話は引き継ぎます）。",
    scanning: "調べています…",
    refresh: "一覧を更新",
    agentDown: "音声エージェントが起動していません",
    asOf: "{time} 時点",
    scanningList: "一覧を調べています…",
    catalogError: "一覧が取れませんでした: {error}",
    connectors: "claude.ai のコネクター",
    locals: "このホストの Claude Code に登録済み",
    missing: "一覧に無いもの（使われません）",
    custom: "URL で追加した MCP サーバー",
    hasToken: "トークンあり",
    remove: "{name} を外す",
    namePlaceholder: "名前（英数字）",
    nameLabel: "MCP サーバーの名前",
    urlLabel: "MCP サーバーの URL",
    tokenPlaceholder: "トークン（任意）",
    tokenLabel: "MCP サーバーのトークン（Bearer）",
    add: "追加",
  },
  en: {
    needsAuth: "Needs sign-in",
    failed: "Can't connect",
    use: "Use {name}",
    dontUse: "Stop using {name}",
    projectScoped: "Unavailable: registered per project on this host",
    sectionLabel: "Connectors & MCP used by Claude",
    note: "Anyone in the room can use these by voice. Every tool goes through the check set in “Checks per tool” below before it runs (tools without a setting need a yes or approval on a screen). Changes apply from the next reply (the conversation continues).",
    scanning: "Scanning…",
    refresh: "Refresh list",
    agentDown: "The voice agent isn't running",
    asOf: "As of {time}",
    scanningList: "Scanning…",
    catalogError: "Couldn't get the list: {error}",
    connectors: "claude.ai connectors",
    locals: "Registered in Claude Code on this host",
    missing: "Not in the list (not used)",
    custom: "MCP servers added by URL",
    hasToken: "Token",
    remove: "Remove {name}",
    namePlaceholder: "Name (letters and numbers)",
    nameLabel: "MCP server name",
    urlLabel: "MCP server URL",
    tokenPlaceholder: "Token (optional)",
    tokenLabel: "MCP server token (Bearer)",
    add: "Add",
  },
});

const STATUS_LABELS = {
  connected: null,
  "needs-auth": "needsAuth",
  failed: "failed",
} as const satisfies Record<McpCatalogServer["status"], string | null>;

function formatTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const day = formatDate(date, "monthDay", locale);
  return `${day}${locale === "ja" ? " " : ", "}${formatClock(date, locale)}`;
}

/**
 * 音声アシスタントの Claude に使わせるコネクター（claude.ai でつないだもの）・MCPサーバーを選ぶ。
 * 一覧はホストの音声エージェントが調べたもので、選んだものはすぐ保存され、エージェントが Claude を起動し直して使い始める。
 */
export function VoiceMcpManager({ mcp }: { mcp: VoiceMcpControl }) {
  const t = messages.useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", url: "", token: "" });
  const state = mcp.state;
  if (!state) return null;

  const servers = state.catalog?.servers ?? [];
  const connectors = servers.filter((s) => s.kind === "connector");
  const locals = servers.filter((s) => s.kind === "local");
  // 選んであるのに一覧に無いもの（コネクターを外した・一覧を取る前）
  const missing = state.catalog ? state.enabled.filter((name) => !servers.some((s) => s.name === name)) : [];
  // トークンは省くと保存済みのものが引き継がれる
  const current: McpSettingsInput = {
    enabled: state.enabled,
    custom: state.custom.map(({ name, url }) => ({ name, url })),
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (name: string) =>
    run(() =>
      mcp.save({
        ...current,
        enabled: state.enabled.includes(name) ? state.enabled.filter((n) => n !== name) : [...state.enabled, name],
      }),
    );

  const addCustom = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || !url) return;
    void run(async () => {
      await mcp.save({ ...current, custom: [...current.custom, { name, url, token: draft.token.trim() }] });
      setDraft({ name: "", url: "", token: "" });
    });
  };

  const removeCustom = (name: string) =>
    run(() => mcp.save({ ...current, custom: current.custom.filter((c) => c.name !== name) }));

  const renderServer = (server: McpCatalogServer) => {
    const statusKey = STATUS_LABELS[server.status];
    const status = statusKey && t(statusKey);
    const label = server.kind === "connector" ? server.name.replace(/^claude\.ai /, "") : server.name;
    return (
      <ListItem
        key={server.name}
        title={label}
        detail={<span title={server.target}>{server.available ? server.target : t("projectScoped")}</span>}
        off={!server.available}
        trailing={
          <>
            {status && <Badge tone="warn">{status}</Badge>}
            <ToggleSwitch
              checked={state.enabled.includes(server.name)}
              disabled={busy || !server.available}
              label={t(state.enabled.includes(server.name) ? "dontUse" : "use", { name: label })}
              onChange={() => void toggle(server.name)}
            />
          </>
        }
      />
    );
  };

  return (
    <section aria-label={t("sectionLabel")}>
      <Note>{t("note")}</Note>
      <div className="flex items-center gap-2.5 text-note text-muted">
        <Button icon="arrow-sync" disabled={busy || state.scanning || !state.connected} onClick={() => void run(mcp.scan)}>
          {state.scanning ? t("scanning") : t("refresh")}
        </Button>
        <span>
          {!state.connected
            ? t("agentDown")
            : state.catalog?.scannedAt
              ? t("asOf", { time: formatTime(state.catalog.scannedAt, locale) })
              : t("scanningList")}
        </span>
      </div>
      {state.catalog?.error && <Message tone="error">{t("catalogError", { error: state.catalog.error })}</Message>}

      {connectors.length > 0 && (
        <>
          <SectionTitle>{t("connectors")}</SectionTitle>
          <List boxed label={t("connectors")}>
            {connectors.map(renderServer)}
          </List>
        </>
      )}
      {locals.length > 0 && (
        <>
          <SectionTitle>{t("locals")}</SectionTitle>
          <List boxed label={t("locals")}>
            {locals.map(renderServer)}
          </List>
        </>
      )}
      {missing.length > 0 && (
        <>
          <SectionTitle>{t("missing")}</SectionTitle>
          <List boxed label={t("missing")}>
            {missing.map((name) => (
              <ListItem
                key={name}
                title={name}
                trailing={
                  <ToggleSwitch checked disabled={busy} label={t("dontUse", { name })} onChange={() => void toggle(name)} />
                }
              />
            ))}
          </List>
        </>
      )}

      <SectionTitle>{t("custom")}</SectionTitle>
      {state.custom.length > 0 && (
        <List boxed label={t("custom")}>
          {state.custom.map((server) => (
            <ListItem
              key={server.name}
              title={server.name}
              detail={<span title={server.url}>{server.url}</span>}
              trailing={
                <>
                  {server.hasToken && <Badge>{t("hasToken")}</Badge>}
                  <IconButton
                    icon="delete"
                    label={t("remove", { name: server.name })}
                    disabled={busy}
                    onClick={() => void removeCustom(server.name)}
                  />
                </>
              }
            />
          ))}
        </List>
      )}
      <form className="grid grid-cols-3 gap-1.5" onSubmit={addCustom}>
        <input
          type="text"
          className={inputClass}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder={t("namePlaceholder")}
          aria-label={t("nameLabel")}
          pattern="[A-Za-z0-9_\-]{1,40}"
        />
        <input
          type="url"
          className={cx(inputClass, "col-span-2")}
          value={draft.url}
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
          placeholder="https://…/mcp"
          aria-label={t("urlLabel")}
        />
        <input
          type="password"
          className={inputClass}
          value={draft.token}
          onChange={(event) => setDraft({ ...draft, token: event.target.value })}
          placeholder={t("tokenPlaceholder")}
          aria-label={t("tokenLabel")}
          autoComplete="off"
        />
        <Button type="submit" className="col-span-2 justify-self-start" disabled={busy || !draft.name.trim() || !draft.url.trim()}>
          {t("add")}
        </Button>
      </form>
      {error && <Message tone="error">{error}</Message>}
    </section>
  );
}
