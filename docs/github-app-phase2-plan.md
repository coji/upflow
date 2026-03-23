# Phase 2: GitHub App 基盤整備 — 実装計画

## Context

GitHub App 移行の Phase 2。PAT ベースの認証を GitHub App Installation Token に移行する基盤を整備する。Phase 0（owner 制限）と Phase 1（PoC）は完了済み。PoC で全 GraphQL クエリ・REST API が Installation Token で動作することを確認済み。`GET /user/repos` は 403、Search API はスコープされないことも確認済み。

## UX フロー設計

Phase 2 の実装はこの UX フローを実現するために組まれている。技術的な PR 分割は後述。

### フロー A: 既存クライアントの GitHub App 移行

2つのパスがある。coji が直接インストールするか、クライアントに依頼するか。

#### パス A-1: coji が直接インストール（推奨・最速）

```
┌─ coji の操作 ──────────────────────────────────────────────────┐
│ 1. Settings → Integration を開く（現在 PAT で接続中）            │
│ 2. 「GitHub App をインストール」ボタンをクリック                  │
│    → サーバーが署名付き state を生成（organizationId + expiry）  │
│    → GitHub のインストール画面にリダイレクト（state 付き）        │
│ 3. 対象 org（acme-corp）を選択 → Install                        │
│    → GitHub が setup callback URL にリダイレクト（state 付き）   │
│    → サーバーが state を検証 → organizationId を特定             │
│    → GET /app/installations/:id で GitHub API 検証               │
│    → shared DB に link 保存 + tenant DB の method を自動切替     │
│    → Settings 画面にリダイレクト                                 │
│ 4. 「✅ GitHub App で接続中（acme-corp / 全リポジトリ）」        │
└────────────────────────────────────────────────────────────────┘
```

**org 名の手入力なし。method の事前切替も不要。** インストールボタンを押して GitHub で org を選ぶだけ。link 保存と同時に method が `token` → `github_app` に自動切替されるので、**リンク完了まで PAT での crawl は止まらない**。

#### パス A-2: クライアント管理者に依頼

coji が GitHub org の admin でない場合はこちら。

```
┌─ coji の操作 ──────────────────────────────────────────────────┐
│ 1. Settings → Integration を開く                                │
│ 2. 「インストール URL をコピー」ボタンをクリック                  │
│    → サーバーが署名付き state を生成（organizationId + expiry）  │
│    → state 付きインストール URL がクリップボードにコピーされる    │
│ 3. URL をクライアント管理者に共有（Slack 等）                    │
└────────────────────────────────────────────────────────────────┘

┌─ クライアント管理者の操作 ─────────────────────────────────────┐
│ 4. 受け取った URL をクリック → GitHub で org 選択 → Install      │
│    → GitHub が setup callback URL にリダイレクト（state 付き）   │
│    → サーバーが state を検証 → organizationId を特定             │
│    → link 保存 + method 自動切替（セッション不要、state で認証） │
│    → クライアントは未ログインなので /login にリダイレクト        │
│    → クライアント側の操作はこれで完了                            │
└────────────────────────────────────────────────────────────────┘

┌─ 自動 ─────────────────────────────────────────────────────────┐
│ 5. coji が次に Settings を開くと                                 │
│    →「✅ GitHub App で接続中（acme-corp / 全リポジトリ）」        │
│    → 次回 crawl から Installation Token で収集開始               │
└────────────────────────────────────────────────────────────────┘
```

**クライアント管理者に必要な操作**: URL をクリック → org 選択 → Install。最小ケースで数クリック。
GitHub アカウントとインストール先 org の admin 権限があればよい。Upflow へのログインは不要。
（Enterprise 環境では org policy 承認や SSO が挟まる場合がある）

**ポイント**: coji が Settings を開いて確認する必要すらない。callback の時点で自動リンク完了。state パラメータで org を特定するのでセッション不要・全 installation 列挙も不要。

**ロールバック**: Settings で「接続解除」→ method が `token` に自動復帰（PAT が有効であることが前提。切替前に PAT の健全性を UI で表示）。

### フロー B: 新規テナントの初期セットアップ

Superadmin が org を作成し、owner が GitHub App を接続してリポジトリを追加する。

```
┌─ Superadmin ───────────────────────────────────────────────────┐
│ 1. Admin → Create Organization（slug + 名前）                   │
│    → org 作成、Settings が空の状態                               │
│    → owner をメンバー招待（既存フロー）                          │
└────────────────────────────────────────────────────────────────┘

┌─ Owner（coji が操作する前提。セルフサーブは Phase 5 以降）────┐
│ 2. Settings → Integration                                       │
│    → 初期状態: PAT 未設定                                        │
│ 3. 「GitHub App をインストール」ボタンをクリック                  │
│    → フロー A-1 のステップ 2-4 と同じ                            │
│ 4. 「✅ 接続済み（acme-corp / 全リポジトリ）」                   │
│                                                                  │
│ 5. Settings → Repositories → Add                                 │
│    → Installation Token でアクセス可能なリポジトリが表示される   │
│    → org 内のリポだけが見える（他 org は見えない）               │
│    → selected repos の場合「一部のリポのみ表示」注記あり         │
│ 6. リポを選択して追加                                            │
│ 7. Data Management → Full Refresh で初回クロール開始             │
└────────────────────────────────────────────────────────────────┘
```

**新規テナントでは PAT 設定を経由せず直接 GitHub App で接続可能。**
**クライアントに依頼する場合**: フロー A-2 と同じ（URL 共有）。

### 接続の仕組み

GitHub App の接続は **署名付き state パラメータ** で安全に行われる:

```
1. ユーザーが「インストール」or「URL コピー」をクリック
2. サーバーが state を生成: HMAC-SHA256(organizationId + expiry, SECRET)
3. GitHub インストール URL に state を付与:
   https://github.com/apps/upflow-team/installations/new?state=SIGNED_STATE
4. GitHub が App インストール後に setup callback にリダイレクト:
   /api/github/setup?installation_id=XXX&state=SIGNED_STATE
5. サーバーが state の署名を検証 → organizationId を取得
6. GET /app/installations/:id で installation を GitHub API 検証
7. shared DB に link 保存 + tenant DB の method を github_app に切替
```

**セッション不要**: state パラメータ自体が「どの tenant に紐づけるか」を暗号的に保証する。複数タブ、別ブラウザ、クライアント委託でも正しい tenant にリンクされる。

**Webhook** は接続の正本ではなく **状態更新**（deleted, suspend, unsuspend, repository selection 変更）に使う。

> **設計変更の理由**: 以前の設計では (1) org 名を手入力 → webhook マッチ、(2) セッションで tenant 特定、(3) 全 installation 列挙だった。(1) はタイプミスリスク、(2) は複数タブ・委託で誤リンク、(3) はテナント間情報漏えい。署名付き state で3つとも解決。

### 設定画面の状態遷移

```
[未設定] ──(PAT 保存)──→ [PAT 設定済み]
    │                          │
    │   (install + link)       │  (install + link)
    │          ↓               ↓
    └────────────────→ [App 接続済み] ←── method 自動切替
                        │         │
           (suspend)    │         │  (installation.deleted)
                ↓       │         ↓
         [App サスペンド]│   [App 要再接続]
                │       │         │
           (unsuspend)  │    (再インストール + link)
                └───────┘         ↓
                            [App 接続済み]

[App 接続済み] ──(接続解除)──→ [PAT 設定済み]（PAT があれば）or [未設定]
```

**重要**: `method` は常に**実効の認証方式**を表す。link が完了するまで `method='token'` のまま（PAT での crawl が止まらない）。link 保存と同時に `method='github_app'` に切り替わる。

| 状態           | 条件                                                      | 表示                                                              | 操作                                                                       |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 未設定         | integration なし or `hasToken` なし + link なし           | 「GitHub 連携が設定されていません」                               | PAT 入力 or 「GitHub App をインストール」ボタン                            |
| PAT 設定済み   | `method='token'` + `hasToken`                             | 「✅ Token で接続中」                                             | Token 更新 / 「GitHub App をインストール」ボタン / インストール URL コピー |
| App 接続済み   | `method='github_app'` + link あり + `appSuspendedAt` なし | 「✅ GitHub App で接続中（{githubOrg} / {repositorySelection}）」 | 接続解除ボタン                                                             |
| App サスペンド | `method='github_app'` + link あり + `appSuspendedAt` あり | 「⚠️ GitHub App がサスペンドされています」                        | GitHub App 設定ページへのリンク                                            |
| App 要再接続   | `method='github_app'` + link なし（soft delete 済み）     | 「⚠️ GitHub App がアンインストールされました」                    | 再インストールボタン / Token に戻すボタン                                  |

以前の設計より状態が減った。「App 未接続」（method 切替済み・未リンク）という不整合状態がなくなり、**method は常に動作中の認証方式を正確に反映する**。

### トラブルシュートガイド

PAT 設定済み状態の画面に、GitHub App インストール関連のヘルプを表示:

> **GitHub App のインストールについて**
>
> - GitHub organization の **admin 権限** が必要です
> - Enterprise 環境では org policy の承認が必要な場合があります
> - クライアントにインストールを依頼する場合は「インストール URL をコピー」から URL を共有してください

### App 接続済み時の repository selection 表示

| `appRepositorySelection` | 表示                                                    | 補足                                                   |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| `all`                    | 「全リポジトリにアクセス可能」                          | —                                                      |
| `selected`               | 「選択されたリポジトリのみ」+ GitHub App 設定へのリンク | リポ追加画面でも「一部のリポのみ表示されています」注記 |

### UX で重視するポイント

1. **org 名の手入力をなくす**: setup callback + GitHub API 検証で org 情報を自動取得。タイプミスが原理的に起きない
2. **クライアント管理者の負荷を最小化**: GitHub での App インストールだけ。Upflow へのログインは不要
3. **method は実効認証を表す**: リンク完了まで PAT のまま。crawl が止まらない。リンク完了時に自動切替
4. **署名付き state で安全にテナント特定**: セッション不要。複数タブ・委託・別ブラウザでも正しい tenant にリンク。全 installation 列挙による情報漏えいリスクなし
5. **安全な切り替え**: 接続解除時に method を自動で token に戻す。PAT が有効なら即復帰（健全性表示あり）
6. **repository selection の期待値調整**: 接続直後から「全リポ/選択のみ」を明示し、リポ追加画面での「見えないリポがある」混乱を防ぐ
7. **org rename の自動吸収**: GitHub account ID を保持し、login 名の変更に追従

---

## PR 分割と実施順序

```text
PR 1 (schema + deps)
  → PR 2 (Octokit factory + fetcher リファクタ + 全 call site)
    → PR 3 (webhook + setup callback + installation 紐付け)
      → PR 4 (設定 UI + リポ追加画面の App UX)
```

PR 3 で「App 接続情報が安全に入る」ところまで完成させてから、PR 4 で UI を開放する。

---

### PR 1: スキーマ拡張 + integrations 移行 + 依存関係

**設定系テーブルを shared DB に寄せる構造変更 + GitHub App 用スキーマ追加。**

> **設計判断**: `integrations` を tenant DB から shared DB に移す。理由:
>
> - PR 2 で全 call site を書き換えるので、移すなら今が最適（後でやると2回書き換え）
> - `github_app_links` が shared DB にあるので、`integrations` が tenant DB に残ると1つの認証情報を得るのに2 DB 跨ぎになる
> - shared DB に置けば `integrations JOIN github_app_links` が1クエリで済む
> - `getTenantData` の N+1 が integrations 分も解消される
> - 長期的に「設定系は shared、データ系は per-tenant」の方針に沿う

1. `@octokit/auth-app` を `devDependencies` → `dependencies` に移動（`package.json`）

2. `db/shared.sql` — `integrations` テーブルを新規追加（tenant DB から移行）:

   ```sql
   CREATE TABLE integrations (
     id TEXT NOT NULL,
     organization_id TEXT NOT NULL REFERENCES organization(id),
     provider TEXT NOT NULL DEFAULT 'github',
     method TEXT NOT NULL DEFAULT 'token',
     private_token TEXT NULL,
     app_suspended_at TEXT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     PRIMARY KEY (id),
     UNIQUE (organization_id)
   );
   ```

3. `db/shared.sql` — `github_app_links` テーブルを新規追加:

   ```sql
   CREATE TABLE github_app_links (
     organization_id TEXT PRIMARY KEY REFERENCES organization(id),
     installation_id INTEGER NOT NULL UNIQUE,
     github_account_id INTEGER NOT NULL UNIQUE,
     github_org TEXT NOT NULL,
     app_repository_selection TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'selected'
     deleted_at TEXT NULL,                                   -- soft delete（要再接続状態の判定用）
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
   );
   ```

4. `db/tenant.sql` — `integrations` テーブルを削除:
   - `repositories.integration_id` FK は削除（カラム自体は残す。1テナント1 integration なので参照整合性はアプリ層で保証）
   - マイグレーション:
     1. shared DB に `integrations` テーブル作成
     2. 各 tenant DB から `integrations` の行を shared DB に移行（マイグレーションスクリプト）
     3. tenant DB から `integrations` テーブル削除 + `repositories` の FK 削除

5. マイグレーション生成: `pnpm db:migrate`（shared + tenant 両方）+ データ移行スクリプト

6. 型再生成: `pnpm db:apply && pnpm db:generate`

7. `batch/db/queries.ts`:
   - `getTenantData` から integrations クエリを分離 → shared DB から取得
   - `listAllOrganizations`: integrations を1クエリで全件取得 → Map でマッチ（N+1 解消）
   - `getOrganization`: `integrations JOIN github_app_links` を1クエリで取得

8. **integrations を参照する全ファイルを `tenantDb` → `db`（shared DB）に変更**:
   | ファイル | 変更内容 |
   |---------|---------|
   | `app/routes/$orgSlug/settings/_index/+functions/queries.server.ts` | `tenantDb` → `db` + `WHERE organizationId` 追加 |
   | `app/routes/$orgSlug/settings/_index/+functions/mutations.server.ts` | 同上 |
   | `app/routes/$orgSlug/settings/repositories/$repository/$pull/queries.server.ts` | 同上 |
   | `app/routes/$orgSlug/settings/repositories/$repository/settings/+functions/queries.server.ts` | 同上 |
   | `app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts` | 同上 |
   | `app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts` | 同上 |
   | `app/routes/$orgSlug/settings/repositories.add/+functions/mutations.server.ts` | 同上 |
   | `db/seed.ts` | integrations の seed を shared DB に変更 |

9. codegen config:
   - `kysely-codegen.shared.config.ts`: `integrations.method`, `integrations.provider` の型 override 追加
   - `kysely-codegen.tenant.config.ts`: integrations 関連の型 override 削除

**検証**: `pnpm db:setup && pnpm validate`

---

### PR 2: Octokit factory + fetcher リファクタ + 全 call site

**コア抽象化。全 call site を一括で切り替え。PAT 方式の動作は変わらない。**

1. **新規**: `app/services/github-octokit.server.ts`

   ```typescript
   type Integration =
     | { method: 'token'; privateToken: string }
     | { method: 'github_app'; installationId: number }

   export function createOctokit(integration: Integration): Octokit
   ```

   - `method: 'token'` → `new Octokit({ auth: privateToken })`
   - `method: 'github_app'` → `new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey, installationId } })`
   - factory 内で `method === 'github_app'` かつ `installationId` 不在なら `InvariantError` を throw（開発者向け fail-fast）
   - 呼び出し元では `integrations JOIN github_app_links`（shared DB、1クエリ）で認証情報を取得。link がなければユーザー向けエラー（「GitHub App が未接続です」）に変換
   - `GITHUB_APP_PRIVATE_KEY` は base64 → PEM デコード
   - env vars: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`（`method: 'github_app'` 時のみ必須）

2. `batch/github/fetcher.ts`:
   - `createFetcherProps`: `{ owner, repo, token }` → `{ owner, repo, octokit }`
   - 内部の `new Octokit({ auth: token })` を削除、渡された octokit を使う

3. **全 call site を更新**（漏れなし）:

   | ファイル                                                                                    | 変更内容                                                                                                  |
   | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
   | `app/services/jobs/crawl.server.ts`                                                         | `createOctokit(integration)` → `createFetcher({ owner, repo, octokit })`                                  |
   | `app/services/jobs/backfill.server.ts`                                                      | 同上                                                                                                      |
   | `batch/github/backfill-repo.ts`                                                             | 引数を `{ privateToken }` → `{ octokit }` に変更                                                          |
   | `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`                     | `privateToken` → `createOctokit` + `createFetcher({ octokit })`                                           |
   | `app/routes/$orgSlug/settings/repositories/$repository/$pull/queries.server.ts`             | `getRepositoryWithIntegration` — integrations は PR 1 で shared DB 移行済み。`github_app_links` JOIN 追加 |
   | `app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts` | raw `fetch` → `createOctokit` + `octokit.rest.search.users()`                                             |

   **セキュリティ**: crawl/backfill の durably step output にトークンを含めないパターンは維持。Octokit インスタンスは step 外で生成。

4. `.env.example` に `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` を追加

**検証**: `pnpm validate` + 既存テスト全パス。PAT 方式の動作に変更なし。

---

### PR 3: Webhook + Setup callback + Installation 紐付け

**App 接続情報が安全に保存されるバックエンド完成形。**

1. **Webhook 署名検証ユーティリティ**: `app/libs/webhook-verify.server.ts`
   - HMAC-SHA256 で `X-Hub-Signature-256` を検証
   - `GITHUB_WEBHOOK_SECRET` env var を使用

2. **State トークンユーティリティ**: `app/libs/github-app-state.server.ts`
   - `generateState(organizationId, expiry=7days)`: HMAC-SHA256 署名付き state を生成
   - `verifyState(state)`: 署名検証 + expiry チェック → `organizationId` を返す
   - `GITHUB_APP_STATE_SECRET` env var を使用（`BETTER_AUTH_SECRET` を流用しても可）

3. **Webhook エンドポイント**: `app/routes/api.github.webhook.ts`
   - セッション認証には依存しない（`/$orgSlug` 配下でないため auth middleware の外）。署名検証のみで認証
   - 署名検証 → イベント種別で分岐
   - `installation.created`:
     - webhook payload から `installation.id`, `installation.account.login`, `installation.account.id`, `repository_selection` を取得
     - shared DB `github_app_links` を `installation_id` or `github_account_id` で検索（**O(1)**）
     - 0件 → ログ出力（setup callback で処理済み or まだ未接続。正常ケース）
     - 1件 → `app_repository_selection` を更新。`github_org` が payload の `account.login` と異なる場合は最新値に更新（org rename 追従）
   - `installation.deleted`:
     - `github_app_links` を soft delete（`deleted_at` を設定、`installation_id` は保持）+ `clearOrgCache`
     - tenant DB の `method` は `github_app` のまま → UI で「要再接続」と表示
   - `installation.suspend` / `unsuspend`:
     - tenant DB の `appSuspendedAt` を更新（`github_app_links.organization_id` で tenant を特定）
   - `installation_repositories`:
     - `app_repository_selection` を更新 + `clearOrgCache`
     - batch 側で 403/404 を受けた repo は crawl をスキップしてログ出力（Phase 3 で is_accessible フラグ対応）
   - 未知のイベント → 202 返却

4. **Setup URL callback**: `app/routes/api.github.setup.ts`
   - GitHub App インストール完了後の **主要な接続経路**
   - `installation_id` と `state` クエリパラメータを受け取る
   - **state 検証**: `verifyState(state)` で署名 + expiry を検証 → `organizationId` を取得（セッション不要）
   - **GitHub API 検証**: App JWT で `GET /app/installations/:installation_id` を呼び検証:
     - installation が自分の App のものか確認
     - `account.login`, `account.id`, `repository_selection` を取得
   - shared DB `github_app_links` に UPSERT（soft delete 済みの行があれば復活）:
     - `organizationId`, `installationId`, `githubOrg`, `githubAccountId`, `appRepositorySelection`, `deleted_at=NULL`
   - **tenant DB の `method` を `github_app` に自動切替**（リンク完了 = 認証切替）
   - `UNIQUE` 制約で重複防止（同一 installation が他 tenant にリンク済みならエラー）
   - `clearOrgCache`
   - `/:orgSlug/settings/integration` にリダイレクト（接続済み状態で表示される）
   - 未ログインでも state から org を特定できるのでリンクは成功する。その後 `/login` にリダイレクト

5. **接続解除 action**: Settings UI から呼ばれる
   - `github_app_links` を soft delete（`deleted_at` 設定）
   - tenant DB の `method` を `token` に変更（PAT があれば即復帰）
   - `clearOrgCache`

6. `.env.example` に `GITHUB_WEBHOOK_SECRET` を追加

7. **本番 App 設定更新（PR 3 デプロイ時）**（GitHub UI での手動作業）:
   - Private key 生成 + 本番 env 投入（`GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_ID`）
   - Webhook URL: `https://upflow.team/api/github/webhook`
   - Webhook Secret 設定 + 本番 env 投入（`GITHUB_WEBHOOK_SECRET`）
   - Setup URL: `https://upflow.team/api/github/setup`

   > **注意**: PR 3 の setup callback は App JWT で GitHub API を叩くため、**private key は PR 3 デプロイ前に必須**。permissions 追加（contents, pull_requests, deployments: read）は PR 4 直前でよい。

**Installation 紐付けフロー**:

```text
1. ユーザーが「インストール」or「URL コピー」をクリック
   → サーバーが state=HMAC(orgId+expiry) を生成
   → GitHub インストール URL に state を付与してリダイレクト or コピー
2. GitHub で Install
3. Setup callback: state 検証 → orgId 特定 → API 検証 → link UPSERT + method 切替
4. Settings 画面にリダイレクト →「✅ 接続済み」
```

**データの所在**:

- `method`, `privateToken`, `appSuspendedAt` → shared DB `integrations`（認証設定・状態）
- `installationId`, `githubOrg`, `githubAccountId`, `appRepositorySelection`, `deletedAt` → shared DB `github_app_links`（接続先ルックアップ）
- `integrations JOIN github_app_links ON organization_id` で1クエリ取得可能

**クロス DB 整合性**:

- **integrations と github_app_links は同一 DB（shared）** なので単一トランザクションで更新可能。以前の設計（integrations が tenant DB、github_app_links が shared DB）のクロス DB 不整合は原理的に発生しない
- **冪等性**: setup callback / webhook は全て冪等。同じ installation_id で再実行しても安全（UPSERT）
- **不整合時の振る舞い**: `method='github_app'` だが link がない（or soft deleted）→ crawl は PAT にフォールバック（`privateToken` があれば）。なければエラーログ + スキップ。UI は「要再接続」を表示
- **tenant DB との整合**: tenant DB には `repositories`（`integration_id` カラム）のみ残る。integration 自体は shared DB にあるので FK は効かないが、1テナント1 integration なので実害なし

**検証**: テスト用 App で setup callback + webhook delivery を確認。`pnpm validate`。

---

### PR 4: 設定 UI + リポ追加画面の App UX

**ユーザー向けの完成形。PR 3 で接続基盤ができた上で UI を開放。**

1. **設定画面拡張**: `app/routes/$orgSlug/settings/integration/index.tsx`
   - 現在の PAT 設定に加えて、GitHub App 接続セクションを追加
   - 状態に応じた UI（UX フロー設計の状態遷移表を参照）:
     - **未接続 / PAT 設定済み**: 「GitHub App をインストール」ボタン + 「インストール URL をコピー」ボタン + トラブルシュートガイド
     - **接続済み**: 「✅ GitHub App で接続中（{githubOrg} / {repositorySelection}）」+ 接続解除ボタン。selected の場合は GitHub App 設定へのリンク
     - **サスペンド**: 「⚠️ GitHub App がサスペンドされています」+ GitHub App 設定ページへのリンク
     - **要再接続**: 「⚠️ GitHub App がアンインストールされました」+ 再インストールボタン + Token に戻すボタン
   - PAT 健全性表示: 接続解除時に PAT に戻れるかどうかを事前に見せる（有効/未設定）
   - 「インストール」ボタン押下時: サーバーに POST → state 生成 → GitHub にリダイレクト
   - 「URL コピー」ボタン押下時: サーバーに POST → state 付き URL 生成 → クリップボードにコピー

2. **設定画面のフォームコンポーネント更新**: `app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`
   - PAT 入力セクション（既存）
   - GitHub App 接続セクション（新規）: 接続状態 + アクションボタン
   - method の明示的な選択 UI は不要（link の有無で自動決定されるため）

3. **リポジトリ追加画面の App 対応**:

   a. `app/routes/$orgSlug/settings/repositories.add/+functions/get-unique-owners.ts`:
   - 新関数 `getInstallationOwners(octokit: Octokit): Promise<string[]>`
   - `octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, { per_page: 100 })`
   - `[...new Set(repos.map(r => r.owner.login))]`
   - 既存 `getUniqueOwners(token)` はそのまま残す

   b. `app/routes/$orgSlug/settings/repositories.add/+functions/get-repositories-by-owner-and-keyword.ts`:
   - 新関数 `getInstallationRepositories(octokit, owner, keyword)`
   - `GET /installation/repositories` 全件取得 → `owner` + `keyword` でクライアント側フィルタ
   - 既存関数はそのまま残す

   c. `app/routes/$orgSlug/settings/repositories.add/+functions/queries.server.ts`:
   - `getIntegration` に `method`, `installationId` を select 追加（`github_app_links` JOIN）

   d. `app/routes/$orgSlug/settings/repositories.add/index.tsx`:
   - loader で `integration.method` に応じて分岐:
     - `token` → 既存フロー
     - `github_app` → `createOctokit()` → `getInstallationOwners(octokit)`
   - `appRepositorySelection === 'selected'` の場合、画面上部に注記: 「GitHub App の設定で選択されたリポジトリのみ表示されています。[GitHub App 設定で変更](リンク)」
   - UI コンポーネントは変更なし（データソースだけ切り替わる）

4. **本番 App 設定更新**（GitHub UI での手動作業）:
   - upflow-team App に permissions 追加（contents, pull_requests, deployments: read）

   > **注意**: Private key / Webhook / Setup URL は PR 3 デプロイ時に設定済み。PR 4 では permissions 追加のみ。

**検証**: テスト用 org で App インストール → 設定画面で接続確認 → crawler 1サイクル → リポ追加画面

---

## Phase 2 のスコープ外（Phase 3 以降）

- `installation_repositories` イベントでの個別リポのアクセス状態フラグ更新・警告 UI
- `repositories` テーブルへの `is_accessible` カラム追加
- セルフサーブのオンボーディングウィザード（org 作成 → GitHub App 接続 → リポ追加を1本の導線に）
- 定期 reconciliation バッチ（`GET /app/installations` と `github_app_links` の突合）

> **Phase 2 での暫定対応**: batch 側で crawl/backfill 中に 403/404 を受けた repo はスキップしてログ出力する。selected repos への変更で既登録リポがアクセス不可になったケースの運用事故を防ぐ。

---

## 文書間の整合性

`docs/github-app-migration.md` は Phase 2 計画の**上位文書**（全体方針・Phase 0-5 の概要）。
本文書（`docs/github-app-phase2-plan.md`）は Phase 2 の**詳細実装計画**で、設計判断は本文書が最新。

以下の点で migration.md を追従更新する必要がある:

- ~~「webhook が正本、callback はリダイレクト only」~~ → 「setup callback + state が主経路、webhook は状態更新」
- ~~「installation.deleted で method を無効化」~~ → 「method は github_app のまま、link を soft delete」
- ~~「githubOrg 手入力」~~ → 「GitHub API から自動取得」

---

## 主要ファイル一覧

| ファイル                                                               | PR  | 変更内容                                                                |
| ---------------------------------------------------------------------- | --- | ----------------------------------------------------------------------- |
| `db/shared.sql`                                                        | 1   | `integrations` 移行 + `github_app_links` 新規追加                       |
| `db/tenant.sql`                                                        | 1   | `integrations` 削除 + `repositories` FK 削除                            |
| `app/services/type.ts`                                                 | 1   | 自動生成（shared DB 型）                                                |
| `app/services/tenant-type.ts`                                          | 1   | 自動生成（tenant DB 型）                                                |
| `batch/db/queries.ts`                                                  | 1   | integrations を shared DB から取得 + N+1 解消                           |
| `app/routes/.../settings/_index/+functions/queries.server.ts`          | 1   | integrations を shared DB から取得                                      |
| `app/routes/.../settings/_index/+functions/mutations.server.ts`        | 1   | integrations を shared DB に upsert                                     |
| `app/routes/.../$repository/$pull/queries.server.ts`                   | 1   | 同上                                                                    |
| `app/routes/.../$repository/settings/+functions/queries.server.ts`     | 1   | 同上                                                                    |
| `app/routes/.../github-users._index/.../search-github-users.server.ts` | 1   | 同上                                                                    |
| `app/routes/.../repositories.add/+functions/queries.server.ts`         | 1   | 同上                                                                    |
| `app/routes/.../repositories.add/+functions/mutations.server.ts`       | 1   | 同上                                                                    |
| `db/seed.ts`                                                           | 1   | integrations seed を shared DB に変更                                   |
| `app/services/github-octokit.server.ts`                                | 2   | **新規** — Octokit ファクトリ                                           |
| `batch/github/fetcher.ts`                                              | 2   | `token` → `octokit`                                                     |
| `app/services/jobs/crawl.server.ts`                                    | 2   | createOctokit 使用                                                      |
| `app/services/jobs/backfill.server.ts`                                 | 2   | createOctokit 使用                                                      |
| `batch/github/backfill-repo.ts`                                        | 2   | 引数変更                                                                |
| `app/routes/.../repositories/$repository/$pull/index.tsx`              | 2   | createOctokit 使用                                                      |
| `app/routes/.../repositories/$repository/$pull/queries.server.ts`      | 2   | `getRepositoryWithIntegration` に select 追加                           |
| `app/routes/.../search-github-users.server.ts`                         | 2   | raw fetch → Octokit                                                     |
| `app/libs/webhook-verify.server.ts`                                    | 3   | **新規** — Webhook 署名検証                                             |
| `app/libs/github-app-state.server.ts`                                  | 3   | **新規** — State トークン生成・検証                                     |
| `app/routes/api.github.webhook.ts`                                     | 3   | **新規** — Webhook エンドポイント                                       |
| `app/routes/api.github.setup.ts`                                       | 3   | **新規** — Setup callback（state 検証 + API 検証 + link + method 切替） |
| `app/routes/$orgSlug/settings/_index/+functions/mutations.server.ts`   | 3   | 接続解除 action                                                         |
| `app/routes/$orgSlug/settings/integration/index.tsx`                   | 4   | UI 拡張（接続状態表示 + アクションボタン）                              |
| `app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx`  | 4   | フォーム拡張                                                            |
| `app/routes/.../get-unique-owners.ts`                                  | 4   | App 用関数追加                                                          |
| `app/routes/.../get-repositories-by-owner-and-keyword.ts`              | 4   | App 用関数追加                                                          |
| `app/routes/.../repositories.add/index.tsx`                            | 4   | method 分岐                                                             |
| `app/routes/.../repositories.add/+functions/queries.server.ts`         | 4   | select 追加                                                             |
