import type { Integration, Repository } from '@prisma/client'
import { logger } from '~/batch/helper/logger'
import { createFetcher } from './fetcher'
import { createAggregator } from './aggregator'
import { createStore } from './store'
import invariant from 'tiny-invariant'
import { timeFormat } from '../../helper/timeformat'
import { buildPullRequests } from './pullrequest'

export const createGitHubProvider = (integration: Integration) => {
  const fetch = async (
    repository: Repository,
    { refresh = false, halt = false }: { refresh?: boolean; halt?: boolean }
  ) => {
    invariant(repository.repo, 'private token not specified')
    invariant(repository.owner, 'private token not specified')
    invariant(integration.privateToken, 'private token not specified')

    const fetcher = createFetcher({ owner: repository.owner, repo: repository.repo, token: integration.privateToken })
    const aggregator = createAggregator()
    const store = createStore({ companyId: repository.companyId, repositoryId: repository.id })

    logger.info('fetch started: ', repository.name)

    // PR の最終更新日時を起点とする
    const leastMergeRequest = aggregator.leastUpdatedPullRequest(await store.loader.pullrequests().catch(() => []))
    logger.info(`last fetched at: ${leastMergeRequest?.updated_at}`)

    // 全プルリク情報をダウンロード
    logger.info(`fetching all pullrequests...`)
    const allPullRequests = await fetcher.pullrequests()
    store.save('pullrequests.json', allPullRequests)
    logger.info(`fetching all pullrequests completed.`)

    // production ブランチのすべての commit
    // logger.info('fetch production commits...')
    // const releaseCommits = await fetcher.refCommits('production', refresh ? leastMergeRequest?.updated_at : undefined)
    // for (const commit of releaseCommits) {
    //   store.save(store.path.releaseCommitsJsonFilename(commit.id), commit)
    // }
    // logger.info(`fetch production commits done: ${releaseCommits.length} commits`)

    // 個別のPR
    for (const pr of allPullRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isNew = leastMergeRequest ? pr.updated_at > leastMergeRequest.updated_at : true // 新しく fetch してきた PR
      // すべて再フェッチせず、オープン以外、前回以前fetchしたPRの場合はスキップ
      if (!refresh && pr.state !== 'open' && !isNew) {
        continue
      }
      const number = pr.number

      // 個別PRの初回コミット
      logger.info(`${number} commits`)
      const commits = await fetcher.firstCommit(number)
      store.save(store.path.commitsJsonFilename(number), commits ? [commits] : [])

      // 個別PRの初回レビュー
      logger.info(`${number} discussions`)
      const discussions = await fetcher.firstReviewComment(number)
      store.save(store.path.discussionsJsonFilename(number), discussions ? [discussions] : [])
    }
  }

  const report = async (repositories: Repository[]) => {
    console.log(
      [
        'number',
        'state',
        'user',
        'title',
        'html_url',
        'first_commited_at',
        'pr_created_at',
        'first_review_commented_at',
        'merged_at'
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
            pr.targetBranch,
            pr.state,
            pr.isReleased,
            pr.author,
            pr.title,
            pr.url,
            pr.firstCommittedAt,
            pr.pullRequestCreatedAt,
            pr.firstReviewedAt,
            pr.mergedAt,
            pr.releasedAt,
            timeFormat(pr.firstCommittedAt),
            timeFormat(pr.pullRequestCreatedAt),
            timeFormat(pr.firstReviewedAt),
            timeFormat(pr.mergedAt),
            timeFormat(pr.releasedAt)
          ].join('\t')
        )
      }
    }

    logger.info('github provider report is not implemented yet')
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
