import { pipe, sortBy } from 'remeda'
import { diffInDays } from '~/app/libs/business-hours'
import type { FilterCountStats } from '~/app/libs/pr-title-filter.server'
import type { PrType } from '~/app/libs/pr-type'
import {
  DEFAULT_ALLOWED_PR_TYPES,
  excludeBots,
  excludePrTitleFilters,
  filteredPullRequestCount,
  filterPrTypes,
} from '~/app/libs/tenant-query.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getDeployedPullRequestReport = async (
  organizationId: OrganizationId,
  fromDateTime: string | null,
  toDateTime: string | null,
  objective: number,
  teamId?: string | null,
  businessDaysOnly = true,
  normalizedPatterns: readonly string[] = [],
  prTypes: readonly PrType[] = DEFAULT_ALLOWED_PR_TYPES,
) => {
  const tenantDb = getTenantDb(organizationId)
  const pullrequests = await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.releasedAt', 'is not', null)
    .$if(fromDateTime !== null, (qb) =>
      qb.where('releasedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('releasedAt', '<=', toDateTime))
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .where(excludePrTitleFilters(normalizedPatterns))
    .where(filterPrTypes(prTypes))
    .leftJoin('pullRequestFeedbacks', (join) =>
      join
        .onRef(
          'pullRequestFeedbacks.pullRequestNumber',
          '=',
          'pullRequests.number',
        )
        .onRef(
          'pullRequestFeedbacks.repositoryId',
          '=',
          'pullRequests.repositoryId',
        ),
    )
    .select([
      'pullRequests.author',
      'pullRequests.repo',
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.firstCommittedAt',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.firstReviewedAt',
      'pullRequests.mergedAt',
      'pullRequests.releasedAt',
      'companyGithubUsers.displayName as authorDisplayName',
      'pullRequests.complexity',
      'pullRequests.complexityReason',
      'pullRequests.riskAreas',
      'pullRequestFeedbacks.correctedComplexity',
      'pullRequestFeedbacks.reason',
      'pullRequestFeedbacks.feedbackBy',
      'pullRequestFeedbacks.feedbackByLogin',
      'pullRequestFeedbacks.updatedAt as feedbackAt',
    ])
    .execute()

  return pipe(
    pullrequests.map((pr) => {
      const createAndDeployDiff = pr.releasedAt
        ? diffInDays(
            pr.firstCommittedAt ?? pr.pullRequestCreatedAt,
            pr.releasedAt,
            businessDaysOnly,
          )
        : null
      const deployTime =
        pr.mergedAt && pr.releasedAt
          ? diffInDays(pr.mergedAt, pr.releasedAt, businessDaysOnly)
          : null
      const achievement =
        createAndDeployDiff !== null ? createAndDeployDiff < objective : false
      return {
        ...pr,
        createAndDeployDiff,
        deployTime,
        achievement,
      }
    }),
    sortBy((pr) => (pr.createAndDeployDiff ? -pr.createAndDeployDiff : 0)),
  )
}

export const countDeployedPullRequests = async (
  organizationId: OrganizationId,
  fromDateTime: string | null,
  toDateTime: string | null,
  teamId?: string | null,
  normalizedPatterns: readonly string[] = [],
  prTypes: readonly PrType[] = DEFAULT_ALLOWED_PR_TYPES,
): Promise<FilterCountStats> => {
  const tenantDb = getTenantDb(organizationId)
  const row = await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.releasedAt', 'is not', null)
    .$if(fromDateTime !== null, (qb) =>
      qb.where('releasedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('releasedAt', '<=', toDateTime))
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .where(filterPrTypes(prTypes))
    .select((eb) => [
      eb.fn.countAll<number>().as('unfiltered'),
      filteredPullRequestCount(normalizedPatterns)(eb).as('filtered'),
    ])
    .executeTakeFirstOrThrow()
  return {
    unfiltered: Number(row.unfiltered),
    filtered: Number(row.filtered),
  }
}
