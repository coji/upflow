import type { Integration, Repository, Company, PullRequest } from '@prisma/client'
import { setTimeout } from 'node:timers/promises'
import invariant from 'tiny-invariant'
import { logger } from '~/batch/helper/logger'
import { createPathBuilder } from '../../helper/path-builder'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import { buildPullRequests } from './pullrequest'
import { createStore } from './store'

export const createGitHubProvider = (integration: Integration) => {
  interface FetchOptions {
    refresh?: boolean
    halt?: boolean
    delay?: number
  }
  const fetch = async (repository: Repository, { refresh = false, halt = false, delay = 0 }: FetchOptions) => {
    invariant(repository.repo, 'private token not specified')
    invariant(repository.owner, 'private token not specified')
    invariant(integration.privateToken, 'private token not specified')

    const fetcher = createFetcher({ owner: repository.owner, repo: repository.repo, token: integration.privateToken })
    const aggregator = createAggregator()
    const store = createStore({ companyId: repository.companyId, repositoryId: repository.id })
    const pathBuilder = createPathBuilder({ companyId: repository.companyId, repositoryId: repository.id })

    await logger.info('fetch started: ', repository.name)
    await logger.info('path: ', pathBuilder.jsonPath(''))

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(await store.loader.pullrequests().catch(() => []))
    const lastFetchedAt = leastMergeRequest?.updatedAt ?? '2000-01-01T00:00:00Z'
    await logger.info(`last fetched at: ${lastFetchedAt}`)

    // 全プルリク情報をダウンロード
    await logger.info(`fetching all pullrequests...`)
    const allPullRequests = await fetcher.pullrequests()
    await store.save('pullrequests.json', allPullRequests)
    await logger.info(`fetching all pullrequests completed.`)

    // 個別のPR
    for (const pr of allPullRequests) {
      if (halt) {
        await logger.fatal('halted')
        return
      }

      const isUpdated = pr.updatedAt > lastFetchedAt
      // 前回以前fetchしたときから更新されていないPRの場合はスキップ
      if (!refresh && !isUpdated) {
        await logger.debug('skip', pr.number, pr.state, pr.updatedAt)
        continue
      }
      const number = pr.number

      // 個別PRの全コミット
      await logger.info(`${number} commits`)
      const allCommits = await fetcher.commits(number)
      await store.save(store.path.commitsJsonFilename(number), allCommits)

      await setTimeout(delay) // 待つ

      // 個別PRのレビューコメント
      await logger.info(`${number} review comments`)
      const discussions = await fetcher.reviewComments(number)
      await store.save(store.path.discussionsJsonFilename(number), discussions)

      await setTimeout(delay) // 待つ

      // 個別PRのレビュー
      await logger.info(`${number} reviews`)
      const reviews = await fetcher.reviews(number)
      await store.save(store.path.reviewJsonFilename(number), reviews)

      await setTimeout(delay) // 待つ
    }

    // 全プルリク情報を保存
    await store.save('pullrequests.json', allPullRequests)
    await logger.info('fetch completed: ', repository.name)
  }

  const analyze = async (company: Company, repositories: Repository[]) => {
    let allPulls: PullRequest[] = []

    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id
      })
      const pulls = await buildPullRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id,
          releaseDetectionMethod: repository.releaseDetectionMethod ?? company.releaseDetectionMethod,
          releaseDetectionKey: repository.releaseDetectionKey ?? company.releaseDetectionKey
        },
        await store.loader.pullrequests()
      )
      allPulls = [...allPulls, ...pulls]
    }
    return { pulls: allPulls, reviewResponses: [] }
  }

  return {
    fetch,
    analyze
  }
}
