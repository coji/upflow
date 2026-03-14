import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getUserProfile = async (
  organizationId: OrganizationId,
  login: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  const user = await tenantDb
    .selectFrom('companyGithubUsers')
    .where((eb) =>
      eb(
        eb.fn('lower', ['companyGithubUsers.login']),
        '=',
        login.toLowerCase(),
      ),
    )
    .select(['login', 'displayName'])
    .executeTakeFirst()
  return user ?? { login, displayName: login }
}

export const getCreatedPRs = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('pullRequestCreatedAt', '>=', from)
    .where('pullRequestCreatedAt', '<=', to)
    .select([
      'number',
      'repositoryId',
      'repo',
      'title',
      'url',
      'pullRequestCreatedAt',
      'complexity',
    ])
    .orderBy('pullRequestCreatedAt', 'asc')
    .execute()
}

export const getMergedPRs = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('mergedAt', '>=', from)
    .where('mergedAt', '<=', to)
    .select([
      'number',
      'repositoryId',
      'repo',
      'title',
      'url',
      'mergedAt',
      'pullRequestCreatedAt',
      'complexity',
      'totalTime',
    ])
    .orderBy('mergedAt', 'asc')
    .execute()
}

export const getReviewsSubmitted = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequestReviews')
    .innerJoin('pullRequests', (join) =>
      join
        .onRef(
          'pullRequestReviews.pullRequestNumber',
          '=',
          'pullRequests.number',
        )
        .onRef(
          'pullRequestReviews.repositoryId',
          '=',
          'pullRequests.repositoryId',
        ),
    )
    .where((eb) =>
      eb(
        eb.fn('lower', ['pullRequestReviews.reviewer']),
        '=',
        login.toLowerCase(),
      ),
    )
    .where('pullRequestReviews.submittedAt', '>=', from)
    .where('pullRequestReviews.submittedAt', '<=', to)
    .select([
      'pullRequestReviews.pullRequestNumber as number',
      'pullRequestReviews.repositoryId',
      'pullRequestReviews.state',
      'pullRequestReviews.submittedAt',
      'pullRequests.repo',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.author',
      'pullRequests.complexity',
    ])
    .orderBy('pullRequestReviews.submittedAt', 'asc')
    .execute()
}

export const getBacklogDetails = async (
  organizationId: OrganizationId,
  login: string,
) => {
  const tenantDb = getTenantDb(organizationId)

  const openPRsRaw = await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('mergedAt', 'is', null)
    .where('closedAt', 'is', null)
    .select([
      'number',
      'repositoryId',
      'repo',
      'title',
      'url',
      'pullRequestCreatedAt',
      'complexity',
    ])
    .orderBy('pullRequestCreatedAt', 'asc')
    .execute()

  // Check which open PRs have reviewers assigned
  const reviewerSet = new Set<string>()
  const reviewerRows = await tenantDb
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
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .where('pullRequestReviewers.requestedAt', 'is not', null)
    .select([
      'pullRequestReviewers.pullRequestNumber as number',
      'pullRequestReviewers.repositoryId',
    ])
    .execute()
  for (const r of reviewerRows) {
    reviewerSet.add(`${r.repositoryId}:${r.number}`)
  }

  const openPRs = openPRsRaw.map((pr) => ({
    ...pr,
    hasReviewer: reviewerSet.has(`${pr.repositoryId}:${pr.number}`),
  }))

  const pendingReviews = await tenantDb
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
    .where((eb) =>
      eb(
        eb.fn('lower', ['pullRequestReviewers.reviewer']),
        '=',
        login.toLowerCase(),
      ),
    )
    .where('pullRequestReviewers.requestedAt', 'is not', null)
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .select([
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.repo',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.complexity',
      'pullRequests.author',
    ])
    .orderBy('pullRequests.pullRequestCreatedAt', 'asc')
    .execute()

  return { openPRs, pendingReviews }
}
