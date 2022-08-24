import { prisma } from '~/app/db.server'
import type { MergeRequest } from '@prisma/client'
export type { MergeRequest } from '@prisma/client'

export function getMergeRequestItems() {
  return prisma.mergeRequest.findMany({
    orderBy: { mergerequest_created_at: 'desc' },
    take: 20
  })
}

interface MergeRequestSummary {
  author: string
  cnt: number
}
export function getMergeRequestSummary() {
  return prisma.$queryRaw<MergeRequestSummary[]>`SELECT author, count(*) as cnt FROM mergerequest GROUP BY author`
}

export function getMergeRequestItem(repositoryId: string, id: string) {
  return prisma.mergeRequest.findUniqueOrThrow({
    where: {
      repositoryId_id: {
        repositoryId,
        id
      }
    }
  })
}

export function upsertMergeRequest(mergeRequest: MergeRequest) {
  return prisma.mergeRequest.upsert({
    where: {
      repositoryId_id: {
        repositoryId: mergeRequest.repositoryId,
        id: mergeRequest.id
      }
    },
    create: mergeRequest,
    update: mergeRequest
  })
}
