import { prisma } from '~/app/services/db.server'

export const listTeamUsers = async (teamId: string) => {
  return await prisma.teamUser.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
  })
}

export const addTeamUser = async (teamId: string, userId: string) => {
  return await prisma.teamUser.create({
    data: {
      teamId,
      userId,
      role: 'member',
    },
  })
}

export const removeTeamUser = async (teamId: string, userId: string) => {
  return await prisma.teamUser.delete({
    where: { teamId_userId: { teamId, userId } },
  })
}
