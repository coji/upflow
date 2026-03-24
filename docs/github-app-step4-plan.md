# Step 4: 設定 UI + リポ追加画面の App UX

> 正本: `docs/github-app-phase2-plan.md`、全体ステップ: `docs/github-app-impl-steps.md`
>
> `feat/github-app-migration` ブランチで作業。Step 3（Webhook + Setup callback）は完了済み。

## 目的

ユーザーが GitHub App を接続・切断し、App 経由でリポジトリを追加できる UI を構築する。

## コードベースの前提（Step 3 完了時点）

- `generateInstallState(organizationId)` → nonce 生成・DB 保存・nonce 返却（`app/libs/github-app-state.server.ts`）
- `consumeInstallState(nonce)` → nonce 検証・消費（setup callback で使用済み）
- `disconnect-github-app` intent → action 内で intent 先行分岐済み（`integration/index.tsx`）
- `getIntegration` / `getGithubAppLink` → 共通サービス（`app/services/github-integration-queries.server.ts`）
- `resolveOctokitFromOrg` / `createAppOctokit` → `app/services/github-octokit.server.ts`
- GitHub App 名: `upflow-team`、インストール URL: `https://github.com/apps/upflow-team/installations/new`

## スコープ外

- 本番 App の private key 生成・webhook 設定（Step 3-6 の手動作業）
- Webhook の実運用テスト（本番設定後に手動確認）

---

## 実装手順

### 4-1. loader の拡張

`app/routes/$orgSlug/settings/integration/index.tsx` の loader を変更。

**現在**:

```typescript
const integration = await getIntegration(organization.id)
return {
  integration: { provider, method, hasToken: !!privateToken },
}
```

**変更後**:

```typescript
const [integration, githubAppLink] = await Promise.all([
  getIntegration(organization.id),
  getGithubAppLink(organization.id),
])
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

`getGithubAppLink` は `app/services/github-integration-queries.server.ts` から import。

---

### 4-2. action の拡張

`integration/index.tsx` の action に以下の intent を追加（Step 3 で `disconnect-github-app` は実装済み）:

| intent               | 処理                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `install-github-app` | `generateInstallState(organization.id)` → nonce 付き GitHub インストール URL にリダイレクト     |
| `copy-install-url`   | `generateInstallState(organization.id)` → nonce 付き URL を JSON で返す（クライアントでコピー） |
| `revert-to-token`    | `disconnect-github-app` と同じ内部処理（ヘルパー共有）。UI 文脈が違うだけ                       |

**`install-github-app` の実装**:

```typescript
if (intent === 'install-github-app') {
  const nonce = await generateInstallState(organization.id)
  const installUrl = `https://github.com/apps/upflow-team/installations/new?state=${nonce}`
  throw redirect(installUrl)
}
```

**`copy-install-url` の実装**:

```typescript
if (intent === 'copy-install-url') {
  const nonce = await generateInstallState(organization.id)
  const installUrl = `https://github.com/apps/upflow-team/installations/new?state=${nonce}`
  return { intent: 'copy-install-url' as const, installUrl }
}
```

**`revert-to-token` の実装**: `disconnect-github-app` と同じトランザクション。ヘルパー関数 `disconnectGithubApp(organizationId)` を抽出して両方から呼ぶ。

```typescript
// app/services/github-app-mutations.server.ts に抽出
export async function disconnectGithubApp(organizationId: OrganizationId) {
  const now = new Date().toISOString()
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('githubAppLinks')
      .set({ deletedAt: now, updatedAt: now })
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .execute()
    await trx
      .updateTable('integrations')
      .set({ method: 'token', appSuspendedAt: null, updatedAt: now })
      .where('organizationId', '=', organizationId)
      .execute()
  })
  clearOrgCache(organizationId)
}
```

---

### 4-3. 設定画面コンポーネントの変更

`app/routes/$orgSlug/settings/_index/+forms/integration-settings.tsx` を拡張。

**現在の構造**: Provider（GitHub 固定）→ Method（Token 固定）→ Private Token 入力 → Update ボタン

**変更後**: method と接続状態に応じてセクションを出し分ける。**App 接続中は PAT セクションを非表示にする**（method 上書き問題を原理的に回避）。

**セクション表示ルール**:

| 状態                                                | PAT セクション      | App セクション                           |
| --------------------------------------------------- | ------------------- | ---------------------------------------- |
| `method='token'` + PAT あり                         | ✅ 表示（更新可能） | ✅ 表示（インストールボタン）            |
| `method='token'` + PAT なし                         | ✅ 表示（入力促し） | ✅ 表示（インストールボタン）            |
| `method='github_app'` + activeLink あり             | ❌ 非表示           | ✅ 表示（接続済み / サスペンド）         |
| `method='github_app'` + activeLink なし（要再接続） | ✅ 表示（復帰用）   | ✅ 表示（再インストール / Token に戻す） |

> **設計判断**: App 接続中に PAT を更新する理由がない。ロールバックは「接続解除 → PAT セクション表示 → PAT 入力」のフロー。「要再接続」時だけ両セクション表示（Token に戻す選択肢があるため）。

**GitHub App セクションの状態表示**:

```typescript
function GitHubAppSection({ integration, githubAppLink }: Props) {
  // 状態判定
  const isAppConnected =
    integration?.method === 'github_app' &&
    githubAppLink != null &&
    !integration.appSuspendedAt
  const isAppSuspended =
    integration?.method === 'github_app' &&
    githubAppLink != null &&
    !!integration.appSuspendedAt
  const needsReconnect =
    integration?.method === 'github_app' && githubAppLink == null

  if (isAppConnected) {
    // ✅ GitHub App で接続中（githubOrg / repositorySelection）+ 接続解除ボタン
  } else if (isAppSuspended) {
    // ⚠️ サスペンド中 + GitHub App 設定リンク
  } else if (needsReconnect) {
    // ⚠️ アンインストールされました + 再インストールボタン + Token に戻すボタン
  } else {
    // GitHub App をインストールボタン + URL コピーボタン
  }
}
```

**各状態のボタン**:

| ボタン                        | Form                                   | intent                  |
| ----------------------------- | -------------------------------------- | ----------------------- |
| 「GitHub App をインストール」 | `<Form method="POST">` + hidden intent | `install-github-app`    |
| 「インストール URL をコピー」 | `fetcher.submit()`                     | `copy-install-url`      |
| 「接続解除」                  | `<Form method="POST">` + ConfirmDialog | `disconnect-github-app` |
| 「再インストール」            | `<Form method="POST">` + hidden intent | `install-github-app`    |
| 「Token に戻す」              | `<Form method="POST">` + ConfirmDialog | `revert-to-token`       |

**URL コピーの UX**: `fetcher` で POST → レスポンスの `installUrl` を `navigator.clipboard.writeText()` でコピー → toast で「コピーしました」

**PAT 未設定の注記**: `revert-to-token` / `disconnect-github-app` で PAT がない場合、ボタンに「※ Token が未設定のため、切替後に Token の入力が必要です」を表示。

---

### 4-4. リポジトリ追加画面の App 対応

`app/routes/$orgSlug/settings/repositories.add/`

**4-4a. 新関数の追加**

`app/routes/$orgSlug/settings/repositories.add/+functions/get-installation-repos.ts`（新規）:

```typescript
import type { Octokit } from 'octokit'

export async function getInstallationOwners(
  octokit: Octokit,
): Promise<string[]> {
  const repos = await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  )
  return [...new Set(repos.map((r) => r.owner.login))].sort()
}

export async function getInstallationRepositories(
  octokit: Octokit,
  owner?: string,
  keyword?: string,
): Promise<{ id: number; name: string; owner: string; full_name: string }[]> {
  const repos = await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  )
  return repos
    .filter((r) => !owner || r.owner.login === owner)
    .filter(
      (r) => !keyword || r.name.toLowerCase().includes(keyword.toLowerCase()),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      owner: r.owner.login,
      full_name: r.full_name,
      visibility: r.visibility ?? 'private',
      pushed_at: r.pushed_at,
    }))
}
```

> **注意**: 返却型は現行の `RepositoryItem` コンポーネントが期待するフィールド（`visibility`, `pushed_at` 等）を含めること。`GET /installation/repositories` のレスポンスにはこれらのフィールドが含まれている。型が不足している場合は `RepositoryItem` の props と `get-repositories-by-owner-and-keyword.ts` の返却型を確認して合わせる。

**PoC（`scripts/poc-repo-add-api.ts`）で確認済み**: `GET /installation/repositories` は Installation Token でスコープされた org のリポのみ返す。Search API はスコープされないため使用不可。

**4-4b. loader の分岐**

`repositories.add/index.tsx` の loader。現在の loader は約80行あるので、method 分岐をそのまま入れると複雑になる。**ヘルパー関数に分離**して loader は分岐して呼ぶだけにする:

- `loadReposForToken(...)` — 既存の PAT フロー（`getUniqueOwners` + `getRepositoriesByOwnerAndKeyword`）
- `loadReposForApp(...)` — App フロー（`getInstallationOwners` + `getInstallationRepositories`）

loader:

```typescript
const integrationWithRepos = await getIntegrationWithRepositories(
  organization.id,
)
if (!integrationWithRepos) throw new Error('integration not created')

if (integrationWithRepos.method === 'github_app') {
  // GitHub App フロー
  const githubAppLink = await getGithubAppLink(organization.id)
  if (!githubAppLink) throw new Error('GitHub App is not connected')
  const octokit = resolveOctokitFromOrg({
    integration: integrationWithRepos,
    githubAppLink,
  })

  const registeredOwners = [
    ...new Set(integrationWithRepos.repositories.map((r) => r.owner)),
  ]
  const apiOwners = await getOrgCachedData(
    organization.id,
    'owners',
    () => getInstallationOwners(octokit),
    300000,
  )
  const owners = [...new Set([...apiOwners, ...registeredOwners])].sort()

  // owner / keyword によるフィルタ
  const { repos } = await getOrgCachedData(
    organization.id,
    `repos-${owner}-${query}`,
    () => getInstallationRepositories(octokit, owner, query),
    300000,
  )

  return {
    registeredRepos: integrationWithRepos.repositories,
    repos: repos.map((r) => ({ id: r.id, name: r.name, owner: r.owner })),
    owners,
    owner,
    query,
    pageInfo: { hasNextPage: false, endCursor: null }, // ページネーション不要（全件取得）
    appRepositorySelection: githubAppLink.appRepositorySelection,
  }
} else {
  // 既存の PAT フロー（変更なし）
  // ...
}
```

**注意**: GitHub App フローではページネーションが不要（`GET /installation/repositories` で全件取得してクライアント側フィルタ）。`pageInfo` は固定値を返す。

**4-4c. UI の変更**

- `appRepositorySelection === 'selected'` の場合、画面上部に注記:
  ```
  「GitHub App の設定で選択されたリポジトリのみ表示されています。GitHub App 設定で変更できます。」
  ```
- ページネーションボタンは `method === 'github_app'` のとき非表示（全件取得なので不要）

---

### 4-5. 本番 App permissions 追加（GitHub UI 手動作業）

- upflow-team App に permissions 追加: Repository: contents, pull_requests, deployments (read)
- 既存インストールに permissions 変更が反映される（GitHub が org admin に通知・承認要求）

---

### 4-6. `.env.example` の変更

変更なし（Step 2-3 で追加済み）。

---

### 4-7. テスト

**設定画面**:

- loader: integration + githubAppLink を返すこと
- action `install-github-app`: nonce 生成 → GitHub URL にリダイレクト
- action `copy-install-url`: nonce 生成 → URL を返す
- action `revert-to-token`: soft delete + method 復帰
- 各状態の表示（未接続、PAT設定済み、App接続済み、サスペンド、要再接続）

**リポ追加画面**:

- `method='token'` → 既存フロー動作確認（regression）
- `method='github_app'` → `getInstallationOwners` / `getInstallationRepositories` の呼び出し
- `method='github_app'` → App repo loader が現行 `RepositoryItem` で描画できる shape を返すこと
- `appRepositorySelection='selected'` → UI 注記表示

**セクション表示**:

- App 接続中 → PAT セクション非表示（PAT submit による method 上書きが原理的に不可能）
- 要再接続 → PAT セクション + App セクション両方表示
- `disconnectGithubApp` / `revert-to-token` 後に `appSuspendedAt` が `null` にクリアされること

- `pnpm validate` 全パス

---

## 検証チェックリスト（全 Step 完了後）

- [ ] PAT テナントで既存動作確認（crawler 1サイクル、リポ追加、設定変更）
- [ ] テスト用 org で「GitHub App をインストール」→ GitHub → Install → callback → 接続済み表示
- [ ] テスト用 org で「URL をコピー」→ 別ブラウザで Install → 接続済み表示
- [ ] App テナントで crawler 1サイクル
- [ ] App テナントでリポ追加画面（owner 一覧、キーワード検索）
- [ ] 接続解除 → PAT に復帰 → crawler 再確認
- [ ] 再インストール → soft delete 復活 → 接続済み表示
- [ ] Webhook: installation.deleted → 要再接続表示
- [ ] Webhook: installation.suspend → サスペンド表示 → unsuspend → 復帰
- [ ] `method='github_app'` + link なし → 要再接続表示（crawl エラー）
- [ ] `pnpm validate` 全パス
