import type { Integration, Repository, Company } from '@prisma/client'
import { setTimeout } from 'node:timers/promises'
import invariant from 'tiny-invariant'
import { upsertPullRequest } from '~/app/models/pullRequest.server'
import { createFetcher } from '~/batch/provider/gitlab/fetcher'
import { createAggregator } from './aggregator'
import { buildMergeRequests } from './mergerequest'
import { createStore } from './store'
import { logger } from '~/batch/helper/logger'
import { shapeGitLabMergeRequest, shapeGitLabCommit, shapeGitLabDiscussionNote } from './shaper'
import { createPathBuilder } from '../../helper/path-builder'

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
    const pathBuilder = createPathBuilder({ companyId: repository.companyId, repositoryId: repository.id })

    logger.info('fetch started: ', repository.name)
    logger.info('path: ', pathBuilder.jsonPath(''))

    // 前回最終取得されたMR
    const leastMergeRequest = aggregator.leastUpdatedMergeRequest(await store.loader.mergerequests().catch(() => []))
    logger.info(`last fetched at: ${leastMergeRequest?.updatedAt}`)

    // すべてのMR
    logger.info('fetch all merge requests...')
    const allMergeRequests = (await fetcher.mergerequests()).map((mr) => shapeGitLabMergeRequest(mr))
    logger.info(`fetch all merge requests done: ${allMergeRequests.length} merge requests`)

    // 個別のMR
    for (const mr of allMergeRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isNew = leastMergeRequest ? mr.updatedAt > leastMergeRequest.updatedAt : true // 新しく fetch してきた MR
      // すべて再フェッチせず、オープン以外、前回以前fetchしたMRの場合はスキップ
      if (!refresh && mr.state !== 'opened' && !isNew) {
        continue
      }
      const iid = mr.iid

      // 個別MRの初回コミット
      logger.info(`${iid} commits`)
      const commits = await fetcher.commits(iid)
      await store.save(
        store.path.commitsJsonFilename(iid),
        commits.map((commit) => shapeGitLabCommit(commit))
      )

      await setTimeout(delay)

      // 個別MRのすべてのディスカッション(レビューコメント含む)
      logger.info(`${iid} discussions`)
      const discussions = await fetcher.discussions(iid)
      await store.save(
        store.path.discussionsJsonFilename(iid),
        discussions
          .map((discussion) =>
            discussion.notes ? discussion.notes?.map((note) => shapeGitLabDiscussionNote(note)) : []
          )
          .flat()
      )

      await setTimeout(delay)
    }

    await store.save('mergerequests.json', allMergeRequests)
    logger.info('fetch completed: ', repository.name)
  }

  /**
   * upsert analized report
   */
  const upsert = async (company: Company, repositories: Repository[]) => {
    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id
      })
      const mergerequests = await store.loader.mergerequests()
      const results = await buildMergeRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id,
          releaseDetectionMethod: repository.releaseDetectionMethod ?? company.releaseDetectionMethod,
          releaseDetectionKey: repository.releaseDetectionKey ?? company.releaseDetectionKey
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
    upsert
  }
}
