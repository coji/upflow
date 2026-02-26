import type { Selectable } from 'kysely'
import invariant from 'tiny-invariant'
import type { TenantDB } from '~/app/services/tenant-db.server'
import { logger } from '~/batch/helper/logger'
import type { Provider } from '~/batch/provider'
import { createPathBuilder } from '../../helper/path-builder'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'

export const createGitHubProvider = (
  integration: Selectable<TenantDB.Integrations>,
): Provider => {
  const fetch: Provider['fetch'] = async (
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
      organizationId: repository.organizationId,
      repositoryId: repository.id,
    })
    const pathBuilder = createPathBuilder({
      organizationId: repository.organizationId,
      repositoryId: repository.id,
    })

    logger.info('fetch started: ', `${repository.owner}/${repository.repo}`)
    logger.info('path: ', pathBuilder.jsonPath(''))

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(
      await store.loader.pullrequests().catch(() => []),
    )
    const lastFetchedAt =
      leastMergeRequest?.updated_at ?? '2000-01-01T00:00:00Z'
    logger.info(`last fetched at: ${lastFetchedAt}`)

    if (halt) {
      logger.fatal('halted')
      return
    }

    // 全タグ情報をダウンロード
    if (repository.releaseDetectionMethod === 'tags') {
      logger.info('fetching all tags...')
      const allTags = await fetcher.tags()
      await store.save('tags.json', allTags)
      logger.info('fetching all tags completed.')
    }

    if (refresh) {
      // フルリフレッシュ: ネストクエリで一括取得（N+1 回避）
      logger.info('fetching all pullrequests with details (nested query)...')
      const allDetails = await fetcher.pullrequestsWithDetails()
      logger.info(`fetched ${allDetails.length} PRs with details.`)

      const allPullRequests = []
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
        await store.save(store.path.commitsJsonFilename(pr.number), commits)

        // reviews: オーバーフロー時は個別取得でフォールバック
        let { reviews } = detail
        if (detail.needsMoreReviews) {
          logger.info(`${pr.number} reviews overflow, fetching individually...`)
          reviews = await fetcher.reviews(pr.number)
        }
        await store.save(store.path.reviewJsonFilename(pr.number), reviews)

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
        await store.save(
          store.path.discussionsJsonFilename(pr.number),
          comments,
        )

        allPullRequests.push(pr)
        logger.info(`${pr.number} saved`)
      }

      await store.save('pullrequests.json', allPullRequests)
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

        const isUpdated = pr.updated_at > lastFetchedAt
        if (!isUpdated) {
          logger.debug('skip', pr.number, pr.state, pr.updated_at)
          continue
        }

        logger.info(`${pr.number} commits`)
        const allCommits = await fetcher.commits(pr.number)
        await store.save(store.path.commitsJsonFilename(pr.number), allCommits)

        logger.info(`${pr.number} review comments`)
        const discussions = await fetcher.comments(pr.number)
        await store.save(
          store.path.discussionsJsonFilename(pr.number),
          discussions,
        )

        logger.info(`${pr.number} reviews`)
        const reviews = await fetcher.reviews(pr.number)
        await store.save(store.path.reviewJsonFilename(pr.number), reviews)
      }

      await store.save('pullrequests.json', allPullRequests)
    }

    logger.info('fetch completed: ', `${repository.owner}/${repository.repo}`)
  }

  const analyze: Provider['analyze'] = async (
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
      state: string
      submittedAt: string
      url: string
    }[] = []
    let allReviewers: {
      pullRequestNumber: number
      repositoryId: string
      reviewerLogins: string[]
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
        organizationId: repository.organizationId,
        repositoryId: repository.id,
      })
      const { pulls, reviews, reviewers, reviewResponses } =
        await buildPullRequests(
          {
            organizationId: repository.organizationId,
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
