import { useState, type FormEvent } from "react";
import type { McpCatalogServer, McpSettingsInput, VoiceMcpControl } from "../lib/voiceMcp";
import { ToggleSwitch } from "./ExtensionSettings";
import { Icon } from "./Icon";
import { Badge, defineMessages, formatClock, formatDate, useLocale, type Locale } from "@home-dashboard/widget-sdk";

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
      <li key={server.name} className={`voice-mcp__item${server.available ? "" : " voice-mcp__item--disabled"}`}>
        <span className="voice-mcp__name">{label}</span>
        {status && <Badge tone="warn">{status}</Badge>}
        <ToggleSwitch
          checked={state.enabled.includes(server.name)}
          disabled={busy || !server.available}
          label={t(state.enabled.includes(server.name) ? "dontUse" : "use", { name: label })}
          onChange={() => void toggle(server.name)}
        />
        <span className="voice-mcp__target" title={server.target}>
          {server.available ? server.target : t("projectScoped")}
        </span>
      </li>
    );
  };

  return (
    <section className="voice-mcp" aria-label={t("sectionLabel")}>
      <p className="voice-mcp__note">{t("note")}</p>
      <div className="voice-mcp__toolbar">
        <button type="button" disabled={busy || state.scanning || !state.connected} onClick={() => void run(mcp.scan)}>
          <Icon name="arrow-sync" />
          <span>{state.scanning ? t("scanning") : t("refresh")}</span>
        </button>
        <span className="voice-mcp__scanned">
          {!state.connected
            ? t("agentDown")
            : state.catalog?.scannedAt
              ? t("asOf", { time: formatTime(state.catalog.scannedAt, locale) })
              : t("scanningList")}
        </span>
      </div>
      {state.catalog?.error && (
        <p className="settings-panel__voice-error">{t("catalogError", { error: state.catalog.error })}</p>
      )}

      {connectors.length > 0 && (
        <>
          <h5 className="voice-mcp__group">{t("connectors")}</h5>
          <ul className="voice-mcp__list">{connectors.map(renderServer)}</ul>
        </>
      )}
      {locals.length > 0 && (
        <>
          <h5 className="voice-mcp__group">{t("locals")}</h5>
          <ul className="voice-mcp__list">{locals.map(renderServer)}</ul>
        </>
      )}
      {missing.length > 0 && (
        <>
          <h5 className="voice-mcp__group">{t("missing")}</h5>
          <ul className="voice-mcp__list">
            {missing.map((name) => (
              <li key={name} className="voice-mcp__item">
                <span className="voice-mcp__name">{name}</span>
                <ToggleSwitch checked disabled={busy} label={t("dontUse", { name })} onChange={() => void toggle(name)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h5 className="voice-mcp__group">{t("custom")}</h5>
      {state.custom.length > 0 && (
        <ul className="voice-mcp__list">
          {state.custom.map((server) => (
            <li key={server.name} className="voice-mcp__item">
              <span className="voice-mcp__name">{server.name}</span>
              {server.hasToken && <Badge>{t("hasToken")}</Badge>}
              <button
                type="button"
                className="voice-mcp__remove"
                aria-label={t("remove", { name: server.name })}
                disabled={busy}
                onClick={() => void removeCustom(server.name)}
              >
                <Icon name="delete" />
              </button>
              <span className="voice-mcp__target" title={server.url}>
                {server.url}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="voice-mcp__form" onSubmit={addCustom}>
        <input
          type="text"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder={t("namePlaceholder")}
          aria-label={t("nameLabel")}
          pattern="[A-Za-z0-9_\-]{1,40}"
        />
        <input
          type="url"
          value={draft.url}
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
          placeholder="https://…/mcp"
          aria-label={t("urlLabel")}
        />
        <input
          type="password"
          value={draft.token}
          onChange={(event) => setDraft({ ...draft, token: event.target.value })}
          placeholder={t("tokenPlaceholder")}
          aria-label={t("tokenLabel")}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !draft.name.trim() || !draft.url.trim()}>
          {t("add")}
        </button>
      </form>
      {error && <p className="settings-panel__voice-error">{error}</p>}
    </section>
  );
}
