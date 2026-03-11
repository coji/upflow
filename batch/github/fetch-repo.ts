import type { Selectable } from 'kysely'
import invariant from 'tiny-invariant'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { logger } from '~/batch/helper/logger'
import { createFetcher } from './fetcher'
import { createStore } from './store'

export async function fetchRepo(
  organizationId: OrganizationId,
  repository: Selectable<TenantDB.Repositories>,
  integration: Pick<Selectable<TenantDB.Integrations>, 'privateToken'>,
  options: { refresh?: boolean; halt?: boolean } = {},
): Promise<{ updatedPrNumbers: Set<number> }> {
  const { refresh = false, halt = false } = options
  invariant(repository.repo, 'repo not specified')
  invariant(repository.owner, 'owner not specified')
  invariant(integration.privateToken, 'private token not specified')

  const fetcher = createFetcher({
    owner: repository.owner,
    repo: repository.repo,
    token: integration.privateToken,
  })
  const store = createStore({
    organizationId,
    repositoryId: repository.id,
  })

  logger.info('fetch started: ', `${repository.owner}/${repository.repo}`)

  // PR の最終更新日時を起点とする（JSON パースなしで取得）
  const lastFetchedAt =
    (await store.getLatestUpdatedAt().catch(() => null)) ??
    '2000-01-01T00:00:00Z'
  logger.info(`last fetched at: ${lastFetchedAt}`)

  if (halt) {
    logger.fatal('halted')
    return { updatedPrNumbers: new Set() }
  }

  // 全タグ情報をダウンロード
  if (repository.releaseDetectionMethod === 'tags') {
    logger.info('fetching all tags...')
    const allTags = await fetcher.tags()
    await store.saveTags(allTags)
    logger.info('fetching all tags completed.')
  }

  // PR 一覧を取得
  logger.info('fetching all pullrequests...')
  const allPullRequests = await fetcher.pullrequests()
  logger.info(`fetched ${allPullRequests.length} PRs.`)

  const updatedPrNumbers = new Set<number>()
  let processed = 0
  for (const pr of allPullRequests) {
    if (halt) {
      logger.fatal('halted')
      return { updatedPrNumbers }
    }

    // refresh でなければ更新分のみ
    if (!refresh) {
      const isUpdated = pr.updatedAt > lastFetchedAt
      if (!isUpdated) {
        logger.debug('skip', pr.number, pr.state, pr.updatedAt)
        continue
      }
    }

    processed++
    logger.info(
      `${pr.number} fetching details... (${processed}/${refresh ? allPullRequests.length : '?'})`,
    )
    try {
      const [commits, discussions, reviews, timelineItems, files] =
        await Promise.all([
          fetcher.commits(pr.number),
          fetcher.comments(pr.number),
          fetcher.reviews(pr.number),
          fetcher.timelineItems(pr.number),
          fetcher.files(pr.number),
        ])
      pr.files = files

      await store.savePrData(pr, {
        commits,
        reviews,
        discussions,
        timelineItems,
      })
      updatedPrNumbers.add(pr.number)
    } catch (e) {
      logger.warn(
        `${pr.number} failed, skipping:`,
        e instanceof Error ? e.message : e,
      )
    }
  }

  logger.info('fetch completed: ', `${repository.owner}/${repository.repo}`)
  return { updatedPrNumbers }
}
