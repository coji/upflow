import { sql } from 'kysely'
import { calcPagination } from '~/app/libs/db-utils'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

const PR_SIZE_RANK: Record<string, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
}

interface ListFilteredFeedbacksArgs {
  organizationId: OrganizationId
  teamId?: string
  sinceDate: string
  currentPage: number
  pageSize: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
}

export const listFilteredFeedbacks = async ({
  organizationId,
  teamId,
  sinceDate,
  currentPage,
  pageSize,
  sortBy,
  sortOrder,
}: ListFilteredFeedbacksArgs) => {
  const tenantDb = getTenantDb(organizationId)

  let query = tenantDb
    .selectFrom('pullRequestFeedbacks')
    .innerJoin('pullRequests', (join) =>
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
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('teams', 'repositories.teamId', 'teams.id')
    .leftJoin(
      'companyGithubUsers',
      'pullRequestFeedbacks.feedbackByLogin',
      'companyGithubUsers.login',
    )
    .select([
      'pullRequestFeedbacks.pullRequestNumber',
      'pullRequestFeedbacks.repositoryId',
      'pullRequestFeedbacks.originalComplexity',
      'pullRequestFeedbacks.correctedComplexity',
      'pullRequestFeedbacks.reason',
      'pullRequestFeedbacks.feedbackBy',
      'pullRequestFeedbacks.feedbackByLogin',
      'pullRequestFeedbacks.updatedAt',
      'pullRequests.title as prTitle',
      'pullRequests.url as prUrl',
      'pullRequests.author as prAuthor',
      'repositories.owner as repoOwner',
      'repositories.repo as repoName',
      'teams.name as teamName',
      'companyGithubUsers.displayName as feedbackByDisplayName',
    ])

  query = query.where('pullRequestFeedbacks.updatedAt', '>=', sinceDate)

  if (teamId) {
    query = query.where('repositories.teamId', '=', teamId)
  }

  let countQuery = tenantDb
    .selectFrom('pullRequestFeedbacks')
    .innerJoin('pullRequests', (join) =>
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
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .select((eb) =>
      eb.fn.count<string>('pullRequestFeedbacks.pullRequestNumber').as('count'),
    )
    .where('pullRequestFeedbacks.updatedAt', '>=', sinceDate)

  if (teamId) {
    countQuery = countQuery.where('repositories.teamId', '=', teamId)
  }

  const sortFieldMap: Record<string, string> = {
    repository: 'repositories.repo',
    updatedAt: 'pullRequestFeedbacks.updatedAt',
  }
  const safeSortBy = sortFieldMap[sortBy ?? ''] ?? sortFieldMap.updatedAt

  const [rows, countResult] = await Promise.all([
    query
      .orderBy(sql.ref(safeSortBy), sortOrder)
      .limit(pageSize)
      .offset((currentPage - 1) * pageSize)
      .execute(),
    countQuery.executeTakeFirst(),
  ])

  return {
    data: rows,
    pagination: calcPagination(
      Number(countResult?.count ?? 0),
      currentPage,
      pageSize,
    ),
  }
}

export type FeedbackRow = Awaited<
  ReturnType<typeof listFilteredFeedbacks>
>['data'][number]

interface GetFeedbackSummaryArgs {
  organizationId: OrganizationId
  teamId?: string
  sinceDate: string
}

export const getFeedbackSummary = async ({
  organizationId,
  teamId,
  sinceDate,
}: GetFeedbackSummaryArgs) => {
  const tenantDb = getTenantDb(organizationId)

  let query = tenantDb
    .selectFrom('pullRequestFeedbacks')
    .innerJoin('pullRequests', (join) =>
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
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .select([
      'pullRequestFeedbacks.originalComplexity',
      'pullRequestFeedbacks.correctedComplexity',
      'repositories.owner as repoOwner',
      'repositories.repo as repoName',
    ])
    .where('pullRequestFeedbacks.updatedAt', '>=', sinceDate)

  if (teamId) {
    query = query.where('repositories.teamId', '=', teamId)
  }

  const rows = await query.execute()

  const totalCount = rows.length
  let upgrades = 0
  let downgrades = 0
  const patternCounts = new Map<string, number>()
  const repoCounts = new Map<string, number>()

  for (const row of rows) {
    const origRank = PR_SIZE_RANK[row.originalComplexity ?? ''] ?? -1
    const corrRank = PR_SIZE_RANK[row.correctedComplexity] ?? -1

    if (origRank >= 0 && corrRank >= 0) {
      if (corrRank > origRank) upgrades++
      else if (corrRank < origRank) downgrades++
    }

    if (row.originalComplexity) {
      const key = `${row.originalComplexity} → ${row.correctedComplexity}`
      patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1)
    }

    const repoKey = `${row.repoOwner}/${row.repoName}`
    repoCounts.set(repoKey, (repoCounts.get(repoKey) ?? 0) + 1)
  }

  let topPattern: { pattern: string; count: number } | null = null
  for (const [pattern, count] of patternCounts) {
    if (!topPattern || count > topPattern.count) {
      topPattern = { pattern, count }
    }
  }

  const topRepositories = [...repoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([repo, count]) => ({ repo, count }))

  return {
    totalCount,
    upgrades,
    downgrades,
    topPattern,
    topRepositories,
  }
}

export type FeedbackSummary = Awaited<ReturnType<typeof getFeedbackSummary>>
