import { useCallback, useEffect, useState, type FormEvent } from "react";
import { defineMessages, useLocale } from "@home-dashboard/widget-sdk";
import {
  addPasskey,
  changePassword,
  createAccount,
  defaultDeviceName,
  deleteAccount,
  deletePasskey,
  fetchAccounts,
  fetchPasskeys,
  passkeyUnavailableReason,
  fetchSessions,
  relativeDate,
  revokeSession,
  setDeviceSettings,
  signOut,
  type Account,
  type Passkey,
  type Role,
  type Session,
} from "../lib/auth";
import { useDevice } from "../lib/device";
import type { LiteMode } from "../lib/lite";
import { ToggleSwitch } from "./ExtensionSettings";

interface AccountSettingsProps {
  apiBaseUrl: string;
  account: Account;
  sessionId: string;
  onSignedOut: () => void;
}

const messages = defineMessages({
  ja: {
    admin: "管理者",
    member: "メンバー",
    signedInBefore: "",
    signedInAfter: "（{role}）でログイン中",
    signOut: "ログアウト",
    changePassword: "パスワードを変える",
    passwordChanged: "変えました。ほかの端末のログインは外れました",
    passkeys: "パスキー",
    passkeyCreated: "パスキー「{name}」を作りました。次からはパスワードを打たずにログインできます",
    passkeyDeleted: "パスキー「{name}」を消しました。端末の側に残っている分も、端末の設定から消しておいてください",
    sessions: "ログインしている端末",
    thisDevice: "この端末",
    lastUsed: "最後に使ったのは{when}",
    sessionRevoked: "{name}のログインを外しました",
    revoke: "外す",
    manageAccounts: "アカウントの管理",
    you: "自分",
    accountDeleted: "{name} を消しました。その人のログインもすべて外れました",
    pressAgainToDelete: "もう一度押して消す",
    delete: "消す",
    accountCreated: "{name} を作りました",
    passkeyNote:
      "パスキーを作ると、この端末の指紋・顔・PIN でログインできます（パスワードを打たなくてよくなります）。 パスキーは作ったときのアドレスでだけ使えます。",
    synced: "同期",
    usableAt: "{host} で使えます · ",
    neverUsed: "まだ使っていません",
    passkeyName: "パスキーの名前（一覧で見分けるため）",
    createPasskey: "この端末でパスキーを作る",
    currentPassword: "今のパスワード",
    newPassword: "新しいパスワード（8文字以上）",
    confirmPassword: "新しいパスワード（確認）",
    passwordMismatch: "確認のパスワードが合っていません",
    change: "変える",
    addAccount: "アカウントを足す",
    username: "ユーザー名（半角英数字と _ . -）",
    password: "パスワード（8文字以上）",
    role: "権限",
    memberOption: "メンバー（使う・鍵を開ける）",
    adminOption: "管理者（アカウントと接続設定も変えられる）",
    add: "足す",
    thisDeviceSection: "この端末",
    dashboardDevice: "ダッシュボード端末にする",
    dashboardDeviceDetail:
      "家に置きっぱなしの端末向け。画面を眠らせず、ログアウトを出しません。ここで話した会話は部屋のマイクと同じく家族みんなの記録になり、「画面から話しかけたときだけ」の家の人の情報は出しません",
    dashboardBadge: "ダッシュボード端末",
    makeDashboard: "ダッシュボード端末にする",
    unmakeDashboard: "ふつうの端末に戻す",
    lite: "軽い表示",
    liteDetail: "ガラスのぼかしを切って、弱い端末でも滑らかに動かします。自動では、この端末の描画の速さを測って決めます",
    liteAuto: "自動",
    liteOn: "入",
    liteOff: "切",
    liteNow: "いまは{state}（{reason}）",
    liteActive: "入",
    liteInactive: "切",
    reasonsetting: "設定で入",
    reasontransparency: "端末の「透明度を下げる」設定",
    reasonsoftware: "GPU を使わずに描いている",
    reasonslow: "描画が遅い",
    reasonfast: "描画は十分速い",
  },
  en: {
    admin: "Admin",
    member: "Member",
    signedInBefore: "Signed in as ",
    signedInAfter: " ({role})",
    signOut: "Sign out",
    changePassword: "Change password",
    passwordChanged: "Password changed. Other devices have been signed out",
    passkeys: "Passkeys",
    passkeyCreated: "Created passkey “{name}”. Next time you can sign in without typing a password",
    passkeyDeleted: "Deleted passkey “{name}”. Also remove the copy stored on your device from its settings",
    sessions: "Signed-in devices",
    thisDevice: "This device",
    lastUsed: "Last used {when}",
    sessionRevoked: "Signed out {name}",
    revoke: "Sign out",
    manageAccounts: "Manage accounts",
    you: "You",
    accountDeleted: "Deleted {name}. All of their sessions have been signed out",
    pressAgainToDelete: "Press again to delete",
    delete: "Delete",
    accountCreated: "Created {name}",
    passkeyNote:
      "With a passkey, you can sign in using this device's fingerprint, face, or PIN instead of typing a password. A passkey only works at the address where it was created.",
    synced: "Synced",
    usableAt: "Works at {host} · ",
    neverUsed: "Not used yet",
    passkeyName: "Passkey name (to tell them apart in the list)",
    createPasskey: "Create a passkey on this device",
    currentPassword: "Current password",
    newPassword: "New password (at least 8 characters)",
    confirmPassword: "Confirm new password",
    passwordMismatch: "The passwords don't match",
    change: "Change",
    addAccount: "Add account",
    username: "Username (letters, numbers, _ . -)",
    password: "Password (at least 8 characters)",
    role: "Role",
    memberOption: "Member (use the dashboard and unlock doors)",
    adminOption: "Admin (can also change accounts and connection settings)",
    add: "Add",
    thisDeviceSection: "This device",
    dashboardDevice: "Use as a dashboard device",
    dashboardDeviceDetail:
      "For a device that stays at home. The screen stays on and sign-out is hidden. Conversations here are shared with the household like the room mic, and household info set to “only from a screen” is not shared",
    dashboardBadge: "Dashboard device",
    makeDashboard: "Make dashboard device",
    unmakeDashboard: "Make regular device",
    lite: "Lite display",
    liteDetail: "Turns off the glass blur so weaker devices stay smooth. Auto measures how fast this device draws",
    liteAuto: "Auto",
    liteOn: "On",
    liteOff: "Off",
    liteNow: "Now {state} ({reason})",
    liteActive: "on",
    liteInactive: "off",
    reasonsetting: "turned on in settings",
    reasontransparency: "the device's reduce-transparency setting",
    reasonsoftware: "drawing without a GPU",
    reasonslow: "drawing is slow",
    reasonfast: "drawing is fast enough",
  },
});

const ROLE_LABELS = {
  admin: "admin",
  member: "member",
} as const satisfies Record<Role, string>;

/**
 * 設定画面の「アカウント」。ログアウト・パスワードの変更・パスキー・ログインしている端末の一覧（外せる）。
 * 管理者には、アカウントの追加と削除も出す。
 */
export function AccountSettings({ apiBaseUrl, account, sessionId, onSignedOut }: AccountSettingsProps) {
  const t = messages.useT();
  const locale = useLocale();
  const isAdmin = account.role === "admin";
  const device = useDevice();
  const dashboard = device.device.dashboard;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // アカウントを消すのは、うっかり押しても消えないよう、もう一度押して確かめる
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextSessions, nextPasskeys, nextAccounts] = await Promise.all([
        fetchSessions(apiBaseUrl),
        fetchPasskeys(apiBaseUrl),
        isAdmin ? fetchAccounts(apiBaseUrl) : Promise.resolve([]),
      ]);
      setSessions(nextSessions);
      setPasskeys(nextPasskeys);
      setAccounts(nextAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [apiBaseUrl, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await task());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (accountId: string) => accounts.find((a) => a.id === accountId)?.username ?? "";

  return (
    <section className="account-settings">
      <div className="account-settings__me">
        <span>
          {t("signedInBefore")}
          <strong>{account.username}</strong>
          {t("signedInAfter", { role: t(ROLE_LABELS[account.role]) })}
        </span>
        {/* ダッシュボード端末では、うっかり押してログインが外れないよう出さない（ふつうの端末に戻すと出る） */}
        {!dashboard && (
          <button
            type="button"
            className="account-settings__button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await signOut(apiBaseUrl);
                onSignedOut();
                return null;
              })
            }
          >
            {t("signOut")}
          </button>
        )}
      </div>

      <details className="connection-settings__section" open={dashboard || undefined}>
        <summary>
          <span>{t("thisDeviceSection")}</span>
          {dashboard && <span className="connection-settings__badge">{t("dashboardBadge")}</span>}
        </summary>
        <div className="settings-list__row settings-list__row--plain account-settings__device">
          <span className="settings-list__text">
            <span className="settings-list__title">{t("dashboardDevice")}</span>
            <span className="settings-list__detail">{t("dashboardDeviceDetail")}</span>
          </span>
          <ToggleSwitch
            checked={dashboard}
            disabled={busy}
            label={t("dashboardDevice")}
            onChange={() =>
              void run(async () => {
                await device.update({ dashboard: !dashboard });
                return null;
              })
            }
          />
        </div>
        <div className="settings-list__row settings-list__row--plain account-settings__device">
          <span className="settings-list__text">
            <span className="settings-list__title">{t("lite")}</span>
            <span className="settings-list__detail">
              {t("liteDetail")}
              {device.device.lite === "auto" && (
                <>
                  {" "}
                  {t("liteNow", {
                    state: t(device.lite.active ? "liteActive" : "liteInactive"),
                    reason: t(`reason${device.lite.reason ?? "fast"}`),
                  })}
                </>
              )}
            </span>
          </span>
          <select
            aria-label={t("lite")}
            value={device.device.lite}
            disabled={busy}
            onChange={(event) =>
              void run(async () => {
                await device.update({ lite: event.target.value as LiteMode });
                return null;
              })
            }
          >
            <option value="auto">{t("liteAuto")}</option>
            <option value="on">{t("liteOn")}</option>
            <option value="off">{t("liteOff")}</option>
          </select>
        </div>
      </details>

      <details className="connection-settings__section">
        <summary>
          <span>{t("changePassword")}</span>
        </summary>
        <PasswordForm
          busy={busy}
          needsCurrent
          onSubmit={(current, next) =>
            run(async () => {
              await changePassword(apiBaseUrl, account.id, current, next);
              return t("passwordChanged");
            })
          }
        />
      </details>

      <details className="connection-settings__section">
        <summary>
          <span>{t("passkeys")}</span>
          <span className="connection-settings__badge">{passkeys.length}</span>
        </summary>
        <PasskeySection
          passkeys={passkeys}
          busy={busy}
          deleting={deleting}
          onAdd={(name) =>
            run(async () => {
              const passkey = await addPasskey(apiBaseUrl, name);
              return passkey ? t("passkeyCreated", { name: passkey.name }) : null;
            })
          }
          onDelete={(passkey) => {
            if (deleting !== passkey.id) return setDeleting(passkey.id);
            setDeleting(null);
            void run(async () => {
              await deletePasskey(apiBaseUrl, passkey.id);
              return t("passkeyDeleted", { name: passkey.name });
            });
          }}
        />
      </details>

      <details className="connection-settings__section">
        <summary>
          <span>{t("sessions")}</span>
          <span className="connection-settings__badge">{sessions.length}</span>
        </summary>
        <ul className="account-settings__list">
          {sessions.map((session) => (
            <li key={session.id}>
              <span className="account-settings__name">
                {session.deviceName}
                {session.id === sessionId && <small>{t("thisDevice")}</small>}
                {session.device.dashboard && <small>{t("dashboardBadge")}</small>}
              </span>
              <span className="account-settings__meta">
                {isAdmin && session.accountId !== account.id && `${nameOf(session.accountId)} · `}
                {t("lastUsed", {
                  when: relativeDate(session.lastUsedAt, locale),
                })}
              </span>
              <span className="account-settings__actions">
                {session.id !== sessionId && (
                  <button
                    type="button"
                    className="account-settings__button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await setDeviceSettings(apiBaseUrl, session.id, {
                          dashboard: !session.device.dashboard,
                        });
                        return null;
                      })
                    }
                  >
                    {session.device.dashboard ? t("unmakeDashboard") : t("makeDashboard")}
                  </button>
                )}
                {!(session.id === sessionId && dashboard) && (
                  <button
                    type="button"
                    className="account-settings__button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await revokeSession(apiBaseUrl, session.id);
                        if (session.id === sessionId) onSignedOut();
                        return t("sessionRevoked", {
                          name: session.deviceName,
                        });
                      })
                    }
                  >
                    {t("revoke")}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {isAdmin && (
        <details className="connection-settings__section">
          <summary>
            <span>{t("manageAccounts")}</span>
            <span className="connection-settings__badge">{accounts.length}</span>
          </summary>
          <ul className="account-settings__list">
            {accounts.map((other) => (
              <li key={other.id}>
                <span className="account-settings__name">
                  {other.username}
                  {other.id === account.id && <small>{t("you")}</small>}
                </span>
                <span className="account-settings__meta">{t(ROLE_LABELS[other.role])}</span>
                {other.id !== account.id && (
                  <button
                    type="button"
                    className="account-settings__button"
                    disabled={busy}
                    onClick={() => {
                      if (deleting !== other.id) return setDeleting(other.id);
                      setDeleting(null);
                      void run(async () => {
                        await deleteAccount(apiBaseUrl, other.id);
                        return t("accountDeleted", { name: other.username });
                      });
                    }}
                  >
                    {deleting === other.id ? t("pressAgainToDelete") : t("delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <NewAccountForm
            busy={busy}
            onSubmit={(username, password, role) =>
              run(async () => {
                await createAccount(apiBaseUrl, username, password, role);
                return t("accountCreated", { name: username });
              })
            }
          />
        </details>
      )}

      {notice && <p className="connection-settings__message">{notice}</p>}
      {error && <p className="connection-settings__message connection-settings__message--error">{error}</p>}
    </section>
  );
}

function PasskeySection({
  passkeys,
  busy,
  deleting,
  onAdd,
  onDelete,
}: {
  passkeys: Passkey[];
  busy: boolean;
  deleting: string | null;
  onAdd: (name: string) => Promise<void>;
  onDelete: (passkey: Passkey) => void;
}) {
  const t = messages.useT();
  const locale = useLocale();
  const [name, setName] = useState(defaultDeviceName);
  const unavailable = passkeyUnavailableReason();
  const here = location.hostname;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onAdd(name.trim());
  };

  return (
    <>
      <p className="account-settings__note">{t("passkeyNote")}</p>
      {passkeys.length > 0 && (
        <ul className="account-settings__list">
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              <span className="account-settings__name">
                {passkey.name}
                {passkey.backedUp && <small>{t("synced")}</small>}
              </span>
              <span className="account-settings__meta">
                {passkey.rpId !== here && t("usableAt", { host: passkey.rpId })}
                {passkey.lastUsedAt
                  ? t("lastUsed", {
                      when: relativeDate(passkey.lastUsedAt, locale),
                    })
                  : t("neverUsed")}
              </span>
              <button
                type="button"
                className="account-settings__button"
                disabled={busy}
                onClick={() => onDelete(passkey)}
              >
                {deleting === passkey.id ? t("pressAgainToDelete") : t("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unavailable ? (
        <p className="account-settings__note">{unavailable}</p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label className="connection-settings__field">
              <span>{t("passkeyName")}</span>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="connection-settings__actions">
              <button type="submit" className="connection-settings__save">
                {t("createPasskey")}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </>
  );
}

function PasswordForm({
  busy,
  needsCurrent,
  onSubmit,
}: {
  busy: boolean;
  needsCurrent: boolean;
  onSubmit: (current: string | null, next: string) => Promise<void>;
}) {
  const t = messages.useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mismatch) return;
    void onSubmit(needsCurrent ? current : null, next).then(() => {
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  };

  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {needsCurrent && (
          <label className="connection-settings__field">
            <span>{t("currentPassword")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
        )}
        <label className="connection-settings__field">
          <span>{t("newPassword")}</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="connection-settings__field">
          <span>{t("confirmPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {mismatch && <p className="connection-settings__message--error">{t("passwordMismatch")}</p>}
        <div className="connection-settings__actions">
          <button type="submit" className="connection-settings__save" disabled={!next || mismatch}>
            {t("change")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function NewAccountForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (username: string, password: string, role: Role) => Promise<void>;
}) {
  const t = messages.useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(username.trim(), password, role).then(() => {
      setUsername("");
      setPassword("");
    });
  };

  return (
    <form onSubmit={submit} className="account-settings__new">
      <h4>{t("addAccount")}</h4>
      <fieldset disabled={busy}>
        <label className="connection-settings__field">
          <span>{t("username")}</span>
          <input
            value={username}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="connection-settings__field">
          <span>{t("password")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="connection-settings__field">
          <span>{t("role")}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">{t("memberOption")}</option>
            <option value="admin">{t("adminOption")}</option>
          </select>
        </label>
        <div className="connection-settings__actions">
          <button type="submit" className="connection-settings__save" disabled={!username.trim() || !password}>
            {t("add")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
