import { nanoid } from 'nanoid'
import { isReservedSlug } from '~/app/libs/auth.server'
import { db, type DB } from '~/app/services/db.server'

export const createOrganization = async ({
  organizationSlug,
  organizationName,
}: {
  organizationSlug: DB.Organizations['slug']
  organizationName: DB.Organizations['name']
}) => {
  if (isReservedSlug(organizationSlug)) {
    throw new Error(`"${organizationSlug}" is a reserved slug`)
  }

  return await db.transaction().execute(async (tsx) => {
    const organization = await tsx
      .insertInto('organizations')
      .values({
        id: nanoid(),
        name: organizationName,
        slug: organizationSlug,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return { organization }
  })
}
