import { db } from '~/app/services/db.server'
import {
  listPrTitleFilters,
  type PrTitleFilterRow,
} from '~/app/services/pr-title-filter-queries.server'
import type { OrganizationId } from '~/app/types/organization'

export type PrTitleFilterWithUsers = PrTitleFilterRow & {
  createdByName: string | null
  updatedByName: string | null
}

/**
 * 一覧 + shared DB users lookup で created_by / updated_by を name に解決する。
 * 削除済み (shared DB から消えた) user は null で返し、UI 側で fallback 表示する。
 */
export const listPrTitleFiltersWithUsers = async (
  organizationId: OrganizationId,
): Promise<PrTitleFilterWithUsers[]> => {
  const filters = await listPrTitleFilters(organizationId)
  const userIds = Array.from(
    new Set(filters.flatMap((f) => [f.createdBy, f.updatedBy])),
  )
  if (userIds.length === 0) {
    return filters.map((f) => ({
      ...f,
      createdByName: null,
      updatedByName: null,
    }))
  }

  const userRows = await db
    .selectFrom('users')
    .select(['id', 'name'])
    .where('id', 'in', userIds)
    .execute()
  const userMap = new Map(userRows.map((u) => [u.id, u.name]))

  return filters.map((f) => ({
    ...f,
    createdByName: userMap.get(f.createdBy) ?? null,
    updatedByName: userMap.get(f.updatedBy) ?? null,
  }))
}
