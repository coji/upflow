import { sql } from 'kysely'
import { db } from '~/app/services/db.server'

interface ListFilteredGithubUsersArgs {
  organizationId: string
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
  let query = db
    .selectFrom('companyGithubUsers')
    .select([
      'companyGithubUsers.login',
      'companyGithubUsers.displayName',
      'companyGithubUsers.name',
      'companyGithubUsers.email',
      'companyGithubUsers.pictureUrl',
      'companyGithubUsers.createdAt',
    ])
    .where('companyGithubUsers.organizationId', '=', organizationId)

  if (search) {
    query = query.where((eb) =>
      eb.or([
        eb('companyGithubUsers.login', 'like', `%${search}%`),
        eb('companyGithubUsers.displayName', 'like', `%${search}%`),
        eb('companyGithubUsers.name', 'like', `%${search}%`),
      ]),
    )
  }

  let countQuery = db
    .selectFrom('companyGithubUsers')
    .select((eb) => eb.fn.count<string>('companyGithubUsers.login').as('count'))
    .where('companyGithubUsers.organizationId', '=', organizationId)

  if (search) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('companyGithubUsers.login', 'like', `%${search}%`),
        eb('companyGithubUsers.displayName', 'like', `%${search}%`),
        eb('companyGithubUsers.name', 'like', `%${search}%`),
      ]),
    )
  }

  const sortFieldMap: Record<string, string> = {
    login: 'companyGithubUsers.login',
    displayName: 'companyGithubUsers.displayName',
    name: 'companyGithubUsers.name',
    email: 'companyGithubUsers.email',
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
