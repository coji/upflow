import type { Company } from '@prisma/client'
import { prisma } from '~/app/services/db.server'
export type { Company } from '@prisma/client'

export const getCompanies = async () => prisma.company.findMany({})

export const getCompany = async (companyId: string) =>
  prisma.company.findUnique({
    where: { id: companyId },
    include: {
      teams: true,
      integration: true,
      repositories: { orderBy: { name: 'asc' } },
      users: { include: { user: true } },
      exportSetting: true,
    },
  })

export const updateCompany = async (companyId: string, company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => {
  return await prisma.company.update({
    data: company,
    where: { id: companyId },
  })
}

export const createCompany = async (name: string) => prisma.company.create({ data: { name } })

export const deleteCompany = async (companyId: string) => prisma.company.delete({ where: { id: companyId } })
