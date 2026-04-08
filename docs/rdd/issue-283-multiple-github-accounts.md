# Issue #283 RDD: 1 Upflow organization に複数の GitHub App installation を紐づける

## 背景・課題

2026-04-07 時点の Upflow は、1 organization に対して 1 つの GitHub App installation しか前提にしていません。

- shared DB `github_app_links` は [`db/shared.sql`](../../db/shared.sql) で `PRIMARY KEY (organization_id)` を持ち、1 org 1 row です。
- query 層の [`app/services/github-integration-queries.server.ts`](../../app/services/github-integration-queries.server.ts) は `getGithubAppLink()` を 1 件返します。
- Octokit 解決の [`app/services/github-octokit.server.ts`](../../app/services/github-octokit.server.ts) は `resolveOctokitFromOrg({ integration, githubAppLink })` で org 単位の単一 link を前提にします。
- crawl / backfill の [`app/services/jobs/crawl.server.ts`](../../app/services/jobs/crawl.server.ts), [`app/services/jobs/backfill.server.ts`](../../app/services/jobs/backfill.server.ts) は、org ごとに 1 つの Octokit を作り、その Octokit で全 repository を処理します。
- repository 追加画面の [`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx) も `getGithubAppLink()` + `resolveOctokitFromOrg()` を使い、単一 installation 前提です。
- PR webhook の [`app/services/github-webhook-pull.server.ts`](../../app/services/github-webhook-pull.server.ts) は `installation.id` から org を 1 件解決したあと、tenant `repositories` を `owner + repo` だけで引きます。

このため、同一 Upflow organization で以下を同時に扱えません。

- 個人アカウントに install した GitHub App で見える private repository
- GitHub Organization に install した GitHub App で見える repository
- 別の personal account / org account ごとに権限が分かれる repository

Issue #283 の目的は、1 Upflow organization に複数の GitHub App installation をぶら下げ、repository ごとにどの installation を使って fetch / crawl / webhook 処理するかを決定できるようにすることです。

## 現状実装の確認

### 1. shared DB は 1 org 1 installation 固定

[`db/shared.sql`](../../db/shared.sql) の `github_app_links` は次を持ちます。

- `PRIMARY KEY (organization_id)`
- `UNIQUE (installation_id)`
- `UNIQUE (github_account_id)`

このうち `PRIMARY KEY (organization_id)` が、1 org に複数 installation を持てない直接原因です。

### 2. `integrations` は org 単位の認証モードを表している

[`db/shared.sql`](../../db/shared.sql) の `integrations` は `UNIQUE (organization_id)` です。  
[`app/routes/$orgSlug/settings/integration/index.tsx`](../../app/routes/$orgSlug/settings/integration/index.tsx) と [`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`](../../app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx) も、org 単位で次を扱っています。

- `method = 'token' | 'github_app'`
- `private_token`
- `app_suspended_at`

つまり `integrations` は installation ごとの row ではなく、org の「現在どの認証方式を使うか」と「PAT を保持しているか」を表す shared state です。

加えて、現行 [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) は `installation.suspend` / `installation.unsuspend` で `integrations.app_suspended_at` を更新しており、suspend 状態も org 単位 1 値に潰れています。

### 3. tenant `repositories` には installation 識別子がない

[`db/tenant.sql`](../../db/tenant.sql) の `repositories` は `integration_id` を持ちますが、`github_installation_id` はありません。  
[`app/routes/$orgSlug/settings/repositories.add/+functions/mutations.server.ts`](../../app/routes/$orgSlug/settings/repositories.add/+functions/mutations.server.ts) も `integrationId` しか保存していません。

そのため現在は「この repository をどの GitHub App installation で取得するか」を DB に保存できません。

### 4. webhook は installation 単位更新になっていない

[`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) では:

- `findActiveLinkByInstallationOrAccount()` が `installation_id` または `github_account_id` のどちらかで 1 row を引く
- `handleInstallationCreated()` は `organizationId` 単位 UPDATE
- `handleInstallationDeleted()` / `handleInstallationRepositories()` も `organizationId` 単位 UPDATE

複数 installation 化すると、これは対象 installation 以外の row まで誤更新する設計です。

### 5. batch 側の crawl パイプラインは広く影響を受ける

実際に `rg` で確認すると、単一 installation 前提の影響範囲は `batch/db/queries.ts` だけではありません。

- [`app/services/jobs/crawl.server.ts`](../../app/services/jobs/crawl.server.ts)
- [`app/services/jobs/backfill.server.ts`](../../app/services/jobs/backfill.server.ts)
- [`batch/db/queries.ts`](../../batch/db/queries.ts)
- [`batch/commands/crawl.ts`](../../batch/commands/crawl.ts)
- [`batch/commands/backfill.ts`](../../batch/commands/backfill.ts)
- [`batch/commands/helpers.ts`](../../batch/commands/helpers.ts)
- [`batch/job-scheduler.ts`](../../batch/job-scheduler.ts)
- [`batch/config/index.ts`](../../batch/config/index.ts)
- [`batch/github/backfill-repo.ts`](../../batch/github/backfill-repo.ts)

補足:

- 現行 repo に `batch/provider/` ディレクトリは存在しません。実在する batch 影響先は上記です。
- `batch/github/fetcher.ts` と `batch/github/backfill-repo.ts` 自体は Octokit を引数で受けるため、主変更点は「どこでその Octokit を repository 単位に選ぶか」です。

## 設計判断

### 1. `integrations.method = 'token'` に戻す意味を明確化する

現行コードでは `method='token'` でも `private_token` が空なら [`app/services/github-octokit.server.ts`](../../app/services/github-octokit.server.ts) の `assertOrgGithubAuthResolvable()` は `No auth configured` を投げます。  
つまり `method='token'` は「PAT が必ず使える」意味ではなく、正確には「org の実効認証方式として GitHub App ではなく PAT 系を選んでいる」状態です。

本 RDD では未接続状態を次で定義します。

- `integrations.method = 'github_app'` かつ active `github_app_links` が 1 件以上:
  - 接続済み GitHub App モード
- `integrations.method = 'token'` かつ `private_token IS NOT NULL`:
  - PAT で即時に GitHub API を使える状態
- `integrations.method = 'token'` かつ `private_token IS NULL`:
  - 未接続状態
  - UI は PAT 入力を要求し、crawl / compare / search は認証未設定として失敗またはスキップする

したがって「token に戻す」の定義は次です。

- 最後の active installation を失ったとき、`integrations.method` を `token` に更新する
- 同時に `private_token` が残っていれば PAT モードへ即復帰する
- `private_token` が無ければ未接続状態へ遷移する

`github_app` 以外の第 3 状態を `integrations.method` に追加する案もありえますが、現行 schema / UI / validation (`z.enum(['token', 'github_app'])`) の影響範囲が広いため、本 issue では採りません。

### 1.5. suspend 状態は installation 単位で `github_app_links.suspended_at` に持たせる

結論:

- `github_app_links` に `suspended_at TEXT NULL` を追加する
- `installation.suspend` / `installation.unsuspend` は対象 installation row の `suspended_at` だけを更新する
- `integrations.app_suspended_at` はこの issue の migration で削除する

理由:

- 現行 [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) は installation を特定したあと更新先だけ `integrations` に切り替えており、複数 installation では対象外 row まで巻き込みます
- 現行 UI [`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`](../../app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx) は `integration.appSuspendedAt` に依存して connected/suspended を判定しているため、installation 単位表示ができません
- `integrations` は引き続き org の auth mode と PAT fallback を持つ shared state に留め、installation 固有状態は `github_app_links` に集約した方が責務が一致します

具体ルール:

- setup callback [`app/routes/api.github.setup.ts`](../../app/routes/api.github.setup.ts) は upsert 時に `suspended_at = NULL` を保存する
- webhook [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) は `installation.suspend` で対象 row の `suspended_at = now`、`installation.unsuspend` で `NULL` に戻す
- integration loader [`app/routes/$orgSlug/settings/integration/index.tsx`](../../app/routes/$orgSlug/settings/integration/index.tsx) は `integrations.appSuspendedAt` を返さず、`githubAppLinks[]` の各 row に `suspendedAt` を載せる
- migration は `github_app_links.suspended_at` 追加とコード切替を先に行い、後段の backfill ルールに従って `integrations.app_suspended_at` から必要な row だけコピーしたうえで、全 reader/writer が旧列を参照しなくなった後に `integrations.app_suspended_at` を削除する

### 2. `UNIQUE (github_account_id)` は外す

結論: `UNIQUE (github_account_id)` は廃止します。

理由:

- #283 の本来の狙いには「同一 personal GitHub account を複数 Upflow org で追跡したい」ユースケースが含まれうる
- GitHub App installation の一意実体は `installation_id` であり、`github_account_id` は account owner を表すだけです
- 同一 account owner に対して、異なる Upflow org がそれぞれ別 repository 群を管理したいケースを `UNIQUE (github_account_id)` が不必要に塞いでいます
- 現行の [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) にある `installation_id or github_account_id` fallback lookup は、単一 link 前提の暫定実装であり、複数 org / 複数 installation を正しく解決するキーではありません

スキーマへの影響:

- `github_app_links` から `UNIQUE (github_account_id)` を削除する
- 必要なら検索用に非 unique index `github_app_links_github_account_id_idx` を置く

webhook 解決への影響:

- `findActiveLinkByInstallationOrAccount()` は廃止する
- installation webhook / PR webhook の link 解決は `installation_id` のみを正とする
- `installation.created` が setup callback より先に届き、まだ `github_app_links` row が無い場合は何もしない
- org との初回紐付けの正本は引き続き [`app/routes/api.github.setup.ts`](../../app/routes/api.github.setup.ts) の `state` ベース callback とする

この変更により、「同じ GitHub account owner を複数 Upflow org で使えない」という制約を外しつつ、webhook 解決は `installation_id` で一意に保てます。

### 3. `integrations.private_token` は維持するが、意味を org-scoped fallback に限定する

結論: `integrations.private_token` は維持します。

ただし意味は明確に限定します。

- `private_token` は特定の GitHub App account の権限を表すものではない
- `private_token` は Upflow organization 全体の代替認証情報であり、`integrations.method='token'` のときだけ実際に使用する
- `integrations.method='github_app'` の間は保持されていても runtime では使わない
- 役割は「最後の active installation を失ったときに PAT に戻れるようにする fallback 保存」と「明示的に PAT モードへ戻す運用経路を残すこと」

維持する理由:

- 現行の settings UI / `upsertIntegration()` / `disconnectGithubApp()` が PAT 保存を前提にしている
- PAT only org を壊さずに multi-installation 化できる
- setup callback の [`app/routes/api.github.setup.ts`](../../app/routes/api.github.setup.ts) も、既存 PAT を消さずに `method='github_app'` へ切り替える設計です

廃止しない代わりのルール:

- `private_token` を GitHub App repository lookup の fallback として使ってはいけない
- repository に `github_installation_id` が必要な経路で、PAT に自動フォールバックして repository 権限差を曖昧にしてはいけない
- PAT fallback は org 全体で明示的に `method='token'` に戻したときだけ使う

## 要件

### 機能要件

1. 1 Upflow organization は複数の active GitHub App installation を保持できること。
2. 各 active installation は shared DB 上で organization に紐づき、`installation_id` は全 organization を通じて一意であること。
3. `github_account_id` は owner 情報として保持するが、複数 Upflow org での再利用を許可すること。`UNIQUE (github_account_id)` は持たないこと。
4. 各 tenant `repositories` row は、GitHub App 認証を使う場合に「どの installation で fetch する repository か」を `github_installation_id` として保持できること。
5. crawl / backfill / repository detail refresh / PR webhook / GitHub user search は、org 単位ではなく repository 単位または明示選択された installation 単位で Octokit を解決すること。
6. GitHub App 経由の repository 追加 UI は、複数 installation のうちどれから repository 一覧を取るか選択できること。
7. GitHub Users 画面の `searchGithubUsers()` は、複数 installation 接続時に「どの installation 権限で search.users を呼ぶか」を UI で明示選択させること。
8. `installation.deleted` / `installation.suspend` / `installation.unsuspend` / `installation_repositories` webhook は、対象 installation row のみを更新できること。
9. PR 系 webhook (`pull_request`, `pull_request_review`, `pull_request_review_comment`) は installation_id と repository 座標の両方で対象 repository を解決し、誤った tenant repository を crawl しないこと。
10. 既存の PAT 連携 (`integrations.method='token'`) は維持すること。`integrations.private_token` は org-scoped fallback credential として保存を継続し、最後の active installation を失ったときだけ PAT モードまたは未接続状態へ戻すこと。
11. 未接続状態は `integrations.method='token'` かつ `private_token IS NULL` と定義すること。要件・UI・受け入れ条件でこの表現を統一すること。
12. 同一 `owner/repo` は tenant `repositories` に常に 1 row だけ保持し、GitHub App モードでは canonical installation を `github_installation_id` で表すこと。
13. personal account と GitHub organization は installation ごとに区別して表示でき、GitHub 側設定リンクも account type に応じて分岐できること。

### 非機能要件

1. Multi-tenant 規約に従い、shared DB 更新では server-derived な `organizationId` を使うこと。callback 起点の更新は `github_app_install_states` から解決し、クライアント入力の org 情報を信用しないこと。
2. webhook で cross-tenant 誤更新を起こさないこと。installation から org を引くときは shared DB の active link を使い、`github_account_id` への曖昧 fallback に依存しないこと。
3. 既存の日時方針に従い、新規・更新する `created_at` / `updated_at` / `deleted_at` / `suspended_at` は ISO 8601 の UTC (`...Z`) を使うこと。
4. org 単位 Octokit 共有ができなくなることによる crawl / backfill / compare の性能劣化を、repository 数に対して許容可能な範囲に収めること。
5. 既存データ移行後も `pnpm db:apply` と `pnpm db:setup` で再現可能であること。destructive な schema 変更は migration で安全に行うこと。
6. クライアントが選んだ `installationId` は信頼せず、server-side で「現在 org の link か」「`deleted_at IS NULL` かつ `suspended_at IS NULL` か」を必ず検証すること。最低でも [`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx) の GitHub App loader/action 境界と [`app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts`](../../app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts) の検索 API 境界で強制すること。
7. shared DB と tenant DB の cross-store 更新は atomic transaction にできない前提で、更新順・再試行・補償・監査ログ・冪等性を設計として明文化すること。

## スキーマ変更

### 1. shared DB `github_app_links`

対象: [`db/shared.sql`](../../db/shared.sql)

変更:

- `PRIMARY KEY (organization_id)` を廃止する
- `PRIMARY KEY (organization_id, installation_id)` に変更する
- `UNIQUE (installation_id)` は維持する
- `UNIQUE (github_account_id)` は削除する
- `suspended_at TEXT NULL` を追加する
- `github_account_type TEXT NULL` を追加する
- `membership_initialized_at TEXT NULL` を追加する（`repository_installation_memberships` の初期投入が完了した時刻。`NULL` は未初期化を意味する）
- 必要なら `INDEX (github_account_id)` を追加する

理由:

- installation が GitHub App 接続の一意実体であり、複数 installation をぶら下げるには `organization_id` 単独主キーを外す必要がある
- `installation_id` は webhook / callback / Octokit 解決の正引きキーとして維持が必要
- `github_account_id` は ownership 情報であって installation の一意キーではない
- `suspended_at` は [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) の suspend 更新を installation 単位にするために必要
- `github_account_type` は [`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`](../../app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx) が現状 `githubOrg` だけで org URL を組み立てているため、personal account URL (`/settings/installations/:id`) と wording を正しく分岐する材料として必要

migration:

- shared DB migration で `github_app_links` を再作成し、複合主キー・`suspended_at`・`github_account_type`・`membership_initialized_at` を持つ新 schema に置き換える
- 既存 row は `organization_id`, `installation_id`, `github_account_id`, `github_org`, `app_repository_selection`, `deleted_at`, `created_at`, `updated_at` をコピーし、`suspended_at` / `github_account_type` / `membership_initialized_at` は `NULL` で初期化する
- `github_account_type` は setup callback [`app/routes/api.github.setup.ts`](../../app/routes/api.github.setup.ts) と `installation.created` webhook で以後埋める
- `membership_initialized_at` は setup callback での初期投入成功時、または crawl の自動 repair 経路で埋める。既存 row は migration 直後 `NULL` のまま放置し、初回 repair で初期化される

### 2. tenant DB `repositories`

対象: [`db/tenant.sql`](../../db/tenant.sql)

追加:

- `github_installation_id INTEGER NULL`
- `CREATE INDEX repositories_github_installation_id_idx ON repositories (github_installation_id)`

意味:

- `integrations` は org の認証モードと PAT fallback を表す
- `repositories.github_installation_id` は、その repository を GitHub App で取得するときに使う installation を表す
- `integrations.method='token'` の repository は `github_installation_id = NULL` でよい
- `integrations.method='github_app'` の新規追加 repository は `github_installation_id NOT NULL` をアプリケーション層で保証する

unique 制約について:

- 現行 `repositories_integration_id_owner_repo_key` は、同一 org 内で同じ `owner/repo` を二重登録しない目的なので維持する
- つまり同一 `owner/repo` を複数 installation から見えても、tenant 上は 1 repository row に正規化する
- installation の違いは row 自体ではなく `github_installation_id` の値で表す

本 issue では、同一 org 内で同一 `owner/repo` を installation ごとに重複登録する要件は含めません。

canonical installation 再割当ルール:

- `github_installation_id` は「その repository row の canonical installation」を表す
- disconnect 操作または `installation.deleted` で canonical installation が失われた場合:
  - 他に active installation が同じ `owner/repo` を見えており、候補が 1 件だけなら自動でその installation へ reassignment する
  - 候補が 0 件なら repository row は残し、`github_installation_id = NULL` にして「assignment required」状態にする
  - 候補が 2 件以上なら自動 reassignment はしない。`github_installation_id = NULL` にして manual reselection を要求する
- `installation_repositories.removed` で canonical installation から特定 repository が外れた場合も同じルールを適用する
- `installation_repositories.added` は canonical installation の自動乗っ取りをしない。既存 row が `NULL` のときだけ manual assignment 候補として UI / 補助スクリプトから選べるようにする

### 2.5. installation と repository 所属関係は tenant DB の junction table に永続化する

結論:

- installation ごとの repository 所属は tenant DB の `repository_installation_memberships` で永続化する
- 候補比較した選択肢は次の 3 つで、採用は (a)
  - (a) tenant DB junction table `repository_installation_memberships (repository_id, installation_id)`
  - (b) shared DB `github_app_links` 上の JSON column
  - (c) 必要時の GitHub API lookup

採用理由:

- (a) は repository 単位の canonical reassignment 判定に必要な membership 集合を tenant DB だけで引けるため、`installation.deleted` / `installation_repositories.removed` / batch reassignment を同期的かつ安定して処理できる
- (b) は `github_app_links` が shared DB にあり、tenant `repositories` と join できないため、「この tenant repository に他の installation 候補が何件あるか」を判定しにくい
- (c) は現行 [`app/routes/$orgSlug/settings/repositories.add/+functions/get-installation-repos.ts`](../../app/routes/$orgSlug/settings/repositories.add/+functions/get-installation-repos.ts) のような一時 fetch には使えるが、webhook 受信時の削除・再割当を GitHub API 可用性に依存させるため canonical reassignment の正本にできない

schema:

- tenant DB に `repository_installation_memberships` を追加する
- columns:
  - `repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE`
  - `installation_id INTEGER NOT NULL`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT NULL`
- constraints / index:
  - `PRIMARY KEY (repository_id, installation_id)`
  - `INDEX repository_installation_memberships_installation_id_idx (installation_id)`
  - `INDEX repository_installation_memberships_repository_id_idx (repository_id)`

更新タイミング:

- setup callback [`app/routes/api.github.setup.ts`](../../app/routes/api.github.setup.ts):
  - installation 自体の row upsert 後、その installation で選択・可視な repository を取得して membership を初期投入し、成功した場合に限り `github_app_links.membership_initialized_at = now` をセットする
  - GitHub API 呼び出しに失敗した場合でも link 自体は保存する（setup callback の主目的を壊さない）。`membership_initialized_at` は `NULL` のままにし、後段の自動 repair 経路に委ねる
- `installation_repositories.added` / `installation_repositories.removed` webhook [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts):
  - payload に含まれる repository ごとに membership を追加 / soft-delete する
  - canonical installation が外れた repository は、この membership table を正本に候補数を再計算する
  - 対象 link が `membership_initialized_at IS NULL` のままだった場合は、payload を merge した上で repair 経路にも初期化を委ねる（webhook payload は必ずしも全 repository を含まないため、この時点で `membership_initialized_at` をセットしてはいけない）
- crawl / backfill:
  - strict lookup 切替前の補助 crawl と専用 backfill CLI が installation ごとの可視 repository を再走査し、membership 欠落や drift を修復する
  - 自動 repair: 定期 crawl ([`batch/job-scheduler.ts`](../../batch/job-scheduler.ts) 経由で起動される [`app/services/jobs/crawl.server.ts`](../../app/services/jobs/crawl.server.ts)) の冒頭で `membership_initialized_at IS NULL` の active link を検出し、`installation_repositories` を再 fetch して membership を埋め、成功時に `membership_initialized_at = now` をセットする
  - 失敗時はリトライ可能な状態 (`membership_initialized_at` は `NULL` のまま) を保ち、cross-store 整合性ルール（tenant first / shared second）と監査ログ (`github_app_link_events`) に従う
  - 同じ webhook / repair が複数回走っても結果が同じになるよう、membership upsert は冪等にする

canonical reassignment での使い方:

- `repositories.github_installation_id` は canonical installation のみを持つ
- `repository_installation_memberships` は「その repository がどの installation から見えているか」の集合を持つ
- canonical installation を失ったときは、`deleted_at IS NULL` の membership 候補数で再割当を決める
  - 1 件なら自動 reassignment
  - 0 件なら `github_installation_id = NULL`
  - 2 件以上なら `github_installation_id = NULL` で manual reselection

未初期化 link のガード:

- canonical reassignment の判定では、`membership_initialized_at IS NOT NULL` の link のみを reassignment 候補として扱う
  - 初期化済み link に紐づく membership は完全な集合と見なせるため、そこからの自動 reassignment は安全
  - `membership_initialized_at IS NULL` の link は候補から除外する。集合が不完全な可能性があり、誤った判定で reassignment すると正しい候補を取り逃すため
- 候補数の判定 (0 / 1 / 2+) は除外後の数で行う
- 「初期化済み候補が 0 件」かつ「未初期化 link が 1 件以上残っている」ケースは、正解が未初期化集合の中にある可能性があるため、`github_installation_id = NULL` (assignment required) に倒す
- 「初期化済み候補が 0 件」かつ「未初期化 link も 0 件」のケースは、純粋に候補が存在しないので `github_installation_id = NULL`
- 該当 link の repair が完了し全 link の `membership_initialized_at` が埋まった後で、batch 補助 CLI が再走査して assignment required の解消を試みる

### 3. `integrations`

対象: [`db/shared.sql`](../../db/shared.sql)

変更しない点:

- `UNIQUE (organization_id)` は維持する
- `method` は `token` / `github_app` の 2 値のままにする
- `private_token` は維持する

変更する点:

- `app_suspended_at` は削除する

追加で明文化する意味:

- `method='github_app'`:
  - active installation を実効認証として使う
- `method='token'` かつ `private_token IS NOT NULL`:
  - PAT モード
- `method='token'` かつ `private_token IS NULL`:
  - 未接続状態

### 4. shared DB `github_app_link_events` (新規 audit log table)

対象: [`db/shared.sql`](../../db/shared.sql)

目的:

- shared / tenant cross-store 更新の監査ログを残し、orphan 検出 / repair / 異常検知の根拠データにする
- canonical reassignment, link soft-delete, membership repair などすべての installation 関連状態変更を記録する

schema:

- table: `github_app_link_events`
- columns:
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `organization_id TEXT NOT NULL` (server-derived。`github_app_links.organization_id` を参照する論理 FK)
  - `installation_id INTEGER NOT NULL`
  - `event_type TEXT NOT NULL` (`link_created` / `link_deleted` / `link_suspended` / `link_unsuspended` / `membership_initialized` / `membership_repaired` / `membership_synced` / `canonical_reassigned` / `canonical_cleared` / `assignment_required`)
  - `source TEXT NOT NULL` (`setup_callback` / `installation_webhook` / `installation_repositories_webhook` / `user_disconnect` / `crawl_repair` / `manual_reassign` / `cli_repair`)
  - `status TEXT NOT NULL` (`success` / `failed` / `skipped`)
  - `details_json TEXT NULL` (任意の payload。失敗時のエラーメッセージ、reassignment の前後値、affected repository ids など)
  - `created_at TEXT NOT NULL` (ISO 8601 UTC)
- indexes:
  - `INDEX github_app_link_events_org_created_idx (organization_id, created_at)` - 組織ごとの時系列クエリ用
  - `INDEX github_app_link_events_installation_idx (installation_id)` - installation 単位の追跡用
  - `INDEX github_app_link_events_event_type_idx (event_type)` - 異常パターン検知用
- 不要な制約:
  - `installation_id` への FK は付けない (`github_app_links` row が hard-delete された場合でもログは残す)

retention:

- 当面は無制限保持する。SQLite のサイズ増加が現実的問題になるまで TTL を入れない
- 将来的に必要なら 90 日 retention を導入し、`created_at < now() - 90 days` の row を別 table へアーカイブする

書き込みポリシー:

- 全 writer は idempotent。同一 `(organization_id, installation_id, event_type, source)` を短時間に複数回受けても、それぞれを別 row として記録してよい (event log の性質上、重複記録は問題ない)
- 失敗時は `status='failed'` で記録し、`details_json` にエラー内容を入れる
- writer は cross-store 整合性ルール (tenant first / shared second) の最後に書き込む。event log 書き込み自体の失敗は warn に留め、本処理を巻き戻さない (event log は監査用途であり、本データの整合性が優先)

例 DDL:

```sql
CREATE TABLE github_app_link_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL,
  installation_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  details_json TEXT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX github_app_link_events_org_created_idx ON github_app_link_events (organization_id, created_at);
CREATE INDEX github_app_link_events_installation_idx ON github_app_link_events (installation_id);
CREATE INDEX github_app_link_events_event_type_idx ON github_app_link_events (event_type);
```

migration:

- PR 1 で table を追加する
- writer は PR 2 (`disconnectGithubAppLink`) / PR 3 (canonical reassignment, repair, webhook) に分散して入る
- backfill は不要 (新規 event のみ記録)

## アプリケーション変更

### 1. query / mutation 層

対象:

- [`app/services/github-integration-queries.server.ts`](../../app/services/github-integration-queries.server.ts)
- [`app/services/github-app-mutations.server.ts`](../../app/services/github-app-mutations.server.ts)
- [`batch/db/queries.ts`](../../batch/db/queries.ts)

変更:

- `getGithubAppLink()` を `getGithubAppLinks()` 配列返却へ変更する
- installation 指定解決用に `getGithubAppLinkByInstallationId()` を追加する
- `disconnectGithubApp(organizationId)` の一括切断だけでは足りないため、`disconnectGithubAppLink(organizationId, installationId)` を追加する
- canonical installation 再割当用に `reassignRepositoryInstallationsAfterLinkChange(...)` を追加する
- repository membership 永続化用に tenant query / mutation を追加する
  - `upsertRepositoryInstallationMemberships(...)`
  - `softDeleteRepositoryInstallationMemberships(...)`
  - `listRepositoryInstallationCandidates(...)`
- 「最後の active installation を切ったときだけ `integrations.method='token'` に戻す」ロジックを mutation に持たせる
- batch の `getOrganization()` / `listAllOrganizations()` も `githubAppLinks[]` と repository の `githubInstallationId` を返す shape に変更する

責務分担:

- user 起点の Disconnect は [`app/services/github-app-mutations.server.ts`](../../app/services/github-app-mutations.server.ts) の `disconnectGithubAppLink()` から canonical installation 再割当 helper を呼ぶ
- GitHub webhook 起点の `installation.deleted` / `installation_repositories` は [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) から同じ helper を呼ぶ
- migration/backfill で一括再計算が必要な場合だけ補助スクリプトを用意して同 helper 相当のロジックを再利用する

cross-store consistency:

- tenant DB と shared DB は別 transaction になるため、更新順は tenant first, shared second で固定する
- rationale:
  - shared first で `github_app_links.deleted_at` だけ先に立つと、runtime は「link は無いが tenant `repositories.github_installation_id` は残る」という即時不整合になる
  - tenant first なら canonical reassignment / `github_installation_id = NULL` / membership 更新が終わるまで link を active に保てるため、失敗時も現行 link で再試行できる
- 実行順:
  1. tenant DB で membership 更新と canonical reassignment を実施する
  2. tenant DB 完了後に shared DB の `github_app_links.deleted_at` または `integrations.method` を更新する
  3. 最後の active link を失ったときだけ `integrations.method='token'` へ戻す
- retry / compensation:
  - tenant 更新失敗時は shared DB を更新しない
  - shared 更新失敗時は tenant 側に再割当済み・shared 側に active link 残存という orphaned state が残りうるため、再試行キューと repair CLI で `github_app_links` と `repositories.github_installation_id` / membership の差分を照合して修復する
  - repair 対象は `deleted_at` 済み installation を canonical に指す repository、membership 0 件なのに canonical が残る repository、shared で deleted なのに tenant membership が active の installation を含む
- audit logging:
  - cross-store 変更の監査ログは shared DB に `github_app_link_events` を追加して記録する
  - event には `organization_id`, `installation_id`, `event_type`, `source` (`user_disconnect` / `installation_deleted` / `installation_repositories_removed` / `repair`), `status`, `details_json`, `created_at` を保存する
- idempotency:
  - repeated webhook / retry を考慮し、membership upsert / soft-delete / canonical reassignment / link soft-delete は同一 installation に対して何度実行しても結果が変わらないようにする
  - `installation.deleted` は既に `deleted_at` が入っていても成功扱いにする
  - `installation_repositories.removed` は対象 membership が既に soft-delete 済みでも成功扱いにする
  - user disconnect と webhook が競合した場合も、最終状態は「link deleted、canonical reassignment 済み」で収束させる

### 2. Octokit 解決

対象:

- [`app/services/github-octokit.server.ts`](../../app/services/github-octokit.server.ts)
- [`app/services/jobs/crawl.server.ts`](../../app/services/jobs/crawl.server.ts)
- [`app/services/jobs/backfill.server.ts`](../../app/services/jobs/backfill.server.ts)
- [`app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`](../../app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx)
- [`app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts`](../../app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts)
- [`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx)

変更:

- `resolveOctokitFromOrg()` 依存を減らし、次の関数を追加する
  - `resolveOctokitForRepository({ integration, githubAppLinks, repository })`
  - `resolveOctokitForInstallation({ integration, installationId })`
- `github_app` モードでは repository の `githubInstallationId` を見て Octokit を決める
- `token` モードでは `private_token` から Octokit を作る
- `searchGithubUsers()` と repositories.add は、repository ではなく「UI で選ばれた installation」から Octokit を作る
- repositories.add / GitHub Users の installation selector は、server-side で active link 検証に通った installation だけを受け付ける

### 3. webhook / setup callback

対象:

- [`app/routes/api.github.setup.ts`](../../app/routes/api.github.setup.ts)
- [`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts)
- [`app/services/github-webhook-shared.server.ts`](../../app/services/github-webhook-shared.server.ts)
- [`app/services/github-webhook-pull.server.ts`](../../app/services/github-webhook-pull.server.ts)

変更:

- setup callback は `(organizationId, installationId)` 単位の UPSERT に変更する
- `onConflict(column('organizationId'))` は使えなくなるため、複合主キーまたは `installation_id` unique を使った upsert に変更する
- `findActiveLinkByInstallationOrAccount()` は削除する
- installation webhook は `installation_id` のみで対象 row を引く
- `installation.deleted` は該当 installation row のみ `deleted_at` をセットする
- `installation.suspend` / `unsuspend` は対象 installation row の `suspended_at` のみ更新する
- setup callback と `installation.created` は `account.type` も保存し、UI が org/personal を区別できるようにする
- `installation_repositories` は payload 上の対象 installation row の `app_repository_selection` だけを更新し、`added` / `removed` repository 一覧が含まれる場合は canonical installation reassignment helper を呼ぶ
- `installation.deleted` / `installation_repositories.removed` の cross-store 更新は tenant first / shared second で行い、shared 更新前に tenant reassignment が失敗した場合は link soft-delete へ進まない
- setup callback / webhook / repair CLI は `repository_installation_memberships` を同じルールで更新し、on-demand API lookup を正本にしない

補足:

- 現行 `integrations.app_suspended_at` は org 単位 1 値で、[`app/services/github-webhook-installation.server.ts`](../../app/services/github-webhook-installation.server.ts) の suspend 処理と [`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`](../../app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx) の UI 判定がそこに依存しています。本 issue で `github_app_links.suspended_at` へ移して依存を外します。

### 4. repository lookup

対象:

- [`app/services/github-webhook-pull.server.ts`](../../app/services/github-webhook-pull.server.ts)
- [`app/routes/$orgSlug/settings/repositories/$repository/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories/$repository/queries.server.ts)
- [`app/routes/$orgSlug/settings/repositories._index/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories._index/queries.server.ts)
- [`app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts)

変更:

- repository 取得時に `githubInstallationId` を必ず select する
- PR webhook は `owner + repo + github_installation_id` で repository を引く
- compare / refresh は repository row から installation を引いて GitHub API を呼ぶ
- repository list / detail でも、どの installation 由来か識別できる情報を出す

## UI 変更

### 1. Integration settings

対象:

- [`app/routes/$orgSlug/settings/integration/index.tsx`](../../app/routes/$orgSlug/settings/integration/index.tsx)
- [`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`](../../app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx)

変更要件:

- loader は `githubAppLinks[]` を返す
- active / deleted / suspended を installation 単位で一覧表示する
- 表示項目:
  - `githubOrg`
  - `githubAccountType`
  - `installationId`
  - `appRepositorySelection`
  - installation 単位の suspended 状態
  - deleted / reconnect required 状態
- `Install GitHub App` は「Add another GitHub account」として複数回実行できる
- Disconnect は installation 単位にする
- 最後の active installation を切った場合だけ:
  - `private_token` があれば PAT モードへ戻る
  - 無ければ未接続状態へ遷移する
- UI 文言上も「未接続状態 = token method without stored PAT」を明示する
- GitHub 側設定リンクは account type で分岐する
  - `Organization` の場合は `https://github.com/organizations/<login>/settings/installations`
  - personal account の場合は `https://github.com/settings/installations/<installationId>`
- wording も account type で分岐する。現行 [`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`](../../app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx) の `Connected to GitHub organization ...` は personal account では使わず、`GitHub account` 等の中立表現に変更する

### 2. Add repositories

対象:

- [`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx)
- [`app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts)
- [`app/routes/$orgSlug/settings/repositories.add/+functions/mutations.server.ts`](../../app/routes/$orgSlug/settings/repositories.add/+functions/mutations.server.ts)

変更要件:

- `integration.method='github_app'` のとき、owner filter より前に installation selector を表示する
- selector 候補は active `githubAppLinks[]`
- 1 件しかなくても selector value は内部的に保持する
- loader / action は受け取った `installationId` が current org の active かつ unsuspended link であることを server-side で検証する
- 選択された installation に対してのみ `fetchAllInstallationRepos(octokit)` を実行する
- 現行 [`app/routes/$orgSlug/settings/repositories.add/index.tsx`](../../app/routes/$orgSlug/settings/repositories.add/index.tsx) の cache key `'app-installation-all-repos'` は installation selector 導入後に使い回せないため、`installationId` を含む key (`app-installation-all-repos:<installationId>`) を必須にする
- repository 追加時に `githubInstallationId` を保存する
- `selected repositories only` の注意文言は installation 単位で表示する

### 3. GitHub Users

対象:

- [`app/routes/$orgSlug/settings/github-users._index/index.tsx`](../../app/routes/$orgSlug/settings/github-users._index/index.tsx)
- [`app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts`](../../app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts)

変更要件:

- `integration.method='github_app'` かつ active installation が 1 件以上ある場合、ユーザー検索 combobox の前に installation selector を置く
- active installation が 1 件ならその installation を初期選択する
- active installation が複数件なら selector 選択を必須にする
- 候補表示 API (`?q=...`) は `installationId` も受け取り、その installation の Octokit で `search.users` を呼ぶ
- 候補表示 API は `installationId` が current org の active / unsuspended link でない場合は検索せず 400 相当を返す
- `token` モードでは selector を表示しない

### 4. Assignment required 運用

対象:

- [`app/routes/$orgSlug/settings/repositories._index/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories._index/queries.server.ts)
- [`app/routes/$orgSlug/settings/repositories/$repository/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories/$repository/queries.server.ts)
- [`app/routes/$orgSlug/settings/repositories._index/index.tsx`](../../app/routes/$orgSlug/settings/repositories._index/index.tsx)
- [`app/routes/$orgSlug/settings/repositories._index/mutations.server.ts`](../../app/routes/$orgSlug/settings/repositories._index/mutations.server.ts)
- batch CLI

変更要件:

- repository list query は [`app/routes/$orgSlug/settings/repositories._index/queries.server.ts`](../../app/routes/$orgSlug/settings/repositories._index/queries.server.ts) で installation 情報を select し、`github_installation_id IS NULL` の row を判定できるようにする
- repository list / detail は `assignment required` badge を表示し、canonical installation 未設定を明示する
- list と detail の両方から installation を再選択できる mutation を追加する
  - 入力は `repositoryId` と `installationId`
  - server-side で current org の active / unsuspended link かつ membership 候補に含まれることを検証する
- batch CLI `reassign-repository-installations` を追加し、candidate 1 件の自動割当と、複数候補 / 候補なしの出力をまとめて実行できるようにする
- scheduled crawl / backfill の skip 対象は repo list 上で運用者が判別できること

## 移行方針

### 1. schema 追加

順序は次で固定します。

1. shared DB で `github_app_links` を複数 row 対応へ変更する
2. tenant DB で `repositories.github_installation_id` を nullable 追加する
3. `github_app_links.suspended_at` / `github_account_type` を読むアプリケーションを deploy する
4. shared DB で `integrations.app_suspended_at` を drop する
5. まだ lookup は切り替えない

この時点では、既存 repository row は `github_installation_id = NULL` のまま残ります。

### 2. アプリケーションを dual-read / dual-write 化する

schema 追加後、lookup 切替前に次を入れます。

- 新規に追加される repository は必ず `github_installation_id` を書く
- setup callback / integration settings は複数 installation を扱える
- crawl / backfill / compare / webhook lookup は、まず `repositories.github_installation_id` を見る
- ただし backfill 未完了の移行期間だけ、`github_installation_id IS NULL` の既存 repository に対して限定 fallback を許す

fallback の定義:

- org に active installation がちょうど 1 件:
  - その installation を一時的に使ってよい
- org に active installation が 0 件:
  - GitHub App auth は未解決。PAT があれば `method='token'` のときのみ使う。`github_app` モードのまま自動 PAT fallback はしない
- org に active installation が 2 件以上:
  - 自動解決してはいけない。`github_installation_id IS NULL` の repository は crawl / backfill / compare / refresh 対象から skip し、assignment required として記録する

scheduled crawl collision 対応:

- 現行 [`batch/job-scheduler.ts`](../../batch/job-scheduler.ts) は org ごとに crawl job を投げ、[`app/services/jobs/crawl.server.ts`](../../app/services/jobs/crawl.server.ts) は org 全 repository を処理します
- schema deploy 後に 2 件目 installation が接続され、backfill 前のまま scheduler が走ると、未割当 repository に対して org-wide single Octokit を誤用する競合が起きます
- そのため dual-read / dual-write 期間の org-wide crawl は次で固定します
  - `github_installation_id IS NOT NULL` の repository はその installation で通常 crawl
  - `github_installation_id IS NULL` かつ active installation が 1 件だけの org は、その installation で暫定 crawl
- `github_installation_id IS NULL` かつ active installation が 2 件以上の org は skip する
- このケースは job 全体 error にはせず、skip 数を log / metric に出して migration 作業対象として見えるようにする
- `integrations.method='github_app'` なのに active installation が 0 件の org は transitional legacy data とみなし、この段階で `integrations.method='token'` へ正規化する。`private_token IS NULL` なら未接続状態、`private_token IS NOT NULL` なら PAT モードに揃える

### 3. backfill 完了後に lookup を切り替える

順序を明示すると次です。

1. schema 追加
2. dual-read / dual-write 対応を deploy
3. 既存 `repositories.github_installation_id` を backfill
4. backfill 完了を検証
5. PR webhook / crawl / backfill / compare / repository detail / GitHub user search の lookup を strict モードへ切り替える

strict モードでは:

- `github_app` repository に `github_installation_id` が無い場合はエラー
- ただし scheduler 起点の org-wide crawl では strict 移行前の一時措置として skip を使い、strict 切替後は `github_installation_id IS NULL` の row 自体が残らないことを前提にする
- PR webhook は `owner + repo + github_installation_id` 一致以外を拾わない
- org 単位単一 link fallback は削除する

### 4. backfill ルール

backfill ルールは次です。

- `integrations.method='token'` の org:
  - すべて `github_installation_id = NULL` のまま
- `integrations.method='github_app'` かつ active installation が 1 件の org:
  - 既存 repository をその `installation_id` で一括 backfill
- `integrations.method='github_app'` かつ active installation が 0 件の org:
  - backfill 対象にはしない
  - これは「最後の active link 喪失前の旧データ」または deploy 境界の transitional legacy data とみなし、先に `integrations.method='token'` へ正規化する
  - `private_token IS NULL` なら未接続状態、`private_token IS NOT NULL` なら PAT モードとして UI に表示する
- `integrations.method='github_app'` かつ active installation が複数件の org:
  - 自動 backfill 不可
  - repository ごとにどの installation へ属するかを判定する補助スクリプトまたは手動割当が必要

補助スクリプトの役割:

- 各 active installation から見える repository 一覧を取得し、`owner/repo -> candidate installationIds[]` を作る
- candidate が 1 件の row は自動で canonical installation を backfill する
- candidate が 0 件または 2 件以上の row は `github_installation_id = NULL` のまま残し、manual reselection 対象一覧を出力する

現状データでは migration 実行時に active installation が複数件存在しません。  
ただし、schema deploy 後から strict lookup 切替前までに追加接続されるケースがあるため、RDD としては上記の多件ケースまで定義しておきます。

### 5. `integrations.app_suspended_at` 既存データの backfill

移行ルール:

- `integrations.app_suspended_at IS NULL` の org は何もしない
- `integrations.app_suspended_at IS NOT NULL` かつ active `github_app_links` がちょうど 1 件の org:
  - その 1 件の `github_app_links.suspended_at` に同値をコピーする
- `integrations.app_suspended_at IS NOT NULL` かつ active link が 0 件または複数件の org:
  - 自動コピーしない
  - 0 件なら org は前述の正規化で `method='token'` へ戻し、旧列は drop 前に無視できる状態へ寄せる
  - 複数件なら suspend 対象 installation を旧列だけでは特定できないため、全 link を `suspended_at = NULL` のままにし、運用確認対象として audit log / migration report に載せる

UI 整合:

- integration settings UI は migration 後、`github_app_links.suspended_at` だけを表示根拠にする
- 旧 `integrations.app_suspended_at` 由来の suspended 表示は残さない

## batch / crawl パイプライン影響範囲

Issue 本文の「batch 側の crawl パイプライン（org -> 単一 Octokit 前提の箇所すべて）」に対応する実ファイルは次です。

- [`app/services/jobs/crawl.server.ts`](../../app/services/jobs/crawl.server.ts)
  - 現在は 1 回だけ `resolveOctokitFromOrg()` して全 repository に使い回している
- [`app/services/jobs/backfill.server.ts`](../../app/services/jobs/backfill.server.ts)
  - 現在は 1 回だけ `resolveOctokitFromOrg()` して全 repository に使い回している
- [`batch/db/queries.ts`](../../batch/db/queries.ts)
  - `getGithubAppLinkByOrgId()` / `getAllGithubAppLinks()` / `getOrganization()` / `listAllOrganizations()` が単数 link shape
- [`batch/commands/crawl.ts`](../../batch/commands/crawl.ts)
  - `requireOrganization()` 経由で organization shape を受ける
- [`batch/commands/backfill.ts`](../../batch/commands/backfill.ts)
  - 同上
- [`batch/commands/helpers.ts`](../../batch/commands/helpers.ts)
  - `getOrganization()` の shape 変更を受ける
- [`batch/job-scheduler.ts`](../../batch/job-scheduler.ts)
  - `listAllOrganizations()` の戻り shape 変更を受ける
- [`batch/config/index.ts`](../../batch/config/index.ts)
  - `listAllOrganizations()` 由来の config shape を返す
- [`batch/github/backfill-repo.ts`](../../batch/github/backfill-repo.ts)
  - repository 単位で渡される Octokit が installation ごとに切り替わる

直接影響が小さいもの:

- [`batch/github/fetcher.ts`](../../batch/github/fetcher.ts)
  - Octokit を引数で受けるだけで、org 単位 state は持たない

## 受け入れ条件

1. 同一 Upflow organization で 2 つ以上の GitHub App installation を接続できる。
2. `db/shared.sql` 上、`github_app_links` は同一 `organization_id` に複数 row を保持でき、`installation_id` は unique、`github_account_id` は non-unique である。
3. `db/tenant.sql` 上、`repositories` は `github_installation_id` を保持する。
4. `app/routes/$orgSlug/settings/repositories.add/index.tsx` で installation を選択して repository を追加すると、追加 row の `github_installation_id` が選択 installation になる。
5. `app/routes/$orgSlug/settings/github-users._index/index.tsx` では、`github_app` モード時に installation selector が表示され、`searchGithubUsers()` は選択 installation の権限で検索する。
6. `app/services/jobs/crawl.server.ts` と `app/services/jobs/backfill.server.ts` は repository ごとに対応 installation の Octokit を使う。
7. `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx` の compare / refresh は repository に紐づく installation で GitHub API を呼ぶ。
8. `pull_request` 系 webhook は `installation_id` と `owner/repo` が一致する repository のみを対象に crawl job を起動する。
9. `installation.suspend` / `installation.unsuspend` webhook を受けると、対象 installation row の `suspended_at` だけが更新され、他 installation row と `integrations` には影響しない。
10. `installation_repositories` webhook を受けると、対象 installation row の `app_repository_selection` と repository set だけが更新され、他 installation row の selection や canonical assignment を不必要に書き換えない。
11. `installation.deleted` webhook を受けると、その installation row のみ `deleted_at` が設定され、他の installation には影響しない。
12. canonical installation を失った repository は、候補 installation が 1 件だけなら自動 reassignment され、候補が 0 件または複数件なら `github_installation_id = NULL` で manual reselection 待ちになる。
13. 最後の active installation を disconnect した場合のみ、`integrations.method` が `token` に戻る。
14. 最後の active installation を失った org で `private_token` が存在する場合は PAT モードへ即復帰し、`private_token` が存在しない場合は `method='token'` かつ `private_token IS NULL` の未接続状態になる。
15. integration settings UI は installation ごとに connected / suspended / deleted を表示し、personal account では `/settings/installations/<id>`、organization では `/organizations/<login>/settings/installations` を使う。
16. `repository_installation_memberships` が追加され、setup callback / `installation_repositories.added|removed` webhook / batch backfill が membership を更新する。canonical reassignment は on-demand GitHub API lookup ではなく、この table を正本に候補数を判定する。
17. repositories.add と GitHub Users の `installationId` は server-side で current org の active / unsuspended link であることが検証され、他 org の installation や deleted / suspended installation を指定しても処理されない。
18. repository list / detail では `github_installation_id IS NULL` の row に `assignment required` badge が表示され、list / detail から再選択できる。batch CLI でも同じ再割当が実行できる。
19. `installation.deleted` と user disconnect の cross-store 更新は tenant first / shared second で実行され、retry 後も tenant canonical assignment と shared link state が収束する。監査ログは shared DB `github_app_link_events` に残る。
20. lookup 切替は `schema 追加 -> backfill 完了 -> strict lookup 切替` の順で行われ、backfill 未完了期間の fallback は「active installation が 1 件の org に限る」。active installation が複数ある org の未割当 repository は scheduled crawl で skip される。
21. `integrations.app_suspended_at` の既存値は、active link が 1 件だけの org で `github_app_links.suspended_at` に移され、integration settings UI でも installation 単位の suspended 表示が維持される。
22. setup callback で membership 初期投入が成功した link は `membership_initialized_at` がセットされ、GitHub API 失敗時は link は保存されたうえで `membership_initialized_at IS NULL` のまま自動 repair 経路で埋められる。
23. canonical reassignment は `membership_initialized_at IS NOT NULL` の link のみを候補に判定する。初期化済み候補が 0 件で未初期化 link が残っているケースは `github_installation_id = NULL` (assignment required) に倒れ、未初期化 link の repair 完了後に再判定される。
24. PAT 方式の organization は、今回の変更後も従来通り repository 追加・crawl が動作する。

## リスク・補足

1. suspend 状態は `github_app_links.suspended_at` に移し、`integrations.app_suspended_at` は削除します。旧列依存の loader / UI / test を同時に差し替えないと整合が崩れます。
2. 同一 `owner/repo` が複数 installation から見える場合、本 RDD は tenant 上の repository row を 1 件に保ち、`github_installation_id` を canonical installation として持つ前提です。候補が複数あるときは自動 reassignment せず manual reselection が必要です。
3. `installation.created` を org 紐付けの主経路にはできません。GitHub webhook payload には Upflow org を特定する `state` が無いためです。初回紐付けの正本は setup callback のままです。
4. personal account UI 分岐には `github_account_type` 保存が前提です。setup callback と installation webhook のどちらかだけを更新すると、既存 row で設定リンクと文言が崩れます。
