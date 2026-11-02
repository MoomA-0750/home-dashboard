import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { browserSupportsWebAuthnAutofill } from "@simplewebauthn/browser";
import {
  Button,
  defineMessages,
  Field,
  getDisplay,
  getLocale,
  Message,
  normalizeDisplay,
  Note,
  Notice,
} from "@home-dashboard/widget-sdk";

/** ログインの画面（画面の真ん中に、浮かせた面を1つ置く） */
const SCREEN = "flex min-h-svh items-center justify-center px-4 py-6";
import {
  defaultDeviceName,
  fetchAuthStatus,
  passkeyUnavailableReason,
  signIn,
  signInWithPasskey,
  type Account,
  type AuthStatus,
} from "../lib/auth";
import { DeviceProvider } from "../lib/device";
import { changeDisplay, changeLocale } from "../lib/locale";

const messages = defineMessages({
  ja: {
    unreachable: "サーバーにつながりません。待っています…",
    loading: "読み込み中…",
    passwordMismatch: "確認のパスワードが合っていません",
    setupTitle: "最初のアカウントを作る",
    signIn: "ログイン",
    setupLead:
      "このダッシュボードにはまだアカウントがありません。ここで作るアカウントが管理者になり、あとから家族のアカウントを足せます。",
    signInLead: "一度ログインすると、この端末ではログアウトするまで入ったままになります（しばらく触らなくても切れません）。",
    username: "ユーザー名",
    password: "パスワード",
    passwordRule: "（8文字以上）",
    passwordConfirm: "パスワード（確認）",
    deviceName: "この端末の名前（ログインしている端末の一覧に出ます）",
    checking: "確かめています…",
    createAndSignIn: "作ってログイン",
    or: "または",
    passkey: "パスキーでログイン",
    setupCode: "合言葉",
    setupCodeHint: "サーバーのログに出ている8文字（docker compose logs home-dashboard で見られます）",
    linkedAdded: "「{label}」を足しました。",
    linkedFailed: "アカウントを足せませんでした: {error}",
    linkedElsewhere:
      "この画面はダッシュボードにログインしていない別のブラウザーで開いています。ダッシュボードを開いていた元の画面（アプリ）に戻ってください。ここでログインして続けることもできます。",
  },
  en: {
    unreachable: "Can't reach the server. Waiting…",
    loading: "Loading…",
    passwordMismatch: "The passwords don't match",
    setupTitle: "Create the first account",
    signIn: "Sign in",
    setupLead:
      "This dashboard has no accounts yet. The account you create here becomes the administrator, and you can add family accounts later.",
    signInLead: "Once you sign in, this device stays signed in until you sign out (it won't time out when idle).",
    username: "Username",
    password: "Password",
    passwordRule: " (8 characters or more)",
    passwordConfirm: "Confirm password",
    deviceName: "Name of this device (shown in the list of signed-in devices)",
    checking: "Checking…",
    createAndSignIn: "Create and sign in",
    or: "or",
    passkey: "Sign in with a passkey",
    setupCode: "Setup code",
    setupCodeHint: "The 8 characters shown in the server log (see docker compose logs home-dashboard)",
    linkedAdded: "Added \"{label}\".",
    linkedFailed: "Couldn't add the account: {error}",
    linkedElsewhere:
      "This page opened in another browser that isn't signed in to the dashboard. Go back to the screen (app) where you had the dashboard open. You can also sign in here to continue.",
  },
});

// 別の端末でログインを外されたときに気づけるよう、ときどき確かめ直す
const RECHECK_MS = 60_000;

interface AuthGateProps {
  apiBaseUrl: string;
  children: (account: Account, sessionId: string, onSignedOut: () => void) => ReactNode;
}

/**
 * ダッシュボードの入口。ログインしていなければログイン画面（アカウントが1つも無ければ最初のアカウント作成）を出す。
 * ログインは期限で切れないので、常に表示しておく端末でも、一度ログインすればそのまま使い続けられる。
 */
export function AuthGate({ apiBaseUrl, children }: AuthGateProps) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const t = messages.useT();

  const check = useCallback(async () => {
    try {
      const next = await fetchAuthStatus(apiBaseUrl);
      // アカウントの言語に合わせる（ほかの端末で変えたときも、確かめ直すたびに追いつく）
      if (next.account?.locale && next.account.locale !== getLocale()) changeLocale(next.account.locale);
      if (next.account?.display) {
        const display = normalizeDisplay(next.account.display);
        if (JSON.stringify(display) !== JSON.stringify(getDisplay())) changeDisplay(display);
      }
      setStatus(next);
      setUnreachable(false);
    } catch {
      // サーバーが落ちているだけのときは、ログイン画面に戻さずそのまま待つ
      setUnreachable(true);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void check();
    const timer = setInterval(check, RECHECK_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!status) {
    return (
      <div className={SCREEN}>
        <p className="text-muted">{unreachable ? t("unreachable") : t("loading")}</p>
      </div>
    );
  }
  if (status.account && status.sessionId) {
    const reload = () => void check();
    return (
      <DeviceProvider
        apiBaseUrl={apiBaseUrl}
        sessionId={status.sessionId}
        device={status.device ?? { dashboard: false, lite: "auto" }}
        reload={reload}
      >
        {children(status.account, status.sessionId, reload)}
      </DeviceProvider>
    );
  }
  return <SignInForm apiBaseUrl={apiBaseUrl} setup={status.setupRequired} onSignedIn={check} />;
}

function SignInForm({ apiBaseUrl, setup, onSignedIn }: { apiBaseUrl: string; setup: boolean; onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const t = messages.useT();
  // パスキーが使えるのは、名前のあるアドレスを https で開いたときだけ（IP アドレスでは使えない）
  const passkeyReady = !setup && passkeyUnavailableReason() === null;
  const deviceNameRef = useRef(deviceName);
  deviceNameRef.current = deviceName;
  // インターネットアカウントのログイン（Google など）から、ダッシュボードにログインしていないブラウザーへ戻ってきたとき
  // （Android でアプリとして開いたダッシュボードから、ログインの画面が別のブラウザーで開いたときなど）
  const [linked] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("signedOut")) return null;
    const added = params.get("added");
    const failed = params.get("error");
    return added ? t("linkedAdded", { label: added }) : failed ? t("linkedFailed", { error: failed }) : "";
  });

  // ユーザー名の欄を押したときに、端末に覚えさせたパスキーを候補に出す（選べばそのままログイン）
  useEffect(() => {
    if (!passkeyReady) return;
    let cancelled = false;
    void browserSupportsWebAuthnAutofill().then(async (supported) => {
      if (!supported || cancelled) return;
      try {
        if (await signInWithPasskey(apiBaseUrl, deviceNameRef.current, true)) onSignedIn();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, passkeyReady, onSignedIn]);

  const signInByPasskey = async () => {
    setSending(true);
    setError(null);
    try {
      if (await signInWithPasskey(apiBaseUrl, deviceName)) onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (setup && password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const code = setup ? setupCode : undefined;
      await signIn(apiBaseUrl, setup ? "setup" : "login", username.trim(), password, deviceName, code);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPassword("");
      setConfirm("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={SCREEN}>
      <form className="raised flex w-104 max-w-full flex-col gap-4 rounded-card p-8 phone:p-5" onSubmit={submit}>
        <h1 className="text-heading font-semibold">{setup ? t("setupTitle") : t("signIn")}</h1>
        {linked !== null && !setup && (
          <div role="status">
            <Notice>
              {linked} {t("linkedElsewhere")}
            </Notice>
          </div>
        )}
        <Note>{setup ? t("setupLead") : t("signInLead")}</Note>
        {/* 入力欄のあいだは Field の下の余白にする */}
        <div className="flex flex-col">
          {setup && (
            <Field label={t("setupCode")}>
              <input
                value={setupCode}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                maxLength={16}
                aria-describedby="setup-code-hint"
                onChange={(e) => setSetupCode(e.target.value)}
              />
              <small id="setup-code-hint" className="text-caption leading-normal font-medium text-muted">
                {t("setupCodeHint")}
              </small>
            </Field>
          )}
          <Field label={t("username")}>
            <input
              value={username}
              autoComplete={passkeyReady ? "username webauthn" : "username"}
              autoCapitalize="none"
              spellCheck={false}
              autoFocus={!setup}
              maxLength={32}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label={`${t("password")}${setup ? t("passwordRule") : ""}`}>
            <input
              type="password"
              value={password}
              autoComplete={setup ? "new-password" : "current-password"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {setup && (
            <Field label={t("passwordConfirm")}>
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          )}
          <Field label={t("deviceName")}>
            <input value={deviceName} maxLength={40} onChange={(e) => setDeviceName(e.target.value)} />
          </Field>
        </div>
        {error && <Message tone="error">{error}</Message>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={sending || !username.trim() || !password || (setup && !setupCode.trim())}
        >
          {sending ? t("checking") : setup ? t("createAndSignIn") : t("signIn")}
        </Button>
        {passkeyReady && (
          <>
            {/* 「または」の両脇に線を引く */}
            <p
              className="flex items-center gap-3 text-note text-muted before:flex-1 before:border-t before:border-glass-border after:flex-1 after:border-t after:border-glass-border"
              aria-hidden="true"
            >
              {t("or")}
            </p>
            <Button size="lg" className="w-full" disabled={sending} onClick={() => void signInByPasskey()}>
              {t("passkey")}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
