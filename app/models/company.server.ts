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
      integration: true,
      repositories: true,
      users: true
    }
  })

export const getCompany = async (companyId: string) =>
  prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { teams: true, integration: true, repositories: true } })

export const updateCompany = async (companyId: string, name: string) => prisma.company.update({ data: { name }, where: { id: companyId } })
