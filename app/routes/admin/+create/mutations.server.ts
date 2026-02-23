import { nanoid } from 'nanoid'
import { isReservedSlug } from '~/app/libs/auth.server'
import { db, type DB } from '~/app/services/db.server'

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

    await tsx
      .insertInto('organizationSettings')
      .values({
        id: nanoid(),
        organizationId: organization.id,
        updatedAt: new Date().toISOString(),
      })
      .execute()

    return { organization }
  })
}
