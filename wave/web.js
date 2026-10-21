// host-module:@home-dashboard/widget-sdk
var m = globalThis.__homeDashboard?.modules?.["@home-dashboard/widget-sdk"];
if (!m) throw new Error("\u672C\u4F53\u306E @home-dashboard/widget-sdk \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\uFF08\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E\u4E2D\u3067\u8AAD\u307F\u8FBC\u3093\u3067\u304F\u3060\u3055\u3044\uFF09");
var widget_sdk_default = m.default ?? m;
var { Avatar, AvatarStack, BackButton, Badge, Button, ButtonLink, ButtonRow, ChatBubble, ChatComposer, ChatFrom, ChatHeader, ChatIconButton, ChatLayout, ChatLog, ChatMeta, ChatPending, ChatRow, Check, CodeBlock, DetailFrame, Dialog, FeatureProvidersContext, Field, Group, Icon, LOCALES, List, ListItem, LocaleContext, Message, Note, Notice, PillMenu, ScreenFrame, ScreenNotice, ScreenSection, SectionTitle, StatGrid, StatTile, ToggleSwitch, WidgetCard, WidgetHint, WidgetRegistry, defineMessages, defineWebExtension, defineWidget, extensionApiUrl, formatClock, formatPastDay, getLocale, intlLocale, setCurrentLocale, textFor, useFeatureProviders, useLocale, usePolledResource, usePolling, weatherConditionText, weatherIcon, widgetRegistry } = m;

// extensions/wave/src/web.tsx
var web_default = defineWebExtension({ provides: { music: { name: "wave", order: 10 } } });
export {
  web_default as default
};
