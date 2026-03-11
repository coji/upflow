import type { Selectable } from 'kysely'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { logger } from '~/batch/helper/logger'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
  UpdatedPrNumbersMap,
} from './types'

interface AnalyzeReposOptions {
  onProgress?: (progress: {
    repo: string
    current: number
    total: number
  }) => void
  updatedPrNumbers?: UpdatedPrNumbersMap
}

export async function analyzeRepos(
  organizationId: OrganizationId,
  organizationSetting: Pick<
    Selectable<TenantDB.OrganizationSettings>,
    'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
  >,
  repositories: Selectable<TenantDB.Repositories>[],
  options?: AnalyzeReposOptions,
) {
  const { onProgress, updatedPrNumbers } = options ?? {}

  const allPulls: Selectable<TenantDB.PullRequests>[] = []
  const allReviews: AnalyzedReview[] = []
  const allReviewers: AnalyzedReviewer[] = []
  const allReviewResponses: AnalyzedReviewResponse[] = []

  const total = repositories.length
  let current = 0

  for (const repository of repositories) {
    current++
    onProgress?.({ repo: repository.repo, current, total })

    // フィルタが指定されていて、このリポジトリに更新PRがなければスキップ
    if (updatedPrNumbers && !updatedPrNumbers.has(repository.id)) {
      logger.info(
        `skipping ${repository.repo} (no updated PRs)`,
        organizationId,
      )
      continue
    }

    const filterPrNumbers = updatedPrNumbers?.get(repository.id)

    const store = createStore({
      organizationId,
      repositoryId: repository.id,
    })
    // 一括ロードで analyze 中の個別クエリを O(1) にする
    await store.preloadAll()

    const { pulls, reviews, reviewers, reviewResponses } =
      await buildPullRequests(
        {
          organizationId,
          repositoryId: repository.id,
          releaseDetectionMethod:
            repository.releaseDetectionMethod ??
            organizationSetting.releaseDetectionMethod,
          releaseDetectionKey:
            repository.releaseDetectionKey ??
            organizationSetting.releaseDetectionKey,
          excludedUsers: organizationSetting.excludedUsers,
        },
        await store.loader.pullrequests(),
        store.loader,
        filterPrNumbers,
      )
    allPulls.push(...pulls)
    allReviews.push(...reviews)
    allReviewers.push(...reviewers)
    allReviewResponses.push(...reviewResponses)
  }
  return {
    pulls: allPulls,
    reviews: allReviews,
    reviewers: allReviewers,
    reviewResponses: allReviewResponses,
  }
}
