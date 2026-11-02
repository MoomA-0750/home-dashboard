import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defineMessages,
  FeatureProvidersContext,
  PillMenu,
  PollingActiveContext,
  textFor,
  useLocale,
  usePresence,
  useSettingsLinks,
  type SettingsLink,
  type WidgetInstance,
} from "@home-dashboard/widget-sdk";
import { useExtensions } from "./lib/extensions";
import { fetchLayout, saveLayout } from "./api/layout";
import { useRuntimeContext } from "./lib/useRuntimeContext";
import { MainInfo } from "./components/MainInfo";
import { WidgetRail } from "./components/WidgetRail";
import { AppShell } from "@home-dashboard/ui/shell";
import { useSidebarItems, type ScreenId } from "./components/Sidebar";
import type { Account } from "./lib/auth";
import { SettingsPanel } from "./components/SettingsPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WidgetEditBar, WidgetPicker } from "./components/WidgetEditBar";
import { VoiceChat } from "./components/VoiceChat";
import { useWallpaper } from "./lib/useWallpaper";
import { useNight } from "./lib/useNight";
import { VoiceLauncher } from "./components/VoiceLauncher";
import { SnackbarHost } from "./components/SnackbarHost";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { VoiceGuardPrompt } from "./components/VoiceGuardPrompt";
import { CLIENT_ID } from "./lib/browserVoice";
import { newConversationId, useVoiceChatSession } from "./lib/voiceConversations";
import { ASSISTANT_CHAT, useChatApp } from "./lib/chatApp";
import { useVoiceMcp } from "./lib/voiceMcp";
import { useDevice, useDeviceSettingsSync, useWakeLock } from "./lib/device";
import {
  askVoiceAssistant,
  cancelVoiceAssistant,
  avatarUrlFor,
  deletePersona,
  importPersona,
  listenVoiceAssistant,
  personaExportUrl,
  setDefaultPersona,
  setPersonaEnabled,
  useAvatarEnabled,
  useVoiceAssistant,
  useVoicePersonas,
} from "./lib/useVoiceAssistant";

/**
 * 時刻・天気はメイン画面左側に固定表示（MainInfo）される画面の構成要素なので、
 * ウィジェットレールには出さない。レールに二重に出るのを防ぐためここで除外する。
 */
const messages = defineMessages({
  ja: {
    assistant: "アシスタント",
    chatApps: "チャットアプリ（いまは{current}）",
    loading: "読み込み中…",
    chat: "チャット",
    settings: "設定",
  },
  en: {
    assistant: "Assistant",
    chatApps: "Chat apps (now {current})",
    loading: "Loading…",
    chat: "Chat",
    settings: "Settings",
  },
});

const CHROME_WIDGET_IDS = ["clock", "weather"];

const SIDEBAR_WIDTH_STORAGE_KEY = "home-dashboard:sidebar-width";

// crypto.randomUUID は https か localhost でしか使えないので、どこでも使える作り方（会話のIDと同じ）
const newInstanceId = newConversationId;

interface AppProps {
  account: Account;
  sessionId: string;
  onSignedOut: () => void;
}

export function App({ account, sessionId, onSignedOut }: AppProps) {
  const ctx = useRuntimeContext();
  const device = useDevice();
  // ほかの端末で「ダッシュボード端末にする」などを変えられたら読み直す。ダッシュボード端末は画面を眠らせない
  useDeviceSettingsSync(ctx.socket, device.reload);
  useWakeLock(device.device.dashboard);
  const voice = useVoiceAssistant(ctx);
  const personas = useVoicePersonas(ctx);
  const [avatarEnabled, setAvatarEnabled] = useAvatarEnabled();
  // URL の ?settings=<ページ> で設定のそのページを開く（Google などのログインから戻ってきたとき。ページの側が URL から外す）
  const [linkedSettingsPage] = useState(() => new URLSearchParams(window.location.search).get("settings"));
  const [activeScreen, setActiveScreen] = useState<ScreenId>(linkedSettingsPage ? "settings" : "home");
  // ほかの所から「設定のこのページを開いて」と頼まれたとき（openSettings）。同じページを続けて頼まれても開き直すよう、毎回作り直す
  const [settingsLink, setSettingsLink] = useState<SettingsLink | null>(null);
  useSettingsLinks(
    useCallback((link: SettingsLink) => {
      setSettingsLink({ ...link });
      setActiveScreen("settings");
    }, []),
  );
  // 設定も Media・Home Control と同じく、サイドバーの右側全体に出る画面
  const settingsVisible = activeScreen === "settings";
  const voiceMcp = useVoiceMcp(ctx, settingsVisible);
  // 連携（Spotify・Home Assistant など）は拡張機能。ウィジェットとサイドバーの画面は、動いている拡張機能から集まる
  const extensions = useExtensions(ctx);
  // Chat 画面。音声アシスタントとのチャット（拡張機能「チャット」が入っていれば、どの端末にも出る）と、
  // 機能の口「chat」に入ったチャットアプリ（iMessage など）を、右上の切り替えで選ぶ。
  // 音声アシスタントのチャットは本体の音声アシスタント（返事の声・話している相手）と一緒に動くので、拡張機能の web.js ではなく本体に置く
  const locale = useLocale();
  const t = messages.useT();
  const chatInstalled = extensions.extensions.some((ext) => ext.id === "chat" && ext.active);
  const chatApps = (extensions.featureProviders.chat ?? []).filter((app) => app.Component);
  const [chatAppId, setChatAppId] = useChatApp();
  const chatOn = chatInstalled || chatApps.length > 0;
  const chatScreenOpen = chatOn && activeScreen === "chat";
  const chatApp = chatApps.find((app) => app.extensionId === chatAppId) ?? (chatInstalled ? null : chatApps[0]);
  // 音声アシスタントのチャットを開いているか（ほかのチャットアプリを選んでいるときは false）
  const chatVisible = chatScreenOpen && chatInstalled && !chatApp;
  const chatSession = useVoiceChatSession(ctx, chatVisible);
  const avatarUrl = (personaId: string | null) =>
    avatarEnabled ? avatarUrlFor(ctx.apiBaseUrl, personas, personaId) : null;
  const defaultAvatarUrl = avatarUrl(personas?.defaultPersonaId ?? null);

  // アバターは数十MBあるので、既定のキャラクターの分だけ、最初に話しかけられる前に読み込んでおく
  // （ほかのキャラクターは呼ばれたときに読む。起動直後の描画の邪魔をしないよう少し待つ）
  useEffect(() => {
    if (!defaultAvatarUrl) return;
    const timer = setTimeout(() => {
      import("./components/VoiceAvatar")
        .then((module) => module.loadAvatar(defaultAvatarUrl))
        .catch((err) => console.error("failed to preload avatar", err));
    }, 3000);
    return () => clearTimeout(timer);
  }, [defaultAvatarUrl]);

  const [instances, setInstances] = useState<WidgetInstance[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const editBar = usePresence(editMode);
  const [wallpaper, setWallpaper] = useWallpaper(ctx);
  const [night, setNight] = useNight(ctx);
  const screens = extensions.screens;
  const currentScreen = screens.find((screen) => screen.key === activeScreen) ?? null;
  const onHome = currentScreen === null && !chatScreenOpen && !settingsVisible;
  // ブラウザのタブの題は、開いている画面の名前（言語に合わせる）
  const pageTitle = settingsVisible
    ? t("settings")
    : chatScreenOpen
      ? t("chat")
      : currentScreen
        ? textFor(currentScreen.label, locale)
        : null;
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Home Dashboard` : "Home Dashboard";
  }, [pageTitle]);
  const sidebarItems = useSidebarItems(screens, chatOn);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  // 追加したウィジェットを見える位置へ送るための目印
  const [revealInstanceId, setRevealInstanceId] = useState<string | null>(null);
  /**
   * サーバーと一致していると分かっている並び（JSON）。これと同じなら保存しない。
   * 読み込んだだけ・ほかの端末の変更を受け取っただけで保存し直すと、端末の間で保存と読み直しが往復し続け、
   * その間にほかの端末の古い並びが並べ替えや追加を上書きしてしまう。
   */
  const syncedLayoutRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const applyServerLayout = useCallback((next: WidgetInstance[]) => {
    syncedLayoutRef.current = JSON.stringify(next);
    setInstances(next);
  }, []);

  // 読めなかったとき（サーバーの再起動中など）は、壁の端末が「読み込み中」のまま止まらないよう、少し待って読み直す
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetchLayout(ctx.apiBaseUrl).then(
        (layout) => !cancelled && applyServerLayout(layout.instances),
        () => {
          if (!cancelled) timer = setTimeout(load, 5000);
        },
      );
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ctx.apiBaseUrl, applyServerLayout]);

  useEffect(() => {
    if (instances === null) return;
    const serialized = JSON.stringify(instances);
    if (serialized === syncedLayoutRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      syncedLayoutRef.current = serialized;
      saveLayout(ctx.apiBaseUrl, { instances, updatedAt: new Date().toISOString() }).catch((err) => {
        // 保存できなかったので、次の変更のときにもう一度送る
        syncedLayoutRef.current = null;
        console.error("failed to save layout", err);
      });
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [instances, ctx.apiBaseUrl]);

  // 他端末でのレイアウト変更をリアルタイムに反映する（複数端末からの同時アクセスを想定）
  useEffect(() => {
    if (!ctx.socket) return;
    const socket = ctx.socket;
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "layout-updated" && message.source !== CLIENT_ID) {
          fetchLayout(ctx.apiBaseUrl).then((layout) => applyServerLayout(layout.instances));
        }
      } catch {
        // ignore malformed messages
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [ctx.socket, ctx.apiBaseUrl, applyServerLayout]);

  // 画面の切り替え（チャットと設定も画面の1つ）
  const handleSelectScreen = (screen: ScreenId) => {
    if (
      screen === "home" ||
      screen === "chat" ||
      screen === "settings" ||
      screens.some((item) => item.key === screen)
    ) {
      setActiveScreen(screen);
      // ウィジェットの編集はホームの画面でだけ意味があるので、ほかの画面へ移ったら終える
      if (screen !== "home") {
        setEditMode(false);
        setWidgetPickerOpen(false);
      }
    }
  };

  const handleAdd = (widgetId: string) => {
    const def = extensions.registry.get(widgetId);
    if (!def) return;
    setInstances((prev) => {
      const current = prev ?? [];
      // レールの末尾に置く（Infinity は JSON にすると null になり、読み直した端末で位置が壊れる）
      const bottom = current
        .filter((i) => !CHROME_WIDGET_IDS.includes(i.widgetId))
        .reduce((max, i) => Math.max(max, i.y + i.h), 0);
      const instance: WidgetInstance = {
        instanceId: newInstanceId(),
        widgetId,
        x: 0,
        y: bottom,
        w: def.defaultSize.w,
        h: def.defaultSize.h,
        config: def.defaultConfig,
      };
      setRevealInstanceId(instance.instanceId);
      return [...current, instance];
    });
    setWidgetPickerOpen(false);
  };

  /** 上下のボタンでの並べ替え（ドラッグしにくいタッチ端末や、遠くへ動かしたいとき用） */
  // ウィジェットのレールに渡す処理は、描き直しても同じものを渡す（返答が流れる間などに、全ウィジェットを描き直させない）
  const handleMove = useCallback((instanceId: string, direction: -1 | 1) => {
    setInstances((prev) => {
      if (!prev) return prev;
      const rail = prev.filter((i) => !CHROME_WIDGET_IDS.includes(i.widgetId)).sort((a, b) => a.y - b.y);
      const index = rail.findIndex((i) => i.instanceId === instanceId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= rail.length) return prev;
      [rail[index], rail[target]] = [rail[target], rail[index]];
      let y = 0;
      const restacked = rail.map((instance) => {
        const next = { ...instance, y };
        y += instance.h;
        return next;
      });
      return mergeRailLayout(prev, restacked);
    });
  }, []);

  const handleToggleEditMode = () => {
    setActiveScreen("home");
    setEditMode((v) => !v);
  };

  const handleOpenWidgetPicker = () => {
    setActiveScreen("home");
    setEditMode(true);
    setWidgetPickerOpen(true);
  };

  const handleRemove = useCallback((instanceId: string) => {
    setInstances((prev) => (prev ?? []).filter((i) => i.instanceId !== instanceId));
  }, []);

  const handleConfigChange = useCallback((instanceId: string, config: Record<string, unknown>) => {
    setInstances((prev) => (prev ?? []).map((i) => (i.instanceId === instanceId ? { ...i, config } : i)));
  }, []);

  const handleRevealed = useCallback(() => setRevealInstanceId(null), []);
  const handleRailLayoutChange = useCallback(
    (next: WidgetInstance[]) => setInstances((prev) => (prev ? mergeRailLayout(prev, next) : prev)),
    [],
  );
  const railInstances = useMemo(
    () => (instances ?? []).filter((i) => !CHROME_WIDGET_IDS.includes(i.widgetId)),
    [instances],
  );

  // チャットアプリが2つ以上あるときだけ、Chat 画面の右上に切り替えを出す（Media の音楽アプリと同じ部品）
  const chatOptions = [
    ...(chatInstalled ? [{ id: ASSISTANT_CHAT, label: t("assistant") }] : []),
    ...chatApps.map((app) => ({ id: app.extensionId, label: textFor(app.name, locale) })),
  ];
  const currentChatId = chatApp?.extensionId ?? ASSISTANT_CHAT;
  const chatSwitcher =
    chatOptions.length > 1 ? (
      <PillMenu
        label={chatOptions.find((option) => option.id === currentChatId)?.label ?? ""}
        icon="chat-multiple"
        ariaLabel={t("chatApps", { current: chatOptions.find((option) => option.id === currentChatId)?.label ?? "" })}
        items={chatOptions.map((option) => ({ ...option, selected: option.id === currentChatId }))}
        onSelect={setChatAppId}
      />
    ) : null;

  if (instances === null) {
    return <div className="flex h-svh items-center justify-center text-muted">{t("loading")}</div>;
  }

  return (
    // 機能の口に入っている拡張機能の一覧を、口を持つ拡張機能（Media の音楽アプリなど）へ渡す
    <FeatureProvidersContext.Provider value={extensions.featureProviders}>
      <AppShell
        items={sidebarItems}
        active={(id) => (id === "chat" ? chatScreenOpen : id === (onHome ? "home" : activeScreen))}
        onSelect={handleSelectScreen}
        storageKey={SIDEBAR_WIDTH_STORAGE_KEY}
      >
        {/* 切った拡張機能の画面を開いていたときは、ホームに戻る */}
        {currentScreen && (
          <ErrorBoundary key={currentScreen.key} name={textFor(currentScreen.label, locale)}>
            <currentScreen.Component ctx={ctx} account={account} />
          </ErrorBoundary>
        )}
        {/* ホーム（時計とウィジェットの列）。開いたときは、中身の区画を少しずつずらして出す */}
        <main
          className="home-layout layer-base grid h-full min-h-0 overflow-hidden enter-stagger"
          hidden={!onHome}
        >
          <MainInfo ctx={ctx} />
          {extensions.ready && (
            // ホームを隠している間は、ウィジェットの読み直しを止める
            <PollingActiveContext.Provider value={onHome}>
              <WidgetRail
                instances={railInstances}
                registry={extensions.registry}
                ctx={ctx}
                editMode={editMode}
                revealInstanceId={revealInstanceId}
                onRevealed={handleRevealed}
                onLayoutChange={handleRailLayoutChange}
                onMove={handleMove}
                onRemove={handleRemove}
                onConfigChange={handleConfigChange}
              />
            </PollingActiveContext.Provider>
          )}
        </main>
        {settingsVisible && (
          <SettingsPanel
            ctx={ctx}
            initialPage={linkedSettingsPage}
            link={settingsLink}
            editMode={editMode}
            onToggleEditMode={handleToggleEditMode}
            onOpenWidgetPicker={handleOpenWidgetPicker}
            voice={voice}
            onSetPersonaEnabled={(personaId, enabled) => setPersonaEnabled(ctx.apiBaseUrl, personaId, enabled)}
            personas={personas}
            onSelectDefaultPersona={(personaId) => setDefaultPersona(ctx.apiBaseUrl, personaId)}
            onImportPersona={(file, replace) => importPersona(ctx.apiBaseUrl, file, replace)}
            avatarUrlFor={(personaId) => avatarUrlFor(ctx.apiBaseUrl, personas, personaId)}
            apiBaseUrl={ctx.apiBaseUrl}
            onDeletePersona={(personaId) => deletePersona(ctx.apiBaseUrl, personaId)}
            personaExportUrl={(personaId) => personaExportUrl(ctx.apiBaseUrl, personaId)}
            avatarAvailable={Boolean(personas?.personas.some((persona) => persona.hasAvatar))}
            avatarEnabled={avatarEnabled}
            onToggleAvatar={() => setAvatarEnabled(!avatarEnabled)}
            mcp={voiceMcp}
            account={account}
            sessionId={sessionId}
            extensions={extensions}
            wallpaper={wallpaper}
            onWallpaperChange={setWallpaper}
            night={night}
            onNightChange={setNight}
            onSignedOut={onSignedOut}
          />
        )}
        {chatScreenOpen && chatApp?.Component && (
          <ErrorBoundary key={chatApp.extensionId} name={textFor(chatApp.name, locale)}>
            <chatApp.Component ctx={ctx} account={account} switcher={chatSwitcher} />
          </ErrorBoundary>
        )}
        {chatVisible && (
          <VoiceChat
            switcher={chatSwitcher}
            snapshot={voice}
            personas={personas}
            session={chatSession}
            apiBaseUrl={ctx.apiBaseUrl}
            // チャットでは返答の声を鳴らさない（文字だけ）
            onAskText={(text, target, attachmentIds) => askVoiceAssistant(ctx.apiBaseUrl, text, "none", target, attachmentIds)}
            onCancel={() => cancelVoiceAssistant(ctx.apiBaseUrl)}
          />
        )}
        {editBar.shown && (
          <WidgetEditBar closing={editBar.closing} onAdd={() => setWidgetPickerOpen(true)} onDone={() => setEditMode(false)} />
        )}
        {widgetPickerOpen && (
          <WidgetPicker
            registry={extensions.registry}
            hiddenWidgetIds={CHROME_WIDGET_IDS}
            placedWidgetIds={railInstances.map((i) => i.widgetId)}
            onAdd={handleAdd}
            onClose={() => setWidgetPickerOpen(false)}
          />
        )}
        <VoiceLauncher snapshot={voice} personas={personas} onListen={() => listenVoiceAssistant(ctx.apiBaseUrl)} />
        <SnackbarHost />
        {/* チャットを開いている端末では、やり取りはチャットに流れるので、手前を覆うパネルは出さない */}
        <VoiceOverlay
          snapshot={chatVisible ? null : voice}
          avatarUrl={avatarUrl(voice?.personaId ?? null)}
          avatarRig={personas?.personas.find((persona) => persona.id === voice?.personaId)?.rig}
          socket={ctx.socket}
          onCancel={() => cancelVoiceAssistant(ctx.apiBaseUrl)}
        />
        {/* 音声アシスタントが道具を使う前の了承・許可。どの画面にも、音声のパネルより上に出す */}
        <VoiceGuardPrompt apiBaseUrl={ctx.apiBaseUrl} socket={ctx.socket} />
      </AppShell>
    </FeatureProvidersContext.Provider>
  );
}

/** レールに出していないウィジェット（時刻・天気）の配置情報は触らずに残す */
function mergeRailLayout(all: WidgetInstance[], rail: WidgetInstance[]): WidgetInstance[] {
  const byId = new Map(rail.map((instance) => [instance.instanceId, instance]));
  return all.map((instance) => byId.get(instance.instanceId) ?? instance);
}
