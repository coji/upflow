import type { Integration, Repository } from '@prisma/client'
import { setTimeout } from 'node:timers/promises'
import invariant from 'tiny-invariant'
import { logger } from '~/batch/helper/logger'
import { createPathBuilder } from '../../helper/path-builder'
import { timeFormat } from '../../helper/timeformat'
import { createAggregator } from './aggregator'
import { createFetcher } from './fetcher'
import { buildPullRequests } from './pullrequest'
import { shapeGitHubCommit, shapeGitHubPullRequest, shapeGitHubReview, shapeGitHubReviewComment } from './shaper'
import { createStore } from './store'

export const createGitHubProvider = (integration: Integration) => {
  const fetch = async (
    repository: Repository,
    { refresh = false, halt = false, delay = 0 }: { refresh?: boolean; halt?: boolean; delay?: number }
  ) => {
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
    const allPullRequests = await fetcher.pullrequests()
    store.save(
      'pullrequests.json',
      allPullRequests.map((pr) => shapeGitHubPullRequest(pr))
    )
    logger.info(`fetching all pullrequests completed.`)

    // 個別のPR
    for (const pr of allPullRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isNew = leastMergeRequest ? pr.updated_at > leastMergeRequest.updatedAt : true // 新しく fetch してきた PR
      // すべて再フェッチせず、オープン以外、前回以前fetchしたPRの場合はスキップ
      if (!refresh && pr.state !== 'open' && !isNew) {
        continue
      }
      const number = pr.number

      // 個別PRの全コミット
      logger.info(`${number} commits`)
      const allCommits = await fetcher.commits(number)
      store.save(
        store.path.commitsJsonFilename(number),
        allCommits.map((commit) => shapeGitHubCommit(commit))
      )

      await setTimeout(delay) // 待つ

      // 個別PRのレビューコメント
      logger.info(`${number} review comments`)
      const discussions = await fetcher.reviewComments(number)
      store.save(
        store.path.discussionsJsonFilename(number),
        discussions ? discussions.map((comment) => shapeGitHubReviewComment(comment)) : []
      )

      await setTimeout(delay) // 待つ

      // 個別PRのレビュー
      logger.info(`${number} reviews`)
      const reviews = await fetcher.reviews(number)
      store.save(
        store.path.reviewJsonFilename(number),
        reviews.map((review) => shapeGitHubReview(review))
      )

      await setTimeout(delay) // 待つ
    }

    // 全プルリク情報を保存
    store.save(
      'pullrequests.json',
      allPullRequests.map((pr) => shapeGitHubPullRequest(pr))
    )
    logger.info('fetch completed: ', repository.name)
  }

  const report = async (repositories: Repository[]) => {
    console.log(
      [
        'repo',
        'number',
        'source branch',
        'target branch',
        'state',
        'author',
        'title',
        'url',
        '初回コミット日時',
        'PR作成日時',
        '初回レビュー日時',
        'マージ日時',
        'リリース日時',
        'coding time',
        'pickup time',
        'review time',
        'deploy time',
        'total time'
      ].join('\t')
    )

    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id
      })

      const results = await buildPullRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id
        },
        await store.loader.pullrequests()
      )

      for (const pr of results) {
        console.log(
          [
            pr.repo,
            pr.number,
            pr.sourceBranch,
            pr.targetBranch,
            pr.state,
            pr.author,
            pr.title,
            pr.url,
            timeFormat(pr.firstCommittedAt),
            timeFormat(pr.pullRequestCreatedAt),
            timeFormat(pr.firstReviewedAt),
            timeFormat(pr.mergedAt),
            timeFormat(pr.releasedAt),
            pr.codingTime,
            pr.pickupTime,
            pr.reviewTime,
            pr.deployTime,
            pr.totalTime
          ].join('\t')
        )
      }
    }
  }

  const upsert = async (repositories: Repository[]) => {
    logger.info('github provider upsert is not implemented yet')
  }

  return {
    fetch,
    report,
    upsert
  }
}
