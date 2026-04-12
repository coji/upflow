import consola from 'consola'
import { getErrorMessage } from '~/app/libs/error-message'
import { db } from '~/app/services/db.server'
import {
  initializeMembershipsForInstallation,
  upsertRepositoryMembership,
} from '~/app/services/github-app-membership.server'
import { fetchInstallationRepositories } from '~/app/services/github-installation-repos.server'
import { getActiveInstallationOptions } from '~/app/services/github-integration-queries.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { shutdown } from './shutdown'

interface BackfillInstallationMembershipCommandProps {
  organizationId?: string
  dryRun?: boolean
}

type OrgSummary = {
  organizationId: string
  organizationName: string
  status:
    | 'skipped_token_method'
    | 'skipped_no_active_link'
    | 'skipped_multi_link_unmapped'
    | 'backfilled_single_link'
  repositoryCount: number
  installationId?: number
  notes?: string
}

/**
 * One-shot operator migration that backfills `github_installation_id` and seeds
 * `repository_installation_memberships` for organizations whose GitHub App
 * mode has exactly one active installation. Idempotent (filters by
 * `github_installation_id IS NULL`).
 */
export async function backfillInstallationMembershipCommand(
  props: BackfillInstallationMembershipCommandProps,
) {
  try {
    let orgsQuery = db
      .selectFrom('organizations')
      .innerJoin(
        'integrations',
        'integrations.organizationId',
        'organizations.id',
      )
      .select([
        'organizations.id as organizationId',
        'organizations.name as organizationName',
        'integrations.method as method',
      ])
    if (props.organizationId) {
      orgsQuery = orgsQuery.where('organizations.id', '=', props.organizationId)
    }
    const orgs = await orgsQuery.execute()

    if (orgs.length === 0) {
      consola.warn('No matching organizations.')
      return
    }
    if (props.dryRun) {
      consola.info('Running in --dry-run mode (no writes will be made).')
    }
    consola.info(`Scanning ${orgs.length} organization(s)...`)

    const summaries: OrgSummary[] = []
    for (const org of orgs) {
      const orgId = org.organizationId as OrganizationId
      if (org.method === 'token') {
        summaries.push({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          status: 'skipped_token_method',
          repositoryCount: 0,
        })
        continue
      }
      if (org.method !== 'github_app') {
        summaries.push({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          status: 'skipped_token_method',
          repositoryCount: 0,
          notes: `Unknown integration method: ${org.method}`,
        })
        continue
      }

      const activeLinks = await getActiveInstallationOptions(orgId)

      if (activeLinks.length === 0) {
        summaries.push({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          status: 'skipped_no_active_link',
          repositoryCount: 0,
          notes:
            'Reinstall the GitHub App to enable strict installation lookup.',
        })
        continue
      }

      // Multi-link decision happens BEFORE we look at orphan rows: even if
      // there are no broken repos right now, the org still needs operator
      // attention (reassign-broken-repositories CLI) before strict lookup.
      if (activeLinks.length > 1) {
        const tenantDb = getTenantDb(orgId)
        const orphanCount = await tenantDb
          .selectFrom('repositories')
          .select((eb) => eb.fn.count<number>('id').as('count'))
          .where('githubInstallationId', 'is', null)
          .executeTakeFirstOrThrow()
        summaries.push({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          status: 'skipped_multi_link_unmapped',
          repositoryCount: Number(orphanCount.count),
          notes: `${activeLinks.length} active installations: ${activeLinks
            .map((l) => l.installationId)
            .join(', ')}. Use reassign-broken-repositories after this command.`,
        })
        continue
      }

      const installationId = activeLinks[0].installationId
      const tenantDb = getTenantDb(orgId)
      const orphans = await tenantDb
        .selectFrom('repositories')
        .select(['id', 'owner', 'repo'])
        .where('githubInstallationId', 'is', null)
        .execute()

      if (orphans.length > 0) {
        consola.info(
          `[${org.organizationName}] backfilling ${orphans.length} repositories to installation ${installationId}...`,
        )
      }

      if (!props.dryRun) {
        if (orphans.length > 0) {
          await tenantDb
            .updateTable('repositories')
            .set({ githubInstallationId: installationId })
            .where('githubInstallationId', 'is', null)
            .execute()
        }

        // Always (re-)seed the membership table for the single active
        // installation — the API is the source of truth, the upsert helpers
        // are idempotent, and we need to fix orgs where
        // `repository_installation_memberships` is empty even though
        // `github_installation_id` is already set (e.g. previous seed
        // failed). If the API call fails, fall back to upserting memberships
        // for every repository tied to this installation.
        try {
          const apiRepos = await fetchInstallationRepositories(installationId)
          await initializeMembershipsForInstallation({
            organizationId: orgId,
            installationId,
            repositories: apiRepos,
          })
        } catch (e) {
          consola.warn(
            `[${org.organizationName}] failed to seed membership table from API: ${getErrorMessage(e)}`,
          )
          const repos = await tenantDb
            .selectFrom('repositories')
            .select('id')
            .where('githubInstallationId', '=', installationId)
            .execute()
          for (const repo of repos) {
            await upsertRepositoryMembership({
              organizationId: orgId,
              installationId,
              repositoryId: repo.id,
            })
          }
        }
      }

      summaries.push({
        organizationId: org.organizationId,
        organizationName: org.organizationName,
        status: 'backfilled_single_link',
        repositoryCount: orphans.length,
        installationId,
        notes: orphans.length === 0 ? 'Memberships re-seeded.' : undefined,
      })
    }

    consola.box('Backfill summary')
    for (const s of summaries) {
      const tag = `[${s.status}]`
      const repos = s.repositoryCount > 0 ? ` ${s.repositoryCount} repos` : ''
      const inst = s.installationId ? ` (installation ${s.installationId})` : ''
      const line = `${tag} ${s.organizationName}${inst}${repos}`
      if (
        s.status === 'skipped_no_active_link' ||
        s.status === 'skipped_multi_link_unmapped'
      ) {
        consola.warn(line)
      } else if (s.status === 'backfilled_single_link') {
        consola.success(line)
      } else {
        consola.info(line)
      }
      if (s.notes) consola.info(`   ${s.notes}`)
    }
    const requiresAttention = summaries.filter(
      (s) =>
        s.status === 'skipped_no_active_link' ||
        s.status === 'skipped_multi_link_unmapped',
    )
    if (requiresAttention.length > 0) {
      consola.warn(
        `${requiresAttention.length} organization(s) require manual follow-up before strict lookup is enabled.`,
      )
    }
  } finally {
    await shutdown()
  }
}
