import { sql } from 'kysely'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * オープンPRタイムラインデータ（Team Stacks の Author 側用）
 * hasAnyReviewer: 一度でもレビュアーがアサインされたかどうか
 */
export const getOpenPullRequests = async (
  organizationId: OrganizationId,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  const rows = await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where((eb) =>
      eb.or([
        eb('companyGithubUsers.type', 'is', null),
        eb('companyGithubUsers.type', '!=', 'Bot'),
      ]),
    )
    .select([
      'pullRequests.author',
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.repo',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.complexity',
      'companyGithubUsers.displayName as authorDisplayName',
    ])
    .select(
      sql<number>`exists(
        select 1 from ${sql.ref('pullRequestReviewers')}
        where ${sql.ref('pullRequestReviewers.pullRequestNumber')} = ${sql.ref('pullRequests.number')}
        and ${sql.ref('pullRequestReviewers.repositoryId')} = ${sql.ref('pullRequests.repositoryId')}
      )`.as('hasAnyReviewer'),
    )
    .execute()

  return rows.map((row) => ({
    ...row,
    hasAnyReviewer: row.hasAnyReviewer === 1,
  }))
}

/**
 * オープンPRに対する現在のレビュー割り当て（Team Stacks の Reviewer 側用）
 */
export const getPendingReviewAssignments = async (
  organizationId: OrganizationId,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequestReviewers')
    .innerJoin('pullRequests', (join) =>
      join
        .onRef(
          'pullRequestReviewers.pullRequestNumber',
          '=',
          'pullRequests.number',
        )
        .onRef(
          'pullRequestReviewers.repositoryId',
          '=',
          'pullRequests.repositoryId',
        ),
    )
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequestReviewers.reviewer']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .where('pullRequestReviewers.requestedAt', 'is not', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .select([
      'pullRequestReviewers.reviewer',
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.repo',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.author',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.complexity',
      'companyGithubUsers.displayName as reviewerDisplayName',
    ])
    .execute()
}
