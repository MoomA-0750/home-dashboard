import { defineMessages } from "@home-dashboard/widget-sdk";

/** 画面側で、いくつかのファイルが使う文（道を呼んで失敗したときの文など） */
export const commonMessages = defineMessages({
  ja: {
    requestFailed: "うまくいきませんでした（{status}）",
    loading: "読み込んでいます…",
    cancel: "やめる",
    close: "閉じる",
    save: "保存",
    noSubject: "（件名なし）",
  },
  en: {
    requestFailed: "Something went wrong ({status})",
    loading: "Loading…",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    noSubject: "(No subject)",
  },
});
