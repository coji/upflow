import type { FilterCountStats } from '~/app/libs/pr-title-filter.server'
import {
  excludeBots,
  excludePrTitleFilters,
  filteredPullRequestCount,
} from '~/app/libs/tenant-query.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * オープンPRの基本情報（Team Stacks の Author 側用）。
 * レビュー状態は getOpenPullRequestReviews / getPendingReviewAssignments を
 * 集約層で合流させて分類する。
 */
export const getOpenPullRequests = async (
  organizationId: OrganizationId,
  teamId?: string | null,
  normalizedPatterns: readonly string[] = [],
  hideDrafts = false,
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
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .where(excludePrTitleFilters(normalizedPatterns))
    .$if(hideDrafts, (qb) => qb.where('pullRequests.isDraft', '=', 0))
    .select([
      'pullRequests.author',
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.repo',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.complexity',
      'pullRequests.isDraft',
      'companyGithubUsers.displayName as authorDisplayName',
    ])
    .execute()
}

/**
 * Review Stacks バナー用に、open PR の unfiltered / filtered 件数 (author ビュー基準)
 * を 1 クエリで返す。SUM(CASE WHEN ...) で filtered 側を同一 scan で集計することで
 * 2 回 count を避ける。
 */
export const countOpenPullRequests = async (
  organizationId: OrganizationId,
  teamId?: string | null,
  normalizedPatterns: readonly string[] = [],
  hideDrafts = false,
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
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .$if(hideDrafts, (qb) => qb.where('pullRequests.isDraft', '=', 0))
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

/**
 * hideDrafts バナー用に、タイトルフィルター適用後の open PR のうち Draft の件数を返す。
 * Draft 除外とタイトル除外の二重カウントを避けるため、title filter 適用後の集合で数える。
 */
export const countHiddenDrafts = async (
  organizationId: OrganizationId,
  teamId?: string | null,
  normalizedPatterns: readonly string[] = [],
): Promise<number> => {
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
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .where(excludePrTitleFilters(normalizedPatterns))
    .where('pullRequests.isDraft', '=', 1)
    .select((eb) => [eb.fn.countAll<number>().as('draftCount')])
    .executeTakeFirstOrThrow()
  return Number(row.draftCount)
}

/**
 * オープンPRに対する現在のレビュー割り当て（Team Stacks の Reviewer 側用）
 */
export const getPendingReviewAssignments = async (
  organizationId: OrganizationId,
  teamId?: string | null,
  normalizedPatterns: readonly string[] = [],
  hideDrafts = false,
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
    .where(excludeBots)
    .where(excludePrTitleFilters(normalizedPatterns))
    .$if(hideDrafts, (qb) => qb.where('pullRequests.isDraft', '=', 0))
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
      'pullRequests.isDraft',
      'companyGithubUsers.displayName as reviewerDisplayName',
    ])
    .execute()
}

/**
 * オープンPRに対して実際に提出されたレビュー履歴（Bot の reviewer は除外）。
 * Popover で reviewer ごとの state を表示するのと、バケット分類の両方で使う。
 */
export const getOpenPullRequestReviews = async (
  organizationId: OrganizationId,
  teamId?: string | null,
  normalizedPatterns: readonly string[] = [],
  hideDrafts = false,
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
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequestReviews.reviewer']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.mergedAt', 'is', null)
    .where('pullRequests.closedAt', 'is', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .where(excludePrTitleFilters(normalizedPatterns))
    .$if(hideDrafts, (qb) => qb.where('pullRequests.isDraft', '=', 0))
    .select([
      'pullRequestReviews.pullRequestNumber as number',
      'pullRequestReviews.repositoryId',
      'pullRequestReviews.reviewer',
      'pullRequestReviews.state',
      'pullRequestReviews.submittedAt',
      'companyGithubUsers.displayName as reviewerDisplayName',
    ])
    .execute()
}
