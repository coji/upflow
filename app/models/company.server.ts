import { prisma } from '~/app/services/db.server'
export type { Company } from '@prisma/client'

export const getCompaniesByUser = async (userId: string) =>
  prisma.company.findMany({
    where: { users: { some: { userId } } },
    include: {
      teams: { include: { teamUser: { include: { user: true } } } },
      integration: true,
      repositories: true,
      users: true,
    },
  })
