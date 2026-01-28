# Step 3: Provider 抽象と I/O 層の整理 - 作業計画

## 概要

Step 2 で抽出したユースケース層の下位にある Provider 層を整理する。
I/O 分離まで含めて「全部やる」が、段階を分けて各段階でゴールデン比較を必須とする。

---

## 現状分析

### 1. Provider 型が暗黙的

**現状**:

```typescript
// batch/provider/index.ts
export const createProvider = (integration: Selectable<DB.Integrations>) =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .otherwise(() => null)
```

- `Provider` 型が明示的に定義されていない
- 呼び出し側で `NonNullable<ReturnType<typeof createProvider>>` を使用

### 2. buildPullRequests に I/O が混在

**現状** (`batch/provider/github/pullrequest.ts`):

```typescript
export const buildPullRequests = async (config, pullrequests) => {
  const store = createStore(config)  // ← store を内部で生成

  for (const pr of pullrequests) {
    const commits = await store.loader.commits(pr.number)     // ← I/O
    const reviews = await store.loader.reviews(pr.number)     // ← I/O
    const discussions = await store.loader.discussions(pr.number)  // ← I/O
    const releasedAt = await findReleaseDate(..., store, ...)  // ← I/O (store を渡す)

    // ... ドメイン計算 ...
  }
}
```

**問題点**:

- store.loader.\* の I/O がループ内に散在
- `findReleaseDate` も store に依存
- テスト時にモックが必要

### 3. findReleaseDate も I/O 依存

**現状** (`batch/provider/github/release-detect.ts`):

```typescript
const findReleaseDateByBranch = async (..., store, ...) => {
  // store.loader.commits() を呼ぶ
}

const findReleaseDateByTag = async (..., store, ...) => {
  // store.loader.tags() を呼ぶ
}
```

---

## 共通型定義

Step 3-2 以降で使用する loaders の型を共通化する。

```typescript
// batch/provider/github/types.ts (新規作成)
import type {
  ShapedGitHubCommit,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from './model'

/** PR 解析に必要な I/O を抽象化した型 */
export interface PullRequestLoaders {
  commits: (number: number) => Promise<ShapedGitHubCommit[]>
  reviews: (number: number) => Promise<ShapedGitHubReview[]>
  discussions: (number: number) => Promise<ShapedGitHubReviewComment[]>
  tags: () => Promise<ShapedGitHubTag[]>
}
```

---

## 作業内容（段階分け）

### Step 3-1: Provider 型の明文化

**目的**: Provider のインターフェースを明示的に定義し、型安全性を向上

**変更ファイル 1**: `batch/provider/index.ts`

```typescript
import type { DB, Selectable } from '~/app/services/db.server'

/** Provider が提供する機能の契約 */
export interface Provider {
  fetch: (
    repository: Selectable<DB.Repositories>,
    options: { refresh?: boolean; halt?: boolean; delay?: number },
  ) => Promise<void>

  analyze: (
    organizationSetting: Pick<
      Selectable<DB.OrganizationSettings>,
      'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
    >,
    repositories: Selectable<DB.Repositories>[],
    onProgress?: (progress: {
      repo: string
      current: number
      total: number
    }) => void,
  ) => Promise<{
    pulls: Selectable<DB.PullRequests>[]
    reviewResponses: {
      repo: string
      number: string
      author: string
      createdAt: string
      responseTime: number
    }[]
  }>
}

export const createProvider = (
  integration: Selectable<DB.Integrations>,
): Provider | null =>
  match(integration.provider)
    .with('github', () => createGitHubProvider(integration))
    .otherwise(() => null)
```

**変更ファイル 2**: `batch/provider/github/provider.ts`

```typescript
import type { Provider } from '~/batch/provider'

// 戻り値型を明示的に Provider に合わせる
export const createGitHubProvider = (
  integration: Selectable<DB.Integrations>,
): Provider => {
  // ...
}
```

**変更ファイル 3**: `batch/usecases/analyze-and-upsert.ts`

```typescript
import type { Provider } from '~/batch/provider'

// NonNullable<ReturnType<...>> を Provider に置換
```

**検証**: 型チェック → テスト → ゴールデン比較

---

### Step 3-2: loaders を引数に注入（DI パターン）

**目的**: I/O 依存を外部から注入可能にする（Dependency Injection）

**注意**: `buildPullRequests` は内部で `findReleaseDate` を呼び、`findReleaseDate` も store に依存するため、両方を同時に変更する。

**変更ファイル 1**: `batch/provider/github/types.ts`（新規）

- 上記「共通型定義」セクションの `PullRequestLoaders` 型を定義

**変更ファイル 2**: `batch/provider/github/release-detect.ts`

```typescript
// Before
export const findReleaseDate = async (
  allPullRequests,
  store,  // store に依存
  pr,
  releaseDetectionMethod,
  releaseDetectionKey,
) => { ... }

// After
export const findReleaseDate = async (
  allPullRequests,
  loaders: Pick<PullRequestLoaders, 'commits' | 'tags'>,
  pr,
  releaseDetectionMethod,
  releaseDetectionKey,
) => { ... }
```

**変更ファイル 3**: `batch/provider/github/pullrequest.ts`

```typescript
// Before
export const buildPullRequests = async (config, pullrequests) => {
  const store = createStore(config) // 内部で生成
  // ...
}

// After
export const buildPullRequests = async (
  config,
  pullrequests,
  loaders: PullRequestLoaders,
) => {
  // loaders を使用
}
```

**変更ファイル 4**: `batch/provider/github/provider.ts`

```typescript
const store = createStore({ organizationId, repositoryId })
const { pulls, reviewResponses } = await buildPullRequests(
  config,
  await store.loader.pullrequests(),
  store.loader, // loaders を渡す
)
```

**検証**: 型チェック → テスト → ゴールデン比較

---

### Step 3-3: buildPullRequests を関数に分解

**目的**: 解析ロジックを小さな関数に分割し、テスト容易性を向上

**`releasedAt` について**: `releasedAt` の計算は `findReleaseDate`（I/O を含む）が担当するため、`buildPullRequests` のメインループ内で呼び出す。`buildPullRequestRow` には計算済みの `releasedAt` を渡す。

**分割する関数**:

#### I/O を含む関数

```typescript
// アーティファクト読み込み（I/O を含む）
async function loadPrArtifacts(
  pr: ShapedGitHubPullRequest,
  loaders: PullRequestLoaders,
) {
  return {
    commits: await loaders.commits(pr.number),
    reviews: await loaders.reviews(pr.number),
    discussions: await loaders.discussions(pr.number),
  }
}
```

#### 純粋関数

```typescript
// アクター除外フィルタ（純粋関数）
function filterActors(
  artifacts: PrArtifacts,
  pr: ShapedGitHubPullRequest,
  excludedUsers: string[],
): PrArtifacts {
  return {
    commits: artifacts.commits,
    reviews: artifacts.reviews.filter(...),
    discussions: artifacts.discussions.filter(...),
  }
}

// 日時計算（純粋関数）
function computeDates(
  pr: ShapedGitHubPullRequest,
  artifacts: PrArtifacts,
): PrDates {
  return {
    firstCommittedAt: ...,
    pullRequestCreatedAt: ...,
    firstReviewedAt: ...,
    mergedAt: ...,
  }
}

// PR 行生成（純粋関数）
function buildPullRequestRow(
  pr: ShapedGitHubPullRequest,
  dates: PrDates,
  releasedAt: string | null,
  config: BuildConfig,
): Selectable<DB.PullRequests> {
  return {
    ...pr,
    ...dates,
    releasedAt,
    codingTime: codingTime({ ... }),
    pickupTime: pickupTime({ ... }),
    reviewTime: reviewTime({ ... }),
    deployTime: deployTime({ ... }),
    totalTime: totalTime({ ... }),
    repositoryId: config.repositoryId,
  }
}
```

**検証**: 型チェック → テスト → ゴールデン比較

---

## 検証方法（各段階で必須）

1. **型チェック**: `pnpm typecheck`
2. **既存テスト**: `pnpm test`
3. **ゴールデン比較**: `pnpm batch:golden:compare`

差分が出た場合は、その段階で原因を特定してから次に進む。

---

## 作業順序

### Step 3-1: Provider 型の明文化

1. [ ] `batch/provider/index.ts` に `Provider` インターフェース追加
2. [ ] `batch/provider/github/provider.ts` に戻り値型 `: Provider` を明示
3. [ ] `batch/usecases/analyze-and-upsert.ts` の型を `Provider` に変更
4. [ ] 型チェック・テスト・ゴールデン比較
5. [ ] コミット

### Step 3-2: loaders を引数に注入（DI パターン）

1. [ ] `batch/provider/github/types.ts` に `PullRequestLoaders` 型を定義
2. [ ] `findReleaseDate` の引数を `store` から `loaders` に変更
3. [ ] `findReleaseDateByBranch` / `findReleaseDateByTag` も同様に変更
4. [ ] `buildPullRequests` の引数に `loaders` を追加
5. [ ] `provider.ts` で `store.loader` を渡すように変更
6. [ ] 型チェック・テスト・ゴールデン比較
7. [ ] コミット

### Step 3-3: buildPullRequests を関数に分解

1. [ ] `loadPrArtifacts`（I/O）を抽出
2. [ ] `filterActors`（純粋関数）を抽出
3. [ ] `computeDates`（純粋関数）を抽出
4. [ ] `buildPullRequestRow`（純粋関数）を抽出
5. [ ] 型チェック・テスト・ゴールデン比較
6. [ ] コミット
