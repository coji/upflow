import { prisma } from '~/app/db.server'
import type { MergeRequest } from '@prisma/client'
export type { MergeRequest } from '@prisma/client'

export function getMergeRequestItems() {
  return prisma.mergeRequest.findMany({
    orderBy: { mergerequest_created_at: 'desc' },
    take: 10
  })
}

interface MergeRequestSummary {
  author: string
  cnt: number
}
export function getMergeRequestSummary() {
  return prisma.$queryRaw<MergeRequestSummary[]>`SELECT author, count(*) as cnt FROM mergerequest GROUP BY author`
}

export function getMergeRequestItem(id: string) {
  return prisma.mergeRequest.findUniqueOrThrow({ where: { id } })
}

export function upsertMergeRequest(mergeRequest: MergeRequest) {
  return prisma.mergeRequest.upsert({
    where: { id: mergeRequest.id },
    create: mergeRequest,
    update: mergeRequest
  })
}

export function deleteMergeRequest({ id }: Pick<MergeRequest, 'id'>) {
  return prisma.mergeRequest.delete({
    where: { id }
  })
}
