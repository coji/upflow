import type { FilterCountStats } from '~/app/libs/pr-title-filter.server'
import {
  excludePrTitleFilters,
  filteredPullRequestCount,
} from '~/app/libs/tenant-query.server'
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
  return {
    login: user?.login ?? login,
    displayName: user?.displayName ?? user?.login ?? login,
  }
}

export const countCreatedPRs = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
  normalizedPatterns: readonly string[] = [],
): Promise<FilterCountStats> => {
  const tenantDb = getTenantDb(organizationId)
  const row = await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('pullRequestCreatedAt', '>=', from)
    .where('pullRequestCreatedAt', '<=', to)
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

export const getCreatedPRs = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
  normalizedPatterns: readonly string[] = [],
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('pullRequestCreatedAt', '>=', from)
    .where('pullRequestCreatedAt', '<=', to)
    .where(excludePrTitleFilters(normalizedPatterns))
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
  normalizedPatterns: readonly string[] = [],
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('mergedAt', '>=', from)
    .where('mergedAt', '<=', to)
    .where(excludePrTitleFilters(normalizedPatterns))
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

export const getClosedPRs = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
  normalizedPatterns: readonly string[] = [],
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where((eb) =>
      eb(eb.fn('lower', ['pullRequests.author']), '=', login.toLowerCase()),
    )
    .where('closedAt', '>=', from)
    .where('closedAt', '<=', to)
    .where('mergedAt', 'is', null)
    .where(excludePrTitleFilters(normalizedPatterns))
    .select([
      'number',
      'repositoryId',
      'repo',
      'title',
      'url',
      'closedAt',
      'pullRequestCreatedAt',
      'complexity',
    ])
    .orderBy('closedAt', 'asc')
    .execute()
}

// Returns all review submissions (including multiple rounds on the same PR).
// Each round is a distinct action for the "what did they do this week" view.
export const getReviewsSubmitted = async (
  organizationId: OrganizationId,
  login: string,
  from: string,
  to: string,
  normalizedPatterns: readonly string[] = [],
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
    .where(excludePrTitleFilters(normalizedPatterns))
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
      'pullRequests.pullRequestCreatedAt',
    ])
    .orderBy('pullRequestReviews.submittedAt', 'asc')
    .execute()
}

export const getBacklogDetails = async (
  organizationId: OrganizationId,
  login: string,
  normalizedPatterns: readonly string[] = [],
) => {
  const tenantDb = getTenantDb(organizationId)

  const loginLower = login.toLowerCase()

  const [openPRsRaw, reviewerRows, pendingReviews, reviewHistory] =
    await Promise.all([
      tenantDb
        .selectFrom('pullRequests')
        .where((eb) =>
          eb(eb.fn('lower', ['pullRequests.author']), '=', loginLower),
        )
        .where('mergedAt', 'is', null)
        .where('closedAt', 'is', null)
        .where(excludePrTitleFilters(normalizedPatterns))
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
        .execute(),

      tenantDb
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
          eb(eb.fn('lower', ['pullRequests.author']), '=', loginLower),
        )
        .where('pullRequests.mergedAt', 'is', null)
        .where('pullRequests.closedAt', 'is', null)
        .where('pullRequestReviewers.requestedAt', 'is not', null)
        .where(excludePrTitleFilters(normalizedPatterns))
        .leftJoin('companyGithubUsers', (join) =>
          join.onRef(
            (eb) => eb.fn('lower', ['pullRequestReviewers.reviewer']),
            '=',
            (eb) => eb.fn('lower', ['companyGithubUsers.login']),
          ),
        )
        .select([
          'pullRequestReviewers.pullRequestNumber as number',
          'pullRequestReviewers.repositoryId',
          'pullRequestReviewers.reviewer',
          'companyGithubUsers.displayName as reviewerDisplayName',
        ])
        .execute(),

      tenantDb
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
            loginLower,
          ),
        )
        .where('pullRequestReviewers.requestedAt', 'is not', null)
        .where('pullRequests.mergedAt', 'is', null)
        .where('pullRequests.closedAt', 'is', null)
        .where(excludePrTitleFilters(normalizedPatterns))
        .leftJoin('companyGithubUsers as authorUser', (join) =>
          join.onRef(
            (eb) => eb.fn('lower', ['pullRequests.author']),
            '=',
            (eb) => eb.fn('lower', ['authorUser.login']),
          ),
        )
        .select([
          'pullRequests.number',
          'pullRequests.repositoryId',
          'pullRequests.repo',
          'pullRequests.title',
          'pullRequests.url',
          'pullRequests.pullRequestCreatedAt',
          'pullRequests.complexity',
          'pullRequests.author',
          'authorUser.displayName as authorDisplayName',
        ])
        .orderBy('pullRequests.pullRequestCreatedAt', 'asc')
        .execute(),

      tenantDb
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
        .where('pullRequests.mergedAt', 'is', null)
        .where('pullRequests.closedAt', 'is', null)
        .where(excludePrTitleFilters(normalizedPatterns))
        .where((eb) =>
          eb.or([
            eb(eb.fn('lower', ['pullRequests.author']), '=', loginLower),
            eb.exists(
              eb
                .selectFrom('pullRequestReviewers')
                .whereRef(
                  'pullRequestReviewers.pullRequestNumber',
                  '=',
                  'pullRequests.number',
                )
                .whereRef(
                  'pullRequestReviewers.repositoryId',
                  '=',
                  'pullRequests.repositoryId',
                )
                .where((eb2) =>
                  eb2(
                    eb2.fn('lower', ['pullRequestReviewers.reviewer']),
                    '=',
                    loginLower,
                  ),
                )
                .select(eb.lit(1).as('v')),
            ),
          ]),
        )
        .leftJoin('companyGithubUsers', (join) =>
          join.onRef(
            (eb) => eb.fn('lower', ['pullRequestReviews.reviewer']),
            '=',
            (eb) => eb.fn('lower', ['companyGithubUsers.login']),
          ),
        )
        .select([
          'pullRequestReviews.pullRequestNumber as number',
          'pullRequestReviews.repositoryId',
          'pullRequestReviews.reviewer',
          'pullRequestReviews.state',
          'pullRequestReviews.submittedAt',
          'companyGithubUsers.displayName as reviewerDisplayName',
        ])
        .execute(),
    ])

  return { openPRs: openPRsRaw, pendingReviews, reviewHistory, reviewerRows }
}

export interface PRKey {
  repositoryId: string
  number: number
}

export const getPRPopoverEnrichment = async (
  organizationId: OrganizationId,
  prKeys: PRKey[],
) => {
  if (prKeys.length === 0) {
    return {
      authors: [] as {
        repositoryId: string
        number: number
        author: string
        authorDisplayName: string | null
      }[],
      reviewHistory: [] as {
        repositoryId: string
        number: number
        reviewer: string
        state: string
        submittedAt: string
        reviewerDisplayName: string | null
      }[],
      reviewerRows: [] as {
        repositoryId: string
        number: number
        reviewer: string
        reviewerDisplayName: string | null
      }[],
    }
  }
  const tenantDb = getTenantDb(organizationId)

  const [authors, reviewHistory, reviewerRows] = await Promise.all([
    tenantDb
      .selectFrom('pullRequests')
      .leftJoin('companyGithubUsers as authorUser', (join) =>
        join.onRef(
          (eb) => eb.fn('lower', ['pullRequests.author']),
          '=',
          (eb) => eb.fn('lower', ['authorUser.login']),
        ),
      )
      .where((eb) =>
        eb.or(
          prKeys.map((k) =>
            eb.and([
              eb('pullRequests.repositoryId', '=', k.repositoryId),
              eb('pullRequests.number', '=', k.number),
            ]),
          ),
        ),
      )
      .select([
        'pullRequests.repositoryId',
        'pullRequests.number',
        'pullRequests.author',
        'authorUser.displayName as authorDisplayName',
      ])
      .execute(),
    tenantDb
      .selectFrom('pullRequestReviews')
      .leftJoin('companyGithubUsers', (join) =>
        join.onRef(
          (eb) => eb.fn('lower', ['pullRequestReviews.reviewer']),
          '=',
          (eb) => eb.fn('lower', ['companyGithubUsers.login']),
        ),
      )
      .where((eb) =>
        eb.or(
          prKeys.map((k) =>
            eb.and([
              eb('pullRequestReviews.repositoryId', '=', k.repositoryId),
              eb('pullRequestReviews.pullRequestNumber', '=', k.number),
            ]),
          ),
        ),
      )
      .select([
        'pullRequestReviews.repositoryId',
        'pullRequestReviews.pullRequestNumber as number',
        'pullRequestReviews.reviewer',
        'pullRequestReviews.state',
        'pullRequestReviews.submittedAt',
        'companyGithubUsers.displayName as reviewerDisplayName',
      ])
      .execute(),
    tenantDb
      .selectFrom('pullRequestReviewers')
      .leftJoin('companyGithubUsers', (join) =>
        join.onRef(
          (eb) => eb.fn('lower', ['pullRequestReviewers.reviewer']),
          '=',
          (eb) => eb.fn('lower', ['companyGithubUsers.login']),
        ),
      )
      .where((eb) =>
        eb.or(
          prKeys.map((k) =>
            eb.and([
              eb('pullRequestReviewers.repositoryId', '=', k.repositoryId),
              eb('pullRequestReviewers.pullRequestNumber', '=', k.number),
            ]),
          ),
        ),
      )
      .where('pullRequestReviewers.requestedAt', 'is not', null)
      .select([
        'pullRequestReviewers.repositoryId',
        'pullRequestReviewers.pullRequestNumber as number',
        'pullRequestReviewers.reviewer',
        'companyGithubUsers.displayName as reviewerDisplayName',
      ])
      .execute(),
  ])

  return { authors, reviewHistory, reviewerRows }
}
