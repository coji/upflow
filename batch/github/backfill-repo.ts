import type { Selectable } from 'kysely'
import invariant from 'tiny-invariant'
import type { DB } from '~/app/services/db.server'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { logger } from '~/batch/helper/logger'
import { createFetcher } from './fetcher'
import { createStore } from './store'

export async function backfillRepo(
  organizationId: OrganizationId,
  repository: Selectable<TenantDB.Repositories>,
  integration: Pick<Selectable<DB.Integrations>, 'privateToken'>,
  options?: { files?: boolean },
) {
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

  logger.info('backfill started: ', `${repository.owner}/${repository.repo}`)

  if (options?.files) {
    // files のみ backfill: raw data の pullRequest JSON に files を追加
    const prs = await store.loader.pullrequests()
    logger.info(`backfilling files for ${prs.length} PRs...`)
    let updated = 0
    let errors = 0
    for (const pr of prs) {
      if (pr.files && pr.files.length > 0) continue // already has files
      try {
        const files = await fetcher.files(pr.number)
        pr.files = files
        await store.updatePrMetadata([pr])
        updated++
      } catch (err) {
        errors++
        logger.warn(
          `  failed to backfill files for PR #${pr.number}: ${err instanceof Error ? err.message : err}`,
        )
      }
      if ((updated + errors) % 100 === 0) {
        logger.info(
          `  files backfilled: ${updated}/${prs.length} (${errors} errors)`,
        )
      }
    }
    logger.info(
      `backfilled files for ${updated} PRs in ${repository.owner}/${repository.repo}${errors > 0 ? ` (${errors} errors)` : ''}`,
    )
    return
  }

  // PR 一覧を取得（メタデータのみ、詳細は不要）
  const allPullRequests = await fetcher.pullrequests()
  logger.info(`fetched ${allPullRequests.length} PR metadata.`)

  // raw データの pullRequest JSON だけを更新
  const updated = await store.updatePrMetadata(allPullRequests)
  logger.info(
    `updated ${updated} raw records in ${repository.owner}/${repository.repo}`,
  )
}
