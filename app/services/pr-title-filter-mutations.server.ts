import { nanoid } from 'nanoid'
import { normalizePattern } from '~/app/libs/pr-title-filter'
import { clearOrgCache } from '~/app/services/cache.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * Every mutation ends with `clearOrgCache(organizationId)` so cached analysis
 * loaders reflect the new filter state immediately.
 */
export const createPrTitleFilter = async (
  organizationId: OrganizationId,
  input: { pattern: string; isEnabled?: boolean; userId: string },
): Promise<{ id: string }> => {
  const tenantDb = getTenantDb(organizationId)
  const id = nanoid()
  const now = new Date().toISOString()
  const normalized = normalizePattern(input.pattern)
  await tenantDb
    .insertInto('prTitleFilters')
    .values({
      id,
      pattern: input.pattern.trim(),
      normalizedPattern: normalized,
      isEnabled: input.isEnabled === false ? 0 : 1,
      createdBy: input.userId,
      updatedBy: input.userId,
      createdAt: now,
      updatedAt: now,
    })
    .execute()
  clearOrgCache(organizationId)
  return { id }
}

export const updatePrTitleFilter = async (
  organizationId: OrganizationId,
  id: string,
  input: { pattern?: string; isEnabled?: boolean; userId: string },
): Promise<void> => {
  const tenantDb = getTenantDb(organizationId)
  const now = new Date().toISOString()
  const values: Record<string, string | number> = {
    updatedBy: input.userId,
    updatedAt: now,
  }
  if (input.pattern !== undefined) {
    values.pattern = input.pattern.trim()
    values.normalizedPattern = normalizePattern(input.pattern)
  }
  if (input.isEnabled !== undefined) {
    values.isEnabled = input.isEnabled ? 1 : 0
  }
  await tenantDb
    .updateTable('prTitleFilters')
    .set(values)
    .where('id', '=', id)
    .execute()
  clearOrgCache(organizationId)
}

export const deletePrTitleFilter = async (
  organizationId: OrganizationId,
  id: string,
): Promise<void> => {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb.deleteFrom('prTitleFilters').where('id', '=', id).execute()
  clearOrgCache(organizationId)
}
