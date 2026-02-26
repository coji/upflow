# Database-per-Tenant 移行計画

## Context

upflow は現在、単一の SQLite DB にすべてのテナントデータを格納している。マルチテナント SaaS としてのデータ分離を強化するため、`shared.db`（認証・組織管理）+ `tenant_{orgId}.db`（テナント固有データ）の構成に移行する。

batch システムも現在 DB に直接書き込んでおり、この分離に対応する必要がある。

---

## テーブル仕分け

### Shared DB（変更なし）

`users`, `sessions`, `accounts`, `verifications`, `organizations`, `members`, `invitations`, `teams`, `team_members`

### Tenant DB（organization_id 列を削除）

`repositories`, `integrations`, `organization_settings`, `export_settings`, `company_github_users`, `pull_requests`, `pull_request_reviews`, `pull_request_reviewers`

---

## Phase 1: スキーマ分割 + getTenantDb ファクトリ

### 1-1. `db/shared.sql` 作成

- 現在の `schema.sql` から shared テーブルのみ抽出

### 1-2. `db/tenant.sql` 作成

- tenant テーブルから `organization_id` 列・FK・関連インデックスを削除
- `company_github_users` の PK を `(login)` のみに変更
- `repositories` のユニークインデックスを `(integration_id, owner, repo)` に変更

### 1-3. `app/services/tenant-db.server.ts` 新規作成

- `getTenantDb(organizationId)` — Kysely インスタンスを Map キャッシュで管理
- `closeTenantDb(organizationId)`, `closeAllTenantDbs()` でクリーンアップ

### 1-4. 型生成の分離

- `db:generate:shared` → `app/services/shared-type.ts`
- `db:generate:tenant` → `app/services/tenant-type.ts`
- 既存 `app/services/type.ts` は `shared-type.ts` にリネーム

### 1-5. Atlas 設定更新

- `atlas.hcl` に `shared` と `tenant` の2環境を定義
- tenant は `for_each` でマルチ DB マイグレーション対応

### 変更ファイル

| ファイル                           | 変更                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| `db/schema.sql` → `db/shared.sql`  | リネーム、tenant テーブル削除                                     |
| `db/tenant.sql`                    | 新規作成                                                          |
| `app/services/tenant-db.server.ts` | 新規作成                                                          |
| `app/services/db.server.ts`        | 型を SharedDB.DB に変更、OrganizationScopePlugin エクスポート削除 |
| `atlas.hcl`                        | 2環境構成に変更                                                   |
| `package.json`                     | db:generate コマンド分離                                          |

---

## Phase 2: PoC（Web 1ルート + batch report）

### 目的

Web と batch の両方で tenant DB が動作することを最小スコープで検証する。

### スコープ

- `$orgSlug/_index`（ダッシュボード）の loader を tenant DB 経由に切り替え
- `batch report` コマンドを tenant DB 経由に切り替え
- seed.ts を更新して shared + tenant 両方にデータ投入
- `pnpm db:setup` で動作確認

### 変更ファイル

| ファイル                                           | 変更                                                   |
| -------------------------------------------------- | ------------------------------------------------------ |
| `app/routes/$orgSlug/_index/+functions/queries.ts` | `getTenantDb(orgId)` 使用、`organizationId` WHERE 削除 |
| `batch/db/queries.ts`                              | `getPullRequestReport()` を tenant DB 経由に           |
| `batch/commands/report.ts`                         | `getOrganization()` を shared + tenant 2段クエリに     |
| `db/seed.ts`                                       | shared DB + tenant DB 両方にシード                     |

### 検証

```bash
pnpm db:setup && pnpm dev
# /:orgSlug でダッシュボードが表示されること
pnpm batch report [orgId]
# TSV レポートが出力されること
```

---

## Phase 3: Web アプリ全ルート切り替え

### tenant DB のみ使うルート（`db` → `getTenantDb(orgId)`）

- `$orgSlug/_index/+functions/queries.ts` — pullRequests, repositories, companyGithubUsers
- `$orgSlug/ongoing/+functions/queries.ts` — 同上
- `$orgSlug/settings/repositories.*` — repositories, integrations
- `$orgSlug/settings/github-users.*` — companyGithubUsers（organizationId WHERE 削除）

### shared + tenant 両方使うルート

- `$orgSlug/settings/_index/+functions/queries.server.ts` — organizations(shared) + settings/integration/export(tenant)
- `$orgSlug/settings/_index/+functions/mutations.server.ts` — organizations 更新(shared) + settings 更新(tenant)
- `admin/+create/mutations.server.ts` — org 作成(shared) → tenant DB 初期化 → settings 作成(tenant)

### 削除

- `app/services/organization-scope-plugin.ts` — DB 分離により不要
- `db.withPlugin(new OrganizationScopePlugin(...))` の全呼び出し箇所

---

## Phase 4: Batch システム切り替え

### 4-1. `batch/db/queries.ts`

**`listAllOrganizations()`** — 最も影響が大きいクエリ:

```typescript
// Before: 単一 DB で JOIN
// After: shared DB で org 一覧 → 各 org の tenant DB で設定取得
const orgs = await db.selectFrom('organizations')...
return Promise.all(orgs.map(async (org) => {
  const tenantDb = getTenantDb(org.id)
  const [settings, integration, repos, export] = await Promise.all([
    tenantDb.selectFrom('organizationSettings')...,
    tenantDb.selectFrom('integrations')...,
    tenantDb.selectFrom('repositories')...,
    tenantDb.selectFrom('exportSettings')...,
  ])
  return { ...org, organizationSetting: settings, integration, repositories: repos, exportSetting: export }
}))
```

**`getOrganization(orgId)`** — 同パターン

**`getPullRequestReport(orgId)`** — tenant DB 内で完結（org フィルタ不要に）

### 4-2. `batch/db/mutations.ts`

3関数すべてに `organizationId` 引数を追加:

- `upsertPullRequest(organizationId, data)` → `getTenantDb(orgId)` で書き込み
- `upsertPullRequestReview(organizationId, data)` → 同上
- `upsertPullRequestReviewers(organizationId, repoId, prNumber, reviewers)` → 同上

### 4-3. `batch/usecases/analyze-and-upsert.ts`

mutation 呼び出しに `organization.id` を追加:

```typescript
for (const pr of pulls) {
  await upsertPullRequest(orgId, pr)
}
```

### 4-4. `batch/jobs/crawl.ts`

`refreshRequestedAt` の更新を tenant DB 経由に:

```typescript
const tenantDb = getTenantDb(organization.id)
await tenantDb
  .updateTable('organizationSettings')
  .set({ refreshRequestedAt: null })
  .execute()
```

### 変更ファイル

| ファイル                               | 変更                                          |
| -------------------------------------- | --------------------------------------------- |
| `batch/db/queries.ts`                  | shared + tenant DB の2段クエリに              |
| `batch/db/mutations.ts`                | organizationId 引数追加、getTenantDb 使用     |
| `batch/usecases/analyze-and-upsert.ts` | mutation 呼び出しに orgId 追加                |
| `batch/jobs/crawl.ts`                  | refreshRequestedAt 更新を tenant DB に        |
| `batch/config/index.ts`                | 変更なし（listAllOrganizations が内部で吸収） |

---

## Phase 5: Org 作成・削除フロー

### 作成（`admin/+create/mutations.server.ts`）

1. shared DB: organization + member 作成（トランザクション）
2. tenant DB ファイル作成 + Atlas マイグレーション適用
3. tenant DB: デフォルト organizationSettings 作成

### 削除（`$orgSlug/settings/_index/+functions/mutations.server.ts`）

1. shared DB: organization 削除（CASCADE で members 等も削除）
2. tenant DB: `closeTenantDb(orgId)` でキャッシュ削除
3. `fs.unlinkSync(tenantDbPath)` でファイル削除

---

## Phase 6: データマイグレーションスクリプト

`db/migrate-to-tenant.ts` 新規作成:

1. 既存 `data.db` を `data.db.backup` にコピー
2. 各 organization に対して:
   - `tenant_{orgId}.db` 作成 + スキーマ適用
   - tenant テーブルのデータを org フィルタ付きでコピー
   - `organization_id` 列は省略してコピー
3. shared DB から tenant テーブルを DROP
4. 行数検証（元 DB と分割後の合計が一致すること）

---

## Phase 7: seed.ts + テスト更新

- `db/seed.ts` — shared DB + tenant DB 両方にシード
- vitest テスト — tenant DB のセットアップ追加
- Playwright E2E — seed 変更に追従

---

## リスクと対策

| リスク                             | 対策                                             |
| ---------------------------------- | ------------------------------------------------ |
| データマイグレーションで行の欠落   | 行数検証スクリプト + backup                      |
| `listAllOrganizations()` が N+1 に | Promise.all で並列化。org 数は少ないので許容範囲 |
| org 作成中に tenant DB 作成失敗    | try/catch で shared DB の org も削除             |
| 接続キャッシュの肥大化             | SQLite は軽量。必要なら LRU 追加                 |

### ロールバック戦略

フィーチャーフラグは使わない（コードパスが二重になり複雑）。代わりに:

- マイグレーション前に `data.db.backup` を作成
- 問題発生時は backup から復元 + git revert で対応

---

## 検証手順

```bash
# 1. スキーマ分割の検証
pnpm db:setup && pnpm db:generate && pnpm typecheck

# 2. 単体テスト
pnpm test

# 3. 開発サーバーで動作確認
pnpm dev
# /:orgSlug, /:orgSlug/settings, /admin を確認

# 4. batch 動作確認
pnpm batch fetch [orgId]
pnpm batch upsert [orgId]
pnpm batch report [orgId]

# 5. E2E テスト
pnpm test:e2e

# 6. 全検証
pnpm validate
```

---

## 実装順序

```text
Phase 1 (スキーマ + ファクトリ)
  ↓
Phase 2 (PoC: 1ルート切り替え + seed)
  ↓ ← ここで動作確認、問題あれば方針修正
Phase 3 (Web 全ルート切り替え)
  ↓
Phase 4 (Batch 切り替え)
  ↓
Phase 5 (Org 作成・削除フロー)
  ↓
Phase 6 (データマイグレーションスクリプト)
  ↓
Phase 7 (seed + テスト更新)
```

---

## フォローアップ TODO

この PR のスコープ外として残した改善項目。

### Branded OrganizationId 型の導入

`organizationId: string` が ~50-60 箇所の関数シグネチャで使われており、誤った string を渡してもコンパイルエラーにならない。Branded type を導入して型安全性を強化する。

```typescript
// app/services/types.ts
type OrganizationId = string & { readonly __brand: unique symbol }
```

影響範囲:

- `app/services/tenant-db.server.ts` の全関数
- `batch/db/mutations.ts`, `batch/db/queries.ts`
- `batch/provider/index.ts` (`RepositoryWithOrg` 型)
- 各 route の queries/mutations 関数

### RepositoryWithOrg 型のリファクタリング

tenant DB 分離後も `batch/provider` が `organizationId` をリポジトリに re-attach している。Provider の `fetch`/`analyze` インターフェースを見直して、`organizationId` をリポジトリではなく別パラメータとして渡す設計に変更する。

```typescript
// Before: repository に organizationId を付加
type RepositoryWithOrg = Selectable<TenantDB.Repositories> & { organizationId: string }
fetch(repository: RepositoryWithOrg, options)

// After: organizationId を別引数に
fetch(organizationId: OrganizationId, repository: Selectable<TenantDB.Repositories>, options)
```

影響範囲:

- `batch/provider/index.ts` — Provider インターフェース
- `batch/provider/github/provider.ts` — GitHub provider 実装
- `batch/helper/path-builder.ts` — ファイルパス構築
- `batch/jobs/crawl.ts` — 呼び出し元
- `batch/usecases/analyze-and-upsert.ts` — 呼び出し元
