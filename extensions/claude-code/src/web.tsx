import { defineWebExtension } from "@home-dashboard/widget-sdk";
import { CodeScreen } from "./CodeScreen";
import { MachineSettings } from "./MachineSettings";

// サイドバーの画面（左にセッションの一覧、右にやり取り）と、設定画面の機械の登録
export default defineWebExtension({
  screens: [
    {
      id: "sessions",
      label: { ja: "Claude Code", en: "Claude Code" },
      icon: "sparkle",
      order: 60,
      Component: CodeScreen,
    },
  ],
  SettingsPanel: MachineSettings,
});
