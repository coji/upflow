# GitHub App 移行 — 残りの実装ステップ

> PR 1（スキーマ + integrations 移行 + deps）は完了。以降を `feat/github-app-migration` ブランチに1本で積む。

## Step 2: Octokit factory + fetcher リファクタ

**目的**: 全 call site を auth-agnostic にする。PAT でも GitHub App でも同じコードパスで動く。

### 2-1. `app/services/github-octokit.server.ts`（新規）

```typescript
import { Octokit } from 'octokit'
import { createAppAuth } from '@octokit/auth-app'

type IntegrationAuth =
  | { method: 'token'; privateToken: string }
  | { method: 'github_app'; installationId: number }

export function createOctokit(auth: IntegrationAuth): Octokit {
  if (auth.method === 'token') {
    return new Octokit({ auth: auth.privateToken })
  }

  const appId = process.env.GITHUB_APP_ID
  const privateKey = Buffer.from(
    process.env.GITHUB_APP_PRIVATE_KEY ?? '',
    'base64',
  ).toString('utf-8')

  if (!appId || !privateKey) {
    throw new Error(
      'GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required for github_app method',
    )
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(appId),
      privateKey,
      installationId: auth.installationId,
    },
  })
}
```

- env vars は `method: 'github_app'` 時のみ必要
- `GITHUB_APP_PRIVATE_KEY` は base64 → PEM デコード（Fly.io secrets で改行を含む鍵を安全に保存するため）

### 2-2. `batch/github/fetcher.ts` リファクタ

**変更前**:

```typescript
interface createFetcherProps {
  owner: string
  repo: string
  token: string
}
export const createFetcher = ({ owner, repo, token }: createFetcherProps) => {
  const octokit = new Octokit({ auth: token })
  // ...
}
```

**変更後**:

```typescript
interface createFetcherProps {
  owner: string
  repo: string
  octokit: Octokit
}
export const createFetcher = ({ owner, repo, octokit }: createFetcherProps) => {
  // Octokit インスタンスは外から受け取る。内部で new Octokit() しない
  // ...
}
```

### 2-3. call site の更新

#### `app/services/jobs/crawl.server.ts`

**変更前**:

```typescript
const org = await getOrganization(orgId)
const token = org.integration?.privateToken
if (!token) throw new Error('No integration token')

const fetcher = createFetcher({ owner: repo.owner, repo: repo.repo, token })
```

**変更後**:

```typescript
// step の外で Octokit を生成（durably.db に永続化されないように）
const org = await getOrganization(orgId)
const integration = org.integration
if (!integration) throw new Error('No integration configured')

const octokit = createOctokit(
  integration.method === 'github_app' && org.githubAppLink
    ? { method: 'github_app', installationId: org.githubAppLink.installationId }
    : integration.privateToken
      ? { method: 'token', privateToken: integration.privateToken }
      : (() => {
          throw new Error('No auth configured')
        })(),
)

const fetcher = createFetcher({ owner: repo.owner, repo: repo.repo, octokit })
```

**セキュリティ**: Octokit インスタンスは `step.run()` の外で生成。step output に含めない。

#### `app/services/jobs/backfill.server.ts`

crawl と同じパターン。`backfillRepo` の引数を変更:

**変更前**: `backfillRepo(orgId, repository, { privateToken: token }, options)`
**変更後**: `backfillRepo(orgId, repository, octokit, options)`

#### `batch/github/backfill-repo.ts`

**変更前**:

```typescript
export async function backfillRepo(
  organizationId: OrganizationId,
  repository: Selectable<TenantDB.Repositories>,
  integration: Pick<Selectable<DB.Integrations>, 'privateToken'>,
  options?: { files?: boolean },
) {
  invariant(integration.privateToken, 'private token not specified')
  const fetcher = createFetcher({ ..., token: integration.privateToken })
}
```

**変更後**:

```typescript
export async function backfillRepo(
  organizationId: OrganizationId,
  repository: Selectable<TenantDB.Repositories>,
  octokit: Octokit,
  options?: { files?: boolean },
) {
  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    octokit,
  })
}
```

#### `app/routes/$orgSlug/settings/repositories/$repository/$pull/index.tsx`

action 内で `createOctokit` + `createFetcher` を使う:

**変更前**: `createFetcher({ ..., token: repository.integration.privateToken })`
**変更後**:

```typescript
const integration = await getIntegration(organization.id) // shared DB
const octokit = createOctokit(/* method に応じた auth */)
const fetcher = createFetcher({
  owner: repository.owner,
  repo: repository.repo,
  octokit,
})
```

#### `app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts`

raw `fetch` → Octokit に統一:

**変更前**: `fetch('https://api.github.com/search/users', { headers: { Authorization: 'Bearer ...' } })`
**変更後**:

```typescript
const octokit = createOctokit(/* ... */)
const { data } = await octokit.rest.search.users({
  q: `${query} in:login`,
  per_page: 8,
})
return data.items.map((u) => ({ login: u.login, avatarUrl: u.avatar_url }))
```

### 2-4. `.env.example` 更新

```
GITHUB_APP_ID=               # GitHub App の App ID（github_app method 時のみ必要）
GITHUB_APP_PRIVATE_KEY=      # GitHub App の秘密鍵（base64 エンコード）
```

### 2-5. テスト

- 既存テストが全パスすること（PAT 方式の動作が変わっていないことの確認）
- `createOctokit` のユニットテスト（method: token / github_app の分岐）
- `pnpm validate` 全パス

---

## Step 3: Webhook + Setup callback + Installation 紐付け

**目的**: GitHub App のインストール/アンインストール/サスペンドを安全に処理するバックエンド。

### 3-1. `app/libs/webhook-verify.server.ts`（新規）

```typescript
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean>
```

- HMAC-SHA256 で `X-Hub-Signature-256` を検証
- `GITHUB_WEBHOOK_SECRET` env var

### 3-2. `app/libs/github-app-state.server.ts`（新規）

```typescript
export function generateInstallState(organizationId: string): string
export function verifyInstallState(state: string): { organizationId: string }
```

- HMAC-SHA256 署名付き state: `orgId:expiry:signature`
- expiry: 7日
- `BETTER_AUTH_SECRET` を流用（新しい env var を増やさない）

### 3-3. `app/routes/api.github.webhook.ts`（新規）

- `/$orgSlug` 配下でないため auth middleware の外。署名検証のみ
- イベント分岐:

| イベント                    | 処理                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `installation.created`      | `github_app_links` を installation_id で検索。あれば `app_repository_selection` を更新 + org rename 追従 |
| `installation.deleted`      | `github_app_links` を soft delete + `clearOrgCache`                                                      |
| `installation.suspend`      | `integrations.appSuspendedAt` を設定                                                                     |
| `installation.unsuspend`    | `integrations.appSuspendedAt` を NULL に                                                                 |
| `installation_repositories` | `app_repository_selection` 更新 + `clearOrgCache`                                                        |
| その他                      | 202 返却                                                                                                 |

- batch 側の 403/404 暫定対応: crawl/backfill で repo アクセス失敗時はスキップ + ログ

### 3-4. `app/routes/api.github.setup.ts`（新規）

- `installation_id` + `state` クエリパラメータを受け取る
- state 検証 → organizationId 取得
- App JWT で `GET /app/installations/:installation_id` を GitHub API 検証
- `github_app_links` に UPSERT（soft delete 復活対応）
- `integrations.method` を `github_app` に自動切替
- `clearOrgCache`
- `/:orgSlug/settings/integration` にリダイレクト
- 未ログインでも state で org を特定できる → リンク成功後 `/login` にリダイレクト

### 3-5. 接続解除 action

- `github_app_links` を soft delete
- `integrations.method` を `token` に戻す（PAT があれば即復帰）
- `clearOrgCache`

### 3-6. 本番 App 設定更新（GitHub UI 手動作業）

- Private key 生成 + `GITHUB_APP_PRIVATE_KEY` 投入
- `GITHUB_APP_ID` 投入
- Webhook URL: `https://upflow.team/api/github/webhook`
- Webhook Secret + `GITHUB_WEBHOOK_SECRET` 投入
- Setup URL: `https://upflow.team/api/github/setup`

### 3-7. テスト

- Webhook 署名検証のユニットテスト
- State 生成・検証のユニットテスト
- Setup callback の結合テスト（state + API mock）
- `pnpm validate` 全パス

---

## Step 4: 設定 UI + リポ追加画面の App UX

**目的**: ユーザーが GitHub App を接続し、リポジトリを追加できる UI。

### 4-1. 設定画面の GitHub App セクション

`app/routes/$orgSlug/settings/integration/index.tsx` + `+forms/integration-settings.tsx`

**接続状態に応じた UI**:

| 状態              | 表示                                      | アクション                                                        |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| 未接続 + PAT なし | 「GitHub 連携が設定されていません」       | PAT 入力 / 「GitHub App をインストール」ボタン                    |
| PAT 設定済み      | 「✅ Token で接続中」                     | PAT 更新 / 「GitHub App をインストール」ボタン / 「URL をコピー」 |
| App 接続済み      | 「✅ GitHub App で接続中（org / repos）」 | 接続解除ボタン                                                    |
| App サスペンド    | 「⚠️ サスペンド中」                       | GitHub App 設定リンク                                             |
| App 要再接続      | 「⚠️ アンインストールされました」         | 再インストールボタン / Token に戻す                               |

**「インストール」ボタン**: POST → state 生成 → GitHub にリダイレクト
**「URL コピー」ボタン**: POST → state 付き URL 生成 → クリップボード

### 4-2. loader の変更

```typescript
// 現在の loader
const integration = await getIntegration(organization.id)
const safeIntegration = { provider, method, hasToken: !!privateToken }

// 変更後
const integration = await getIntegration(organization.id)
const githubAppLink = await getGithubAppLink(organization.id)
return {
  integration: { provider, method, hasToken: !!privateToken, appSuspendedAt },
  githubAppLink: githubAppLink ? { githubOrg, appRepositorySelection } : null,
}
```

### 4-3. リポジトリ追加画面の App 対応

`app/routes/$orgSlug/settings/repositories.add/`

**新関数**:

- `getInstallationOwners(octokit)`: `GET /installation/repositories` → owner 抽出
- `getInstallationRepositories(octokit, owner, keyword)`: 全件取得 → フィルタ

**loader 分岐**:

```typescript
if (integration.method === 'github_app') {
  // createOctokit → getInstallationOwners / getInstallationRepositories
} else {
  // 既存フロー（getUniqueOwners / getRepositoriesByOwnerAndKeyword）
}
```

**UI 注記**: `appRepositorySelection === 'selected'` の場合「一部のリポのみ表示」

### 4-4. 本番 App permissions 追加（GitHub UI 手動作業）

- Repository: contents, pull_requests, deployments (read) を追加
- 既存インストールに permissions 変更が反映される（GitHub が org admin に通知）

### 4-5. テスト

- 設定画面の状態表示テスト
- リポ追加画面の method 分岐テスト
- E2E: App インストール → 接続 → リポ追加（手動確認）
- `pnpm validate` 全パス

---

## 実装の順序と依存関係

```
Step 2 (Octokit factory + fetcher)
  → createOctokit は Step 3, 4 でも使う
  → PAT 方式の動作に変更なし（安全に先行実装可能）

Step 3 (Webhook + Setup callback)
  → Step 2 の createOctokit を使用
  → 本番 App 設定（private key, webhook）が必要
  → Step 4 の UI から呼ばれる setup/disconnect action を提供

Step 4 (設定 UI + リポ追加)
  → Step 2 の createOctokit を使用
  → Step 3 の setup/disconnect action を使用
  → 本番 App の permissions 追加が必要
```

## 検証チェックリスト（全 Step 完了後）

- [ ] PAT テナントで既存動作確認（crawler 1サイクル、リポ追加、設定変更）
- [ ] テスト用 org で App インストール → 設定画面で接続確認
- [ ] App テナントで crawler 1サイクル
- [ ] App テナントでリポ追加画面
- [ ] 接続解除 → PAT に復帰 → crawler 再確認
- [ ] Webhook: installation.deleted → 要再接続表示
- [ ] `pnpm validate` 全パス
