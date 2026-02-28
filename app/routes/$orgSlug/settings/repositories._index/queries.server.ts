import { sql } from 'kysely'
import { escapeLike } from '~/app/libs/db-utils'
import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

interface ListFilteredRepositoriesArgs {
  organizationId: OrganizationId
  repo: string
  teamId?: string
  currentPage: number
  pageSize: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
}

export const listFilteredRepositories = async ({
  organizationId,
  repo,
  teamId,
  currentPage,
  pageSize,
  sortBy,
  sortOrder,
}: ListFilteredRepositoriesArgs) => {
  const tenantDb = getTenantDb(organizationId)
  let query = tenantDb
    .selectFrom('repositories')
    .leftJoin('teams', 'repositories.teamId', 'teams.id')
    .selectAll('repositories')
    .select('teams.name as teamName')

  if (repo) {
    const pattern = `%${escapeLike(repo)}%`
    query = query.where((eb) =>
      eb.or([
        eb('repositories.owner', 'like', pattern),
        eb('repositories.repo', 'like', pattern),
      ]),
    )
  }

  if (teamId) {
    query = query.where('repositories.teamId', '=', teamId)
  }

  let countQuery = tenantDb
    .selectFrom('repositories')
    .select((eb) => eb.fn.count<string>('repositories.id').as('count'))

  if (repo) {
    const pattern = `%${escapeLike(repo)}%`
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('repositories.owner', 'like', pattern),
        eb('repositories.repo', 'like', pattern),
      ]),
    )
  }

  if (teamId) {
    countQuery = countQuery.where('teamId', '=', teamId)
  }

  const sortFieldMap: Record<string, string> = {
    repo: 'repositories.repo',
    owner: 'repositories.owner',
    teamName: 'teams.name',
    releaseDetectionMethod: 'repositories.releaseDetectionMethod',
    createdAt: 'repositories.createdAt',
  }
  const safeSortBy = sortFieldMap[sortBy ?? ''] ?? sortFieldMap.createdAt

  const [rows, countResult] = await Promise.all([
    query
      .orderBy(sql.ref(safeSortBy), sortOrder)
      .limit(pageSize)
      .offset((currentPage - 1) * pageSize)
      .execute(),
    countQuery.executeTakeFirst(),
  ])

  const totalItems = Number(countResult?.count ?? 0)
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const newCurrentPage = Math.min(currentPage, totalPages)

  return {
    data: rows,
    pagination: {
      currentPage: newCurrentPage,
      pageSize,
      totalPages,
      totalItems,
    },
  }
}

export type RepositoryRow = Awaited<
  ReturnType<typeof listFilteredRepositories>
>['data'][number]
