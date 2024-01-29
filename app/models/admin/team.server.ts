import type { Company } from '@prisma/client'
import { prisma } from '~/app/services/db.server'

export const listTeams = async (companyId: Company['id']) => {
  return await prisma.team.findMany({
    where: { companyId },
    include: {
      _count: {
        select: {
          TeamRepository: true,
          teamUser: true,
        },
      },
    },
  })
}

export const getTeam = async (id: string) => {
  return await prisma.team.findUnique({
    where: { id },
  })
}
