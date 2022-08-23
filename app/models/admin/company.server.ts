import { prisma } from '~/app/db.server'
export type { Company } from '@prisma/client'

export const getCompanies = async () => prisma.company.findMany({})

export const getCompany = async (companyId: string) =>
  prisma.company.findUnique({ where: { id: companyId }, include: { teams: true, integration: true, repositories: true, users: true } })

export const updateCompany = async (companyId: string, name: string) => prisma.company.update({ data: { name }, where: { id: companyId } })

export const createCompany = async (name: string) => prisma.company.create({ data: { name } })

export const deleteCompany = async (companyId: string) => prisma.company.delete({ where: { id: companyId } })
