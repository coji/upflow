import type { Integration, Repository } from '@prisma/client'
import invariant from 'tiny-invariant'
import { upsertMergeRequest } from '~/app/models/mergeRequest.server'
import { createFetcher } from '~/batch/provider/gitlab/fetcher'
import { timeFormat } from '../../helper/timeformat'
import { createAggregator } from './aggregator'
import { buildMergeRequests } from './mergerequest'
import { createStore } from './store'
import { logger } from '~/batch/helper/logger'

export const createGitLabProvider = (integration: Integration) => {
  /**
   * fetch gitlab information
   */
  const fetch = async (
    repository: Repository,
    { refresh = false, halt = false }: { refresh: boolean; halt: boolean }
  ) => {
    invariant(repository.projectId, 'project id shoud specified')
    invariant(integration.privateToken, 'provider privateToken shoud specified')

    const fetcher = createFetcher({ projectId: repository.projectId, privateToken: integration.privateToken })
    const aggregator = createAggregator()
    const store = createStore({ companyId: repository.companyId, repositoryId: repository.id })

    logger.info('fetch started: ')

    // 前回最終取得されたMR
    const leastMergeRequest = aggregator.leastUpdatedMergeRequest(await store.loader.mergerequests().catch(() => []))
    logger.info(`last fetched at: ${leastMergeRequest?.updated_at}`)

    // すべてのMR
    logger.info('fetch all merge requests...')
    const allMergeRequests = await fetcher.mergerequests()
    store.save('mergerequests.json', allMergeRequests)
    logger.info(`fetch all merge requests done: ${allMergeRequests.length} merge requests`)

    // production ブランチのすべての commit
    logger.info('fetch production commits...')
    const releaseCommits = await fetcher.refCommits('production', refresh ? leastMergeRequest?.updated_at : undefined)
    for (const commit of releaseCommits) {
      store.save(store.path.releaseCommitsJsonFilename(commit.id), commit)
    }
    logger.info(`fetch production commits done: ${releaseCommits.length} commits`)

    // 個別のMR
    for (const mr of allMergeRequests) {
      if (halt) {
        logger.fatal('halted')
        return
      }

      const isNew = leastMergeRequest ? mr.updated_at > leastMergeRequest.updated_at : true // 新しく fetch してきた MR
      // すべて再フェッチせず、オープン以外、前回以前fetchしたMRの場合はスキップ
      if (!refresh && mr.state !== 'opened' && !isNew) {
        continue
      }
      const iid = mr.iid

      // 個別MRのすべてのコミット
      logger.info(`${iid} commits`)
      const commits = await fetcher.mergerequestCommits(iid)
      store.save(store.path.commitsJsonFilename(iid), commits)

      // 個別MRのすべてのディスカッション(レビューコメント含む)
      logger.info(`${iid} discussions`)
      const discussions = await fetcher.discussions(iid)
      store.save(store.path.discussionsJsonFilename(iid), discussions)
    }
  }

  /**
   * report
   */
  const report = async (repositories: Repository[]) => {
    // ヘッダ
    console.log(
      [
        'id',
        'target_branch',
        'state',
        'コミット数',
        'コメント数',
        '初回コミット日時',
        'MR作成日時',
        '初回レビュー日時',
        'マージ日時',
        'リリース日時',
        'リリースにコミット済',
        'MR作成者',
        'MRタイトル'
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
            mr.id,
            mr.target_branch,
            mr.state,
            mr.num_of_comments,
            mr.num_of_comments,
            timeFormat(mr.first_commited_at),
            timeFormat(mr.mergerequest_created_at),
            timeFormat(mr.first_reviewd_at),
            timeFormat(mr.merged_at),
            timeFormat(mr.released_at),
            mr.is_release_committed,
            mr.author,
            mr.title
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
        await upsertMergeRequest(mr)
      }
    }
  }

  return {
    fetch,
    report,
    upsert
  }
}
