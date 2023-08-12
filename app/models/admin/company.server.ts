import type { Company, Team } from '@prisma/client'
import { prisma } from '~/app/services/db.server'
export type { Company, Team } from '@prisma/client'

export const listCompanies = async () => {
  return prisma.company.findMany({
    select: {
      id: true,
      name: true,
      teams: { select: { id: true, name: true } },
    },
  })
}

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

export const createCompany = async ({
  companyId,
  companyName,
  teamId,
  teamName,
}: {
  companyId: Company['id']
  companyName: Company['name']
  teamId: Team['id']
  teamName: Team['name']
}) =>
  prisma.company.create({
    data: {
      id: companyId,
      name: companyName,
      teams: { create: [{ id: teamName, name: teamName }] },
    },
  })

export const deleteCompany = async (companyId: string) => prisma.company.delete({ where: { id: companyId } })
