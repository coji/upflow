import consola from 'consola'
import { match } from 'ts-pattern'
import type { ReassignBrokenRepositoryResult } from '~/app/services/github-app-membership.server'
import { reassignBrokenRepository } from '~/app/services/github-app-membership.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface ReassignBrokenRepositoriesCommandProps {
  organizationId?: string
  repositoryId?: string
}

/**
 * Operator command to recover repositories whose canonical
 * `github_installation_id` was lost. Walks every broken repository in the org
 * (or a single one if `repositoryId` is given) and asks
 * {@link reassignBrokenRepository} to assign a new canonical from the
 * membership table.
 */
export async function reassignBrokenRepositoriesCommand(
  props: ReassignBrokenRepositoriesCommandProps,
) {
  try {
    const result = await requireOrganization(props.organizationId)
    if (!result) return

    const { orgId } = result
    const tenantDb = getTenantDb(orgId)

    let query = tenantDb
      .selectFrom('repositories')
      .select(['id', 'owner', 'repo'])
      .where('githubInstallationId', 'is', null)
    if (props.repositoryId) {
      query = query.where('id', '=', props.repositoryId)
    }
    const broken = await query.execute()

    if (broken.length === 0) {
      consola.info('No broken repositories found.')
      return
    }
    consola.info(`Found ${broken.length} broken repositories. Reassigning...`)

    const counts: Record<ReassignBrokenRepositoryResult['status'], number> = {
      reassigned: 0,
      no_candidates: 0,
      pending_initialization: 0,
      ambiguous: 0,
      not_found: 0,
      not_broken: 0,
    }
    for (const repo of broken) {
      const label = `${repo.owner}/${repo.repo}`
      try {
        const outcome = await reassignBrokenRepository({
          organizationId: orgId,
          repositoryId: repo.id,
          source: 'cli_repair',
        })
        counts[outcome.status]++
        match(outcome)
          .with({ status: 'reassigned' }, ({ installationId }) =>
            consola.success(`${label} → installation ${installationId}`),
          )
          .with({ status: 'ambiguous' }, ({ candidateCount }) =>
            consola.warn(
              `${label}: ${candidateCount} candidates, manual disconnect required`,
            ),
          )
          .with({ status: 'no_candidates' }, () =>
            consola.warn(`${label}: no active installation can see this repo`),
          )
          .with({ status: 'pending_initialization' }, () =>
            consola.warn(
              `${label}: installation pending membership initialization`,
            ),
          )
          .with({ status: 'not_found' }, () =>
            consola.warn(`${label}: repository not found`),
          )
          .with({ status: 'not_broken' }, () =>
            consola.info(`${label}: already assigned`),
          )
          .exhaustive()
      } catch (e) {
        consola.error(`${label}:`, e)
      }
    }
    consola.info('Summary:', counts)
  } finally {
    await shutdown()
  }
}
