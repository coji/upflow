import type { Integration, Repository, Company, PullRequest } from '@prisma/client'
import { setTimeout } from 'node:timers/promises'
import invariant from 'tiny-invariant'
import { createFetcher } from '~/batch/provider/gitlab/fetcher'
import { createAggregator } from './aggregator'
import { buildMergeRequests } from './mergerequest'
import { createStore } from './store'
import { logger } from '~/batch/helper/logger'
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
    const lastFetchedAt = leastMergeRequest?.updatedAt ?? '2000-01-01T00:00:00Z'
    logger.info(`last fetched at: ${lastFetchedAt}`)

    // すべてのMR
    logger.info('fetch all merge requests...')
    const allMergeRequests = await fetcher.mergerequests()
    logger.info(`fetch all merge requests done: ${allMergeRequests.length} merge requests`)

    // 個別のMR
    for (const mr of allMergeRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isUpdated = mr.updatedAt > lastFetchedAt
      // 前回以前fetchしたときから更新されていないMRの場合はスキップ
      if (!refresh && !isUpdated) {
        logger.debug('skip', {
          number: mr.iid,
          state: mr.state,
          updatedAt: mr.updatedAt,
          lastUpdatedAt: lastFetchedAt
        })
        continue
      }
      const iid = mr.iid

      // 個別MRの初回コミット
      logger.info(`${iid} commits`)
      const commits = await fetcher.commits(iid)
      await store.save(store.path.commitsJsonFilename(iid), commits)

      await setTimeout(delay)

      // 個別MRのすべてのディスカッション(レビューコメント含む)
      logger.info(`${iid} discussions`)
      const discussions = await fetcher.discussions(iid)
      await store.save(store.path.discussionsJsonFilename(iid), discussions)

      await setTimeout(delay)
    }

    await store.save('mergerequests.json', allMergeRequests)
    logger.info('fetch completed: ', repository.name)
  }

  const analyze = async (company: Company, repositories: Repository[]) => {
    let allPulls: PullRequest[] = []

    for (const repository of repositories) {
      const store = createStore({
        companyId: repository.companyId,
        repositoryId: repository.id
      })
      const mergerequests = await store.loader.mergerequests()
      const pulls = await buildMergeRequests(
        {
          companyId: repository.companyId,
          repositoryId: repository.id,
          releaseDetectionMethod: repository.releaseDetectionMethod ?? company.releaseDetectionMethod,
          releaseDetectionKey: repository.releaseDetectionKey ?? company.releaseDetectionKey
        },
        mergerequests
      )
      allPulls = [...allPulls, ...pulls]
    }
    return allPulls
  }

  return {
    fetch,
    analyze
  }
}
