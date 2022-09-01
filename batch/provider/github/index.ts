import type { Integration, Repository } from '@prisma/client'
import { logger } from '~/batch/helper/logger'
import { createFetcher } from './fetcher'
import { createAggregator } from './aggregator'
import { createStore } from './store'
import invariant from 'tiny-invariant'
import { localStorageManager } from '@chakra-ui/system'

export const createGitHubProvider = (integration: Integration) => {
  const fetch = async (repository: Repository, { refresh = false, halt = false }: { refresh?: boolean; halt?: boolean }) => {
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
    const pullrequests = await fetcher.pullrequests()
    store.save('pullrequests.json', pullrequests)
    logger.info(`fetching all pullrequests completed.`)

    // logger.info('github provider fetch is not implemented yet.')
  }

  const report = async (repositories: Repository[]) => {
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
