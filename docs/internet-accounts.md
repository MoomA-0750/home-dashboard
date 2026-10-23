# インターネットアカウント（カレンダー・メール）

Google・iCloud・Microsoft・一般（IMAP・CalDAV・公開カレンダー）のアカウントを、ダッシュボードにログインした人ごとに登録して、
カレンダーとメールを Calendar・Mail の画面、「予定」「メール」のウィジェット、音声アシスタントで使う。

- 足す・変える・外すのは、設定の「アカウント → インターネットアカウント」（ログインした人なら誰でも。自分のアカウントだけ）
- 自分のアカウントは自分にだけ見える。「家で共有する」にしたものは、家族と音声アシスタントにも見える
  （音声アシスタントはだれが話しかけたか分からないので、家で共有のものだけを使う。予定を足したり、読み上げて了承をもらってからメールを送ったりできる）
- パスワード・トークンは `data/extension-data/accounts/accounts.json`（持ち主だけが読める）に置き、画面には返さない
- 前のメールの拡張機能の設定（`.env` の `MAIL_*`）は、「家のアカウント」（家で共有・管理者が変える）として一度だけ移る

拡張機能「カレンダー・メール」（`extensions/accounts`）が、アカウントを置いてつなぎ、Calendar・Mail の画面と「予定」「メール」のウィジェット、
音声アシスタントの `list_events`・`create_event`・`update_event`・`delete_event`・`list_mail`・`read_mail`・`send_mail` を持つ。
ほかの拡張機能も、機能の口「calendar」「mail」に入れば、同じ画面・ウィジェット・音声アシスタントに出る（型は `extensions/accounts/src/calendar/types.ts`・`mail/types.ts`）。

## iCloud

Apple ID のページ（https://account.apple.com）の「サインインとセキュリティ → App 用パスワード」でパスワードを作り、
設定の「インターネットアカウント → iCloud」に Apple ID（メールアドレス）と一緒に入れる。iCloud のメール（IMAP・SMTP）と
カレンダー（CalDAV）を使う。

## そのほか

- **メール（IMAP・SMTP）**: サーバー・ポート・ユーザー名・パスワード。Gmail を IMAP で読むなら `imap.gmail.com` と
  「アプリパスワード」（https://myaccount.google.com/apppasswords）。送信のサーバーを空にすると読むだけ
- **カレンダー（CalDAV）**: CalDAV の URL・ユーザー名・パスワード（Nextcloud・Fastmail など）
- **公開カレンダー（iCal の URL）**: 見るだけ。Google カレンダーの「iCal 形式の非公開 URL」、祝日のカレンダーなど

## Google・Microsoft（管理者が一度だけ）

Google・Microsoft はログイン（OAuth）で足す。そのために、管理者が自分たち用の「クライアント」を一度作り、
設定の「拡張機能 → カレンダー・メール」に入れる（`.env` の `GOOGLE_*`・`MICROSOFT_*`・`ACCOUNTS_REDIRECT_BASE` でもよい）。
接続設定は Google・Microsoft の区画に分かれていて、使うほうだけ埋めればよい。下の手順は、それぞれの区画の「手順」でも見られる
（リダイレクト URI は、入れた「戻り先の URL の頭」で埋めて出る）。

**戻り先の URL の頭**には、このダッシュボードを開いている https の URL を入れる（例: `https://general-console.<tailnet>.ts.net:10448`）。
ログインのあと、ここへ戻ってくる。IP アドレス（`https://192.168.1.10`）は Google が受け付けない。

### Google

1. https://console.cloud.google.com でプロジェクトを作る
2. 「API とサービス → ライブラリ」で **Google Calendar API** と **Gmail API** を有効にする
3. 「Google Auth Platform（OAuth 同意画面）」で、ユーザーの種類を「外部」にして、アプリ名とメールを入れる。
   「データアクセス」に `https://www.googleapis.com/auth/calendar`・`https://www.googleapis.com/auth/gmail.modify`・
   `https://www.googleapis.com/auth/gmail.send` を足す
4. **公開ステータスを「本番環境」にする**（「テスト」のままだと、ログインが7日で切れる）。Google の確認を受けていないので、
   ログインのときに「確認されていないアプリ」と出る。自分たちで作ったものなので「詳細 → 移動」で進む
5. 「クライアント → クライアントを作成」で種類を「ウェブ アプリケーション」にし、承認済みのリダイレクト URI に
   `<戻り先の URL の頭>/auth/accounts/google/callback` を入れる。できたクライアント ID とシークレットを設定に入れる

### Microsoft（Outlook.com・Microsoft 365）

1. https://entra.microsoft.com の「アプリの登録 → 新規登録」で、サポートされるアカウントの種類を
   「任意の組織ディレクトリ内のアカウントと個人の Microsoft アカウント」にし、リダイレクト URI（Web）に
   `<戻り先の URL の頭>/auth/accounts/microsoft/callback` を入れる
2. 「証明書とシークレット」で新しいクライアント シークレットを作る（期限が来たら作り直して入れ替える）
3. 「API のアクセス許可」で Microsoft Graph の委任されたアクセス許可 `Calendars.ReadWrite`・`Mail.ReadWrite`・`Mail.Send`・
   `User.Read`・`offline_access` を足す
4. アプリケーション（クライアント）ID とシークレットを設定に入れる（テナントは個人と職場の両方なら `common`）

## 気をつけること

- ログインが切れたら（パスワードを変えた・許しを外したなど）、設定の「アカウント → インターネットアカウント」でそのアカウントを開き「ログインし直す」
- 外しても、Google・Microsoft の側の許しは残る。止めるなら、それぞれのアカウントの「サードパーティのアクセス」からも外す
- 繰り返しの予定を変える・消すと、サービスによっては繰り返し全体が変わる（iCloud・一般の CalDAV）
- 送ったメールは、Gmail と Microsoft では送信済みに入る。IMAP・SMTP（iCloud・一般）では送信済みに入らないことがある
