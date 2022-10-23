import { createUser } from '~/app/models/user.server'

export const createTestUser = async (email: string, password: string) => {
  if (!email) {
    throw new Error('email required for login')
  }
  if (!email.endsWith('@example.com')) {
    throw new Error('All test emails must end in @example.com')
  }

  await createUser(email, password)
}
