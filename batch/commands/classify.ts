import consola from 'consola'
import type { OrganizationId } from '~/app/services/tenant-db.server'
import { allConfigs } from '../config'
import { classifyPullRequests } from '../usecases/classify-pull-requests'

interface ClassifyCommandProps {
  organizationId?: string
  force?: boolean
  limit?: number
}

export async function classifyCommand({
  organizationId,
  force,
  limit,
}: ClassifyCommandProps) {
  if (!organizationId) {
    consola.error('organization id required')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return
  }

  const orgId = organizationId as OrganizationId
  const flags = [
    force ? 'force' : null,
    limit ? `limit=${limit}` : null,
  ].filter(Boolean)
  consola.info(
    `Classifying PRs for ${orgId}${flags.length ? ` (${flags.join(', ')})` : ''}`,
  )

  await classifyPullRequests(orgId, { force, limit })
}
