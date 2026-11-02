import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { MessagesScreen } from "./MessagesScreen";

// サイドバーには出さず、Chat 画面のチャットアプリ（機能の口「chat」）として入る
export default defineWebExtension({
  provides: { chat: { name: "iMessage", order: 20, Component: MessagesScreen } },
});
