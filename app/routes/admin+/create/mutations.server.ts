import { db, type DB } from '~/app/services/db.server'

export const createOrganization = async ({
  organizationId,
  organizationName,
}: {
  organizationId: DB.Organizations['id']
  organizationName: DB.Organizations['name']
}) => {
  return await db.transaction().execute(async (tsx) => {
    const organization = await tsx
      .insertInto('organizations')
      .values({
        id: organizationId,
        name: organizationName,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return { organization }
  })
}
