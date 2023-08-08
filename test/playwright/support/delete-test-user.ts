import { prisma } from '~/app/services/db.server'

export const deleteTestUser = async (email: string) => {
  if (!email) {
    throw new Error('email required for login')
  }
  if (!email.endsWith('@example.com')) {
    throw new Error('All test emails must end in @example.com')
  }

  await prisma.user.delete({ where: { email } })
}
