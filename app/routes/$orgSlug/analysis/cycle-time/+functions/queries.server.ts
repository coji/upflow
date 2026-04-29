import type { FilterCountStats } from '~/app/libs/pr-title-filter.server'
import {
  excludeBots,
  excludePrTitleFilters,
  filteredPullRequestCount,
} from '~/app/libs/tenant-query.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * Cycle time raw rows for released PRs in [sinceDate, untilDate).
 * `untilDate` を null にすると上限なしで取得する（current period 用）。
 */
export const getCycleTimeRawData = async (
  organizationId: OrganizationId,
  sinceDate: string,
  untilDate: string | null,
  teamId?: string | null,
  repositoryId?: string | null,
  normalizedPatterns: readonly string[] = [],
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
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
    .where('pullRequests.totalTime', 'is not', null)
    .where('pullRequests.releasedAt', '>=', sinceDate)
    .$if(untilDate !== null, (qb) =>
      qb.where('pullRequests.releasedAt', '<', untilDate as string),
    )
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .$if(repositoryId != null, (qb) =>
      qb.where('pullRequests.repositoryId', '=', repositoryId as string),
    )
    .where(excludeBots)
    .where(excludePrTitleFilters(normalizedPatterns))
    .select([
      'pullRequests.repositoryId',
      'pullRequests.repo',
      'pullRequests.number',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.author',
      'companyGithubUsers.displayName as authorDisplayName',
      'pullRequests.state',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.mergedAt',
      'pullRequests.releasedAt',
      'pullRequests.codingTime',
      'pullRequests.pickupTime',
      'pullRequests.reviewTime',
      'pullRequests.deployTime',
      'pullRequests.totalTime',
    ])
    .execute()
}

/**
 * バナー用 excludedCount 算出のため、cycle time 母集団の distinct PR 件数を 1 クエリで返す。
 */
export const countCycleTimePullRequests = async (
  organizationId: OrganizationId,
  sinceDate: string,
  teamId?: string | null,
  repositoryId?: string | null,
  normalizedPatterns: readonly string[] = [],
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
    .where('pullRequests.totalTime', 'is not', null)
    .where('pullRequests.releasedAt', '>=', sinceDate)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .$if(repositoryId != null, (qb) =>
      qb.where('pullRequests.repositoryId', '=', repositoryId as string),
    )
    .where(excludeBots)
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

export interface CycleTimeRepositoryOption {
  id: string
  owner: string
  repo: string
}

/**
 * Repository filter dropdown 用の repository 一覧。team filter があればそれで絞り込む。
 */
export const listCycleTimeRepositories = async (
  organizationId: OrganizationId,
  teamId?: string | null,
): Promise<CycleTimeRepositoryOption[]> => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('repositories')
    .$if(teamId != null, (qb) => qb.where('teamId', '=', teamId as string))
    .select(['id', 'owner', 'repo'])
    .orderBy('owner')
    .orderBy('repo')
    .execute()
}
