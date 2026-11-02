import { useState, type FormEvent } from "react";
import {
  Button,
  ButtonRow,
  defineMessages,
  Dialog,
  Field,
  Message,
  Note,
} from "@home-dashboard/widget-sdk";
import {
  answerGuard,
  approveWithPasskey,
  approveWithPassword,
  useGuardRequests,
  type GuardRequest,
} from "../lib/voiceGuard";

const messages = defineMessages({
  ja: {
    confirmTitle: "音声アシスタントの確認",
    approveTitle: "音声アシスタントが許可を求めています",
    confirmNote: "声で「はい」と答えても進められます。",
    approveNote: "本人確認をして許可すると実行します。許可しなければ実行しません。",
    yes: "はい",
    no: "いいえ",
    deny: "許可しない",
    passkey: "パスキーで許可",
    usePassword: "パスワードで許可",
    password: "パスワード",
    approve: "許可",
    more: "ほかに {count} 件",
  },
  en: {
    confirmTitle: "Voice assistant needs a yes",
    approveTitle: "The voice assistant is asking for permission",
    confirmNote: "You can also answer “yes” by voice.",
    approveNote: "It runs only after you verify it's you and allow it.",
    yes: "Yes",
    no: "No",
    deny: "Don't allow",
    passkey: "Allow with passkey",
    usePassword: "Allow with password",
    password: "Password",
    approve: "Allow",
    more: "{count} more",
  },
});

/**
 * 音声アシスタントが道具を使う前の確かめ（apps/server/src/voiceGuard.ts）を、ログインしているどの画面にも出す。
 * 了承（confirm）は押すだけ、解錠などの許可（approve）はパスキーかパスワードで本人確認してから。
 * 音声のパネルより上に出す（話しかけている最中に出るので）。背景を押しても閉じない（答えるまで残す）
 */
export function VoiceGuardPrompt({ apiBaseUrl, socket }: { apiBaseUrl: string; socket: WebSocket | null }) {
  const requests = useGuardRequests(apiBaseUrl, socket);
  const request = requests[0];
  if (!request) return null;
  return <GuardCard key={request.id} apiBaseUrl={apiBaseUrl} request={request} others={requests.length - 1} />;
}

function GuardCard({ apiBaseUrl, request, others }: { apiBaseUrl: string; request: GuardRequest; others: number }) {
  const t = messages.useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const approve = request.kind === "approve";
  const title = t(approve ? "approveTitle" : "confirmTitle");

  const run = async (task: () => Promise<unknown>) => {
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

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (password) void run(() => approveWithPassword(apiBaseUrl, request.id, password));
  };

  return (
    // 重なりは guard（音声のパネルより上）。答えるまで閉じない（閉じるのは中のボタン）
    <Dialog
      title={title}
      onClose={() => undefined}
      dismissible={false}
      layer="guard"
      role="alertdialog"
      className="fields flex flex-col gap-3"
    >
      <p className="text-title leading-normal font-semibold wrap-anywhere untrim">{request.description}</p>
      <Note>{t(approve ? "approveNote" : "confirmNote")}</Note>
      {approve && password !== null ? (
        <form className="flex flex-col gap-3" onSubmit={submitPassword}>
          <Field label={t("password")}>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <ButtonRow>
            <Button type="submit" variant="primary" disabled={busy || !password}>
              {t("approve")}
            </Button>
            <Button disabled={busy} onClick={() => void run(() => answerGuard(apiBaseUrl, request.id, false))}>
              {t("deny")}
            </Button>
          </ButtonRow>
        </form>
      ) : approve ? (
        <ButtonRow>
          <Button
            variant="primary"
            icon="shield-keyhole"
            disabled={busy}
            onClick={() => void run(() => approveWithPasskey(apiBaseUrl, request.id))}
          >
            {t("passkey")}
          </Button>
          <Button disabled={busy} onClick={() => setPassword("")}>
            {t("usePassword")}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void run(() => answerGuard(apiBaseUrl, request.id, false))}>
            {t("deny")}
          </Button>
        </ButtonRow>
      ) : (
        <ButtonRow>
          <Button variant="primary" disabled={busy} onClick={() => void run(() => answerGuard(apiBaseUrl, request.id, true))}>
            {t("yes")}
          </Button>
          <Button disabled={busy} onClick={() => void run(() => answerGuard(apiBaseUrl, request.id, false))}>
            {t("no")}
          </Button>
        </ButtonRow>
      )}
      {error && <Message tone="error">{error}</Message>}
      {others > 0 && <Note>{t("more", { count: others })}</Note>}
    </Dialog>
  );
}
