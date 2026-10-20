import type { PrType } from '~/app/libs/pr-type'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const countPullRequestsByType = async (
  organizationId: OrganizationId,
) => {
  const rows = await getTenantDb(organizationId)
    .selectFrom('pullRequests')
    .select((eb) => ['prType', eb.fn.countAll<number>().as('count')])
    .groupBy('prType')
    .execute()
  return rows.map((r) => ({
    prType: r.prType as PrType | null,
    count: Number(r.count),
  }))
}

/** 種別判定のシグナルが食い違った PR (規約外の命名、#429) */
export const listSignalConflictPullRequests = async (
  organizationId: OrganizationId,
  limit = 200,
) => {
  return await getTenantDb(organizationId)
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .select([
      'pullRequests.repositoryId',
      'pullRequests.number',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.sourceBranch',
      'pullRequests.targetBranch',
      'pullRequests.prType',
      'pullRequests.pullRequestCreatedAt',
      'repositories.owner',
      'repositories.repo',
    ])
    .where('pullRequests.prTypeWarning', '=', 'signal-conflict')
    .orderBy('pullRequests.pullRequestCreatedAt', 'desc')
    .limit(limit)
    .execute()
}
