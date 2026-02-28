import { type SqlBool, sql } from 'kysely'
import { escapeLike } from '~/app/libs/db-utils'
import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/services/tenant-db.server'

interface ListFilteredMembersArgs {
  organizationId: OrganizationId
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
    const pattern = `%${escapeLike(name)}%`
    query = query.where(sql<SqlBool>`users.name LIKE ${pattern} ESCAPE '\\'`)
  }

  type Role = 'owner' | 'admin' | 'member'
  const validRoles: ReadonlySet<string> = new Set<Role>([
    'owner',
    'admin',
    'member',
  ])
  const roleValues = (filters.role ?? []).filter((r): r is Role =>
    validRoles.has(r),
  )
  if (roleValues.length > 0) {
    query = query.where('members.role', 'in', roleValues)
  }

  let countQuery = db
    .selectFrom('members')
    .innerJoin('users', 'users.id', 'members.userId')
    .select((eb) => eb.fn.count<string>('members.id').as('count'))
    .where('members.organizationId', '=', organizationId)

  if (name) {
    const pattern = `%${escapeLike(name)}%`
    countQuery = countQuery.where(
      sql<SqlBool>`users.name LIKE ${pattern} ESCAPE '\\'`,
    )
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
