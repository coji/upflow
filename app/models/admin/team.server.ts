import type { Company, Prisma, Team } from '@prisma/client'
import { prisma } from '~/app/services/db.server'
export type { Team }

export const listCompanyTeams = async (companyId: Company['id']) => {
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

export const getTeam = async (id: Team['id']) => {
  return await prisma.team.findUnique({
    where: { id },
  })
}

export const addTeam = async (team: Prisma.TeamCreateInput) => {
  return await prisma.team.create({
    data: team,
  })
}

export const updateTeam = async (
  id: Team['id'],
  team: Prisma.TeamUpdateInput,
) => {
  return await prisma.team.update({
    where: { id },
    data: team,
  })
}

export const deleteTeam = async (id: Team['id']) => {
  return await prisma.team.delete({
    where: { id },
  })
}
