import { useEffect, useState } from "react";
import {
  defineMessages,
  formatDate,
  formatTime,
  List,
  ListItem,
  LOCALES,
  Message,
  Note,
  textFor,
  useDisplay,
  useLocale,
  type DisplaySettings,
  type SettingsLink,
  type WidgetRuntimeContext,
} from "@home-dashboard/widget-sdk";
import { chooseDisplay, chooseLocale } from "../lib/locale";
import type {
  PersonaImportResult,
  VoicePersonas,
  VoiceSnapshot,
} from "../lib/useVoiceAssistant";
import type { VoiceMcpControl } from "../lib/voiceMcp";
import { useGuardSettings, type GuardSettingsControl } from "../lib/voiceGuard";
import { VoicePrivacySettings, VoiceToolChecks } from "./VoiceGuardSettings";
import { ErrorBoundary } from "./ErrorBoundary";
import { PersonaManager } from "./PersonaManager";
import { VoiceMcpManager } from "./VoiceMcpManager";
import { AccountSettings } from "./AccountSettings";
import { ExtensionSettings, ToggleSwitch } from "./ExtensionSettings";
import type { LoadedExtensions } from "../lib/extensions";
import type { Account } from "../lib/auth";
import { Icon, type IconName } from "./Icon";
import { WallpaperSettings } from "./WallpaperSettings";
import type { WallpaperInfo } from "../lib/useWallpaper";

interface SettingsPanelProps {
  /** 拡張機能が足した設定のページに渡す */
  ctx: WidgetRuntimeContext;
  /** 最初に開くページ（URL で指定されたとき） */
  initialPage?: string | null;
  /** ほかの所から開くよう頼まれたページ（openSettings） */
  link?: SettingsLink | null;
  editMode: boolean;
  onToggleEditMode: () => void;
  onOpenWidgetPicker: () => void;
  voice: VoiceSnapshot | null;
  onSetPersonaEnabled: (personaId: string, enabled: boolean) => Promise<void>;
  personas: VoicePersonas | null;
  onSelectDefaultPersona: (personaId: string) => Promise<void>;
  onImportPersona: (file: File, replace: boolean) => Promise<PersonaImportResult>;
  onDeletePersona: (personaId: string) => Promise<void>;
  personaExportUrl: (personaId: string) => string;
  avatarUrlFor: (personaId: string) => string | null;
  apiBaseUrl: string;
  /** サーバーにVRMアバターが置かれているか（置かれていなければ切り替えを出さない） */
  avatarAvailable: boolean;
  avatarEnabled: boolean;
  onToggleAvatar: () => void;
  mcp: VoiceMcpControl;
  account: Account;
  sessionId: string;
  extensions: LoadedExtensions;
  wallpaper: WallpaperInfo | null;
  onWallpaperChange: (info: WallpaperInfo) => void;
  onSignedOut: () => void;
}

/** 本体の項目の id か、拡張機能が足したページの key（「拡張機能の id:ページの id」） */
type SettingsPage = string;

const messages = defineMessages({
  ja: {
    general: "一般",
    widgets: "ウィジェット",
    wallpaper: "壁紙",
    account: "アカウント",
    extensions: "拡張機能",
    voice: "音声アシスタント",
    connectors: "コネクター・MCP",
    language: "言語",
    languageNote: "このアカウントの画面の言語です。どの端末でログインしても、同じ言語で出ます。",
    adminOnlyVoice: "キャラクター・既定の話し相手・Claude が使う道具を変えられるのは管理者だけです。",
    calendar: "暦",
    gregorian: "西暦",
    japaneseEra: "和暦",
    dateFormat: "日付の形",
    dateAuto: "言語に合わせる",
    dateYmd: "年/月/日",
    dateMdy: "月/日/年",
    dateDmy: "日/月/年",
    clock: "時刻",
    clock24: "24時間",
    clock12: "12時間（午前・午後）",
    weekStart: "週の始まり",
    sunday: "日曜日",
    monday: "月曜日",
    temperature: "温度の単位",
    celsius: "摂氏（℃）",
    fahrenheit: "華氏（℉）",
    settings: "設定",
    settingsNav: "設定の項目",
    widgetsNote: "ホームの右側に並べるカードを、並べ替えたり足したりします。",
    exitEditMode: "編集モードを終了",
    editWidgets: "ウィジェットを並べ替え・削除",
    addWidget: "ウィジェットを追加",
    voiceStandby: "待機中（{phrases}で呼び出せます）",
    voiceAgentDown: "音声エージェントが起動していません",
    defaultPersona: "マイクのボタン・文字で話しかけたときに応答するキャラクター",
    showAvatar: "この端末でアバターを表示",
    showAvatarDetail: "重い端末では切ってください",
    characters: "キャラクター",
    loadingCharacters: "キャラクターを読み込んでいます…",
  },
  en: {
    general: "General",
    widgets: "Widgets",
    wallpaper: "Wallpaper",
    account: "Account",
    extensions: "Extensions",
    voice: "Voice assistant",
    connectors: "Connectors & MCP",
    language: "Language",
    languageNote: "The language for this account. It applies on every device you sign in on.",
    adminOnlyVoice: "Only administrators can change the characters, the default character and the tools Claude uses.",
    calendar: "Calendar",
    gregorian: "Gregorian",
    japaneseEra: "Japanese era",
    dateFormat: "Date format",
    dateAuto: "Match the language",
    dateYmd: "Year/Month/Day",
    dateMdy: "Month/Day/Year",
    dateDmy: "Day/Month/Year",
    clock: "Time",
    clock24: "24-hour",
    clock12: "12-hour (AM/PM)",
    weekStart: "First day of the week",
    sunday: "Sunday",
    monday: "Monday",
    temperature: "Temperature unit",
    celsius: "Celsius (℃)",
    fahrenheit: "Fahrenheit (℉)",
    settings: "Settings",
    settingsNav: "Settings sections",
    widgetsNote: "Rearrange or add the cards shown on the right side of Home.",
    exitEditMode: "Done editing",
    editWidgets: "Rearrange or remove widgets",
    addWidget: "Add widget",
    voiceStandby: "Listening (say {phrases} to call)",
    voiceAgentDown: "The voice agent isn't running",
    defaultPersona: "Character that answers when you use the mic button or type",
    showAvatar: "Show avatar on this device",
    showAvatarDetail: "Turn off on slower devices",
    characters: "Characters",
    loadingCharacters: "Loading characters…",
  },
});

const SETTINGS_PAGES: { id: SettingsPage; label: Parameters<ReturnType<typeof messages.useT>>[0]; icon: IconName }[] = [
  { id: "general", label: "general", icon: "globe" },
  { id: "widgets", label: "widgets", icon: "grid" },
  { id: "wallpaper", label: "wallpaper", icon: "image" },
  { id: "account", label: "account", icon: "person" },
  { id: "extensions", label: "extensions", icon: "puzzle-piece" },
  { id: "voice", label: "voice", icon: "mic" },
  { id: "connectors", label: "connectors", icon: "plug" },
];

/** 選ぶ項目の一覧（言語・表示の設定）。選んでいる行に印を付ける（選んでいない行も印の場所を空けて、行の高さをそろえる） */
function ChoiceList<T extends string | number>({
  label,
  options,
  value,
  onChoose,
}: {
  label: string;
  options: { id: T; label: string; detail?: string }[];
  value: T;
  onChoose: (id: T) => void;
}) {
  return (
    <List boxed label={label}>
      {options.map((option) => (
        <ListItem
          key={String(option.id)}
          title={option.label}
          detail={option.detail}
          selected={option.id === value}
          trailing={<Icon name="checkmark" className={option.id === value ? undefined : "settings-choice__off"} />}
          chevron={false}
          onClick={() => onChoose(option.id)}
        />
      ))}
    </List>
  );
}

/** 一般: このアカウントの画面の言語と、日付・時刻・温度の出し方 */
function GeneralSettings({ apiBaseUrl }: { apiBaseUrl: string }) {
  const t = messages.useT();
  const locale = useLocale();
  const display = useDisplay();
  const [error, setError] = useState<string | null>(null);
  const sample = new Date();
  const choose = (patch: Partial<DisplaySettings>) =>
    void chooseDisplay(apiBaseUrl, patch).then(
      () => setError(null),
      (err) => setError(err instanceof Error ? err.message : String(err)),
    );
  // 例は、選んだときの出方（今日の日付で）
  const dateSample = (dateFormat: DisplaySettings["dateFormat"]) =>
    formatDate(sample, "fullWeekday", locale, { ...display, dateFormat });
  return (
    <section>
      <h4 className="settings-detail__subtitle">{t("language")}</h4>
      <Note>{t("languageNote")}</Note>
      <ChoiceList
        label={t("language")}
        options={LOCALES}
        value={locale}
        onChoose={(id) => void chooseLocale(apiBaseUrl, id).catch(() => undefined)}
      />
      <h4 className="settings-detail__subtitle">{t("calendar")}</h4>
      <ChoiceList
        label={t("calendar")}
        options={[
          { id: "gregorian", label: t("gregorian"), detail: formatDate(sample, "full", locale, { ...display, calendar: "gregorian" }) },
          { id: "japanese", label: t("japaneseEra"), detail: formatDate(sample, "full", locale, { ...display, calendar: "japanese" }) },
        ]}
        value={display.calendar}
        onChoose={(calendar) => choose({ calendar })}
      />
      <h4 className="settings-detail__subtitle">{t("dateFormat")}</h4>
      <ChoiceList
        label={t("dateFormat")}
        options={[
          { id: "auto", label: t("dateAuto"), detail: dateSample("auto") },
          { id: "ymd", label: t("dateYmd"), detail: dateSample("ymd") },
          { id: "mdy", label: t("dateMdy"), detail: dateSample("mdy") },
          { id: "dmy", label: t("dateDmy"), detail: dateSample("dmy") },
        ]}
        value={display.dateFormat}
        onChoose={(dateFormat) => choose({ dateFormat })}
      />
      <h4 className="settings-detail__subtitle">{t("clock")}</h4>
      <ChoiceList
        label={t("clock")}
        options={[
          { id: "24", label: t("clock24"), detail: formatTime(sample, locale, { ...display, clock: "24" }) },
          { id: "12", label: t("clock12"), detail: formatTime(sample, locale, { ...display, clock: "12" }) },
        ]}
        value={display.clock}
        onChoose={(clock) => choose({ clock })}
      />
      <h4 className="settings-detail__subtitle">{t("weekStart")}</h4>
      <ChoiceList
        label={t("weekStart")}
        options={[
          { id: 0, label: t("sunday") },
          { id: 1, label: t("monday") },
        ]}
        value={display.weekStart}
        onChoose={(weekStart) => choose({ weekStart: weekStart as 0 | 1 })}
      />
      <h4 className="settings-detail__subtitle">{t("temperature")}</h4>
      <ChoiceList
        label={t("temperature")}
        options={[
          { id: "c", label: t("celsius"), detail: "21℃" },
          { id: "f", label: t("fahrenheit"), detail: "70℉" },
        ]}
        value={display.temperatureUnit}
        onChoose={(temperatureUnit) => choose({ temperatureUnit })}
      />
      {error && <Message tone="error">{error}</Message>}
    </section>
  );
}

/**
 * サイドバーの Settings の画面。Media・Home Control と同じく、サイドバーの右側全体に出す。
 * 左で項目を選び、右にその中身を出す（狭い画面（スマホなど）では1列にして、一覧と中身を入れ替える）。
 * 編集モードの入口はここに置き、編集中の操作は画面下の操作帯（WidgetEditBar）で行う。
 */
export function SettingsPanel({
  ctx,
  initialPage,
  link,
  editMode,
  onToggleEditMode,
  onOpenWidgetPicker,
  voice,
  onSetPersonaEnabled,
  personas,
  onSelectDefaultPersona,
  onImportPersona,
  onDeletePersona,
  personaExportUrl,
  avatarUrlFor,
  apiBaseUrl,
  avatarAvailable,
  avatarEnabled,
  onToggleAvatar,
  mcp,
  account,
  sessionId,
  extensions,
  wallpaper,
  onWallpaperChange,
  onSignedOut,
}: SettingsPanelProps) {
  const t = messages.useT();
  const locale = useLocale();
  const [page, setPage] = useState<SettingsPage>(initialPage ?? "general");
  // 音声の守り（ゲストモード・個人の情報・道具ごとの確かめ）は、その項目を開いている間だけ読む
  const guard = useGuardSettings(ctx.apiBaseUrl, ctx.socket, page === "voice" || page === "connectors");
  // 拡張機能が足したページは「アカウント」のすぐ下に並べる。本体の項目の中に出すもの（parent）は、その項目の中に区画として出す
  const accountIndex = SETTINGS_PAGES.findIndex((item) => item.id === "account") + 1;
  const builtinPages = SETTINGS_PAGES.map((item) => ({ ...item, label: t(item.label) }));
  const navItems = [
    ...builtinPages.slice(0, accountIndex),
    ...extensions.settingsPages.filter((p) => !p.parent).map((p) => ({ id: p.key, label: textFor(p.label, locale), icon: p.icon })),
    ...builtinPages.slice(accountIndex),
  ];
  const sectionsOf = (parent: string) => extensions.settingsPages.filter((p) => p.parent === parent);
  const extensionPage = extensions.settingsPages.find((p) => p.key === page && !p.parent) ?? null;
  // 狭い画面では、項目を選ぶと一覧の代わりに中身を出す
  const [pageOpen, setPageOpen] = useState(Boolean(initialPage));
  useEffect(() => {
    if (!link) return;
    setPage(link.page as SettingsPage);
    setPageOpen(true);
  }, [link]);

  return (
    <section className="screen settings-screen" aria-label={t("settings")}>
      <div className="screen__inner settings-screen__inner">
        <header className="screen__header">
          <h1>{t("settings")}</h1>
        </header>

        <div className={`settings-panel__columns${pageOpen ? " settings-panel__columns--page-open" : ""}`}>
          {/* 左: 大きな項目の一覧（macOS の設定のように、選ぶと右に中身が出る） */}
          <nav className="settings-nav" aria-label={t("settingsNav")}>
            <ul>
              {navItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`settings-nav__item${item.id === page ? " settings-nav__item--on" : ""}`}
                    aria-current={item.id === page ? "page" : undefined}
                    onClick={() => {
                      setPage(item.id);
                      setPageOpen(true);
                    }}
                  >
                    <span className="settings-nav__icon">
                      <Icon name={item.icon} />
                    </span>
                    <span className="settings-nav__label">{item.label}</span>
                    <Icon name="chevron-right" className="settings-nav__chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* 右: 選んだ項目の中身。狭い画面では一覧と入れ替わり、「設定」で一覧に戻る */}
          <div className="settings-detail">
            <button
              type="button"
              className="settings-detail__back settings-detail__back--page"
              onClick={() => setPageOpen(false)}
            >
              <Icon name="chevron-left" />
              <span>{t("settings")}</span>
            </button>
            <h3 className="settings-detail__title">{navItems.find((item) => item.id === page)?.label}</h3>
            {extensionPage && (
              <ErrorBoundary key={extensionPage.key} name={navItems.find((item) => item.id === page)?.label ?? ""}>
                <extensionPage.Component ctx={ctx} account={account} />
              </ErrorBoundary>
            )}
            {page === "general" && <GeneralSettings apiBaseUrl={apiBaseUrl} />}
            {page === "widgets" && (
              <section className="settings-panel__widget-actions">
                <p className="connection-settings__note">{t("widgetsNote")}</p>
                <button
                  type="button"
                  className={`settings-panel__edit-toggle${editMode ? " settings-panel__edit-toggle--on" : ""}`}
                  aria-pressed={editMode}
                  onClick={onToggleEditMode}
                >
                  <Icon name="edit" />
                  <span>{editMode ? t("exitEditMode") : t("editWidgets")}</span>
                </button>
                <button type="button" className="settings-panel__edit-toggle" onClick={onOpenWidgetPicker}>
                  <Icon name="add" />
                  <span>{t("addWidget")}</span>
                </button>
              </section>
            )}
            {page === "wallpaper" && (
              <WallpaperSettings
                apiBaseUrl={apiBaseUrl}
                wallpaper={wallpaper}
                isAdmin={account.role === "admin"}
                onChange={onWallpaperChange}
              />
            )}
            {page === "account" && (
              <>
                <AccountSettings
                  apiBaseUrl={apiBaseUrl}
                  account={account}
                  sessionId={sessionId}
                  onSignedOut={onSignedOut}
                />
                {sectionsOf("account").map((section) => (
                  <section key={section.key} className="settings-panel__extension-section">
                    <h4 className="settings-detail__subtitle">{textFor(section.label, locale)}</h4>
                    <ErrorBoundary name={textFor(section.label, locale)}>
                      <section.Component ctx={ctx} account={account} />
                    </ErrorBoundary>
                  </section>
                ))}
              </>
            )}
            {page === "extensions" && (
              <ExtensionSettings
                apiBaseUrl={apiBaseUrl}
                extensions={extensions}
                isAdmin={account.role === "admin"}
                link={link?.page === "extensions" ? link : null}
              />
            )}
            {(page === "voice" || page === "connectors") && (
              <VoiceSection
                part={page}
                voice={voice}
                onSetPersonaEnabled={onSetPersonaEnabled}
                personas={personas}
                onSelectDefaultPersona={onSelectDefaultPersona}
                onImportPersona={onImportPersona}
                onDeletePersona={onDeletePersona}
                personaExportUrl={personaExportUrl}
                avatarUrlFor={avatarUrlFor}
                apiBaseUrl={apiBaseUrl}
                avatarAvailable={avatarAvailable}
                avatarEnabled={avatarEnabled}
                onToggleAvatar={onToggleAvatar}
                mcp={mcp}
                guard={guard}
                isAdmin={account.role === "admin"}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface VoiceSectionProps {
  /** 設定画面のどの項目として出すか（音声アシスタントとキャラクター・コネクター） */
  part: "voice" | "connectors";
  voice: VoiceSnapshot | null;
  onSetPersonaEnabled: (personaId: string, enabled: boolean) => Promise<void>;
  personas: VoicePersonas | null;
  onSelectDefaultPersona: (personaId: string) => Promise<void>;
  onImportPersona: (file: File, replace: boolean) => Promise<PersonaImportResult>;
  onDeletePersona: (personaId: string) => Promise<void>;
  personaExportUrl: (personaId: string) => string;
  avatarUrlFor: (personaId: string) => string | null;
  apiBaseUrl: string;
  avatarAvailable: boolean;
  avatarEnabled: boolean;
  onToggleAvatar: () => void;
  mcp: VoiceMcpControl;
  guard: GuardSettingsControl;
  /** キャラクター・既定の話し相手・Claude の道具を変えられるのは管理者だけ（使うのは誰でも） */
  isAdmin: boolean;
}

/** 音声アシスタントの接続状況・この端末での使い方・キャラクター（と、コネクター・MCP） */
function VoiceSection({
  part,
  voice,
  onSetPersonaEnabled,
  personas,
  onSelectDefaultPersona,
  onImportPersona,
  onDeletePersona,
  personaExportUrl,
  avatarUrlFor,
  apiBaseUrl,
  avatarAvailable,
  avatarEnabled,
  onToggleAvatar,
  mcp,
  guard,
  isAdmin,
}: VoiceSectionProps) {
  const t = messages.useT();
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  // キャラクターの詳細を開いているあいだは、音声アシスタントの設定を隠して詳細だけを出す
  const [personaOpen, setPersonaOpen] = useState(false);
  const connected = Boolean(voice?.connected);
  // 呼べるのは入っているキャラクターだけ
  const enabledPersonas = personas?.personas.filter((persona) => persona.enabled) ?? [];
  const wakePhrases = enabledPersonas.map((persona) => persona.wakePhrase);

  if (part === "connectors")
    return isAdmin ? (
      <>
        <VoiceMcpManager mcp={mcp} />
        <VoiceToolChecks guard={guard} />
      </>
    ) : (
      <Note>{t("adminOnlyVoice")}</Note>
    );

  return (
    <section className="settings-panel__voice">
      {!personaOpen && (
        <>
          <p className="settings-panel__voice-status">
            <span className={`status-dot${connected ? " status-dot--ok" : ""}`} aria-hidden="true" />
            {connected
              ? t("voiceStandby", {
                  phrases:
                    locale === "ja"
                      ? wakePhrases.map((phrase) => `「${phrase}」`).join("")
                      : wakePhrases.map((phrase) => `“${phrase}”`).join(" or "),
                })
              : t("voiceAgentDown")}
          </p>
          {enabledPersonas.length > 1 && (
            <label className="settings-panel__voice-persona">
              <span>{t("defaultPersona")}</span>
              <select
                value={personas!.defaultPersonaId}
                disabled={!isAdmin}
                onChange={(event) => {
                  onSelectDefaultPersona(event.target.value).catch((err) =>
                    setError(err instanceof Error ? err.message : String(err)),
                  );
                }}
              >
                {enabledPersonas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="settings-panel__voice-error">{error}</p>}
          {/* この端末だけの切り替え。ほかの一覧と同じく、行の右のスイッチで入／切する */}
          {avatarAvailable && (
            <ul className="settings-list settings-list--boxed">
              {avatarAvailable && (
                <li>
                  <div className="settings-list__row settings-list__row--plain">
                    <span className="settings-list__text">
                      <span className="settings-list__title">{t("showAvatar")}</span>
                      <span className="settings-list__detail">{t("showAvatarDetail")}</span>
                    </span>
                    <ToggleSwitch checked={avatarEnabled} label={t("showAvatar")} onChange={onToggleAvatar} />
                  </div>
                </li>
              )}
            </ul>
          )}
          <VoicePrivacySettings guard={guard} isAdmin={isAdmin} />
        </>
      )}
      {!personaOpen && <h4 className="settings-detail__subtitle">{t("characters")}</h4>}
      {!personaOpen && !isAdmin && <Note>{t("adminOnlyVoice")}</Note>}
      {personas ? (
        <PersonaManager
          personas={personas}
          onDetailChange={setPersonaOpen}
          onImport={onImportPersona}
          onDelete={onDeletePersona}
          onSetEnabled={onSetPersonaEnabled}
          exportUrl={personaExportUrl}
          avatarUrlFor={avatarUrlFor}
          apiBaseUrl={apiBaseUrl}
        />
      ) : (
        <p className="connection-settings__note">{t("loadingCharacters")}</p>
      )}
    </section>
  );
}
