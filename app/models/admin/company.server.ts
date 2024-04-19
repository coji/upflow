import { prisma } from '~/app/services/db.server'
export type { Company, Team } from '@prisma/client'

// export const getCompany = async (companyId: string) =>
//   prisma.company.findUnique({
//     where: { id: companyId },
//     include: {
//       teams: true,
//       integration: true,
//       repositories: { orderBy: { name: 'asc' } },
//       users: { include: { user: true } },
//       exportSetting: true,
//     },
//   })

export const deleteCompany = async (companyId: string) =>
  prisma.company.delete({ where: { id: companyId } })
