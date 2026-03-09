import type { Selectable } from 'kysely'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
} from './types'

export async function analyzeRepos(
  organizationId: OrganizationId,
  organizationSetting: Pick<
    Selectable<TenantDB.OrganizationSettings>,
    'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
  >,
  repositories: Selectable<TenantDB.Repositories>[],
  onProgress?: (progress: {
    repo: string
    current: number
    total: number
  }) => void,
) {
  let allPulls: Selectable<TenantDB.PullRequests>[] = []
  let allReviews: AnalyzedReview[] = []
  let allReviewers: AnalyzedReviewer[] = []
  let allReviewResponses: AnalyzedReviewResponse[] = []

  const total = repositories.length
  let current = 0

  for (const repository of repositories) {
    current++
    onProgress?.({ repo: repository.repo, current, total })

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
      )
    allPulls = [...allPulls, ...pulls]
    allReviews = [...allReviews, ...reviews]
    allReviewers = [...allReviewers, ...reviewers]
    allReviewResponses = [...allReviewResponses, ...reviewResponses]
  }
  return {
    pulls: allPulls,
    reviews: allReviews,
    reviewers: allReviewers,
    reviewResponses: allReviewResponses,
  }
}
