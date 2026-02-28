import { sql } from 'kysely'
import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

interface ListFilteredGithubUsersArgs {
  organizationId: OrganizationId
  search: string
  currentPage: number
  pageSize: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
}

export const listFilteredGithubUsers = async ({
  organizationId,
  search,
  currentPage,
  pageSize,
  sortBy,
  sortOrder,
}: ListFilteredGithubUsersArgs) => {
  const tenantDb = getTenantDb(organizationId)

  let query = tenantDb
    .selectFrom('companyGithubUsers')
    .select([
      'companyGithubUsers.login',
      'companyGithubUsers.displayName',
      'companyGithubUsers.isActive',
      'companyGithubUsers.createdAt',
    ])

  if (search) {
    query = query.where((eb) =>
      eb.or([
        eb('companyGithubUsers.login', 'like', `%${search}%`),
        eb('companyGithubUsers.displayName', 'like', `%${search}%`),
      ]),
    )
  }

  let countQuery = tenantDb
    .selectFrom('companyGithubUsers')
    .select((eb) => eb.fn.count<string>('companyGithubUsers.login').as('count'))

  if (search) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('companyGithubUsers.login', 'like', `%${search}%`),
        eb('companyGithubUsers.displayName', 'like', `%${search}%`),
      ]),
    )
  }

  const sortFieldMap: Record<string, string> = {
    login: 'companyGithubUsers.login',
    displayName: 'companyGithubUsers.displayName',
    isActive: 'companyGithubUsers.isActive',
    createdAt: 'companyGithubUsers.createdAt',
  }
  const safeSortBy = sortFieldMap[sortBy ?? ''] ?? sortFieldMap.login

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

export type GithubUserRow = Awaited<
  ReturnType<typeof listFilteredGithubUsers>
>['data'][number]
