import { sql } from 'kysely'
import { getTenantDb } from '~/app/services/tenant-db.server'

interface ListFilteredRepositoriesArgs {
  organizationId: string
  repo: string
  currentPage: number
  pageSize: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
}

export const listFilteredRepositories = async ({
  organizationId,
  repo,
  currentPage,
  pageSize,
  sortBy,
  sortOrder,
}: ListFilteredRepositoriesArgs) => {
  const tenantDb = getTenantDb(organizationId)
  let query = tenantDb.selectFrom('repositories').selectAll()

  if (repo) {
    query = query.where((eb) =>
      eb.or([
        eb('repositories.owner', 'like', `%${repo}%`),
        eb('repositories.repo', 'like', `%${repo}%`),
      ]),
    )
  }

  let countQuery = tenantDb
    .selectFrom('repositories')
    .select((eb) => eb.fn.count<string>('repositories.id').as('count'))

  if (repo) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('repositories.owner', 'like', `%${repo}%`),
        eb('repositories.repo', 'like', `%${repo}%`),
      ]),
    )
  }

  const sortFieldMap: Record<string, string> = {
    repo: 'repositories.repo',
    owner: 'repositories.owner',
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
