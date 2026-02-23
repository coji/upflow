import { sql } from 'kysely'
import { db } from '~/app/services/db.server'

interface ListFilteredMembersArgs {
  organizationId: string
  name: string
  filters: Record<string, string[]>
  currentPage: number
  pageSize: number
  sortBy?: string
  sortOrder: 'asc' | 'desc'
}

export const listFilteredMembers = async ({
  organizationId,
  name,
  filters,
  currentPage,
  pageSize,
  sortBy,
  sortOrder,
}: ListFilteredMembersArgs) => {
  let query = db
    .selectFrom('members')
    .innerJoin('users', 'users.id', 'members.userId')
    .select([
      'members.id',
      'users.name',
      'users.email',
      'users.image',
      'members.role',
      'members.createdAt',
    ])
    .where('members.organizationId', '=', organizationId)

  if (name) {
    query = query.where('users.name', 'like', `%${name}%`)
  }

  const roleValues = filters.role ?? []
  if (roleValues.length > 0) {
    query = query.where('members.role', 'in', roleValues)
  }

  let countQuery = db
    .selectFrom('members')
    .innerJoin('users', 'users.id', 'members.userId')
    .select((eb) => eb.fn.count<string>('members.id').as('count'))
    .where('members.organizationId', '=', organizationId)

  if (name) {
    countQuery = countQuery.where('users.name', 'like', `%${name}%`)
  }
  if (roleValues.length > 0) {
    countQuery = countQuery.where('members.role', 'in', roleValues)
  }

  const sortFieldMap: Record<string, string> = {
    name: 'users.name',
    email: 'users.email',
    role: 'members.role',
    createdAt: 'members.createdAt',
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

export type MemberRow = Awaited<
  ReturnType<typeof listFilteredMembers>
>['data'][number]
