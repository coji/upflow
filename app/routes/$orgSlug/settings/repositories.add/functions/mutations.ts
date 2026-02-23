import { nanoid } from 'nanoid'
import { db, sql, type DB, type Insertable } from '~/app/services/db.server'

export const addRepository = async (
  organizationId: DB.Organizations['id'],
  data: Pick<Insertable<DB.Repositories>, 'owner' | 'repo'>,
) => {
  const organizationSetting = await db
    .selectFrom('organizationSettings')
    .selectAll()
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()
  const integration = await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()

  return await db
    .insertInto('repositories')
    .values({
      id: nanoid(),
      organizationId,
      integrationId: integration.id,
      provider: integration.provider,
      owner: data.owner,
      repo: data.repo,
      releaseDetectionKey: organizationSetting.releaseDetectionKey,
      releaseDetectionMethod: organizationSetting.releaseDetectionMethod,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflict((cb) =>
      cb
        .columns(['organizationId', 'integrationId', 'owner', 'repo'])
        .doUpdateSet((eb) => ({
          owner: eb.ref('excluded.owner'),
          repo: eb.ref('excluded.repo'),
          releaseDetectionKey: eb.ref('excluded.releaseDetectionKey'),
          releaseDetectionMethod: eb.ref('excluded.releaseDetectionMethod'),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
    )
    .executeTakeFirst()
}
