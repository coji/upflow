import { db } from '~/app/services/db.server'

export const deleteTestUser = async (email: string) => {
  if (!email.endsWith('@example.com')) {
    throw new Error('All test emails should be end in @example.com')
  }

  await db.deleteFrom('users').where('email', '==', email).execute()
}
