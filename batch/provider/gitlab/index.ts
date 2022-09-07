import type { Integration, Repository } from '@prisma/client'
import { setTimeout } from 'node:timers/promises'
import invariant from 'tiny-invariant'
import { upsertPullRequest } from '~/app/models/pullRequest.server'
import { createFetcher } from '~/batch/provider/gitlab/fetcher'
import { timeFormat } from '../../helper/timeformat'
import { createAggregator } from './aggregator'
import { buildMergeRequests } from './mergerequest'
import { createStore } from './store'
import { logger } from '~/batch/helper/logger'
import { shapeGitLabMergeRequest, shapeGitLabCommit, shapeGitLabDiscussionNote } from './shaper'

export const createGitLabProvider = (integration: Integration) => {
  /**
   * fetch gitlab information
   */
  const fetch = async (
    repository: Repository,
    { refresh = false, halt = false, delay = 0 }: { refresh: boolean; halt: boolean; delay?: number }
  ) => {
    invariant(repository.projectId, 'project id shoud specified')
    invariant(integration.privateToken, 'provider privateToken shoud specified')

    const fetcher = createFetcher({ projectId: repository.projectId, privateToken: integration.privateToken })
    const aggregator = createAggregator()
    const store = createStore({ companyId: repository.companyId, repositoryId: repository.id })

    logger.info('fetch started: ')

    // 前回最終取得されたMR
    const leastMergeRequest = aggregator.leastUpdatedMergeRequest(await store.loader.mergerequests().catch(() => []))
    logger.info(`last fetched at: ${leastMergeRequest?.updatedAt}`)

    // すべてのMR
    logger.info('fetch all merge requests...')
    const allMergeRequests = await fetcher.mergerequests()
    store.save(
      'mergerequests.json',
      allMergeRequests.map((mr) => shapeGitLabMergeRequest(mr))
    )
    logger.info(`fetch all merge requests done: ${allMergeRequests.length} merge requests`)

    // 個別のMR
    for (const mr of allMergeRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isNew = leastMergeRequest ? mr.updated_at > leastMergeRequest.updatedAt : true // 新しく fetch してきた MR
      // すべて再フェッチせず、オープン以外、前回以前fetchしたMRの場合はスキップ
      if (!refresh && mr.state !== 'opened' && !isNew) {
        continue
      }
      const iid = mr.iid

      // 個別MRの初回コミット
      logger.info(`${iid} commits`)
      const commits = await fetcher.mergerequestFirstCommits(iid)
      store.save(
        store.path.commitsJsonFilename(iid),
        commits.map((commit) => shapeGitLabCommit(commit))
      )

      await setTimeout(delay)

      // 個別MRのすべてのディスカッション(レビューコメント含む)
      logger.info(`${iid} discussions`)
      const discussions = await fetcher.discussions(iid)
      store.save(
        store.path.discussionsJsonFilename(iid),
        discussions.map((discussion) =>
          discussion.notes ? { notes: discussion.notes?.map((note) => shapeGitLabDiscussionNote(note)) } : { notes: [] }
        )
      )

      await setTimeout(delay)
    }
  }

  /**
   * report
   */
  const report = async (repositories: Repository[]) => {
    // ヘッダ
    console.log(
      [
        'repo',
        'iid',
        'source branch',
        'target branch',
        'state',
        'author',
        'title',
        'url',
        '初回コミット日時',
        'MR作成日時',
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

      const results = await buildMergeRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id
        },
        await store.loader.mergerequests()
      )

      for (const mr of results) {
        console.log(
          [
            mr.repo,
            mr.number,
            mr.sourceBranch,
            mr.targetBranch,
            mr.state,
            mr.author,
            mr.title,
            mr.url,
            timeFormat(mr.firstCommittedAt),
            timeFormat(mr.pullRequestCreatedAt),
            timeFormat(mr.firstReviewedAt),
            timeFormat(mr.mergedAt),
            timeFormat(mr.releasedAt),
            mr.codingTime,
            mr.pickupTime,
            mr.reviewTime,
            mr.deployTime,
            mr.totalTime
          ].join('\t')
        )
      }
    }
  }

  /**
   * upsert analized report
   */
  const upsert = async (repositories: Repository[]) => {
    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id
      })
      const mergerequests = await store.loader.mergerequests()
      const results = await buildMergeRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id
        },
        mergerequests
      )
      for (const mr of results) {
        await upsertPullRequest(mr)
      }
    }
  }

  return {
    fetch,
    report,
    upsert
  }
}
