import { nanoid } from 'nanoid'
import { db, sql, type DB, type Insertable } from '~/app/services/db.server'

export const addRepository = async (
  companyId: DB.Company['id'],
  data: Pick<Insertable<DB.Repository>, 'owner' | 'repo'>,
) => {
  const company = await db
    .selectFrom('companies')
    .selectAll()
    .where('id', '==', companyId)
    .executeTakeFirstOrThrow()
  const integration = await db
    .selectFrom('integrations')
    .selectAll()
    .where('companyId', '==', companyId)
    .executeTakeFirstOrThrow()

  return await db
    .insertInto('repositories')
    .values({
      id: nanoid(),
      companyId,
      integrationId: integration.id,
      provider: integration.provider,
      owner: data.owner,
      repo: data.repo,
      releaseDetectionKey: company.releaseDetectionKey,
      releaseDetectionMethod: company.releaseDetectionMethod,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflict((cb) =>
      cb
        .columns(['companyId', 'integrationId', 'owner', 'repo'])
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
