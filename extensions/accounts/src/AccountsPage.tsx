import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BackButton,
  Button,
  ButtonRow,
  Check,
  defineMessages,
  Field,
  Group,
  List,
  ListItem,
  Message,
  openSettings,
  Note,
  SectionTitle,
  ToggleSwitch,
  useLocale,
  type ScreenProps,
} from "@home-dashboard/widget-sdk";
import {
  addAccount,
  fetchAccounts,
  fetchProviders,
  providerLabel,
  removeAccount,
  startOAuth,
  testAccount,
  updateAccount,
} from "./client";
import type { AccountInfo } from "./store";
import { commonMessages } from "./webMessages";

/**
 * 設定画面の「アカウント → インターネットアカウント」（ログインした人ごと）。自分のアカウントを足し、カレンダー・メールのどちらに使うか、
 * 家で共有するか（家族と音声アシスタントにも見せるか）を決める。ほかの人が家で共有しているものは、見えるだけ
 */

const messages = defineMessages({
  ja: {
    added: "{label} を足しました",
    removed: "{label} を外しました",
    calendar: "カレンダー",
    mail: "メール",
    serviceSeparator: "・",
    notInUse: "使っていません",
    intro:
      "Google・iCloud などのアカウントを足すと、カレンダーとメールが「カレンダー」「メール」の画面とウィジェットに出ます。自分のアカウントは自分にだけ見えます。「家で共有する」にしたものは、家族と音声アシスタントにも見えます。",
    myAccounts: "自分のアカウント",
    none: "まだありません。",
    sharedBadge: "家で共有",
    other: "そのほか",
    oauthUnavailable: "{providers}は、ログインの設定がまだです。押すと設定（拡張機能 → カレンダー・メール）を開きます。",
    oauthUnavailableMember: "{providers}は、ログインの設定がまだです。管理者が「拡張機能 → カレンダー・メール」で設定すると足せます。",
    needsSetup: "{provider}（ログインの設定がまだ。押すと設定を開く）",
    needsSetupMember: "{provider}（ログインの設定がまだ。管理者が設定すると足せる）",
    askAdmin: "{provider}のログインの設定は管理者がします。管理者に「拡張機能 → カレンダー・メール」での設定を頼んでください。",
    providerSeparator: "・",
    sharedAccounts: "家で共有されているアカウント",
    ownerOnly: "変えられるのは登録した人",
    internetAccounts: "インターネットアカウント",
    addICloud: "iCloud を足す",
    addAccount: "アカウントを足す",
    iCloudNote:
      "Apple ID のページ（account.apple.com）の「サインインとセキュリティ → App 用パスワード」で作ったパスワードを入れます（Apple IDのパスワードそのものは使えません）。iCloud のメールとカレンダーを使います。",
    kind: "種類",
    kindImap: "メール（IMAP・SMTP）",
    kindCaldav: "カレンダー（CalDAV）",
    kindIcal: "公開カレンダー（iCal の URL。見るだけ）",
    imapServer: "受信（IMAP）のサーバー",
    imapHint: "Gmail なら imap.gmail.com（「アプリパスワード」を使う）",
    imapPort: "受信のポート",
    smtpServer: "送信（SMTP）のサーバー",
    smtpHint: "空なら読むだけ",
    smtpPort: "送信のポート",
    caldavUrl: "CalDAV の URL",
    calendarUrl: "カレンダーの URL",
    icalHint: "Google カレンダーの「iCal 形式の非公開 URL」や、祝日のカレンダーなど（webcal:// も可）",
    appleId: "Apple ID（メールアドレス）",
    username: "ユーザー名",
    appPassword: "App 用パスワード",
    password: "パスワード",
    labelOptional: "名前（空ならメールアドレス）",
    shareCheck: "家で共有する（家族と音声アシスタントにも見える）",
    checking: "つながるか確かめています…",
    add: "足す",
    useCalendar: "カレンダーを使う",
    useCalendarDetail: "カレンダーの画面・予定のウィジェットに出す",
    useMail: "メールを使う",
    useMailDetail: "メールの画面・メールのウィジェットに出す",
    share: "家で共有する",
    shareDetail: "家族と音声アシスタントにも見せる（音声アシスタントは予定を足したり、確かめてからメールを送ったりできる）",
    uses: "使うもの",
    name: "名前",
    passwordHint: "変えるときだけ入れる",
    changed: "変えました",
    test: "つながるか確かめる",
    reauth: "ログインし直す",
    confirmRemove: "もう一度押して外す",
    remove: "このアカウントを外す",
    oauthRemoveNote:
      "外しても、{provider} の側の許しは残ります。止めるなら、{provider}のアカウントの「サードパーティのアクセス」からも外してください。",
  },
  en: {
    added: "Added {label}",
    removed: "Removed {label}",
    calendar: "Calendar",
    mail: "Mail",
    serviceSeparator: ", ",
    notInUse: "Not in use",
    intro:
      "Add accounts such as Google or iCloud to show their calendars and mail on the Calendar and Mail screens and widgets. Your accounts are visible only to you. Accounts set to “Share with household” are also visible to your family and the voice assistant.",
    myAccounts: "My accounts",
    none: "None yet.",
    sharedBadge: "Shared",
    other: "Other",
    oauthUnavailable: "Sign-in for {providers} isn't set up yet. Tap it to open the setup (Extensions → Calendar & Mail).",
    oauthUnavailableMember: "Sign-in for {providers} isn't set up yet. It can be added once an admin sets it up in Extensions → Calendar & Mail.",
    needsSetup: "{provider} (sign-in not set up; tap to open the setup)",
    needsSetupMember: "{provider} (sign-in not set up; an admin can set it up)",
    askAdmin: "An admin sets up sign-in for {provider}. Ask an admin to set it up in Extensions → Calendar & Mail.",
    providerSeparator: " and ",
    sharedAccounts: "Shared household accounts",
    ownerOnly: "Only the person who added it can change it",
    internetAccounts: "Internet Accounts",
    addICloud: "Add iCloud",
    addAccount: "Add account",
    iCloudNote:
      "Enter an app-specific password created on your Apple ID page (account.apple.com) under Sign-In and Security → App-Specific Passwords (your Apple ID password itself won't work). Uses iCloud Mail and Calendar.",
    kind: "Type",
    kindImap: "Mail (IMAP / SMTP)",
    kindCaldav: "Calendar (CalDAV)",
    kindIcal: "Public calendar (iCal URL, read-only)",
    imapServer: "Incoming (IMAP) server",
    imapHint: "For Gmail, imap.gmail.com (use an app password)",
    imapPort: "Incoming port",
    smtpServer: "Outgoing (SMTP) server",
    smtpHint: "Leave empty for read-only",
    smtpPort: "Outgoing port",
    caldavUrl: "CalDAV URL",
    calendarUrl: "Calendar URL",
    icalHint: "Such as Google Calendar's “Secret address in iCal format” or a holiday calendar (webcal:// works too)",
    appleId: "Apple ID (email address)",
    username: "Username",
    appPassword: "App-specific password",
    password: "Password",
    labelOptional: "Name (email address if empty)",
    shareCheck: "Share with household (visible to family and the voice assistant)",
    checking: "Checking the connection…",
    add: "Add",
    useCalendar: "Use calendar",
    useCalendarDetail: "Show on the Calendar screen and events widget",
    useMail: "Use mail",
    useMailDetail: "Show on the Mail screen and mail widget",
    share: "Share with household",
    shareDetail: "Also show to family and the voice assistant (the voice assistant can add events and, after confirming, send mail)",
    uses: "Use for",
    name: "Name",
    passwordHint: "Enter only to change it",
    changed: "Saved",
    test: "Test connection",
    reauth: "Sign in again",
    confirmRemove: "Press again to remove",
    remove: "Remove this account",
    oauthRemoveNote:
      "Removing it here keeps the access granted on the {provider} side. To revoke it, also remove it under third-party access in your {provider} account.",
  },
});

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "add"; type: "icloud" | "other" };

export function AccountsPage({ ctx, account }: ScreenProps) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [accounts, setAccounts] = useState<AccountInfo[] | null>(null);
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  const [view, setView] = useState<View>({ kind: "list" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, available] = await Promise.all([fetchAccounts(ctx), fetchProviders(ctx)]);
      setAccounts(list);
      setProviders(available);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  // ctx は毎分（時刻）変わるので、宛先が変わったときだけ読み直す
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.apiBaseUrl]);

  useEffect(() => {
    void load();
    // Google・Microsoft のログインから戻ってきたときの結果（URL に付いてくる）を出して、URL から外す
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    const error = params.get("error");
    if (added) setMessage({ ok: true, text: messages.t("added", { label: added }) });
    if (error) setMessage({ ok: false, text: error });
    if (params.has("settings")) window.history.replaceState(null, "", window.location.pathname);
  }, [load]);

  const done = (text: string) => {
    setMessage({ ok: true, text });
    setView({ kind: "list" });
    void load();
  };

  if (view.kind === "add")
    return <AddForm ctx={ctx} type={view.type} onBack={() => setView({ kind: "list" })} onAdded={(a) => done(t("added", { label: a.label }))} />;

  const opened = view.kind === "detail" ? accounts?.find((a) => a.id === view.id) : null;
  if (opened)
    return (
      <AccountDetail
        ctx={ctx}
        account={opened}
        onBack={() => setView({ kind: "list" })}
        onChanged={() => void load()}
        onRemoved={() => done(t("removed", { label: opened.label }))}
      />
    );

  const isAdmin = account.role === "admin";
  /**
   * Google・Microsoft のボタン。ログインの設定（OAuth のアプリ）がまだなら、薄くせずに「設定がまだ」の印を付け、
   * 押すと設定のその場所を開く（設定できるのは管理者だけなので、メンバーには頼み方を出す）
   */
  const oauthButton = (provider: "google" | "microsoft", label: string) =>
    providers[provider] ? (
      <Button icon="add" onClick={() => void startOAuth(ctx, provider).catch((err) => setMessage({ ok: false, text: err.message }))}>
        {label}
      </Button>
    ) : (
      <Button
        icon="warning"
        className="[&_.fluent-icon]:text-warn"
        aria-label={t(isAdmin ? "needsSetup" : "needsSetupMember", { provider: label })}
        title={t(isAdmin ? "needsSetup" : "needsSetupMember", { provider: label })}
        onClick={() =>
          isAdmin
            ? openSettings({ page: "extensions", extension: "accounts" })
            : setMessage({ ok: false, text: t("askAdmin", { provider: label }) })
        }
      >
        {label}
      </Button>
    );
  const mine = accounts?.filter((a) => a.mine) ?? [];
  const others = accounts?.filter((a) => !a.mine) ?? [];
  const services = (a: AccountInfo) =>
    [a.services.calendar && t("calendar"), a.services.mail && t("mail")].filter(Boolean).join(t("serviceSeparator")) || t("notInUse");

  return (
    <div className="flex flex-col gap-1">
      <Note>{t("intro")}</Note>
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      <SectionTitle>{t("myAccounts")}</SectionTitle>
      {accounts === null ? (
        <Note>{tc("loading")}</Note>
      ) : mine.length === 0 ? (
        <Note>{t("none")}</Note>
      ) : (
        <List label={t("myAccounts")}>
          {mine.map((a) => (
            <ListItem
              key={a.id}
              title={a.label}
              badge={a.shared ? t("sharedBadge") : undefined}
              detail={`${providerLabel(a.provider, locale)} · ${services(a)}`}
              onClick={() => {
                setMessage(null);
                setView({ kind: "detail", id: a.id });
              }}
            />
          ))}
        </List>
      )}
      <ButtonRow>
        {oauthButton("google", "Google")}
        <Button icon="add" onClick={() => setView({ kind: "add", type: "icloud" })}>
          iCloud
        </Button>
        {oauthButton("microsoft", "Microsoft")}
        <Button icon="add" onClick={() => setView({ kind: "add", type: "other" })}>
          {t("other")}
        </Button>
      </ButtonRow>
      {(!providers.google || !providers.microsoft) && (
        <Note>
          {t(isAdmin ? "oauthUnavailable" : "oauthUnavailableMember", {
            providers: [!providers.google && "Google", !providers.microsoft && "Microsoft"].filter(Boolean).join(t("providerSeparator")),
          })}
        </Note>
      )}
      {others.length > 0 && (
        <>
          <SectionTitle>{t("sharedAccounts")}</SectionTitle>
          <List label={t("sharedAccounts")}>
            {others.map((a) => (
              <ListItem key={a.id} title={a.label} detail={`${providerLabel(a.provider, locale)} · ${services(a)} · ${t("ownerOnly")}`} />
            ))}
          </List>
        </>
      )}
    </div>
  );
}

function AddForm({
  ctx,
  type,
  onBack,
  onAdded,
}: {
  ctx: ScreenProps["ctx"];
  type: "icloud" | "other";
  onBack: () => void;
  onAdded: (account: AccountInfo) => void;
}) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const [kind, setKind] = useState<"icloud" | "imap" | "caldav" | "ical">(type === "icloud" ? "icloud" : "imap");
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const account = await addAccount(ctx, {
        provider: kind,
        label,
        username,
        password,
        shared,
        imap: kind === "imap" ? { host: imapHost, port: imapPort, secure: imapPort !== "143" } : undefined,
        smtp: kind === "imap" && smtpHost ? { host: smtpHost, port: smtpPort, secure: smtpPort === "465" } : undefined,
        calendarUrl: kind === "caldav" || kind === "ical" ? calendarUrl : undefined,
      });
      onAdded(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-1" onSubmit={(e) => void submit(e)}>
      <BackButton label={t("internetAccounts")} onClick={onBack} />
      <SectionTitle>{kind === "icloud" ? t("addICloud") : t("addAccount")}</SectionTitle>
      {kind === "icloud" && (
        <Note>{t("iCloudNote")}</Note>
      )}
      <Group>
        <fieldset className="m-0 border-0 p-0" disabled={busy}>
          {type === "other" && (
            <Field label={t("kind")}>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="imap">{t("kindImap")}</option>
                <option value="caldav">{t("kindCaldav")}</option>
                <option value="ical">{t("kindIcal")}</option>
              </select>
            </Field>
          )}
          {kind === "imap" && (
            <>
              <Field label={t("imapServer")} hint={t("imapHint")}>
                <input value={imapHost} placeholder="imap.example.com" onChange={(e) => setImapHost(e.target.value)} />
              </Field>
              <Field label={t("imapPort")}>
                <input inputMode="numeric" value={imapPort} onChange={(e) => setImapPort(e.target.value)} />
              </Field>
              <Field label={t("smtpServer")} hint={t("smtpHint")}>
                <input value={smtpHost} placeholder="smtp.example.com" onChange={(e) => setSmtpHost(e.target.value)} />
              </Field>
              <Field label={t("smtpPort")}>
                <input inputMode="numeric" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </Field>
            </>
          )}
          {(kind === "caldav" || kind === "ical") && (
            <Field
              label={kind === "caldav" ? t("caldavUrl") : t("calendarUrl")}
              hint={kind === "ical" ? t("icalHint") : undefined}
            >
              <input value={calendarUrl} placeholder="https://…" onChange={(e) => setCalendarUrl(e.target.value)} />
            </Field>
          )}
          {kind !== "ical" && (
            <>
              <Field label={kind === "icloud" ? t("appleId") : t("username")}>
                <input value={username} autoComplete="off" spellCheck={false} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label={kind === "icloud" ? t("appPassword") : t("password")}>
                <input type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          )}
          <Field label={t("labelOptional")}>
            <input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Check checked={shared} onChange={setShared}>
            {t("shareCheck")}
          </Check>
        </fieldset>
        {error && <Message tone="error">{error}</Message>}
        <ButtonRow>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? t("checking") : t("add")}
          </Button>
          <Button onClick={onBack}>{tc("cancel")}</Button>
        </ButtonRow>
      </Group>
    </form>
  );
}

function AccountDetail({
  ctx,
  account,
  onBack,
  onChanged,
  onRemoved,
}: {
  ctx: ScreenProps["ctx"];
  account: AccountInfo;
  onBack: () => void;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const t = messages.useT();
  const tc = commonMessages.useT();
  const locale = useLocale();
  const [label, setLabel] = useState(account.label);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const oauth = account.provider === "google" || account.provider === "microsoft";

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await work();
      if (text) setMessage({ ok: true, text });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  const patch = (input: Record<string, unknown>, text?: string) =>
    run(async () => {
      await updateAccount(ctx, account.id, input);
      return text;
    });

  const toggles: { key: "calendar" | "mail" | "shared"; title: string; detail: string; checked: boolean }[] = [
    ...(account.supports.calendar
      ? [{ key: "calendar" as const, title: t("useCalendar"), detail: t("useCalendarDetail"), checked: account.services.calendar }]
      : []),
    ...(account.supports.mail
      ? [{ key: "mail" as const, title: t("useMail"), detail: t("useMailDetail"), checked: account.services.mail }]
      : []),
    {
      key: "shared",
      title: t("share"),
      detail: t("shareDetail"),
      checked: account.shared,
    },
  ];

  return (
    <div className="flex flex-col gap-1">
      <BackButton label={t("internetAccounts")} onClick={onBack} />
      <SectionTitle>{account.label}</SectionTitle>
      <Note>
        {providerLabel(account.provider, locale)}
        {account.email && ` · ${account.email}`}
        {account.username && account.username !== account.email && ` · ${account.username}`}
      </Note>
      <List label={t("uses")}>
        {toggles.map((toggle) => (
          <ListItem
            key={toggle.key}
            title={toggle.title}
            detail={toggle.detail}
            trailing={
              <ToggleSwitch
                checked={toggle.checked}
                disabled={busy}
                label={toggle.title}
                onChange={(on) =>
                  void patch(toggle.key === "shared" ? { shared: on } : { services: { ...account.services, [toggle.key]: on } })
                }
              />
            }
          />
        ))}
      </List>
      <Group>
        <Field label={t("name")}>
          <input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        {account.username !== null && (
          <Field label={t("password")} hint={t("passwordHint")}>
            <input type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <ButtonRow>
          <Button
            variant="primary"
            disabled={busy || (label === account.label && !password)}
            onClick={() =>
              void patch({ label, ...(password ? { password } : {}) }, t("changed")).then(() => setPassword(""))
            }
          >
            {tc("save")}
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await testAccount(ctx, account.id);
                if (!result.ok) throw new Error(result.message);
                return result.message;
              })
            }
          >
            {t("test")}
          </Button>
          {oauth && (
            <Button disabled={busy} onClick={() => void startOAuth(ctx, account.provider as "google" | "microsoft", account.id)}>
              {t("reauth")}
            </Button>
          )}
        </ButtonRow>
      </Group>
      {message && <Message tone={message.ok ? "ok" : "error"}>{message.text}</Message>}
      <ButtonRow>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() =>
            removing
              ? void run(async () => {
                  await removeAccount(ctx, account.id);
                  onRemoved();
                })
              : setRemoving(true)
          }
        >
          {removing ? t("confirmRemove") : t("remove")}
        </Button>
      </ButtonRow>
      {oauth && (
        <Note>{t("oauthRemoveNote", { provider: providerLabel(account.provider, locale) })}</Note>
      )}
    </div>
  );
}
