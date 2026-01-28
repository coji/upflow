# Batch リファクタリング作業計画

## 概要

`batch-refactor-plan.md` の計画に基づき、Step 2（ユースケース層の抽出）から開始する。

### Step 1（Functional Core）の位置づけ

- `cycletime.ts` / `review-response.ts` は既に純粋関数として分離済み
- `buildPullRequests` は I/O（store.loader.\*）が混在しているが、ユースケース層抽出の直接の対象ではない
- **後工程（Step 3 以降）で並行して検討**する

---

## 現状分析

### 重複箇所

`crawlJob`（batch/jobs/crawl.ts）と `upsertCommand`（batch/commands/upsert.ts）が以下のフローを重複実装：

```
crawlJob:
  for each organization:
    1. provider.fetch(repository)      ← crawlJob のみ
    2. provider.analyze(setting, repositories)
    3. upsertPullRequest(pr) for each pr
    4. exportPullsToSpreadsheet()
    5. exportReviewResponsesToSpreadsheet()

upsertCommand:
    1. （fetch なし）
    2. provider.analyze(setting, repositories)
    3. upsertPullRequest(pr) for each pr
    4. exportPullsToSpreadsheet()
    5. exportReviewResponsesToSpreadsheet()
```

### 既に純粋関数として分離済み

- `batch/bizlogic/cycletime.ts` - codingTime, pickupTime, reviewTime, deployTime, totalTime
- `batch/provider/github/review-response.ts` - analyzeReviewResponse

### I/O とドメイン計算が混在（後工程で検討）

- `batch/provider/github/pullrequest.ts` の `buildPullRequests`
  - store.loader.commits() 等の I/O が内部に存在
  - テスト可能性は store モックで担保されているため、今回は対象外

---

## 作業ステップ

### Step 2-1: ユースケース関数の作成

**ファイル**: `batch/usecases/analyze-and-upsert.ts`

#### 型定義（ドメイン DTO）

```typescript
import type { DB, Selectable } from '~/app/services/db.server'
import type { createProvider } from '~/batch/provider'

/** Provider 型（null を除外） */
type Provider = NonNullable<ReturnType<typeof createProvider>>

/** analyzeAndUpsert に渡す organization の必須フィールド */
interface OrganizationForAnalyze {
  id: string
  organizationSetting: Pick<
    Selectable<DB.OrganizationSettings>,
    'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
  >
  repositories: Selectable<DB.Repositories>[]
  exportSetting?: Selectable<DB.ExportSettings> | null
}

interface AnalyzeAndUpsertParams {
  organization: OrganizationForAnalyze
  provider: Provider // null を除外した型
}
```

#### 実装

```typescript
import { logger } from '~/batch/helper/logger' // consola のエイリアス

export async function analyzeAndUpsert({
  organization,
  provider,
}: AnalyzeAndUpsertParams) {
  logger.info('analyze started...', { organizationId: organization.id })

  // 1. analyze
  const { pulls, reviewResponses } = await provider.analyze(
    organization.organizationSetting,
    organization.repositories,
  )
  logger.info('analyze completed.', { pullsCount: pulls.length })

  // 2. upsert
  logger.info('upsert started...')
  for (const pr of pulls) {
    await upsertPullRequest(pr)
  }
  logger.info('upsert completed.')

  // 3. export (optional)
  if (organization.exportSetting) {
    logger.info('exporting to spreadsheet...')
    await exportPullsToSpreadsheet(pulls, organization.exportSetting)
    await exportReviewResponsesToSpreadsheet(
      reviewResponses,
      organization.exportSetting,
    )
    logger.info('export to spreadsheet done.')
  }

  return { pulls, reviewResponses }
}
```

### Step 2-2: crawlJob の書き換え

- `invariant` チェックは呼び出し側（crawlJob）に残す
- ログは現行と同等の粒度を維持

```typescript
export const crawlJob = async () => {
  logger.info('crawl started.')

  const organizations = await listAllOrganizations()

  for (const organization of organizations) {
    logger.info('organization:', organization.name)

    if (!organization.organizationSetting?.isActive) {
      logger.info('organization is not active.')
      continue
    }

    const integration = organization.integration
    if (!integration) {
      logger.error('integration not set:', organization.id, organization.name)
      continue
    }

    const provider = createProvider(integration)
    if (!provider) {
      logger.error(
        'provider cant detected',
        organization.id,
        organization.name,
        integration.provider,
      )
      continue
    }

    // fetch
    for (const repository of organization.repositories) {
      logger.info('fetch started...')
      await provider.fetch(repository, options)
      logger.info('fetch completed.')
    }

    // analyze + upsert + export
    await analyzeAndUpsert({ organization, provider })
  }

  logger.info('crawl completed.')
}
```

### Step 2-3: upsertCommand の書き換え

```typescript
export async function upsertCommand({ organizationId }: UpsertCommandProps) {
  if (!organizationId) {
    consola.error('config should specified')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return
  }

  const organization = await getOrganization(organizationId)
  invariant(organization.integration, 'integration should related')
  invariant(
    organization.organizationSetting,
    'organization setting should related',
  )

  const provider = createProvider(organization.integration)
  invariant(provider, `unknown provider ${organization.integration.provider}`)

  await analyzeAndUpsert({ organization, provider })
}
```

---

## 検証方法

### 必須チェック

1. **型チェック**: `pnpm typecheck`
2. **既存テスト**: `pnpm test`
3. **ゴールデン比較**（自動差分検出）:
   - リファクタ前: `pnpm batch:golden:snapshot`
   - リファクタ後: `pnpm batch:golden:compare`
   - 差分があれば `exitCode = 1` で失敗
   - **前提**: `.env` に `DATABASE_URL` が設定されていること

### ゴールデン比較の対象

- **保存先**: `tmp/golden/batch-analysis-snapshot.json`（デフォルト）
- `pulls`: PR 解析結果（repo/number/updatedAt でソート）
- `reviewResponses`: レビュー反応時間（repo/number/createdAt/author でソート）

---

## ロギング方針

- **使用する logger**: `~/batch/helper/logger`（`consola` のエイリアス）
- ユースケース層（`analyzeAndUpsert`）でも `logger` を使用し、処理フェーズごとにログを残す
- 呼び出し側（`crawlJob` / `upsertCommand`）で org/repo 単位のログを維持
- 例外は発生箇所で throw し、呼び出し側で捕捉してログ出力

---

## 今後のステップ（参考）

- Step 3: Provider 抽象と I/O 層の整理（`buildPullRequests` の I/O 分離を含む）
- Step 4: Export / Upsert の整理
- Step 5: 最終検証（ゴールデン比較）

---

## 作業順序

1. [ ] ゴールデンスナップショット取得（リファクタ前）
2. [ ] `batch/usecases/` ディレクトリ作成
3. [ ] `batch/usecases/analyze-and-upsert.ts` 作成
4. [ ] `batch/jobs/crawl.ts` 書き換え
5. [ ] `batch/commands/upsert.ts` 書き換え
6. [ ] 型チェック・テスト実行
7. [ ] ゴールデン比較実行
8. [ ] コミット
