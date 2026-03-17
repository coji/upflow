import consola from 'consola'
import { classifyPullRequests } from '../usecases/classify-pull-requests'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

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
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId } = result

  try {
    const flags = [
      force ? 'force' : null,
      limit ? `limit=${limit}` : null,
    ].filter(Boolean)
    consola.info(
      `Classifying PRs for ${orgId}${flags.length ? ` (${flags.join(', ')})` : ''}`,
    )

    await classifyPullRequests(orgId, { force, limit })
  } finally {
    await shutdown()
  }
}
