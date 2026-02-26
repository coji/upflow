import { nanoid } from 'nanoid'
import { isReservedSlug } from '~/app/libs/auth.server'
import { db, sql, type DB } from '~/app/services/db.server'
import {
  createTenantDb,
  deleteTenantDb,
  getTenantDb,
} from '~/app/services/tenant-db.server'

export const createOrganization = async ({
  organizationSlug,
  organizationName,
  creatorUserId,
}: {
  organizationSlug: DB.Organizations['slug']
  organizationName: DB.Organizations['name']
  creatorUserId: string
}) => {
  if (isReservedSlug(organizationSlug)) {
    throw new Error(`"${organizationSlug}" is a reserved slug`)
  }

  // 1. Create organization + member in shared DB
  const { organization } = await db.transaction().execute(async (tsx) => {
    const organization = await tsx
      .insertInto('organizations')
      .values({
        id: nanoid(),
        name: organizationName,
        slug: organizationSlug,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await tsx
      .insertInto('members')
      .values({
        id: nanoid(),
        organizationId: organization.id,
        userId: creatorUserId,
        role: 'owner',
        createdAt: new Date().toISOString(),
      })
      .execute()

    return { organization }
  })

  // 2. Create tenant DB file + apply migrations + default settings
  try {
    createTenantDb(organization.id)
    const tenantDb = getTenantDb(organization.id)
    await tenantDb
      .insertInto('organizationSettings')
      .values({
        id: nanoid(),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .execute()
  } catch (e) {
    // Rollback: delete the organization if tenant DB creation fails
    await db
      .deleteFrom('organizations')
      .where('id', '=', organization.id)
      .execute()
    deleteTenantDb(organization.id)
    throw e
  }

  return { organization }
}
