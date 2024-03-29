import { prisma } from '~/app/services/db.server'

export const listTeamRepository = async (teamId: string) => {
  return await prisma.teamRepository.findMany({
    where: { teamId },
    include: { repository: true },
    orderBy: { createdAt: 'desc' },
  })
}

export const addTeamRepository = async (
  teamId: string,
  repositoryId: string,
) => {
  return await prisma.teamRepository.create({
    data: {
      teamId,
      repositoryId,
    },
  })
}

export const removeTeamRepository = async (
  teamId: string,
  repositoryId: string,
) => {
  return await prisma.teamRepository.delete({
    where: { teamId_repositoryId: { teamId, repositoryId } },
  })
}
