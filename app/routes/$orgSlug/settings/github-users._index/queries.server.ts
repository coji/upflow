import { sql, type SqlBool } from 'kysely'
import { calcPagination, escapeLike } from '~/app/libs/db-utils'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

interface ListFilteredGithubUsersArgs {
  organizationId: OrganizationId
  search: string
  isActive?: 0 | 1
  currentPage: number
  pageSize: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
}

export const listFilteredGithubUsers = async ({
  organizationId,
  search,
  isActive,
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
      'companyGithubUsers.type',
      'companyGithubUsers.isActive',
      'companyGithubUsers.createdAt',
    ])

  if (search) {
    const pattern = `%${escapeLike(search)}%`
    query = query.where((eb) =>
      eb.or([
        sql<SqlBool>`${sql.ref('companyGithubUsers.login')} LIKE ${pattern} ESCAPE '\\'`,
        sql<SqlBool>`${sql.ref('companyGithubUsers.displayName')} LIKE ${pattern} ESCAPE '\\'`,
      ]),
    )
  }

  if (isActive !== undefined) {
    query = query.where('companyGithubUsers.isActive', '=', isActive)
  }

  let countQuery = tenantDb
    .selectFrom('companyGithubUsers')
    .select((eb) => eb.fn.count<string>('companyGithubUsers.login').as('count'))

  if (search) {
    const pattern = `%${escapeLike(search)}%`
    countQuery = countQuery.where((eb) =>
      eb.or([
        sql<SqlBool>`${sql.ref('companyGithubUsers.login')} LIKE ${pattern} ESCAPE '\\'`,
        sql<SqlBool>`${sql.ref('companyGithubUsers.displayName')} LIKE ${pattern} ESCAPE '\\'`,
      ]),
    )
  }

  if (isActive !== undefined) {
    countQuery = countQuery.where('companyGithubUsers.isActive', '=', isActive)
  }

  const sortFieldMap: Record<string, string> = {
    login: 'companyGithubUsers.login',
    displayName: 'companyGithubUsers.displayName',
    type: 'companyGithubUsers.type',
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

  return {
    data: rows,
    pagination: calcPagination(
      Number(countResult?.count ?? 0),
      currentPage,
      pageSize,
    ),
  }
}

export type GithubUserRow = Awaited<
  ReturnType<typeof listFilteredGithubUsers>
>['data'][number]
