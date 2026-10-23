import { useState } from "react";
import { Badge, Check, defineMessages, List, ListItem, Message, Note, SectionTitle } from "@home-dashboard/widget-sdk";
import { Icon } from "./Icon";
import { ToggleSwitch } from "./ExtensionSettings";
import type { GuardSettingsControl, GuardTool, PersonalPolicy, ToolLevel } from "../lib/voiceGuard";

const messages = defineMessages({
  ja: {
    privacy: "声で使うときの守り",
    guest: "ゲストモード",
    guestDetail: "家の人の情報を出さず、やり取りを記録に残しません",
    guestNote: "声で「ゲストモードにして」「ゲストモードを終わって」と言っても切り替えられます。",
    personal: "家の人の情報（メール・予定など）を出すとき",
    personalAll: "いつでも",
    personalAllDetail: "部屋の誰の声でも答える",
    personalScreen: "画面から話しかけたときだけ",
    personalScreenDetail: "ログインしている画面のチャット・マイクからだけ。部屋のマイクとダッシュボード端末では出さない",
    personalNone: "出さない",
    personalNoneDetail: "音声アシスタントでは使わない",
    adminOnly: "変えられるのは管理者だけです。",
    tools: "道具ごとの確かめ",
    toolsNote:
      "音声アシスタントが道具を使う前に、ここで決めた確かめをします。外の人が書いた文（メール・Webページ）を読んだ会話では、「そのまま」の操作にも了承を求めます。ダッシュボードの道具は、拡張機能が決めた段より緩くはできません。",
    dashboardTools: "ダッシュボードの道具",
    builtinTools: "Claude の道具",
    externalTools: "コネクター・MCP の道具（呼ばれたことのあるもの）",
    externalNote: "段を決めていない道具は、読むだけに見える名前でも了承を、それ以外は画面での許可を求めます。",
    noExternal: "まだ呼ばれた道具はありません",
    asDeclared: "既定（{level}）",
    varies: "操作で変わる",
    undecided: "未設定（{level}）",
    personalBadge: "家の人の情報",
    untrustedBadge: "外の文",
    personalCheck: "家の人の情報を返す",
    levelLabel: "{name} の確かめ",
    read: "読むだけ",
    low: "そのまま",
    confirm: "了承を求める",
    approve: "画面で許可",
    deny: "使わせない",
  },
  en: {
    privacy: "Voice safeguards",
    guest: "Guest mode",
    guestDetail: "Hides household info and keeps nothing in the history",
    guestNote: "You can also switch it by voice (“guest mode on / off”).",
    personal: "When to share household info (mail, calendar)",
    personalAll: "Always",
    personalAllDetail: "Answer any voice in the room",
    personalScreen: "Only from a screen",
    personalScreenDetail: "Only from chat or mic on a signed-in screen, not the room mic or dashboard devices",
    personalNone: "Never",
    personalNoneDetail: "Not used by the voice assistant",
    adminOnly: "Only administrators can change this.",
    tools: "Checks per tool",
    toolsNote:
      "Before the voice assistant uses a tool, it runs the check set here. After it reads text written by others (mail, web pages), even “Just do it” actions need a yes. Dashboard tools can't be made looser than their extension declares.",
    dashboardTools: "Dashboard tools",
    builtinTools: "Claude tools",
    externalTools: "Connector & MCP tools (ones used so far)",
    externalNote: "Tools without a setting need a spoken yes if their name looks read-only, otherwise approval on a screen.",
    noExternal: "No tools have been used yet",
    asDeclared: "Default ({level})",
    varies: "depends on the action",
    undecided: "Not set ({level})",
    personalBadge: "Household info",
    untrustedBadge: "Outside text",
    personalCheck: "Returns household info",
    levelLabel: "Check for {name}",
    read: "Read only",
    low: "Just do it",
    confirm: "Ask for a yes",
    approve: "Approve on screen",
    deny: "Don't allow",
  },
});

const LEVELS: ToolLevel[] = ["read", "low", "confirm", "approve", "deny"];
const POLICIES: { id: PersonalPolicy; label: "personalAll" | "personalScreen" | "personalNone"; detail: "personalAllDetail" | "personalScreenDetail" | "personalNoneDetail" }[] = [
  { id: "all", label: "personalAll", detail: "personalAllDetail" },
  { id: "screen", label: "personalScreen", detail: "personalScreenDetail" },
  { id: "none", label: "personalNone", detail: "personalNoneDetail" },
];

function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  return { busy, error, run };
}

/** 音声アシスタントの設定の中の、ゲストモードと家の人の情報の出し方 */
export function VoicePrivacySettings({ guard, isAdmin }: { guard: GuardSettingsControl; isAdmin: boolean }) {
  const t = messages.useT();
  const { busy, error, run } = useRun();
  const settings = guard.settings;
  if (!settings) return null;
  return (
    <>
      <SectionTitle>{t("privacy")}</SectionTitle>
      <ul className="settings-list settings-list--boxed">
        <li>
          <div className="settings-list__row settings-list__row--plain">
            <span className="settings-list__text">
              <span className="settings-list__title">{t("guest")}</span>
              <span className="settings-list__detail">{t("guestDetail")}</span>
            </span>
            <ToggleSwitch
              checked={settings.guest}
              disabled={busy}
              label={t("guest")}
              onChange={() => void run(() => guard.setGuest(!settings.guest))}
            />
          </div>
        </li>
      </ul>
      <Note>{t("guestNote")}</Note>
      <SectionTitle>{t("personal")}</SectionTitle>
      <List boxed label={t("personal")}>
        {POLICIES.map((policy) => (
          <ListItem
            key={policy.id}
            title={t(policy.label)}
            detail={t(policy.detail)}
            selected={settings.personal === policy.id}
            trailing={<Icon name="checkmark" className={settings.personal === policy.id ? undefined : "settings-choice__off"} />}
            chevron={false}
            onClick={isAdmin && !busy ? () => void run(() => guard.save({ personal: policy.id })) : undefined}
          />
        ))}
      </List>
      {!isAdmin && <Note>{t("adminOnly")}</Note>}
      {error && <Message tone="error">{error}</Message>}
    </>
  );
}

/** コネクター・MCP の設定の中の、道具ごとの確かめの段（管理者だけ） */
export function VoiceToolChecks({ guard }: { guard: GuardSettingsControl }) {
  const t = messages.useT();
  const { busy, error, run } = useRun();
  const settings = guard.settings;
  if (!settings) return null;

  const levelName = (level: ToolLevel | "varies" | null) => (level === "varies" ? t("varies") : level ? t(level) : "");

  const update = (tool: GuardTool, change: { level?: ToolLevel | null; personal?: boolean }) => {
    const current = settings.tools[tool.name] ?? {};
    const next = { ...current, ...change };
    if (next.level === null) delete next.level;
    const tools = { ...settings.tools, [tool.name]: next as { level?: ToolLevel; personal?: boolean } };
    if (next.level === undefined && next.personal === undefined) delete tools[tool.name];
    return run(() => guard.save({ tools }));
  };

  /** ダッシュボードの道具は宣言より厳しい段だけ選べる（引数で変わるものは、下限として選ぶ） */
  const choices = (tool: GuardTool): ToolLevel[] => {
    if (tool.kind === "external" || tool.declared === "varies" || tool.declared === null) return LEVELS;
    return LEVELS.slice(LEVELS.indexOf(tool.declared) + 1);
  };

  const renderTool = (tool: GuardTool) => (
    <li key={tool.name} className="voice-guard-tools__item">
      <span className="voice-guard-tools__name" title={tool.name}>
        {tool.label}
      </span>
      <span className="voice-guard-tools__badges">
        {tool.personal && <Badge>{t("personalBadge")}</Badge>}
        {tool.untrusted && <Badge>{t("untrustedBadge")}</Badge>}
      </span>
      <select
        aria-label={t("levelLabel", { name: tool.label })}
        value={tool.override?.level ?? ""}
        disabled={busy}
        onChange={(event) => void update(tool, { level: (event.target.value || null) as ToolLevel | null })}
      >
        <option value="">
          {t(tool.kind === "external" ? "undecided" : "asDeclared", { level: levelName(tool.declared) })}
        </option>
        {choices(tool).map((level) => (
          <option key={level} value={level}>
            {t(level)}
          </option>
        ))}
      </select>
      {tool.kind === "external" && (
        <span className="voice-guard-tools__personal">
          <Check checked={tool.personal} disabled={busy} onChange={(personal) => void update(tool, { personal })}>
            {t("personalCheck")}
          </Check>
        </span>
      )}
    </li>
  );

  const groups: { kind: GuardTool["kind"]; title: "dashboardTools" | "builtinTools" | "externalTools" }[] = [
    { kind: "dashboard", title: "dashboardTools" },
    { kind: "builtin", title: "builtinTools" },
    { kind: "external", title: "externalTools" },
  ];

  return (
    <section className="voice-guard-tools" aria-label={t("tools")}>
      <SectionTitle>{t("tools")}</SectionTitle>
      <Note>{t("toolsNote")}</Note>
      {groups.map(({ kind, title }) => {
        const tools = guard.tools.filter((tool) => tool.kind === kind);
        return (
          <div key={kind}>
            <h5 className="voice-mcp__group">{t(title)}</h5>
            {kind === "external" && <Note>{t("externalNote")}</Note>}
            {tools.length > 0 ? (
              <ul className="voice-mcp__list">{tools.map(renderTool)}</ul>
            ) : (
              <Note>{t("noExternal")}</Note>
            )}
          </div>
        );
      })}
      {error && <Message tone="error">{error}</Message>}
    </section>
  );
}
