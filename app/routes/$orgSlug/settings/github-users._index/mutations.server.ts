import { db } from '~/app/services/db.server'

export const addGithubUser = async (params: {
  login: string
  displayName: string
  organizationId: string
}) => {
  await db
    .insertInto('companyGithubUsers')
    .values({
      login: params.login,
      displayName: params.displayName,
      organizationId: params.organizationId,
      updatedAt: new Date().toISOString(),
    })
    .execute()
}

export const updateGithubUser = async (params: {
  login: string
  organizationId: string
  displayName: string
  name: string | null
  email: string | null
}) => {
  await db
    .updateTable('companyGithubUsers')
    .set({
      displayName: params.displayName,
      name: params.name,
      email: params.email,
      updatedAt: new Date().toISOString(),
    })
    .where('login', '=', params.login)
    .where('organizationId', '=', params.organizationId)
    .execute()
}

export const deleteGithubUser = async (
  login: string,
  organizationId: string,
) => {
  await db
    .deleteFrom('companyGithubUsers')
    .where('login', '=', login)
    .where('organizationId', '=', organizationId)
    .execute()
}
