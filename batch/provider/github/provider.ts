import type { Selectable } from 'kysely'
import invariant from 'tiny-invariant'
import type { TenantDB } from '~/app/services/tenant-db.server'
import { logger } from '~/batch/helper/logger'
import type { Provider } from '~/batch/provider'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'

export const createGitHubProvider = (
  integration: Selectable<TenantDB.Integrations>,
): Provider => {
  const fetch: Provider['fetch'] = async (
    organizationId,
    repository,
    { refresh = false, halt = false },
  ) => {
    invariant(repository.repo, 'private token not specified')
    invariant(repository.owner, 'private token not specified')
    invariant(integration.privateToken, 'private token not specified')

    const fetcher = createFetcher({
      owner: repository.owner,
      repo: repository.repo,
      token: integration.privateToken,
    })
    const aggregator = createAggregator()
    const store = createStore({
      organizationId,
      repositoryId: repository.id,
    })

    logger.info('fetch started: ', `${repository.owner}/${repository.repo}`)

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(
      await store.loader.pullrequests().catch(() => []),
    )
    const lastFetchedAt = leastMergeRequest?.updatedAt ?? '2000-01-01T00:00:00Z'
    logger.info(`last fetched at: ${lastFetchedAt}`)

    if (halt) {
      logger.fatal('halted')
      return
    }

    // 全タグ情報をダウンロード
    if (repository.releaseDetectionMethod === 'tags') {
      logger.info('fetching all tags...')
      const allTags = await fetcher.tags()
      await store.saveTags(allTags)
      logger.info('fetching all tags completed.')
    }

    // PR 一覧を取得
    logger.info('fetching all pullrequests...')
    const allPullRequests = await fetcher.pullrequests()
    logger.info(`fetched ${allPullRequests.length} PRs.`)

    let processed = 0
    for (const pr of allPullRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      // refresh でなければ更新分のみ
      if (!refresh) {
        const isUpdated = pr.updatedAt > lastFetchedAt
        if (!isUpdated) {
          logger.debug('skip', pr.number, pr.state, pr.updatedAt)
          continue
        }
      }

      processed++
      logger.info(
        `${pr.number} fetching details... (${processed}/${refresh ? allPullRequests.length : '?'})`,
      )
      try {
        const [commits, discussions, reviews, timelineItems, files] =
          await Promise.all([
            fetcher.commits(pr.number),
            fetcher.comments(pr.number),
            fetcher.reviews(pr.number),
            fetcher.timelineItems(pr.number),
            fetcher.files(pr.number),
          ])
        pr.files = files

        await store.savePrData(pr, {
          commits,
          reviews,
          discussions,
          timelineItems,
        })
      } catch (e) {
        logger.warn(
          `${pr.number} failed, skipping:`,
          e instanceof Error ? e.message : e,
        )
      }
    }

    logger.info('fetch completed: ', `${repository.owner}/${repository.repo}`)
  }

  const backfill: Provider['backfill'] = async (organizationId, repository) => {
    invariant(repository.repo, 'repo not specified')
    invariant(repository.owner, 'owner not specified')
    invariant(integration.privateToken, 'private token not specified')

    const fetcher = createFetcher({
      owner: repository.owner,
      repo: repository.repo,
      token: integration.privateToken,
    })
    const store = createStore({
      organizationId,
      repositoryId: repository.id,
    })

    logger.info('backfill started: ', `${repository.owner}/${repository.repo}`)

    // PR 一覧を取得（メタデータのみ、詳細は不要）
    const allPullRequests = await fetcher.pullrequests()
    logger.info(`fetched ${allPullRequests.length} PR metadata.`)

    // raw データの pullRequest JSON だけを更新
    const updated = await store.updatePrMetadata(allPullRequests)
    logger.info(
      `updated ${updated} raw records in ${repository.owner}/${repository.repo}`,
    )
  }

  const analyze: Provider['analyze'] = async (
    organizationId,
    organizationSetting,
    repositories,
    onProgress,
  ) => {
    let allPulls: Selectable<TenantDB.PullRequests>[] = []
    let allReviews: {
      id: string
      pullRequestNumber: number
      repositoryId: string
      reviewer: string
      state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
      submittedAt: string
      url: string
    }[] = []
    let allReviewers: {
      pullRequestNumber: number
      repositoryId: string
      reviewers: { login: string; requestedAt: string | null }[]
    }[] = []
    let allReviewResponses: {
      repo: string
      number: string
      author: string
      createdAt: string
      responseTime: number
    }[] = []

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

  return {
    fetch,
    backfill,
    analyze,
  }
}
