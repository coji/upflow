import { prisma } from '~/app/db.server'
export type { Company } from '@prisma/client'

export const getCompaniesByUser = async (userId: string) =>
  prisma.company.findMany({
    where: {
      users: {
        some: {
          userId
        }
      }
    },
    include: {
      teams: {
        include: {
          users: true
        }
      },
      integrations: {
        include: {
          repositories: true
        }
      },
      users: true
    }
  })
