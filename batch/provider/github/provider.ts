import invariant from 'tiny-invariant'
import type { DB, Selectable } from '~/app/services/db.server'
import { logger } from '~/batch/helper/logger'
import { createPathBuilder } from '../../helper/path-builder'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'

export const createGitHubProvider = (
  integration: Selectable<DB.Integration>,
) => {
  interface FetchOptions {
    refresh?: boolean
    halt?: boolean
    delay?: number
  }
  const fetch = async (
    repository: Selectable<DB.Repository>,
    { refresh = false, halt = false, delay = 0 }: FetchOptions,
  ) => {
    invariant(repository.repo, 'private token not specified')
    invariant(repository.owner, 'private token not specified')
    invariant(integration.privateToken, 'private token not specified')

    const fetcher = createFetcher({
      owner: repository.owner,
      repo: repository.repo,
      token: integration.privateToken,
      delay,
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

    // 全プルリク情報をダウンロード
    logger.info('fetching all pullrequests...')
    const allPullRequests = await fetcher.pullrequests()

    // 一旦保存する: クロールしなおしたときに quota が溢れちゃうので一旦。
    // await store.save('pullrequests.json', allPullRequests)
    logger.info('fetching all pullrequests completed.')

    // 全タグを情報をダウンロード
    if (repository.releaseDetectionMethod === 'tags') {
      logger.info('fetching all tags...')
      const allTags = await fetcher.tags()
      await store.save('tags.json', allTags)

      logger.info('fetching all tags completed.')
    }

    // 個別のPR
    for (const pr of allPullRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isUpdated = pr.updated_at > lastFetchedAt
      // 前回以前fetchしたときから更新されていないPRの場合はスキップ
      if (!refresh && !isUpdated) {
        logger.debug('skip', pr.number, pr.state, pr.updated_at)
        continue
      }

      // 個別PRの全コミット
      logger.info(`${pr.number} commits`)
      const allCommits = await fetcher.commits(pr.number)
      await store.save(store.path.commitsJsonFilename(pr.number), allCommits)

      // 個別PRのレビューコメント
      logger.info(`${pr.number} review comments`)
      const discussions = await fetcher.comments(pr.number)
      await store.save(
        store.path.discussionsJsonFilename(pr.number),
        discussions,
      )

      // 個別PRのレビュー
      logger.info(`${pr.number} reviews`)
      const reviews = await fetcher.reviews(pr.number)
      await store.save(store.path.reviewJsonFilename(pr.number), reviews)
    }

    // 全プルリク情報を保存
    await store.save('pullrequests.json', allPullRequests)
    logger.info('fetch completed: ', `${repository.owner}/${repository.repo}`)
  }

  const analyze = async (
    organizationSetting: Pick<
      Selectable<DB.OrganizationSetting>,
      'releaseDetectionMethod' | 'releaseDetectionKey'
    >,
    repositories: Selectable<DB.Repository>[],
  ) => {
    let allPulls: Selectable<DB.PullRequest>[] = []
    let allReviewResponses: {
      repo: string
      number: string
      author: string
      createdAt: string
      responseTime: number
    }[] = []

    for (const repository of repositories) {
      const store = createStore({
        organizationId: repository.organizationId,
        repositoryId: repository.id,
      })
      const { pulls, reviewResponses } = await buildPullRequests(
        {
          organizationId: repository.organizationId,
          repositoryId: repository.id,
          releaseDetectionMethod:
            repository.releaseDetectionMethod ??
            organizationSetting.releaseDetectionMethod,
          releaseDetectionKey:
            repository.releaseDetectionKey ??
            organizationSetting.releaseDetectionKey,
        },
        await store.loader.pullrequests(),
      )
      allPulls = [...allPulls, ...pulls]
      allReviewResponses = [...allReviewResponses, ...reviewResponses]
    }
    return { pulls: allPulls, reviewResponses: allReviewResponses }
  }

  return {
    fetch,
    analyze,
  }
}
