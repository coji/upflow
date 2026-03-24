# GitHub App 移行 — 残りの実装ステップ

> 正本: `docs/github-app-phase2-plan.md`（設計判断・UX フロー）、ロードマップ: `docs/github-app-migration.md`（Phase 0-5 全体）

> PR 1（スキーマ + integrations 移行 + deps）は完了。以降を `feat/github-app-migration` ブランチに1本で積む。

## Step 2: Octokit factory + fetcher リファクタ

**目的**: 全 call site を auth-agnostic にする。PAT でも GitHub App でも同じコードパスで動く。

### 2-1. `app/services/github-octokit.server.ts`（新規）

```typescript
import invariant from 'tiny-invariant'
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

  invariant(
    appId && privateKey,
    'GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required for github_app method',
  )

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
- `InvariantError`（tiny-invariant）で fail-fast（正本の方針に沿う）

**例外の使い分け方針**:

- `invariant()` / `InvariantError`: 開発者向け fail-fast。「ここに到達したらコードのバグ」（例: env var 未設定で github_app method を使おうとした）
- `throw new Error(...)`: ユーザー起因のエラー。「設定が不足している」（例: integration 未設定、auth 方式が決定できない）。call site では後者を使う

**`assertOrgGithubAuthResolvable` + `resolveOctokitFromOrg`**（同ファイルに追加）:

```typescript
type OrgGithubAuthInput = {
  integration:
    | { method: string; privateToken: string | null }
    | null
    | undefined
  githubAppLink: { installationId: number } | null | undefined
}

/**
 * durably step 内で呼べる。Octokit は作らず、ユーザー向けエラーのみ投げる。
 */
export function assertOrgGithubAuthResolvable(org: OrgGithubAuthInput): void

/**
 * org の integration + githubAppLink から Octokit を生成する。
 * assertOrgGithubAuthResolvable → createOctokit の2段構え。
 */
export function resolveOctokitFromOrg(org: OrgGithubAuthInput): Octokit
```

- `assertOrgGithubAuthResolvable`: ユーザー向けバリデーション。durably `step.run` 内で使用（Octokit を生成せずに auth の存在だけ確認）
- `resolveOctokitFromOrg`: assert 後に `createOctokit` を呼ぶ。assert 通過後の分岐は `invariant` で開発者バグ検出
- `method='github_app'` + link なし → `'GitHub App is not connected'`（PAT fallback しない）

全 call site でこれらのヘルパーを使い、method 分岐のコピペをなくす。

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

> **スコープ**: 以下の call site は `createFetcher({ token })` → `createFetcher({ octokit })` への切り替えが対象。`repositories.add` 系（`get-unique-owners.ts`, `get-repositories-by-owner-and-keyword.ts`）は **Step 4 で UI ごと置き換える**ため Step 2 の対象外。これらは PAT 直結の API（`GET /user/repos`, Search API）を使っており、GitHub App では別 API（`GET /installation/repositories`）に切り替えが必要。

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
// step の前に1回だけ fetch（secrets は step output に含めない）
const fullOrg = await getOrganization(orgId)

// step.run 内: バリデーション + 安全なデータのみ返す
const organization = await step.run('load-organization', () => {
  assertOrgGithubAuthResolvable({
    integration: fullOrg.integration,
    githubAppLink: fullOrg.githubAppLink,
  })
  return {
    /* token を含めない安全なデータのみ */
  }
})

// step の外: 同じ fullOrg から Octokit 生成（2回目の fetch 不要）
const octokit = resolveOctokitFromOrg({
  integration: fullOrg.integration,
  githubAppLink: fullOrg.githubAppLink,
})

const fetcher = createFetcher({ owner: repo.owner, repo: repo.repo, octokit })
```

**セキュリティ**: `assertOrgGithubAuthResolvable` は step 内で安全に呼べる（Octokit を作らない）。`resolveOctokitFromOrg` は step 外で呼ぶ。`getOrganization` は1回だけ。

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

action 内で `resolveOctokitFromOrg` + `createFetcher` を使う。`getRepositoryWithIntegration` は廃止し、`getRepository`（tenant DB のみ）+ `getIntegration` / `getGithubAppLink`（shared DB）に分離。

**変更前**: `getRepositoryWithIntegration` → `createFetcher({ token: repository.integration.privateToken })`
**変更後**:

```typescript
const repository = await getRepository(organization.id, repositoryId)
const integration = await getIntegration(organization.id)
const githubAppLink = await getGithubAppLink(organization.id)
const octokit = resolveOctokitFromOrg({ integration, githubAppLink })
const fetcher = createFetcher({
  owner: repository.owner,
  repo: repository.repo,
  octokit,
})
```

`$pull/queries.server.ts` の変更: `getRepositoryWithIntegration` を削除し、`getRepository`（`id`, `owner`, `repo` のみ select）に置き換え。

#### `app/routes/$orgSlug/settings/github-users._index/+functions/search-github-users.server.ts`

raw `fetch` → Octokit に統一:

**変更前**: `fetch('https://api.github.com/search/users', { headers: { Authorization: 'Bearer ...' } })`
**変更後**:

```typescript
try {
  const integration = await getIntegration(organizationId)
  const githubAppLink = await getGithubAppLink(organizationId)
  const octokit = resolveOctokitFromOrg({ integration, githubAppLink })
  const { data } = await octokit.rest.search.users({
    q: `${query} in:login`,
    per_page: 8,
  })
  return data.items.map((u) => ({ login: u.login, avatarUrl: u.avatar_url }))
} catch {
  return []
}
```

認証エラー・API エラー時は空配列を返す（既存の `if (!integration?.privateToken) return []` と同等の振る舞い）。

### 2-4. `.env.example` 更新

```
GITHUB_APP_ID=               # GitHub App の App ID（github_app method 時のみ必要）
GITHUB_APP_PRIVATE_KEY=      # GitHub App の秘密鍵（base64 エンコード）
```

### 2-5. テスト（`app/services/github-octokit.server.test.ts`）

- `createOctokit`: token method → Octokit 生成、github_app method + env なし → invariant エラー、env あり → 生成
- `assertOrgGithubAuthResolvable`: integration なし → エラー、github_app + link なし → エラー、github_app + link あり → pass、token + PAT なし → エラー
- `resolveOctokitFromOrg`: token path → Octokit 生成、github_app path → Octokit 生成
- 既存テスト全パス（PAT 方式の動作変更なし）
- `pnpm validate` 全パス（34テスト、231ケース）

---

## Step 3: Webhook + Setup callback + Installation 紐付け

**目的**: GitHub App のインストール/アンインストール/サスペンドを安全に処理するバックエンド。

### 3-0. 前提: 共有クエリの整理（Step 2 からの持ち越し）

Step 2 で `getIntegration` / `getGithubAppLink` を `_index/+functions/queries.server.ts` に置いたが、他ルート（`github-users`, `$pull`）から cross-route import している。Step 3-4 で利用箇所がさらに増えるため、このタイミングで共通化する。

- `app/services/github-integration-queries.server.ts` を新規作成
- `getIntegration(organizationId)` と `getGithubAppLink(organizationId)` を移動
- 全ルートの import 先を更新（`_index/+functions/queries.server.ts` の元の定義は削除）
- `repositories/$repository/settings/+functions/queries.server.ts` と `repositories.add/+functions/queries.server.ts` の重複 `getIntegration` も統合

### 3-1. `app/libs/webhook-verify.server.ts`（新規）

```typescript
import { timingSafeEqual, createHmac } from 'node:crypto'

export function verifyWebhookSignature(
  rawBody: string, // 必ず raw body（JSON parse 前）
  signatureHeader: string, // X-Hub-Signature-256 ヘッダ値
): boolean
```

**実装要件**:

- `sha256=` prefix を厳格に確認（prefix なし or 別アルゴリズムは reject）
- `crypto.timingSafeEqual` を使用（タイミング攻撃防止）
- raw body で HMAC 計算してから JSON parse する（parse 後の re-stringify は改変リスク）
- `GITHUB_WEBHOOK_SECRET` env var

### 3-2. `app/libs/github-app-state.server.ts`（新規）

```typescript
export function generateInstallState(organizationId: string): string
export function verifyInstallState(state: string): { organizationId: string }
```

**実装要件**:

- state = nonce（UUID）のみ。署名は不要
- DB に `github_app_install_states` テーブルを作り、nonce + organizationId + expiresAt + consumedAt を管理
- `generateInstallState`: nonce 生成 → DB INSERT → nonce を返す
- `consumeInstallState`: DB で未消費 + 未期限切れを検証 → 消費済みにして organizationId を返す
- expired / 消費済み / 存在しない nonce は reject

### 3-3. `app/routes/api.github.webhook.ts`（新規）

- `/$orgSlug` 配下でないため auth middleware の外。署名検証のみ
- **必ず raw body で署名検証 → JSON parse の順序**

イベント分岐:

| イベント                    | 処理                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `installation.created`      | `github_app_links` を `installation_id` or `github_account_id` で検索（正本どおり両方で O(1)）。あれば `app_repository_selection` を更新 + org rename 追従 |
| `installation.deleted`      | `github_app_links` を soft delete + `clearOrgCache`                                                                                                        |
| `installation.suspend`      | `integrations.appSuspendedAt` を設定                                                                                                                       |
| `installation.unsuspend`    | `integrations.appSuspendedAt` を NULL に                                                                                                                   |
| `installation_repositories` | `app_repository_selection` 更新 + `clearOrgCache`                                                                                                          |
| その他                      | 202 返却                                                                                                                                                   |

- **全 webhook の shared DB 更新はトランザクション内で実行**（`db.transaction()` を使用）
- batch 側の 403/404 暫定対応: crawl/backfill で repo アクセス失敗時はスキップ + ログ

**テスト対象**: malformed header、unsupported algo prefix、body 改変、各イベント種別の正常・異常系

### 3-4. `app/routes/api.github.setup.ts`（新規）

- `installation_id` + `state` クエリパラメータを受け取る
- **state 検証**: `consumeInstallState(nonce)` で DB 検証・消費 → `organizationId` 取得（セッション不要）
- **GitHub API 検証**: App JWT で `GET /app/installations/:installation_id` を呼び検証
  - installation が自分の App のものか確認
  - `account.login`, `account.id`, `repository_selection` を取得
  - API エラー時は nonce 未消費のまま → ユーザーは同じ URL で再試行可能
- **単一トランザクションで以下を全て実行**（`db.transaction()` 必須。nonce 消費も含む）:
  - nonce を消費済みにする（ここで初めて消費。API 検証成功後のみ）
  - `github_app_links` に UPSERT（soft delete 復活対応: `deleted_at = NULL` に戻す）
  - `integrations.method` を `github_app` に自動切替
  - `integrations.appSuspendedAt` を NULL にクリア（前回 suspend 状態からの再接続に対応）
- `UNIQUE` 制約で重複防止（同一 installation が他 tenant にリンク済みならエラー）
- トランザクション失敗時は nonce も未消費 → 再試行可能
- `clearOrgCache`
- **リダイレクト仕様**:
  1. ログイン済み + org にアクセス可能 → `/:orgSlug/settings/integration`
  2. ログイン済み + org にアクセス不可 → `/`（トップ）
  3. 未ログイン → リンクは完了（state で認証済み）→ `/login`

### 3-5. 接続解除 action

`app/routes/$orgSlug/settings/integration/index.tsx` の action に追加:

- intent: `disconnect-github-app`
- **単一トランザクションで実行**:
  - `github_app_links` を soft delete（`deleted_at` 設定）
  - `integrations.method` を `token` に戻す
- `clearOrgCache`
- **PAT 有無による挙動**（`revert-to-token` と同じ）:
  - PAT あり → 即座に PAT で動作再開
  - PAT なし → UI は「未接続 + PAT なし」状態になる（PAT 入力を促す）

### 3-6. 本番 App 設定更新（GitHub UI 手動作業）

- Private key 生成 + `GITHUB_APP_PRIVATE_KEY` 投入
- `GITHUB_APP_ID` 投入
- Webhook URL: `https://upflow.team/api/github/webhook`
- Webhook Secret + `GITHUB_WEBHOOK_SECRET` 投入
- Setup URL: `https://upflow.team/api/github/setup`

### 3-7. テスト

**Webhook 署名検証**:

- 正常な署名 → true
- malformed header（`sha256=` prefix なし）→ reject
- unsupported algo prefix → reject
- body 改変 → reject
- secret 不一致 → reject

**State トークン**:

- 生成 → 検証 → organizationId 取得成功
- expired state → reject
- 改変 state → reject
- 消費済み nonce の再利用 → reject

**Setup callback**:

- 正常フロー: state 有効 + installation 有効 → link 作成 + method 切替（トランザクション）
- duplicate installation → UNIQUE 制約エラー
- 無効な installation_id → GitHub API エラー → 適切なエラーレスポンス
- soft delete 済み link の復活

**Webhook イベント**:

- `installation.created`: link あり → `app_repository_selection` 更新 + org rename 追従
- `installation.created`: link なし → ログのみ（エラーにしない）
- `installation.deleted`: soft delete + `clearOrgCache`
- `installation.suspend` / `unsuspend`: `appSuspendedAt` 更新
- `installation_repositories`: `app_repository_selection` 更新

**接続解除**:

- soft delete + method 復帰（トランザクション）
- PAT なし時の振る舞い

**PAT フォールバック**:

- `method='github_app'` + link なし（soft deleted）→ PAT フォールバック確認

- `pnpm validate` 全パス

---

## Step 4: 設定 UI + リポ追加画面の App UX

**目的**: ユーザーが GitHub App を接続し、リポジトリを追加できる UI。

### 4-1. 設定画面の GitHub App セクション

`app/routes/$orgSlug/settings/integration/index.tsx` + `+forms/integration-settings.tsx`

**接続状態に応じた UI**:

| 状態              | 条件                                                             | 表示                                      | アクション                                                        |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| 未接続 + PAT なし | `!integration` or (`method='token'` + `!hasToken`)               | 「GitHub 連携が設定されていません」       | PAT 入力 / 「GitHub App をインストール」ボタン                    |
| PAT 設定済み      | `method='token'` + `hasToken`                                    | 「✅ Token で接続中」                     | PAT 更新 / 「GitHub App をインストール」ボタン / 「URL をコピー」 |
| App 接続済み      | `method='github_app'` + `activeLink != null` + `!appSuspendedAt` | 「✅ GitHub App で接続中（org / repos）」 | 接続解除ボタン                                                    |
| App サスペンド    | `method='github_app'` + `activeLink != null` + `appSuspendedAt`  | 「⚠️ サスペンド中」                       | GitHub App 設定リンク                                             |
| App 要再接続      | `method='github_app'` + `activeLink == null`                     | 「⚠️ アンインストールされました」         | 再インストールボタン / Token に戻す                               |

> 判定ロジック: `activeLink` は `github_app_links` の `deleted_at IS NULL` の行。「未接続」は `method='token'` で link もない。「要再接続」は `method='github_app'` だが active link がない（soft delete 済み）。

### 4-2. action の追加（server 側）

`app/routes/$orgSlug/settings/integration/index.tsx` の action に以下の intent を追加:

| intent                  | 処理                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| `integration-settings`  | 既存の PAT 更新（変更なし）                                                |
| `install-github-app`    | state 生成 → GitHub インストール URL にリダイレクト                        |
| `copy-install-url`      | state 生成 → state 付き URL を返す（クライアントでクリップボードにコピー） |
| `disconnect-github-app` | 接続解除: soft delete + method='token'（「接続済み」状態から）             |
| `revert-to-token`       | Token に戻す: soft delete + method='token'（「要再接続」状態から）         |

> `disconnect-github-app` と `revert-to-token` は**内部処理は同一**（`disconnectGithubApp(organizationId)` ヘルパーを共有）。intent 名を分けるのは操作意図・UI 文言・監査ログの文脈が異なるため。

**PAT 有無による挙動**（両 intent 共通）:

- PAT あり → `method='token'` に切替。即座に PAT で動作再開
- PAT なし → `method='token'` に切替。UI は「未接続 + PAT なし」状態になる（PAT 入力を促す）
- **UI 側**: PAT がない場合はボタンに「※ Token が未設定のため、切替後に Token の入力が必要です」の注記を表示

**schema 拡張**: `app/routes/$orgSlug/settings/_index/+schema.ts` の `integrationSettingsSchema` に新 intent を追加するか、`integration/index.tsx` に独立した action schema を定義。

### 4-3. loader の変更

`github_app_links` のクエリは `batch/db/queries.ts` の `getGithubAppLinkByOrgId` と同じ SELECT だが、batch モジュールからの import は依存の方向が不自然。**ルート層の `+functions/queries.server.ts` に同じクエリを置く**（このプロジェクトの routing convention に従う）。

```typescript
// app/routes/$orgSlug/settings/integration/+functions/queries.server.ts（新規 or 既存に追加）
export const getGithubAppLink = async (organizationId: OrganizationId) => {
  return (
    (await db
      .selectFrom('githubAppLinks')
      .select(['githubOrg', 'appRepositorySelection', 'installationId'])
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()) ?? null
  )
}
```

```typescript
// loader
const integration = await getIntegration(organization.id)
const githubAppLink = await getGithubAppLink(organization.id)
// Never send privateToken to the client
return {
  integration: integration
    ? {
        provider: integration.provider,
        method: integration.method,
        hasToken: !!integration.privateToken,
        appSuspendedAt: integration.appSuspendedAt,
      }
    : null,
  githubAppLink: githubAppLink
    ? {
        githubOrg: githubAppLink.githubOrg,
        appRepositorySelection: githubAppLink.appRepositorySelection,
      }
    : null,
}
```

### 4-4. リポジトリ追加画面の App 対応

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

### 4-5. 本番 App permissions 追加（GitHub UI 手動作業）

- Repository: contents, pull_requests, deployments (read) を追加
- 既存インストールに permissions 変更が反映される（GitHub が org admin に通知）

### 4-6. テスト

**設定画面**:

- 各状態（未接続、PAT設定済み、App接続済み、サスペンド、要再接続）の表示テスト
- install-github-app intent → リダイレクト確認
- copy-install-url intent → URL 生成確認
- disconnect-github-app intent → soft delete + method 復帰
- revert-to-token intent → method 復帰

**リポ追加画面**:

- `method='token'` → 既存フロー動作確認
- `method='github_app'` → Installation API 経由のリポ一覧（mock）
- `appRepositorySelection='selected'` → UI 注記表示

- `pnpm validate` 全パス

---

## 実装の順序と依存関係

```
Step 2 (Octokit factory + fetcher)
  → createOctokit は Step 3, 4 でも使う
  → PAT 方式の動作に変更なし（安全に先行実装可能）

Step 3 (Webhook + Setup callback)
  → Step 2 の createOctokit を使用
  → 本番 App 設定（private key, webhook, state secret）が必要
  → Step 4 の UI から呼ばれる setup/disconnect/revert action を提供

Step 4 (設定 UI + リポ追加)
  → Step 2 の createOctokit を使用
  → Step 3 の action（install, disconnect, revert）を使用
  → 本番 App の permissions 追加が必要
```

## 検証チェックリスト（全 Step 完了後）

- [ ] PAT テナントで既存動作確認（crawler 1サイクル、リポ追加、設定変更）
- [ ] テスト用 org で App インストール → 設定画面で接続確認
- [ ] App テナントで crawler 1サイクル
- [ ] App テナントでリポ追加画面
- [ ] 接続解除 → PAT に復帰 → crawler 再確認
- [ ] 再インストール → soft delete 復活 → 接続済み表示
- [ ] Webhook: installation.deleted → 要再接続表示
- [ ] Webhook: installation.suspend → サスペンド表示 → unsuspend → 復帰
- [ ] 委託インストール（URL 共有）→ 未ログインでもリンク成功
- [ ] expired state → reject
- [ ] `method='github_app'` + link なし → PAT フォールバック確認
- [ ] `pnpm validate` 全パス
