import type { PullRequest, Repository } from '@prisma/client'
import { prisma } from '~/app/services/db.server'

export const listPullRequests = async (repositoryId: Repository['id']) => {
  return await prisma.pullRequest.findMany({ where: { repositoryId }, orderBy: { number: 'desc' } })
}

export const getPullRequest = async (number: PullRequest['number']) => {
  return await prisma.pullRequest.findFirstOrThrow({ where: { number } })
}
