import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

const DEFAULT_TIMEZONE = 'Asia/Tokyo'

export async function getOrganizationTimezone(
  organizationId: OrganizationId,
): Promise<string> {
  const tenantDb = getTenantDb(organizationId)
  const row = await tenantDb
    .selectFrom('organizationSettings')
    .select('timezone')
    .executeTakeFirst()
  return row?.timezone ?? DEFAULT_TIMEZONE
}

export { DEFAULT_TIMEZONE }
