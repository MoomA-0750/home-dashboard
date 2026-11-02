import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { AccountsPage } from "./AccountsPage";
import { CalendarScreen } from "./calendar/CalendarScreen";
import { agendaWidget } from "./calendar/widget";
import { MailScreen } from "./mail/MailScreen";
import { mailWidget } from "./mail/widget";

// カレンダー・メール。Calendar・Mail の画面とウィジェット、設定の「アカウント」の中のインターネットアカウント（ログインした人ごと）
export default defineWebExtension({
  widgets: [agendaWidget, mailWidget],
  screens: [
    { id: "calendar", label: { ja: "カレンダー", en: "Calendar" }, icon: "calendar", order: 20, Component: CalendarScreen },
    { id: "mail", label: { ja: "メール", en: "Mail" }, icon: "mail", order: 25, Component: MailScreen },
  ],
  settingsPages: [{ id: "internet", label: { ja: "インターネットアカウント", en: "Internet Accounts" }, icon: "globe", parent: "account", Component: AccountsPage }],
});
