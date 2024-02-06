import { prisma } from '~/app/services/db.server'

export const listCompanyUsers = async (companyId: string) => {
  return await prisma.companyUser.findMany({
    where: { companyId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
}
