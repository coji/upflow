import {
  excludeBots,
  excludePrTitleFilters,
} from '~/app/libs/tenant-query.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

import type { OpenPRInventoryRawRow } from './aggregate'

export const getOpenPRInventoryRawData = (
  organizationId: OrganizationId,
  sinceDate: string,
  now: string,
  teamId?: string | null,
  excludeBotAuthors = true,
  normalizedPatterns: readonly string[] = [],
): Promise<OpenPRInventoryRawRow[]> => {
  const tenantDb = getTenantDb(organizationId)

  return tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('pullRequests.pullRequestCreatedAt', '<=', now)
    .where(({ or, eb }) =>
      or([
        eb('pullRequests.mergedAt', 'is', null),
        eb('pullRequests.mergedAt', '>=', sinceDate),
      ]),
    )
    .where(({ or, eb }) =>
      or([
        eb('pullRequests.closedAt', 'is', null),
        eb('pullRequests.closedAt', '>=', sinceDate),
      ]),
    )
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .$if(excludeBotAuthors, (qb) =>
      qb
        .leftJoin('companyGithubUsers', (join) =>
          join.onRef(
            (eb) => eb.fn('lower', ['pullRequests.author']),
            '=',
            (eb) => eb.fn('lower', ['companyGithubUsers.login']),
          ),
        )
        .where(excludeBots),
    )
    .where(excludePrTitleFilters(normalizedPatterns))
    .select([
      'pullRequests.repositoryId',
      'pullRequests.number',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.mergedAt',
      'pullRequests.closedAt',
      'pullRequests.firstReviewedAt',
    ])
    .execute()
}

export const countOpenPRInventory = async (
  organizationId: OrganizationId,
  sinceDate: string,
  now: string,
  teamId?: string | null,
  excludeBotAuthors = true,
  normalizedPatterns: readonly string[] = [],
): Promise<number> => {
  const tenantDb = getTenantDb(organizationId)
  const row = await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('pullRequests.pullRequestCreatedAt', '<=', now)
    .where(({ or, eb }) =>
      or([
        eb('pullRequests.mergedAt', 'is', null),
        eb('pullRequests.mergedAt', '>=', sinceDate),
      ]),
    )
    .where(({ or, eb }) =>
      or([
        eb('pullRequests.closedAt', 'is', null),
        eb('pullRequests.closedAt', '>=', sinceDate),
      ]),
    )
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .$if(excludeBotAuthors, (qb) =>
      qb
        .leftJoin('companyGithubUsers', (join) =>
          join.onRef(
            (eb) => eb.fn('lower', ['pullRequests.author']),
            '=',
            (eb) => eb.fn('lower', ['companyGithubUsers.login']),
          ),
        )
        .where(excludeBots),
    )
    .where(excludePrTitleFilters(normalizedPatterns))
    .select((eb) => eb.fn.countAll<number>().as('cnt'))
    .executeTakeFirstOrThrow()
  return Number(row.cnt)
}
