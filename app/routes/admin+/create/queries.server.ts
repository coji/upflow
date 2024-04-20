import { db, type DB } from '~/app/services/db.server'

export const createCompany = async ({
  companyId,
  companyName,
  teamId,
  teamName,
}: {
  companyId: DB.Company['id']
  companyName: DB.Company['name']
  teamId: DB.Team['id']
  teamName: DB.Team['name']
}) => {
  return await db.transaction().execute(async (tsx) => {
    const company = await tsx
      .insertInto('companies')
      .values({
        id: companyId,
        name: companyName,
        updatedAt: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const team = await tsx
      .insertInto('teams')
      .values({
        companyId: companyId,
        id: teamId,
        name: teamName,
        updatedAt: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return company
  })
}
