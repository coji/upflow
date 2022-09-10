import type { Integration, Repository, Company } from '@prisma/client'
import { setTimeout } from 'node:timers/promises'
import invariant from 'tiny-invariant'
import { logger } from '~/batch/helper/logger'
import { createPathBuilder } from '../../helper/path-builder'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import { buildPullRequests } from './pullrequest'
import { shapeGitHubCommit, shapeGitHubPullRequest, shapeGitHubReview, shapeGitHubReviewComment } from './shaper'
import { createStore } from './store'
import { upsertPullRequest } from '~/app/models/pullRequest.server'

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

    logger.info('fetch started: ', repository.name)
    logger.info('path: ', pathBuilder.jsonPath(''))

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(await store.loader.pullrequests().catch(() => []))
    logger.info(`last fetched at: ${leastMergeRequest?.updatedAt}`)

    // 全プルリク情報をダウンロード
    logger.info(`fetching all pullrequests...`)
    const allPullRequests = (await fetcher.pullrequests()).map((pr) => shapeGitHubPullRequest(pr))
    await store.save('pullrequests.json', allPullRequests)
    logger.info(`fetching all pullrequests completed.`)

    // 個別のPR
    for (const pr of allPullRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isNew = leastMergeRequest ? pr.updatedAt > leastMergeRequest.updatedAt : true // 新しく fetch してきた PR
      // すべて再フェッチせず、オープン以外、前回以前fetchしたPRの場合はスキップ
      if (!refresh && pr.state !== 'open' && !isNew) {
        continue
      }
      const number = pr.number

      // 個別PRの全コミット
      logger.info(`${number} commits`)
      const allCommits = await fetcher.commits(number)
      await store.save(
        store.path.commitsJsonFilename(number),
        allCommits.map((commit) => shapeGitHubCommit(commit))
      )

      await setTimeout(delay) // 待つ

      // 個別PRのレビューコメント
      logger.info(`${number} review comments`)
      const discussions = await fetcher.reviewComments(number)
      await store.save(
        store.path.discussionsJsonFilename(number),
        discussions ? discussions.map((comment) => shapeGitHubReviewComment(comment)) : []
      )

      await setTimeout(delay) // 待つ

      // 個別PRのレビュー
      logger.info(`${number} reviews`)
      const reviews = await fetcher.reviews(number)
      await store.save(
        store.path.reviewJsonFilename(number),
        reviews.map((review) => shapeGitHubReview(review))
      )

      await setTimeout(delay) // 待つ
    }

    // 全プルリク情報を保存
    await store.save('pullrequests.json', allPullRequests)
    logger.info('fetch completed: ', repository.name)
  }

  const upsert = async (company: Company, repositories: Repository[]) => {
    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id
      })

      const results = await buildPullRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id,
          releaseDetectionMethod: repository.releaseDetectionMethod ?? company.releaseDetectionMethod,
          releaseDetectionKey: repository.releaseDetectionKey ?? company.releaseDetectionKey
        },
        await store.loader.pullrequests()
      )

      for (const pr of results) {
        await upsertPullRequest(pr)
      }
    }
  }

  return {
    fetch,
    upsert
  }
}
