import type { PullRequest } from '@prisma/client'
import { prisma } from '~/app/db.server'
export type { PullRequest } from '@prisma/client'

export function getPullRequestItems() {
  return prisma.pullRequest.findMany({
    orderBy: { pullRequestCreatedAt: 'desc' },
    take: 20
  })
}

interface MergeRequestSummary {
  author: string
  cnt: number
}
export function getPullRequestSummary() {
  return prisma.$queryRaw<MergeRequestSummary[]>`SELECT author, count(*) as cnt FROM mergerequest GROUP BY author`
}

export function getPullRequestItem(repositoryId: string, number: string) {
  return prisma.pullRequest.findUniqueOrThrow({
    where: {
      repositoryId_number: {
        repositoryId,
        number
      }
    }
  })
}

export function upsertPullRequest(pullRequest: PullRequest) {
  return prisma.pullRequest.upsert({
    where: {
      repositoryId_number: {
        repositoryId: pullRequest.repositoryId,
        number: pullRequest.number
      }
    },
    create: pullRequest,
    update: pullRequest
  })
}

export async function getPullRequestReport(companyId: string) {
  return prisma.pullRequest.findMany({
    where: {
      repository: {
        companyId
      }
    }
  })
}
