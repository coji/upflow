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

    if (refresh) {
      // フルリフレッシュ: ネストクエリで一括取得（N+1 回避）
      logger.info('fetching all pullrequests with details (nested query)...')
      const allDetails = await fetcher.pullrequestsWithDetails()
      logger.info(`fetched ${allDetails.length} PRs with details.`)

      for (const detail of allDetails) {
        if (halt) {
          logger.fatal('halted')
          return
        }

        const { pr } = detail

        // commits: オーバーフロー時は個別取得でフォールバック
        let { commits } = detail
        if (detail.needsMoreCommits) {
          logger.info(`${pr.number} commits overflow, fetching individually...`)
          commits = await fetcher.commits(pr.number)
        }

        // reviews: オーバーフロー時は個別取得でフォールバック
        let { reviews } = detail
        if (detail.needsMoreReviews) {
          logger.info(`${pr.number} reviews overflow, fetching individually...`)
          reviews = await fetcher.reviews(pr.number)
        }

        // comments: オーバーフロー時は個別取得でフォールバック
        let { comments } = detail
        if (
          detail.needsMoreComments ||
          detail.needsMoreReviewThreads ||
          detail.needsMoreReviewThreadComments
        ) {
          logger.info(
            `${pr.number} comments overflow, fetching individually...`,
          )
          comments = await fetcher.comments(pr.number)
        }

        // timelineItems: オーバーフロー時は個別取得でフォールバック
        let { timelineItems } = detail
        if (detail.needsMoreTimelineItems) {
          logger.info(
            `${pr.number} timeline items overflow, fetching individually...`,
          )
          timelineItems = await fetcher.timelineItems(pr.number)
        }

        // files: 常に個別取得（ネストクエリから除外済み）
        const files = await fetcher.files(pr.number)
        pr.files = files

        await store.savePrData(pr, {
          commits,
          reviews,
          discussions: comments,
          timelineItems,
        })
        logger.info(`${pr.number} saved`)
      }
    } else {
      // インクリメンタル: PR一覧だけ取得し、更新分のみ個別に詳細取得
      logger.info('fetching all pullrequests...')
      const allPullRequests = await fetcher.pullrequests()
      logger.info(`fetched ${allPullRequests.length} PRs.`)

      for (const pr of allPullRequests) {
        if (halt) {
          logger.fatal('halted')
          return
        }

        const isUpdated = pr.updatedAt > lastFetchedAt
        if (!isUpdated) {
          logger.debug('skip', pr.number, pr.state, pr.updatedAt)
          continue
        }

        logger.info(`${pr.number} fetching details...`)
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
      }
    }

    logger.info('fetch completed: ', `${repository.owner}/${repository.repo}`)
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
    analyze,
  }
}
