import { setTimeout } from 'node:timers/promises'
import type {
  Company,
  Integration,
  PullRequest,
  Repository,
} from '@prisma/client'
import invariant from 'tiny-invariant'
import { crawlerDb, listValue } from '~/batch/db/crawler-db.server'
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
  const fetch = async (
    repository: Repository,
    { refresh = false, halt = false, delay = 0 }: FetchOptions,
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
      companyId: repository.companyId,
      repositoryId: repository.id,
    })
    const pathBuilder = createPathBuilder({
      companyId: repository.companyId,
      repositoryId: repository.id,
    })

    logger.info('fetch started: ', repository.name)
    logger.info('path: ', pathBuilder.jsonPath(''))

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(
      await store.loader.pullrequests().catch(() => []),
    )
    const lastFetchedAt = leastMergeRequest?.updatedAt ?? '2000-01-01T00:00:00Z'
    logger.info(`last fetched at: ${lastFetchedAt}`)

    // 全プルリク情報をダウンロード
    logger.info('fetching all pullrequests...')
    const allPullRequests = await fetcher.pullrequests()

    for (const pr of allPullRequests) {
      await crawlerDb
        .insertInto('pull_requests')
        .values({
          id: pr.id,
          organization: pr.organization,
          repo: pr.repo,
          number: pr.number,
          state: pr.state,
          url: pr.url,
          author: pr.author,
          assignees: listValue(pr.assignees),
          reviewers: listValue(pr.reviewers),
          draft: pr.draft,
          title: pr.title,
          source_branch: pr.sourceBranch,
          target_branch: pr.targetBranch,
          merged_at: pr.mergedAt,
          merge_commit_sha: pr.mergeCommitSha,
          created_at: pr.createdAt,
          updated_at: pr.updatedAt,
        })
        .onConflict((oc) =>
          oc.columns(['id']).doUpdateSet({
            organization: (eb) => eb.ref('excluded.organization'),
            repo: (eb) => eb.ref('excluded.repo'),
            number: (eb) => eb.ref('excluded.number'),
            state: (eb) => eb.ref('excluded.state'),
            url: (eb) => eb.ref('excluded.url'),
            author: (eb) => eb.ref('excluded.author'),
            assignees: (eb) => eb.ref('excluded.assignees'),
            reviewers: (eb) => eb.ref('excluded.reviewers'),
            title: (eb) => eb.ref('excluded.title'),
            source_branch: (eb) => eb.ref('excluded.source_branch'),
            target_branch: (eb) => eb.ref('excluded.target_branch'),
            merged_at: (eb) => eb.ref('excluded.merged_at'),
            merge_commit_sha: (eb) => eb.ref('excluded.merge_commit_sha'),
            created_at: (eb) => eb.ref('excluded.created_at'),
            updated_at: (eb) => eb.ref('excluded.updated_at'),
          }),
        )
        .execute()
    }

    // 全プルリク情報を保存
    await store.save('pullrequests.json', allPullRequests)
    logger.info('fetching all pullrequests completed.')

    return
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

      const isUpdated = pr.updatedAt > lastFetchedAt
      // 前回以前fetchしたときから更新されていないPRの場合はスキップ
      if (!refresh && !isUpdated) {
        logger.debug('skip', pr.number, pr.state, pr.updatedAt)
        continue
      }
      const number = pr.number

      // 個別PRの全コミット
      logger.info(`${number} commits`)
      const allCommits = await fetcher.commits(number)
      await store.save(store.path.commitsJsonFilename(number), allCommits)

      await setTimeout(delay) // 待つ

      // 個別PRのレビューコメント
      logger.info(`${number} review comments`)
      const discussions = await fetcher.comments(number)
      await store.save(store.path.discussionsJsonFilename(number), discussions)

      await setTimeout(delay) // 待つ

      // 個別PRのレビュー
      logger.info(`${number} reviews`)
      const reviews = await fetcher.reviews(number)
      await store.save(store.path.reviewJsonFilename(number), reviews)

      await setTimeout(delay) // 待つ
    }

    // 全プルリク情報を保存
    await store.save('pullrequests.json', allPullRequests)
    logger.info('fetch completed: ', repository.name)
  }

  const analyze = async (company: Company, repositories: Repository[]) => {
    let allPulls: PullRequest[] = []
    let allReviewResponses: {
      repo: string
      number: string
      author: string
      createdAt: string
      responseTime: number
    }[] = []

    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id,
      })
      const { pulls, reviewResponses } = await buildPullRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id,
          releaseDetectionMethod:
            repository.releaseDetectionMethod ?? company.releaseDetectionMethod,
          releaseDetectionKey:
            repository.releaseDetectionKey ?? company.releaseDetectionKey,
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
